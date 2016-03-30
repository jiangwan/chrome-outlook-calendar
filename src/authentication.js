/**
 * Provide oauth2 authentication functionality
 */
var authentication = {};

/**
 * Configuration for authentication
 * @type {Object}
 * @private
 */
authentication.config_ = {
    AUTH_ENDPOINT: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
    LOGOUT_URL: {
        consumers: 'https://login.live.com/logout.srf',
        organizations: 'https://login.microsoftonline.com/logout.srf'
    },
    CLIENT_ID: '0181f97d-6f49-4bad-9134-86cc2f3b014d',
    REDIRECT_URI: 'https://outlook-extension.azurewebsites.net/',
    SCOPES: 'openid email profile offline_access https://outlook.office.com/contacts.read https://outlook.office.com/Calendars.ReadWrite',
    RESPONSE_TYPE: 'id_token+token'
};

/**
 * Stop waiting for refresh tokens after the timeout and consider this attempt as a failure
 * @type {number}
 * @private
 */
authentication.REFRESH_TOKENS_TIMEOUT_ = 3000; // ms

/**
 * Prompt a login window which takes the user's credential
 * @param {function(string)} callback A callback called when an access token is available
 */
authentication.login = function (callback) {
    var idTokenNonce = authentication.guid_();
    var urlNavigate = authentication.getNavigateUrl_(true /*interactive*/, null /*hint*/)
        + '&nonce=' + idTokenNonce;

    chrome.tabs.create({'url': urlNavigate}, function (loginTab) {
        var onUpdatedHandler = function (tabId, changeInfo, tab) {
            if (tabId == loginTab.id &&
                tab.url.startsWith(authentication.config_.REDIRECT_URI)) {
                chrome.tabs.onUpdated.removeListener(onUpdatedHandler);

                var requestInfo = authentication.getRequestInfo_(tab.url);

                if (requestInfo) {
                    chrome.tabs.remove(tabId);
                    chrome.storage.local.set({tokens: requestInfo}, function () {
                        if (chrome.runtime.lastError) {
                            console.log(chrome.runtime.lastError.message);
                        }

                        if (callback) {
                            callback(requestInfo.access_token);
                        }
                    });
                }
            }
        };

        chrome.tabs.onUpdated.addListener(onUpdatedHandler);
        chrome.tabs.onRemoved.addListener(function onRemovedHandler(tabId) {
            if (tabId == loginTab.id) {
                chrome.tabs.onUpdated.removeListener(onUpdatedHandler);
                chrome.tabs.onRemoved.removeListener(onRemovedHandler);
            }
        });
    });
};

/**
 * Refresh authentication tokens. Retry several times if failed.
 * @param {function(string)} callback A callback called when an access token is available
 */
authentication.refreshTokens = function (callback) {
    chrome.storage.local.get('tokens', function (storage) {
        if (chrome.runtime.lastError || !storage['tokens'] || !storage['tokens'].user) {

            console.log('Error retrieving cached token info');
            callback(null);
            return;
        }

        var succeeded = false;
        var tokens = storage['tokens'];
        var email = tokens.user.preferred_username;
        var idTokenNonce = authentication.guid_();

        var urlNavigate = authentication.getNavigateUrl_(false /*interactive*/, email)
            + '&domain_hint=' + tokens.domain
            + '&nonce=' + idTokenNonce;

        // request refresh tokens in an iframe embedded in the background page
        var ifr = document.createElement('iframe');
        ifr.src = urlNavigate;
        ifr.style.display = 'none';

        var redirectListener = function (details) {
            if (details.redirectUrl.startsWith(authentication.config_.REDIRECT_URI)) {
                var requestInfo = authentication.getRequestInfo_(details.redirectUrl);

                if (requestInfo) {
                    succeeded = true;
                    chrome.storage.local.set({'tokens': requestInfo}, function () {
                        if (chrome.runtime.lastError) {
                            console.log(chrome.runtime.lastError.message);
                        }

                        callback(requestInfo.access_token);
                    });
                }
            }
        };

        window.setTimeout(function () {
            //chrome.webRequest.OnBeforeRedirect.removeListener(function(){});
            document.getElementsByTagName('body')[0].removeChild(ifr);

            if (!succeeded) {
                console.log('Refreshing access tokens: Timeout');
                callback(null);
            }
        }, authentication.REFRESH_TOKENS_TIMEOUT_);

        chrome.webRequest.onBeforeRedirect.addListener(
            redirectListener, {'urls': [urlNavigate]});
        document.getElementsByTagName('body')[0].appendChild(ifr);
    });

};

authentication.logout = function () {
    chrome.storage.local.get('tokens', function (storage) {
        if (chrome.runtime.lastError ||
            storage === undefined || !storage['tokens']) {
            return;
        }

        var logoutUrl = authentication.config_.LOGOUT_URL[storage['tokens'].domain];

        chrome.storage.local.remove('tokens', function () {
            $.ajax(logoutUrl);
        });
    });
};

/**
 * Retrieve cached access token
 * @param {function(string)} onSuccess A callback called when an access token is available
 */
authentication.getAccessToken = function (onSuccess) {
    chrome.storage.local.get('tokens', function (storage) {
        if (chrome.runtime.lastError) {
            console.log(chrome.runtime.lastError.message);
        }

        if (storage === undefined || !storage['tokens']) {
            chrome.storage.local.remove('tokens');
            chrome.runtime.sendMessage({
                'method': 'ui.authStatus.updated',
                'authorized': false
            });
        } else {
            var tokens = storage['tokens'];
            onSuccess(tokens.access_token, tokens.domain);
        }
    });
};

/**
 * Get access token, id token, and extract user information by decoding id token.
 * @param {string} redirect url
 * @returns {Object} access token, id token and related information
 * @private
 */
authentication.getRequestInfo_ = function (url) {
    var hash = authentication.getHash_(url);
    var parameters = authentication.deserialize_(hash);
    var requestInfo = null;

    var invalid = !parameters
        || parameters.error
        || !parameters.access_token;

    if (!invalid) {
        // todo: validate id_token
        var user = decode.getUser(parameters.id_token, authentication.config_.CLIENT_ID) || {};

        requestInfo = {
            access_token: parameters.access_token,
            expires_in: parameters.expires_in,
            id_token: parameters.id_token,
            user: user,
            domain: authentication.getDomainHintFromTid_(user.tid)
        };
    }

    return requestInfo;
};

/**
 * Get url for login
 * @param {bool} true for interactive auth mode, otherwise false
 * @param {string} login hint
 * @returns {string} login url
 * @private
 */
authentication.getNavigateUrl_ = function (interactive, hint) {
    var config = authentication.config_;
    var login_prompt = interactive ? 'login' : 'none';
    var login_hint = hint || '';

    var urlNavigate = config.AUTH_ENDPOINT + '?response_mode=fragment'
        + '&response_type=' + config.RESPONSE_TYPE
        + '&client_id=' + config.CLIENT_ID
        + '&redirect_uri=' + encodeURIComponent(config.REDIRECT_URI)
        + '&scope=' + encodeURIComponent(config.SCOPES)
        + '&prompt=' + login_prompt
        + '&login_hint=' + login_hint;

    return urlNavigate;
};

/**
 * Extract hash from url
 * @param {string} url
 * @returns {string}
 * @private
 */
authentication.getHash_ = function (url) {
    var hash = '';
    if (url.indexOf('#/') > -1) {
        hash = url.substring(url.indexOf('#/') + 2);
    } else if (url.indexOf('#') > -1) {
        hash = url.substring(url.indexOf('#') + 1);
    }

    return hash;
};

/**
 * Hash deserializer (from Microsoft adal.js v1.0.8)
 * @param {string} query
 * @returns {Object} deserialized hash
 * @private
 */
authentication.deserialize_ = function (query) {
    var match,
        pl = /\+/g,  // Regex for replacing addition symbol with a space
        search = /([^&=]+)=?([^&]*)/g,
        decode = function (s) {
            return decodeURIComponent(s.replace(pl, ' '));
        },
        obj = {};
    match = search.exec(query);
    while (match) {
        obj[decode(match[1])] = decode(match[2]);
        match = search.exec(query);
    }

    return obj;
};

/**
 * GUID generator (from Microsoft adal.js v1.0.8)
 * @returns {string} guid
 * @private
 */
authentication.guid_ = function () {
    // RFC4122: The version 4 UUID is meant for generating UUIDs from truly-random or
    // pseudo-random numbers.
    // The algorithm is as follows:
    //     Set the two most significant bits (bits 6 and 7) of the
    //        clock_seq_hi_and_reserved to zero and one, respectively.
    //     Set the four most significant bits (bits 12 through 15) of the
    //        time_hi_and_version field to the 4-bit version number from
    //        Section 4.1.3. Version4
    //     Set all the other bits to randomly (or pseudo-randomly) chosen
    //     values.
    // UUID                   = time-low "-" time-mid "-"time-high-and-version "-"clock-seq-reserved and low(2hexOctet)"-" node
    // time-low               = 4hexOctet
    // time-mid               = 2hexOctet
    // time-high-and-version  = 2hexOctet
    // clock-seq-and-reserved = hexOctet:
    // clock-seq-low          = hexOctet
    // node                   = 6hexOctet
    // Format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
    // y could be 1000, 1001, 1010, 1011 since most significant two bits needs to be 10
    // y values are 8, 9, A, B
    var guidHolder = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx';
    var hex = '0123456789abcdef';
    var r = 0;
    var guidResponse = "";
    for (var i = 0; i < 36; i++) {
        if (guidHolder[i] !== '-' && guidHolder[i] !== '4') {
            // each x and y needs to be random
            r = Math.random() * 16 | 0;
        }

        if (guidHolder[i] === 'x') {
            guidResponse += hex[r];
        } else if (guidHolder[i] === 'y') {
            // clock-seq-and-reserved first hex is filtered and remaining hex values are random
            r &= 0x3; // bit and with 0011 to set pos 2 to zero ?0??
            r |= 0x8; // set pos 3 to 1 as 1???
            guidResponse += hex[r];
        } else {
            guidResponse += guidHolder[i];
        }
    }

    return guidResponse;
};

/**
 * source: https://azure.microsoft.com/en-us/documentation/articles/active-directory-v2-protocols-implicit/
 * @param {string} tid
 * @returns {string} domain hint
 * @private
 */
authentication.getDomainHintFromTid_ = function (tid) {
    if (tid) {
        return tid == '9188040d-6c67-4c5b-b112-36a304b66dad' ? constants.DOMAIN.consumers : constants.DOMAIN.organizations;
    } else {
        return '';
    }
};
