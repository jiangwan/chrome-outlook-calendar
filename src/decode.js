/**
 * Functions excerpted from Microsoft adal.js library that helps
 * decode id token to get user profile.
 */
var decode = {};

decode.getUser = function (encodedIdToken, clientId) {
    var user = null;
    var parsedJson = decode._extractIdToken(encodedIdToken);
    if (parsedJson && parsedJson.hasOwnProperty('aud')
       && parsedJson.aud.toLowerCase() === clientId.toLowerCase()) {
        user = parsedJson;
    }
    
    return user;
};

decode._extractIdToken = function (encodedIdToken) {
    // id token will be decoded to get the username
    var decodedToken = decode._decodeJwt(encodedIdToken);
    if (!decodedToken) {
        return null;
    }
    
    try {
        var base64IdToken = decodedToken.JWSPayload;
        var base64Decoded = decode._base64DecodeStringUrlSafe(base64IdToken);
        if (!base64Decoded) {
            console.log('The returned id_token could not be base64 url safe decoded.');
            return null;
        }
        
        // ECMA script has JSON built-in support
        return JSON.parse(base64Decoded);
    } catch (err) {
        console.log('The returned id_token could not be decoded', err);
    }
    
    return null;
};

decode._decodeJwt = function (jwtToken) {
    if (jwtToken === null) {
      return null;
    };

    var idTokenPartsRegex = /^([^\.\s]*)\.([^\.\s]+)\.([^\.\s]*)$/;
    
    var matches = idTokenPartsRegex.exec(jwtToken);
    if (!matches || matches.length < 4) {
        console.log('The returned id_token is not parseable.');
        return null;
    }
    
    var crackedToken = {
        header: matches[1],
        JWSPayload: matches[2],
        JWSSig: matches[3]
    };
    
    return crackedToken;
};

decode._base64DecodeStringUrlSafe = function (base64IdToken) {
    // html5 should support atob function for decoding
    base64IdToken = base64IdToken.replace(/-/g, '+').replace(/_/g, '/');
    if (window.atob) {
        return decodeURIComponent(escape(window.atob(base64IdToken))); // jshint ignore:line
    }
    else {
        return decodeURIComponent(escape(decode._decodeBase64IdToken(base64IdToken)));
    }
};

//Take https://cdnjs.cloudflare.com/ajax/libs/Base64/0.3.0/base64.js and https://en.wikipedia.org/wiki/Base64 as reference. 
decode._decodeBase64IdToken = function(base64IdToken) {
    var codes = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
    base64IdToken = String(base64IdToken).replace(/=+$/, '');

    var length = base64IdToken.length;
    if (length % 4 === 1) {
        throw new Error('The token to be decoded is not correctly encoded.');
    }
    
    var h1, h2, h3, h4, bits, c1, c2, c3, decoded = '';
    for (var i = 0; i < length; i += 4) {
        //Every 4 base64 encoded character will be converted to 3 byte string, which is 24 bits
        // then 6 bits per base64 encoded character
        h1 = codes.indexOf(base64IdToken.charAt(i));
        h2 = codes.indexOf(base64IdToken.charAt(i + 1));
        h3 = codes.indexOf(base64IdToken.charAt(i + 2));
        h4 = codes.indexOf(base64IdToken.charAt(i + 3));
        
        // For padding, if last two are '='
        if (i + 2 === length - 1) {
            bits = h1 << 18 | h2 << 12 | h3 << 6;
            c1 = bits >> 16 & 255;
            c2 = bits >> 8 & 255;
            decoded += String.fromCharCode(c1, c2);
            break;
        }
        // if last one is '='
        else if (i + 1 === length - 1) {
            bits = h1 << 18 | h2 << 12
            c1 = bits >> 16 & 255;
            decoded += String.fromCharCode(c1);
            break;
        }
        
        bits = h1 << 18 | h2 << 12 | h3 << 6 | h4;
        
        // then convert to 3 byte chars
        c1 = bits >> 16 & 255;
        c2 = bits >> 8 & 255;
        c3 = bits & 255;
        
        decoded += String.fromCharCode(c1, c2, c3);
    }
    
    return decoded;
};
