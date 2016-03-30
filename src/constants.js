/**
 * The namespace for constants in UI
 */
var constants = {};

/**
 * Outlook calendar url
 * @type {string}
 * @const
 */
constants.CALENDAR_CONSUMERS_URL = 'https://outlook.live.com/owa/#path=/calendar';

/**
 * Office365 calendar url
 * @type {string}
 * @const
 */
constants.CALENDAR_ORGANIZATIONS_URL = 'https://outlook.office.com/owa/#path=/calendar';

/**
 * Url for creating live account
 * @type {string}
 * @const
 */
constants.CREATE_ACCOUNT_URL = 'https://signup.live.com';

/**
 * Url for location query in Bing map
 * @type {string}
 * @const
 */
constants.BING_MAP_QUERY_URL = 'http://bing.com/maps/default.aspx?where1=';

/**
 * Mapping rgb color to calendar color name.
 * The strings are obtained from outlook calendar web app.
 * @type {Object.<string,string>}
 * @const
 */
constants.CALENDAR_COLOR = {
    'LightBlue': 'rgb(166,209,245)',
    'LightTeal': 'rgb(74,218,204)',
    'LightGreen': 'rgb(135,210,142)',
    'LightGray': 'rgb(192,192,192)',
    'LightRed': 'rgb(248,140,155)',
    'LightPink': 'rgb(240,140,192)',
    'LightBrown': 'rgb(203,162,155)',
    'LightOrange': 'rgb(252,171,115)',
    'LightYellow': 'rgb(244,208,122)'
};

/**
 * Use this color when the server doesn't provide a valid color
 * @type {string}
 * @const
 */
constants.DEFAULT_CALENDAR_COLOR = '#ccffcc';