// Firefox and Chrome have different `Date.parse` functions so here we are
// The idea of this is to have a best effort at human readalbe date parsing
// I coulnd't really find a library that worked well in both Firefox and Chrome
// A lot of libraries fall back to Date.parse which is great in Chrome, but pretty janky in Firefox - but necessary

// That being said we don't want or need an extremely thorough range of formats, just basic day month year
// 2019
// Feb 2019
// 10 Feb 2019
// 10th Feb 2018

const separators = '(?: +|_|-|/)';
const optionalOrdinalIndicators = '(?:st|nd|rd|th)?';

const monthYearDateRegex = new RegExp('^(\\d+|\\w+)' + separators + '(\\d+)$');
//                                     ^ Month                    ^ Year

const dayMonthYearDateRegex = new RegExp('^(\\d+)' + optionalOrdinalIndicators + separators + '(\\d+|\\w+)' + separators + '(\\d+)$');
//                                        ^ Day                                              ^ Month                    ^ Year

const monthNames = [
    ['jan', 'january'],
    ['feb', 'february'],
    ['mar', 'march'],
    ['apr', 'april'],
    ['may'],
    ['jun', 'june'],
    ['jul', 'july'],
    ['aug', 'august'],
    ['sep', 'sept', 'september'],
    ['oct', 'october'],
    ['nov', 'november'],
    ['dec', 'december']
];


export function parseDate(text, mode) {
    const trimmed = text.trim();

    try {
        const p = parseDateNoFallback(trimmed, mode);

        if (!p) {
            return Date.parse(trimmed);
        } else {
            return p;
        }
    } catch(_) {
        // Fallback to native - hope they're in Chrome lol.
        // This *WILL NOT* respect the before/after flag so can lead to slightly unexpected results
        return Date.parse(trimmed);
    }
}

export function parseDateNoFallback(text, mode) {
    // Date parser mode will chose either the from start of your date or the end
    // This is because if you say, "Give me all documents from after 2018" you don't want the
    // calculation to be from the first of January because you'd get results from all of 2018
    //
    // For example from_start '2018' returns 2018-01-01T00:00:00, from_end returns 2018-12-31T24:00:00
    if (mode !== 'from_start' && mode !== 'from_end') {
        throw new Error('Invalid date parsing mode');
    }


    let year, month, day;

    // Check if we can just parse the text text as a single year
    year = Number(text);
    if (!isNaN(year)) {
    // Check if we can just parse the text text as a single year
        if (mode === 'from_end') {
            year += 1;
        }

        return Date.UTC(year, 0);
    }

    const monthYear = monthYearDateRegex.exec(text);
    if (monthYear !== null && monthYear.length === 3 && validateMonth(monthYear[1]) && validateYear(monthYear[2])) {
        year = Number(monthYear[2]);
        month = getMonthIndex(monthYear[1]);

        if (mode === 'from_end') {
            month += 1;

            return Date.UTC(year, month);
        } else {
            return Date.UTC(year, month);
        }
    }

    const dayMonthYear = dayMonthYearDateRegex.exec(text);
    if (dayMonthYear !== null && dayMonthYear.length === 4 && validateDay(dayMonthYear[1]) && validateMonth(dayMonthYear[2]) && validateYear(dayMonthYear[3])) {
        year = Number(dayMonthYear[3]);
        month = getMonthIndex(dayMonthYear[2]);
        day = Number(dayMonthYear[1]);

        if (mode === 'from_end') {
            day += 1;

            return Date.UTC(year, month, day);
        } else {
            return Date.UTC(year, month, day);
        }
    }

    return null;
}

function validateDay(day) {
    const num = Number(day);
    return !!num;
}

function validateMonth(month) {
    const num = Number(month);
    return !!num || monthNames.some(monthTexts => monthTexts.includes(month.toLowerCase()));
}

function getMonthIndex(month) {
    const num = Number(month);
    if (num) {
        return num - 1;
    }

    return monthNames.findIndex(names => names.includes(month.toLowerCase()));
}

function validateYear(year) {
    const num = Number(year);
    return !!num;
}
