/**
 * Provide oauth2 authentication functionality
 */
var authentication = {};


/** 
 * Load access token from local storage. If it doesn't exist, try to get one by refreshing token. 
 */
authentication.getAccessToken = function(callback) {
    chrome.storage.local.get('outlook_calendar_accessToken', function(storage) {
	if (chrome.runtime.lastError) {
	    console.log('Error retrieving access token from local storage: ' + chrome.runtime.lastError.message);
	}

	var accessToken = storage['outlook_calendar_accessToken'];
	if (accessToken) {
	    callback(accessToken);
	} else {
	    authentication.refreshAccessToken(callback);
	}
    });
};


/**
 * Refresh access token given a valid refresh token. If no refresh token or it is not valid,
 * a message is sent to ui to load logon page.
 */
authentication.refreshAccessToken = function(callback) {
    chrome.storage.local.get('outlook_calendar_refreshToken', function(storage) {
	if (chrome.runtime.lastError) {
	    console.log('Error loading refresh token from local storage: ' + chrome.runtime.lastError.message);
	};

	var refreshToken = storage['outlook_calendar_refreshToken'];
	if (!refreshToken) {
	    chrome.runtime.sendMessage({'method': 'ui.authStatus.updated', 'authorized': false});
	    return;
	}

	$.ajax(authentication.Url_.TokensRequestUrl, {
	    type: 'POST',
	    data: authentication.Url_.refreshAccessTokenRequestData(refreshToken),
	    dataType: 'json',
	})
	.done(function(data) {
	    var accessToken = data.access_token;
	    chrome.storage.local.set({'outlook_calendar_accessToken': accessToken}, function() {
		callback(accessToken);
	    });
	})
	.fail(function(response) {
	    console.log('Failed to refresh access token: ' + response.statusText);
	    chrome.runtime.sendMessage({'method': 'ui.logon.update', 'authorized': false});
	});
    });
};

/**
 * Retrieve an access token from provider in interactive mode
 */
authentication.getTokensFromServer = function(callback) {
    chrome.identity.launchWebAuthFlow(
	{'url': authentication.Url_.AuthCodeRequestUrl, 'interactive': true},
	function(redirect_url) {
	    if (chrome.runtime.lastError) {
		console.log('Unable to get redirect url from server: ' + chrome.runtime.lastError.message);
		return;
	    }

	    var authCode = authentication.parseUrlForAuthCode_(redirect_url);
	    $.ajax(authentication.Url_.TokensRequestUrl, {
		type: 'POST',
		data: authentication.Url_.getTokensRequestData(authCode),
		dataType: 'json',
	    })
	    .done(function(data) {
		var accessToken = data.access_token;
		var refreshToken = data.refresh_token;
		chrome.storage.local.set(
		    {'outlook_calendar_accessToken': accessToken, 'outlook_calendar_refreshToken': refreshToken}
		    , function() {
			if (chrome.runtime.lastError) {
			    console.log('Error storing access token to local storage: ' + chrome.runtime.lastError.message);
			}

			callback(accessToken);
		    });
	    })
	    .fail(function(response) {
		console.log('Failed to get tokens from server: ' + response.statusText);
	    });
	});
};


authentication.removeCachedTokens = function(callback) {
    chrome.storage.local.remove(['outlook_calendar_accessToken','outlook_calendar_refreshToken','calendar_list','calendar_allEvents'], function() {
	if (chrome.runtime.lastError) {
	    console.log('Error removing authentication tokens out of local storage: ' + chrome.runtime.lastError);
	    return;
	}

	if (callback) {
	    callback();
	}
    });
};


authentication.Url_ = (function() {
    const BASE_URL_ = 'https://login.microsoftonline.com/common/oauth2/v2.0/';
    const CLIENT_ID_ = '0181f97d-6f49-4bad-9134-86cc2f3b014d';
    const REDIRECT_URI_ =  'https://hdandfaejoeplicpcfdnepdofkoaejdp.chromiumapp.org/';
    const CLIENT_SECRET_ = 'faQWw8EctScLyFmcQDWWQkQ';
    const SCOPE_ = 'offline_access https://outlook.office.com/Calendars.ReadWrite';

    return {
	AuthCodeRequestUrl: BASE_URL_ + 'authorize?response_type=code'
	    + '&client_id=' + CLIENT_ID_ 
	    + '&redirect_uri=' + encodeURIComponent(REDIRECT_URI_)
	    + '&scope=' + encodeURIComponent(SCOPE_),

	TokensRequestUrl: BASE_URL_ + 'token',

	LogoutUrl: 'https://login.microsoftonline.com/logout.srf?client_id=' + CLIENT_ID_,

	getTokensRequestData: function(authCode) {
	    return 'grant_type=authorization_code' + '&code=' + authCode
		+ '&redirect_uri=' + encodeURIComponent(REDIRECT_URI_)
		+ '&client_id=' + CLIENT_ID_
	        + '&scope=' + encodeURIComponent('offline_access ' + SCOPE_)
		+ '&client_secret=' + CLIENT_SECRET_;
	},

	refreshAccessTokenRequestData: function(refreshToken) {
	    return 'grant_type=refresh_token' + '&refresh_token=' + refreshToken
		+ '&redirect_uri=' + encodeURIComponent(REDIRECT_URI_)
		+ '&client_id=' + CLIENT_ID_
		+ '&client_secret=' + CLIENT_SECRET_;
	}
    };
})();


authentication.parseUrlForAuthCode_ = function(redirect_url) {
    var regx = /[#\?]code=.+&?/;
    var urlSegment = redirect_url.match(regx)[0];

    if (urlSegment) {
	return urlSegment.split('=')[1];
    }

    return '';
};

