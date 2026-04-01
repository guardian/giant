import { getTriState, triStateCycle } from "./triStateCycle";

describe("getTriState", () => {
  test("returns 'positive' when key is in positive array", () => {
    expect(getTriState("pdf", ["pdf", "image"], [])).toBe("positive");
  });

  test("returns 'negative' when key is in negative array", () => {
    expect(getTriState("pdf", [], ["pdf"])).toBe("negative");
  });

  test("returns 'off' when key is in neither array", () => {
    expect(getTriState("pdf", ["image"], ["video"])).toBe("off");
  });

  test("returns 'off' for empty arrays", () => {
    expect(getTriState("pdf", [], [])).toBe("off");
  });
});

describe("triStateCycle", () => {
  test("off → positive: adds key to positive", () => {
    const result = triStateCycle("image", ["pdf"], []);
    expect(result).toEqual({ positive: ["pdf", "image"], negative: [] });
  });

  test("positive → negative: moves key from positive to negative", () => {
    const result = triStateCycle("pdf", ["pdf", "image"], []);
    expect(result).toEqual({ positive: ["image"], negative: ["pdf"] });
  });

  test("negative → off: removes key from negative", () => {
    const result = triStateCycle("pdf", [], ["pdf"]);
    expect(result).toEqual({ positive: [], negative: [] });
  });

  test("cycling three times returns to original state", () => {
    const initial = { positive: ["image"], negative: [] };
    const step1 = triStateCycle("pdf", initial.positive, initial.negative);
    const step2 = triStateCycle("pdf", step1.positive, step1.negative);
    const step3 = triStateCycle("pdf", step2.positive, step2.negative);
    expect(step3).toEqual(initial);
  });

  test("does not mutate input arrays", () => {
    const positive = ["pdf", "image"];
    const negative = ["video"];
    const posCopy = [...positive];
    const negCopy = [...negative];
    triStateCycle("pdf", positive, negative);
    expect(positive).toEqual(posCopy);
    expect(negative).toEqual(negCopy);
  });

  test("works with empty arrays", () => {
    const result = triStateCycle("pdf", [], []);
    expect(result).toEqual({ positive: ["pdf"], negative: [] });
  });

  test("preserves other keys when cycling", () => {
    const result = triStateCycle("pdf", ["pdf", "image", "video"], ["audio"]);
    expect(result).toEqual({
      positive: ["image", "video"],
      negative: ["audio", "pdf"],
    });
  });
});
