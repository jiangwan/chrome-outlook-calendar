/**
 * Script that supports browser actions.
 */
var browser_action = {};

browser_action.ANIMATION_DURATION_ = 100;

/**
 * Initialize the popup page
 */
browser_action.initialize = function() {
    browser_action.initializeUIContents_();
    browser_action.registerEventHandlers_();
    browser_action.addMessageListeners_();

    chrome.runtime.sendMessage({'method': 'authentication.accessToken.get'},
			       browser_action.refreshPage_);
};

browser_action.initializeUIContents_ = function() {
    // set default calendar link which should be updated
    // depending on user types once logged in
    $('#calendar_url').attr('href', constants.CALENDAR_CONSUMERS_URL);

    // localization
    $('.i18n').each(function() {
	var text = chrome.i18n.getMessage($(this).attr('id').toString()) || '';
	if ($(this).prop('tagName') == 'IMG') {
	    $(this).attr('title', text);
	} else {
	    $(this).text(text);
	}
    });

    moment.locale(chrome.i18n.getUILanguage());
};

browser_action.registerEventHandlers_ = function() {
    $(document).on('click', function(event) {
	// light dismiss any visible event details section
	$('.event-details:visible').slideUp(browser_action.ANIMATION_DURATION_);

	// light dismiss account page if visible
	if ($('#account_page').is(':visible') &&
	    !$(event.target).closest($('#account')).length &&
	    !$(event.target).closest($('#account_page')).length) {
	    $('#account_page').slideUp(browser_action.ANIMATION_DURATION_);
	    $('#content_blocker').hide();
	}
    });

    $('#signin_button').on('click', function() {
	chrome.runtime.sendMessage({'method': 'authentication.tokens.renew'});
    });

    $('#create_account').on('click', function() {
	chrome.tabs.create({'url': constants.CREATE_ACCOUNT_URL});
    });

    $('#sync_now').on('click', function() {
	if (!$(this).hasClass('spin')) {
	    chrome.runtime.sendMessage({'method': 'calendar.calendarList.get'});
	}
    });

    $('#account').on('click', function() {
	$('#account_page').slideToggle(browser_action.ANIMATION_DURATION_);
	$('#content_blocker').toggle();
    });

    $('#signout_button').on('click', function() {
	browser_action.logout_();
    });

    /** Option page is not yet available
    $('#settings').on('click', function() {
	chrome.tabs.create({'url': 'options.html'});
    });
    */
};

browser_action.addMessageListeners_ = function() {
    chrome.runtime.onMessage.addListener(function(message, sender, callback) {
	switch(message.method) {
	    case 'ui.authStatus.updated':
	      browser_action.refreshPage_(message.authorized);
	      break;

	    case 'ui.events.update':
	      chrome.runtime.sendMessage({'method': 'calendar.allEvents.get'},
					 browser_action.showCalendarEvents_);
	      browser_action.refreshStop_();
	      break;

	    case 'ui.refresh.start':
	      browser_action.refreshStart_();
	      break;

	    case 'ui.refresh.stop':
	      browser_action.refreshStop_();
	      break;
	}

	return true;
    });
};

browser_action.refreshPage_ = function(authenticated) {
	$('section').show();
	
    if (authenticated) {
	browser_action.showCalendarPage_();
	browser_action.showCalendarContents_();
    } else {
	browser_action.logout_();
    }
};

browser_action.showCalendarPage_ = function() {
    $('#account_page').hide();
    $('#content_blocker').hide();
    $('#error').hide();
    $('#logon').hide();

    $('#action_bar').show();
    $('#calendar_events').show();
};

browser_action.showCalendarContents_ = function() {
    chrome.runtime.sendMessage({'method': 'calendar.allEvents.get'}, browser_action.showCalendarEvents_);
    chrome.runtime.sendMessage({'method': 'account.user.get'}, browser_action.showAccountInfo_);
    chrome.runtime.sendMessage({'method': 'account.photo.get'}, browser_action.showAccountPhoto_);
};

browser_action.showLoginPage_ = function() {
    $('#action_bar').hide();
    $('#account_page').hide();
    $('#content_blocker').hide();
    $('#error').hide();
    $('#calendar_events').hide();

    $('#logon').show();
};

browser_action.logout_ = function() {
    chrome.runtime.sendMessage({'method': 'authentication.clear'});
    browser_action.showLoginPage_();
};

/**
 * Show all events in the next few days starting from today;
 * for a multi-day event, we display it in each day it occurs;
 */
browser_action.showCalendarEvents_ = function(data) {
    $('#calendar_events').empty();

    var events = data.events;
    var sortedIndices = data.indices;
    var today = util.getDateOfToday();
    var date = today.clone().add(-1,'day');

    $.each(sortedIndices, function(i, indicesOfDay) {
	date.add(1,'day');
	var hasEvents = indicesOfDay && indicesOfDay.length > 0;
	if (hasEvents || date.isSame(today,'day')) {
	    $('<div>').addClass('date-header')
		.text(date.format('dddd, MMMM D'))
		.appendTo($('#calendar_events'));

	    // Only show "no events" only for if there is no event today
	    if (!hasEvents) {
		$('<div>').addClass('event-preview')
		    .text(chrome.i18n.getMessage('no_events'))
		    .appendTo($('#calendar_events'));
	    }

	    $.each(indicesOfDay, function(j, index) {
		browser_action.createEventElement_(
		    events[index], date).appendTo($('#calendar_events'));
	    });
	}
    });
};

browser_action.createEventElement_ = function(event, currentDay) {
    var eventContainer = $('<div>').addClass('event-container');

    // create event preview and detals divs as children of event container box
    var eventPreview = $('<div>')
	.addClass('event-preview')
	.appendTo(eventContainer);
    var eventDetails = $('<div>').appendTo(eventContainer);

    // event preview: start time
    var localStartTime = '';
    var start = util.convertEventTimeFromUtcToLocal(
	event.isAllday,
	event.startTimeUTC);
    var treatedAsAllDay = event.isAllDay || start.isBefore(currentDay,'day');
    
    if (!treatedAsAllDay) {
	localStartTime = start.format('h:mma');

	$('<div>').addClass('preview-time')
	    .text(localStartTime)
	    .css({'background-color': util.getCalendarColor(event.color)}) // ToDo: use background color of the page if event color is  Auto
	    .appendTo(eventPreview);
    }
    
    // event preview: subject
    $('<div>').addClass('preview-subject')
	.text(event.subject)
	.css({'background-color': 
	      treatedAsAllDay ?
	      util.getCalendarColor(event.color) :
	      constants.DEFAULT_CALENDAR_COLOR})
	.appendTo(eventPreview);

    // lazy load event details
    eventPreview.on('click', function() {
	if (!eventDetails.hasClass('event-details')) {
	    eventDetails.addClass('event-details');

	    var backgroundColor = util.getCalendarColor(event.color);

	    $('<a>').attr({
		'href': event.url,
		'target': '_blank'
	    }).append($('<div>')
		      .addClass('event-details-subject')
		      .text(event.subject)
		      .css({'background-color': backgroundColor}))
	    .appendTo(eventDetails);

	    var timeRangeString = util.getTimeRangeString(
		moment.utc(event.startTimeUTC).local(),
		moment.utc(event.endTimeUTC).local(),
		event.isAllDay);

	    $('<div>').addClass('event-timeRange')
		.text(timeRangeString)
		.css({'background-color': backgroundColor})
		.appendTo(eventDetails);

	    if (event.location) {
		var locationDiv = $('<div>')
		    .addClass('event-location')
		    .appendTo(eventDetails);
		$('<div>')
		    .addClass('event-location-icon')
		    .append($('<img>')
			    .attr({'src': chrome.extension.getURL('icons/Location-Map-icon.png'),
				   'alt': 'Location'}))
		    .appendTo(locationDiv);
	   
		$('<div>').addClass('event-location-content')
		    .text(event.location)
		    .appendTo(locationDiv);
	    }

	    var organizerDiv = $('<div>')
		.addClass('event-organizer')
		.appendTo(eventDetails);
	    $('<div>').addClass('event-organizer-icon')
		.append($('<img>')
			.attr({'src': chrome.extension.getURL('icons/Contacts-64.png'),
			       'alt': 'Organizer'}))
		.appendTo(organizerDiv);

	    $('<div>').addClass('event-location-content')
		.text(event.organizer)
		.appendTo(organizerDiv);

	    $('<div>').addClass('event-body')
		.text(event.bodyPreview)
		.appendTo(eventDetails);
	}
    });

    eventContainer.on('click', function(event) {
	event.stopPropagation();

	if (!$(event.target).closest(eventDetails).length) {
	    var wasDetailsOpen = eventDetails.is(':visible');
	    $('.event-details:visible').slideUp(browser_action.ANIMATION_DURATION_);
	    if (!wasDetailsOpen) {
		eventDetails.slideDown(browser_action.ANIMATION_DURATION_);
	    }
	}
    });

    return eventContainer;
};

browser_action.showAccountInfo_ = function(user) {
    var name = user.name || '';
    var email = user.preferred_username || '';
    $('#account_displayName').text(name);
    $('#account_email').text(email);
};

browser_action.showAccountPhoto_ = function(imgDataUrl) {
    $('#account_photo').attr('src', imgDataUrl);
};

browser_action.refreshStart_ = function() {
    $('#sync_now').addClass('spin');
};

browser_action.refreshStop_ = function() {
    $('#sync_now').removeClass('spin');
};


/**
 * Initailize functionality when the popup page is loaded
 */
window.addEventListener('load', function() {
    browser_action.initialize();
}, false);
