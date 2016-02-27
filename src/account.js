var account = {};

account.USER_PHOTO_API_URL = 'https://outlook.office.com/api/v2.0/me/photo/$value';

account.getUserInfo = function(callback) {
    chrome.storage.local.get('tokens', function(storage) {
	var user = {};
	var tokens = storage['tokens'];
	if (tokens && tokens.user) {
	    user = tokens.user;
	}

	callback(user);
    });
};

account.getUserPhoto = function(callback) {
   chrome.storage.local.get('account_userPhotoDataUrl', function(storage) {
       if (chrome.runtime.lastError || !storage['account_userPhoto']) {
	   console.log('Failed to fectch cached user photo');
	   account._syncUserPhoto(callback);
	   return;
       }

       var data = storage['account_userPhotoDataUrl'];
       callback(data);
   });
};

account._syncUserPhoto = function(callback) {
    chrome.storage.local.get('tokens', function(storage) {
	if (chrome.runtime.lastError || !storage['tokens']) {
	    console.log('Error fetching cached tokens');
	    return;
	}

	var accessToken = storage['tokens'].access_token;
	
	// It seems that ajax doesn't process the binary data in response body properly
	// (http://www.henryalgus.com/reading-binary-files-using-jquery-ajax/) and the
	// solution in that post doesn't work in this code. So I have to switch to
	// XMLHttpRequest
	var request = new XMLHttpRequest();
	request.open('GET', account.USER_PHOTO_API_URL, true /*async*/);
	request.setRequestHeader('Authorization', 'Bearer ' + accessToken);
	request.responseType = 'arraybuffer';

	request.onload = function() {
	    if (this.status === 200) {
		var bytes = new Uint8Array(this.response);
		var binaryString = '';
		bytes.forEach(function(element, index, array) {
		    binaryString += String.fromCharCode(element);
		});

		var imageDataUrl = window.btoa(binaryString);
		chrome.storage.local.set({'account_userPhotoDataUrl': imageDataUrl}, function() {
		    callback(imageDataUrl);
		});
	    }
	};

	request.send();
    });
};

       

