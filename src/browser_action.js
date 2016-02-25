/**
 * Script that supports browser actions.
 */
var browserAction = {};

browserAction.CONSTANTS = {
    SLIDE_DELAY: 100
};

/**
 * Initialize the popup page
 */
browserAction.initialize = function() {
    browserAction.initializeUIContents_();
    browserAction.registerButtonClickHandlers_();
    browserAction.addMessageListener_();

    // this is only intended for first time loading when there is no cached token.
    chrome.runtime.sendMessage({'method': 'authentication.accessToken.get'}, browserAction.showOrHideLogonMessage_);
};

browserAction.initializeUIContents_ = function() {
    $('#calendar_url').attr('href', constants.CALENDAR_URL);
};

browserAction.registerButtonClickHandlers_ = function() {
    // light dimiss
    $(document).on('click', function(event) {
	$('.event-details:visible').slideUp(browserAction.CONSTANTS.SLIDE_DELAY);
    });

    $('#authorization_button').on('click', function() {
	chrome.runtime.sendMessage({'method': 'authentication.tokens.request'}, browserAction.showOrHideLogonMessage_);
    });

    $('#create_account').on('click', function() {
	chrome.tabs.create({'url': constants.CREATE_ACCOUNT_URL});
    });

    $('#sync_now').on('click', function() {
	if (!$(this).hasClass('spin')) {
	    browserAction.refreshStart_();
	    chrome.runtime.sendMessage({'method': 'calendar.calendarList.get'});
	}
    });

    $('#logout_button').on('click', function() {
	chrome.runtime.sendMessage({method: 'authentication.clear'});
	browserAction.showOrHideLogonMessage_(false /*authorized*/);
	$('#content-blocker').hide();
	$('#header-popup').hide();
	$('#error').hide();
	$('#calendar-events').hide();
    });

    $('#settings').on('click', function() {
	chrome.tabs.create({'url': 'options.html'});
    });
};

/**
 * Show all events in the next few days starting from today;
 * for a multi-day event, we display it in each day it occurs;
 */
browserAction.showCalendarEvents_ = function(data) {
    $('#calendar-events').empty();

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
		.appendTo($('#calendar-events'));

	    // Only show "no events" only for if there is no event today
	    if (!hasEvents) {
		$('<div>').addClass('event-preview')
		    .text(chrome.i18n.getMessage('no_events'))
		    .appendTo($('#calendar-events'));
	    }

	    $.each(indicesOfDay, function(j, index) {
		browserAction.createEventElement_(events[index], date).appendTo($('#calendar-events'));
	    });
	}
    });
};

browserAction.createEventElement_ = function(event, currentDay) {
    var eventContainer = $('<div>').addClass('event-container');

    // create event preview and detals divs as children of event container box
    var eventPreview = $('<div>').addClass('event-preview').appendTo(eventContainer);
    var eventDetails = $('<div>').appendTo(eventContainer);

    // event preview: start time
    var localStartTime = '';
    var start = util.convertEventTimeFromUtcToLocal(event.isAllday, event.startTimeUTC);
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
	.css({'background-color': treatedAsAllDay ? util.getCalendarColor(event.color) : '#ffffff'})
	.appendTo(eventPreview);

    // lazy load event details
    eventPreview.on('click', function() {
	if (!eventDetails.hasClass('event-details')) {
	    eventDetails.addClass('event-details');

	    var backgroundColor = util.getCalendarColor(event.color);

	    $('<div>').addClass('event-details-subject')
		.text(event.subject)
		.css({'background-color': backgroundColor})
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
		var locationDiv = $('<div>').addClass('event-location').appendTo(eventDetails);
		$('<div>').addClass('event-location-icon')
		    .append($('<img>')
			    .attr({'src': chrome.extension.getURL('icons/Location-Map-icon.png'), 'alt': 'Location'}))
		    .appendTo(locationDiv);
	   
		$('<div>').addClass('event-location-content')
		    .text(event.location)
		    .appendTo(locationDiv);
	    }

	    var organizerDiv = $('<div>').addClass('event-organizer').appendTo(eventDetails);
	    $('<div>').addClass('event-organizer-icon')
		.append($('<img>')
			.attr({'src': chrome.extension.getURL('icons/Contacts-64.png'), 'alt': 'Organizer'}))
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
	    $('.event-details:visible').slideUp(browserAction.CONSTANTS.SLIDE_DELAY);
	    if (!wasDetailsOpen) {
		eventDetails.slideDown(browserAction.CONSTANTS.SLIDE_DELAY);
	    }
	}
    });

    return eventContainer;
};

browserAction.showOrHideLogonMessage_ = function(authorized) {
    if (authorized) {
	$('#logon').hide();
	$('#action-bar').show();
	$('#calendar-events').show();

	chrome.runtime.sendMessage({'method': 'calendar.allEvents.get'}, browserAction.showCalendarEvents_);
    } else {
	$('#logon').show();
	$('#action-bar').hide();
	$('#calendar-events').hide();
    }
};

browserAction.refreshStart_ = function() {
    $('#sync_now').addClass('spin');
};

browserAction.refreshStop_ = function() {
    $('#sync_now').removeClass('spin');
};

browserAction.showErrorMessage_ = function(error) {
    $('#error').text(error);
    $('#error').show();
};

browserAction.hideErrorMessage_ = function() {
    $('#error').hide();
};

browserAction.addMessageListener_ = function() {
    chrome.runtime.onMessage.addListener(function(message, sender, callback) {
	switch(message.method) {
	    case 'ui.authStatus.updated':
	      browserAction.showOrHideLogonMessage_(message.authorized);
	      break;

	    case 'ui.events.update':
	      browserAction.refreshStop_();
	      browserAction.hideErrorMessage_();
	      chrome.runtime.sendMessage({'method': 'calendar.allEvents.get'}, browserAction.showCalendarEvents_);
	      break;

	    case 'ui.refresh.stop':
	      browserAction.refreshStop_();
	      break;

	    case 'ui.error.show':
	      browserAction.showErrorMessage_(message.error);
	      break;
	}

	return true;
    });
};


/**
 * Initailize functionality when the popup page is loaded
 */
window.addEventListener('load', function() {
    browserAction.initialize();
}, false);
