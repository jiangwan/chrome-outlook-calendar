/**
 * Schedule repeat tasks for calendar, e.g. sync events in background.
 * chrome.alarms api is intentionally used instead of window.setInterval
 * in case we will switch to event page one day.
 */
var scheduler = {};

scheduler.NAME_ = 'calendar_scheduler';

scheduler.INTERVAL_ = 30; // minutes

scheduler.initialize = function () {
    chrome.alarms.onAlarm.addListener(function (alarm) {
        if (alarm.name === scheduler.NAME_) {
            scheduler.updateCalendar_();
        }
    });

    chrome.alarms.get(scheduler.NAME_, function (alarm) {
        if (!alarm || alarm.name != scheduler.NAME_) {
            chrome.alarms.create(scheduler.NAME_, {
                delayInMinutes: scheduler.INTERVAL_,
                periodInMinutes: scheduler.INTERVAL_
            });
        }
    });
};

scheduler.updateCalendar_ = function () {
    calendar.syncCalendarList();
};
