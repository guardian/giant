import _get from 'lodash/get';
import _set from 'lodash/set';

export function isValidValue(value) {
    if (value === undefined || value === '') {
        return false;
    }

    if (Array.isArray(value) && value.length === 0) {
        return false;
    }

    return true;
}

export function objectToParamString(obj, prefix) {
    return Object.keys(obj).reduce(function(soFar, key) {
        const value = obj[key];
        const encodedKey = encodeURIComponent(prefix ? `${prefix}.${key}`: key);
        if (!isValidValue(value)) {
            return soFar;
        }

        if (Array.isArray(value)) {
            return soFar.concat(value.map((subValue) => [encodedKey + '[]=' + encodeURIComponent(subValue)]));
        } else if (typeof value === 'object' && value !== null) {
            return soFar.concat([objectToParamString(value, key)]);
        } else {
            return soFar.concat([encodedKey + '=' + encodeURIComponent(value)]);
        }
    }, []).join('&');
}

export function paramStringToObject(string) {

    const stringNoQuestion = string[0] === '?' ? string.slice(1, string.length) : string;

    const params = stringNoQuestion.split('&');

    const paramsObject = params.reduce((paramsObject, param) => {
        const splitParam = param.split('=');

        if (splitParam.length !== 2) {
            return paramsObject; //Not key=value fail fast
        }

        const rawKey = decodeURIComponent(splitParam[0]);
        const rawValue = decodeURIComponent(splitParam[1]);

        const isArray = rawKey.indexOf('[]') !== -1;

        const key = isArray ? rawKey.replace('[]', '') : rawKey; // Strip off the [] if array
        const value = isArray ? _get(paramsObject, key, []).concat([rawValue]) : rawValue; // add to any existing values if array

        return Object.assign({}, _set(paramsObject, key, value));

    }, {});

    return paramsObject;
}
