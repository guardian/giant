import { loadPreferences, preferencesSchema } from "./Preferences";
import {
  getPreference,
  setPreference,
  updatePreference,
} from "../actions/preferences";
import { vi } from "vitest";

beforeEach(() => localStorage.clear());

test.each([
  null,
  "{",
  "null",
  "[]",
  '"text"',
  '{"featureEUI":null}',
  '{"showSearchHighlights":"true"}',
])("resets missing or invalid saved preferences (%s) to defaults", (saved) => {
  if (saved !== null) localStorage.setItem("preferences", saved);
  const defaults = { showSearchHighlights: true, showCommentHighlights: true };
  expect(loadPreferences()).toEqual(defaults);
  expect(localStorage.getItem("preferences")).toBe(JSON.stringify(defaults));
});

test("accepts optional settings but rejects nullable and non-boolean known settings", () => {
  expect(preferencesSchema.safeParse({}).success).toBe(true);
  for (const key of Object.keys(preferencesSchema.shape)) {
    expect(preferencesSchema.safeParse({ [key]: false }).success).toBe(true);
    expect(preferencesSchema.safeParse({ [key]: null }).success).toBe(false);
    expect(preferencesSchema.safeParse({ [key]: "false" }).success).toBe(false);
  }
});

test("adds the legacy comment default while retaining unknown keys and absent search settings", () => {
  localStorage.setItem(
    "preferences",
    '{"featureEUI":false,"future":{"value":1}}',
  );
  expect(loadPreferences()).toEqual({
    featureEUI: false,
    future: { value: 1 },
    showCommentHighlights: true,
  });
  expect(getPreference("showSearchHighlights")).toBeUndefined();
});

test("preserves disabled highlights and unknown keys across updates", () => {
  localStorage.setItem(
    "preferences",
    '{"showSearchHighlights":false,"showCommentHighlights":false,"future":42}',
  );
  const preferences = setPreference("featurePageViewer", true);
  expect(preferences).toEqual({
    showSearchHighlights: false,
    showCommentHighlights: false,
    future: 42,
    featurePageViewer: true,
  });
  expect(loadPreferences()).toEqual(preferences);
});

test("rejects invalid updates without overwriting valid storage", () => {
  const preferences = loadPreferences();
  expect(() => setPreference("featureEUI", null)).toThrow();
  expect(loadPreferences()).toEqual(preferences);
});

test("dispatches validated preferences after saving them", () => {
  const dispatch = vi.fn();
  updatePreference("featureEUI", true)(dispatch);
  expect(dispatch).toHaveBeenCalledWith({
    type: "APP_SET_PREFERENCES",
    receivedAt: expect.any(Number),
    preferences: loadPreferences(),
  });
});

test("propagates storage failures rather than reporting a successful update", () => {
  const write = vi
    .spyOn(Storage.prototype, "setItem")
    .mockImplementation(() => {
      throw new Error("Storage unavailable");
    });
  try {
    expect(() => updatePreference("featureEUI", true)).toThrow(
      "Storage unavailable",
    );
  } finally {
    write.mockRestore();
  }
});
