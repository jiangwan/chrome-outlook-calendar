var util = {};

util.getDateOfToday = function() {
    return moment().hour(0).minute(0).second(0).millisecond(0);
};

util.convertEventTimeFromUtcToLocal = function(isAllDay, timeString) {
    if (isAllDay) {
	var day = moment.utc(timeString);
	return moment([day.year(), day.month(), day.date()]);
    } else {
	return moment.parseZone(timeString).local();
    }
};

util.getTimeRangeString = function(start, end, isAllDay) {
    var startString = '', endString = '';

    if (isAllDay) {
	if (end.diff(start,'day') == 1) {
	    return 'All Day Events';
	} else {
	    startString = start.format('ddd, MMM D');
	    endString = end.add(-1,'day').format('ddd, MMM D');
	}
    }
    
    if (start.isSame(end,'day')) {
	startString = start.format('h:mma');
	endString = end.format('h:mma');
    } else {
	startString = start.format('ddd, MMM D, h:mma');
	endString = end.format('ddd, MMM D, h:mma');
    }

    return startString + ' - ' + endString;
};

util.getCalendarColor = function(colorCode) {
    return  constants.CALENDAR_COLOR[colorCode] || constants.DEFAULT_CALENDAR_COLOR;
};
