/**
 * Script that supports browser actions.
 */
var browserAction = {};


/**
 * Initialize the popup page
 */
browserAction.initialize = function() {
    browserAction.initializeUIContents_();
    browserAction.registerButtonClickHandlers_();
    browserAction.addMessageListener_();
    
    chrome.runtime.sendMessage({'method': 'authentication.accessToken.get'}, browserAction.showOrHideLogonMessage_);
};


browserAction.initializeUIContents_ = function() {
    $('#calendar_url').attr('href', constants.CALENDAR_URL);
};


browserAction.registerButtonClickHandlers_ = function() {
    $('#authorization_button').on('click', function() {
	$('#logon-progressBar').show();
	chrome.runtime.sendMessage({'method': 'authentication.tokens.request'}, browserAction.showOrHideLogonMessage_);
    });

    $('#sync_now').on('click', function() {
	if (!$(this).hasClass('spin')) {
	    browserAction.refreshStart_();
	    chrome.runtime.sendMessage({'method': 'calendar.calendarList.get'});
	}
    });

    $('#sign_out').on('click', function() {
	chrome.runtime.sendMessage({'method': 'authentication.clear'}, function() {
	    browserAction.hideErrorMessage_();
	    browserAction.showOrHideLogonMessage_(false/*authorized*/);
	});
    });

    $('#settings').on('click', function() {
	chrome.tabs.create({'url': 'options.html'});
    });
};


browserAction.promptForLogonIfNotAuthenticated_ = function() {
    
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
    var eventContainer = $('<div>');

    // create event preview and detals divs as children of event container box
    var eventPreview = $('<div>').addClass('event-preview')
	.appendTo(eventContainer);
    var eventDetails = $('<div>').attr('id','event-details').appendTo(eventContainer);
    eventDetails.hide();

    // event preview: start time
    var localStartTime = '';
    var start = util.convertEventTimeFromUtcToLocal(event.isAllday, event.startTimeUTC);
    if (!event.isAllDay && !start.isBefore(currentDay,'day')) {
	localStartTime = start.format('h:mma');
    }

    $('<div>').addClass('start-time')
	.text(localStartTime)
	.css({'background-color': util.getCalendarColor(event.color)}) // ToDo: use background color of the page if event color is  Auto
	.appendTo(eventPreview);

    // event preview: subject
    $('<div>').addClass('event-preview')
	.text(event.subject)
	.css({'background-color': 'white'})
	.appendTo(eventPreview);

    // lazy load event details
    eventPreview.on('click', function() {
	if (!eventDetails.is(':visible')) {
	    $('*[id=event-details]').each(function() {
		$(this).hide();
	    });
	}

	if (!eventDetails.hasClass('event-details')) {
	    eventDetails.addClass('event-details');

	    var timeRangeString = util.getTimeRangeString(
		moment.utc(event.startTimeUTC).local(),
		moment.utc(event.endTimeUTC).local(),
		event.isAllDay);
	    $('<div>').addClass('event-timeRange')
		.text(timeRangeString)
		.appendTo(eventDetails);

	    var locationDiv = $('<div>').addClass('event-location').appendTo(eventDetails);
	    $('<div>').addClass('event-location-icon')
		.append($('<img>')
			.attr({'src': chrome.extension.getURL('icons/Location-Map-icon.png'), 'alt': 'Location'}))
		.appendTo(locationDiv);
	    $('<div>').addClass('event-location-content')
		.text(event.location)
		.appendTo(locationDiv);

	    $('<div>').addClass('event-body')
		.text(event.bodyPreview)
		.appendTo(eventDetails);

	    eventDetails.on('click', function() {
		$(this).hide();
	    });
	}

	eventDetails.slideToggle(100);
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
