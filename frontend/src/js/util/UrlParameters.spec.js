import {
  objectToParamString,
  paramStringToObject,
  isValidValue,
} from "./UrlParameters";

test("isValidValue detects valid values", () => {
  expect(isValidValue("test")).toBe(true);
  expect(isValidValue(["test"])).toBe(true);
  expect(isValidValue(123)).toBe(true);
  expect(isValidValue({ test: "test" })).toBe(true);
  expect(isValidValue(false)).toBe(true);
});

test("isValidValue detects invalid values", () => {
  expect(isValidValue()).toBe(false);
  expect(isValidValue([])).toBe(false);
  expect(isValidValue(undefined)).toBe(false);
});

test("objects are converted correctly", () => {
  const obj1 = {
    testValue: "test",
  };

  const obj2 = {
    testValue: "test",
    test2ndValue: "test2",
  };

  const obj3 = {
    testValue: "test",
    testArray: ["test1", "test2"],
  };

  const obj4 = {
    invalidValue: undefined,
    invalidArray: [],
    testValue: "test",
  };

  const obj5 = {
    invalidValue: undefined,
    invalidArray: [],
  };

  const obj6 = {
    testValue: "👻🐸",
    testArray: ["测试", "ทดสอบ"],
  };

  const obj7 = {
    "tes&t": "te???t",
    testArray: ["&", "& &"],
  };

  const obj8 = {
    testValue: "test",
    testObject: {
      testObjectValue: ["test1", "test2"],
      testObjectValue2: "a string",
    },
  };

  const obj9 = {
    testValue: 3,
  };

  expect(objectToParamString(obj1)).toBe("testValue=test");
  expect(objectToParamString(obj2)).toBe("testValue=test&test2ndValue=test2");
  expect(objectToParamString(obj3)).toBe(
    "testValue=test&testArray[]=test1&testArray[]=test2",
  );
  expect(objectToParamString(obj4)).toBe("testValue=test");
  expect(objectToParamString(obj5)).toBe("");
  expect(objectToParamString(obj6)).toBe(
    "testValue=%F0%9F%91%BB%F0%9F%90%B8&testArray[]=%E6%B5%8B%E8%AF%95&testArray[]=%E0%B8%97%E0%B8%94%E0%B8%AA%E0%B8%AD%E0%B8%9A",
  );
  expect(objectToParamString(obj7)).toBe(
    "tes%26t=te%3F%3F%3Ft&testArray[]=%26&testArray[]=%26%20%26",
  );
  expect(objectToParamString(obj8)).toBe(
    "testValue=test&testObject.testObjectValue[]=test1&testObject.testObjectValue[]=test2&testObject.testObjectValue2=a%20string",
  );
  expect(objectToParamString(obj9)).toBe("testValue=3");
});

test("Param string correctly becomes an object", () => {
  const testString1 = "?filters.ingestion[]=Test%20Ingest";
  expect(paramStringToObject(testString1)).toEqual({
    filters: {
      ingestion: ["Test Ingest"],
    },
  });

  const testString2 = "filters.ingestion[]=Test%20Ingest";
  expect(paramStringToObject(testString2)).toEqual({
    filters: {
      ingestion: ["Test Ingest"],
    },
  });

  const testString3 = "";
  expect(paramStringToObject(testString3)).toEqual({});

  const testString4 =
    "?filters.ingestion[]=Test%20Ingest&filters.ingestion[]=Test%20Ingest2";
  expect(paramStringToObject(testString4)).toEqual({
    filters: {
      ingestion: ["Test Ingest", "Test Ingest2"],
    },
  });

  const testString5 = "?query=Search%20Term&filters.ingestion[]=Test%20Ingest2";
  expect(paramStringToObject(testString5)).toEqual({
    query: "Search Term",
    filters: {
      ingestion: ["Test Ingest2"],
    },
  });

  const testString6 = "?query=Search%20Term&filters.ingestion[]=Test=Ingest2";
  expect(paramStringToObject(testString6)).toEqual({
    query: "Search Term",
  });

  const testString7 = "filters.ingestion[]=Test=Ingest2";
  expect(paramStringToObject(testString7)).toEqual({});

  const testString8 = "filters.ingestion[]=%F0%9F%91%BB%F0%9F%90%B8";
  expect(paramStringToObject(testString8)).toEqual({
    filters: {
      ingestion: ["👻🐸"],
    },
  });
});
