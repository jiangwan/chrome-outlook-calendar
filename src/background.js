var background = {};

/**
 * Initialize the event page script
 */
background.initialize = function() {
    background.addMessageListener_();
};


background.addMessageListener_ = function() {
    chrome.runtime.onMessage.addListener(function(message, sender, callback) {
	switch(message.method)  {
	    case 'authentication.accessToken.get':
	      authentication.getAccessToken(callback);
	      break;

	    case 'authentication.clear':
	      authentication.logout();
	      break;

	    case 'authentication.tokens.request':
	      authentication.login(function(accessToken) {
		  calendar.syncCalendarList();
		  if (callback) {
		      callback(accessToken);
		  }
	      });
	      break;

	    case 'calendar.calendarList.get':
	      calendar.syncCalendarList();
	      break;

	    case 'calendar.allEvents.get':
	      calendar.loadEvents(callback);
	      break;

	}

	return true;
    });
};


background.initialize();
