import _get from "lodash/get";
import _set from "lodash/set";

export type UrlParameters = {
  [key: string]: string | number | boolean | null | undefined | object;
};

type ParsedUrlValue = string | ParsedUrlParameters | ParsedUrlValue[];
export type ParsedUrlParameters = { [key: string]: ParsedUrlValue | undefined };

export function isValidValue(value?: unknown) {
  if (value === undefined || value === "") {
    return false;
  }

  if (Array.isArray(value) && value.length === 0) {
    return false;
  }

  return true;
}

export function objectToParamString(obj: object, prefix?: string): string {
  return Object.keys(obj)
    .reduce<string[]>(function (soFar, key) {
      const value: unknown = _get(obj, [key]);
      const encodedKey = encodeURIComponent(prefix ? `${prefix}.${key}` : key);
      if (!isValidValue(value)) {
        return soFar;
      }

      if (Array.isArray(value)) {
        return soFar.concat(
          value.map(
            (subValue: unknown) =>
              encodedKey + "[]=" + encodeURIComponent(String(subValue)),
          ),
        );
      } else if (typeof value === "object" && value !== null) {
        return soFar.concat([objectToParamString(value, key)]);
      } else {
        return soFar.concat([
          encodedKey + "=" + encodeURIComponent(String(value)),
        ]);
      }
    }, [])
    .join("&");
}

export function paramStringToObject(string: string): ParsedUrlParameters {
  const stringNoQuestion =
    string[0] === "?" ? string.slice(1, string.length) : string;

  const params = stringNoQuestion.split("&");

  const initialParams: ParsedUrlParameters = {};
  const paramsObject = params.reduce((paramsObject, param) => {
    const splitParam = param.split("=");

    if (splitParam.length !== 2) {
      return paramsObject; //Not key=value fail fast
    }

    const rawKey = decodeURIComponent(splitParam[0]);
    const rawValue = decodeURIComponent(splitParam[1]);

    const isArray = rawKey.indexOf("[]") !== -1;

    const key = isArray ? rawKey.replace("[]", "") : rawKey; // Strip off the [] if array
    let value: ParsedUrlValue = rawValue;
    if (isArray) {
      const previous: ParsedUrlValue = _get(paramsObject, key, []);
      // Preserve scalar concatenation and failure for conflicting object paths.
      if (typeof previous === "string" || Array.isArray(previous)) {
        value = previous.concat(rawValue);
      } else {
        throw new TypeError("Cannot append a URL parameter to an object");
      }
    }

    return Object.assign({}, _set(paramsObject, key, value));
  }, initialParams);

  return paramsObject;
}
