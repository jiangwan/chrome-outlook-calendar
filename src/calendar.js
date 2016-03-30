/**
 * Calendar related functionality
 */
var calendar = {};

calendar.CALENDAR_LIST_API_URL_ = 'https://outlook.office.com/api/v2.0/me/calendars';

calendar.CALENDAR_EVENT_API_URL_ = 'https://outlook.office.com/api/v2.0/me/calendars/{calendar_id}/calendarview?startdatetime={start_datetime}&enddatetime={end_datetime}';

calendar.DAYS_TO_OBSERVE_ = 7;

/**
 * Sync calendar list from server; once succeeded, sync all calendar events too;
 */
calendar.syncCalendarList = function () {
    chrome.runtime.sendMessage({'method': 'ui.refresh.start'});
    authentication.getAccessToken(calendar.getCalendarsWithRetry_(0 /*retryCount*/));
};

calendar.getCalendarsWithRetry_ = function (retryCount) {
    var onFailure = function (retry, response) {
        if (retry < constants.REFRESH_TOKENS_RETRY_LIMIT) {
            console.log('Unable to sync calendar list. Attempt: ' + retry);

            window.setTimeout(function (callback) {
                authentication.refreshTokens(callback);
            }, constants.REFRESH_TOKENS_RETRY_INTERVAL, calendar.getCalendarsWithRetry_(retry + 1));
        } else {
            chrome.runtime.sendMessage({'method': 'ui.refresh.stop'});

            if (!response || response.statusCode === 401) {
                calendar.clearCaches_();
                chrome.runtime.sendMessage({
                    'method': 'ui.authStatus.updated',
                    'authorized': false
                });
            }
        }
    };

    return function (accessToken) {
        if (!accessToken) {
            onFailure(retryCount, null);
            return;
        }

        $.ajax(calendar.CALENDAR_LIST_API_URL_, {
                headers: {'Authorization': 'Bearer ' + accessToken},
                dataType: 'json',
                retry: retryCount
            })
            .done(function (data, status, response) {
                var calendarList = {};
                var calendars = response.responseJSON.value;
                $.each(calendars, function (i, item) {
                    calendarList[item.Id] = {
                        'id': item.Id,
                        'name': item.Name,
                        'color': item.Color
                    };
                });

                chrome.storage.local.set({'calendar_list': calendarList}, function () {
                    if (chrome.runtime.lastError) {
                        console.log('Error saving calendar list to local storage: ' + chrome.runtime.lastError.message);
                        return;
                    }

                    calendar.syncEvents();
                });
            })
            .fail(function (response) {
                onFailure(this.retry, response);
            });
    };
};

calendar.loadEvents = function (callback) {
    chrome.storage.local.get('calendar_allEvents', function (storage) {
        if (chrome.runtime.lastError) {
            console.log('Error retrieving calendar events from local stroage: ' + chrome.runtime.lastError.message);
            return;
        }

        var events = storage['calendar_allEvents'];
        if (events === undefined) {
            //calendar.syncCalendarList();
        } else {
            var sortedIndices = calendar.sortEventsByDate_(events);
            callback({'events': events, 'indices': sortedIndices});
        }
    });
};

/**
 * Sync all events from server using cached calendar list
 */
calendar.syncEvents = function () {
    chrome.storage.local.get('calendar_list', function (storage) {
        if (chrome.runtime.lastError) {
            console.log('Error retrieving calendar list from local storage: ' + chrome.runtime.lastError.message);
            return;
        }

        var calendarList = storage['calendar_list'];
        authentication.getAccessToken(calendar.retrieveEventsWithRetry_(calendarList, 0 /*retryCount*/));
    });
};

calendar.retrieveEventsWithRetry_ = function (calendars, retryCount) {
    var reject = (function (calendars, retryCount) {
        return function (response) {
            if (retryCount < constants.REFRESH_TOKENS_RETRY_LIMIT) {
                window.setTimeout(function (callback) {
                        authentication.refreshTokens(callback);
                    },
                    constants.REFRESH_TOKENS_RETRY_INTERVAL,
                    calendar.retrieveEventsWithRetry_(calendars, retryCount + 1));
            } else {
                chrome.runtime.sendMessage({'method': 'ui.refresh.stop'});

                if (response.statusCode === 401) {
                    calendar.clearCaches_();
                    chrome.runtime.sendMessage({
                        'method': 'ui.authStatus.update',
                        'authorized': false
                    });
                }
            }
        };
    })(calendars, retryCount);

    return function (accessToken) {
        if (!accessToken) {
            reject();
            return;
        }

        var allEvents = [];
        var promises = [];

        for (var id in calendars) {
            promises.push(calendar.syncCalendarEvents_(accessToken, calendars[id]));
        }

        var timeStamp = moment().toISOString();
        Promise.all(promises).then(function (calendarEvents) {
            $.each(calendarEvents, function (i, events) {
                if (events) {
                    allEvents = allEvents.concat(events);
                }
            });

            allEvents.sort(function (first, second) {
                return moment.utc(first.startTimeUTC) - moment.utc(second.startTimeUTC);
            });

            chrome.storage.local.set({'calendar_allEvents': allEvents, 'last_syncedTime': timeStamp}, function () {
                if (chrome.runtime.lastError) {
                    console.log('Failed to save all calendar events to local storage');
                    return;
                }

                chrome.runtime.sendMessage({'method': 'ui.events.update'});
                chrome.runtime.sendMessage({'method': 'ui.refresh.stop'});
            });
        }, reject);
    };
};

calendar.syncCalendarEvents_ = function (accessToken, calendarInfo) {
    var calendar_id = calendarInfo.id;
    var color = calendarInfo.color;

    return new Promise(function (resolve, reject) {
        var today = util.getDateOfToday();
        var start_datetime = today.toISOString();
        var end_datetime = today.add(calendar.DAYS_TO_OBSERVE_, 'days').toISOString();
        var eventQueryUrl = calendar.CALENDAR_EVENT_API_URL_.replace('{calendar_id}', encodeURIComponent(calendar_id)).replace('{start_datetime}', start_datetime).replace('{end_datetime}', end_datetime)
            + '&$top=9999'; // bug: without specifying this parameter, the server always returns no more than 10 events

        $.ajax(eventQueryUrl, {
                headers: {'Authorization': 'Bearer ' + accessToken},
                dateType: 'json'
            })
            .done(function (data) {
                var events = [];
                $.each(data.value, function (i, item) {
                    var start = moment.utc(item.Start.DateTime).toISOString();
                    var end = moment.utc(item.End.DateTime).toISOString();

                    events.push({
                        'calendarId': calendar_id,
                        'color': color,
                        'subject': item.Subject,
                        'location': item.Location.DisplayName,
                        'startTimeUTC': start,
                        'endTimeUTC': end,
                        'isAllDay': item.IsAllDay,
                        'bodyPreview': item.BodyPreview,
                        'organizer': item.Organizer.EmailAddress.Name,
                        'url': item.WebLink
                    });
                });

                resolve(events);
            })
            .fail(function (response) {
                console.log('Error retrieving calendar events from server: ' + response.statusText);
                reject({'statusCode': response.status});
            });
    });
};

calendar.clearCaches_ = function () {
    chrome.storage.local.clear();
};

/**
 * Classify events by date and returns a two dimensional array storing
 * indices of events for each day.
 */
calendar.sortEventsByDate_ = function (events) {
    var container = new Array(calendar.DAYS_TO_OBSERVE_);
    for (var i = 0; i < calendar.DAYS_TO_OBSERVE_; i++) {
        container[i] = [];
    }

    var firstDay = util.getDateOfToday();
    var lastDay = firstDay.clone().add(calendar.DAYS_TO_OBSERVE_ - 1, 'days');

    $.each(events, function (index, event) {
        var start = util.convertEventTimeFromUtcToLocal(event.isAllDay, event.startTimeUTC);
        var end = util.convertEventTimeFromUtcToLocal(event.isAllDay, event.endTimeUTC);
        if (end.hour() == 0 && end.minute() == 0) {
            end.add(-1, 'day');
        }

        if (start.isAfter(lastDay, 'day') || end.isBefore(firstDay, 'day')) {
            return true;
        }

        var startIndex = start.isBefore(firstDay, 'day') ? 0 : start.diff(firstDay, 'day');
        var endIndex = end.isAfter(lastDay, 'day') ? calendar.DAYS_TO_OBSERVE_ - 1 : end.diff(firstDay, 'day');
        for (var i = startIndex; i <= endIndex; i++) {
            container[i].push(index);
        }
    });

    return container;
};
