/**
 * Schedule repeat tasks for calendar, e.g. sync events in background.
 * chrome.alarms api is intentionally used instead of window.setInterval
 * in case we will switch to event page one day. 
 */
var scheduler = {};

scheduler.name_ = 'calendar_scheduler';

scheduler.INTERVAL = 30; // minutes

scheduler.initialize = function() {
    chrome.alarms.onAlarm.addListener(function(alarm) {
	if (alarm.name === scheduler.name_) {
	    scheduler.updateCalendar_();
	}
    });

    chrome.alarms.get(scheduler.name_, function(alarm) {
	if (!alarm || alarm.name != scheduler.name_) {
	    chrome.alarms.create(scheduler.name_, {
		delayInMinutes: scheduler.INTERVAL,
		periodInMinutes: scheduler.INTERVAL});
	}
    });
};

scheduler.updateCalendar_ = function() {
    calendar.syncCalendarList();
};
