/**
 * Schedule repeat tasks for calendar, e.g. sync events in background.
 * chrome.alarms api is intentionally used instead of window.setInterval
 * in case we will switch to event page one day. 
 */
var scheduler = {};

scheduler._name = 'calendar_scheduler';

scheduler.INTERVAL = 30; // minutes

scheduler.initialize = function() {
    chrome.alarms.onAlarm.addListener(function(alarm) {
	if (alarm.name === scheduler._name) {
	    scheduler._updateCalendar();
	}
    });

    chrome.alarms.get(scheduler._name, function(alarm) {
	if (!alarm || alarm.name != scheduler._name) {
	    chrome.alarms.create(scheduler._name, {
		delayInMinutes: scheduler.INTERVAL,
		periodInMinutes: scheduler.INTERVAL});
	}
    });
};

scheduler._updateCalendar = function() {
    chrome.runtime.sendMessage({method: 'ui.refresh.start'});
    calendar.syncCalendarList();
};
