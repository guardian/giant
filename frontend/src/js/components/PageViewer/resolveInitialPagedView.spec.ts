import {
  COMBINED_VIEW,
  isTextLikeView,
  resolveInitialPagedView,
} from "./resolveInitialPagedView";

describe("isTextLikeView", () => {
  it("treats text and any ocr.* variant as text-like", () => {
    expect(isTextLikeView("text")).toBe(true);
    expect(isTextLikeView("ocr")).toBe(true);
    expect(isTextLikeView("ocr.english")).toBe(true);
  });

  it("does not treat combined, transcript or other views as text-like", () => {
    expect(isTextLikeView(COMBINED_VIEW)).toBe(false);
    expect(isTextLikeView("transcript.english")).toBe(false);
    expect(isTextLikeView("vttTranscript.english")).toBe(false);
    expect(isTextLikeView("preview")).toBe(false);
    expect(isTextLikeView("table")).toBe(false);
  });
});

describe("resolveInitialPagedView", () => {
  const base = {
    totalPages: 10,
    currentView: undefined as string | undefined,
    hasSearchQuery: false,
    searchMatchesInPages: null as boolean | null,
  };

  it("waits until the page count is known", () => {
    expect(resolveInitialPagedView({ ...base, totalPages: null })).toEqual({
      kind: "wait",
    });
  });

  it("does nothing for non-paged documents (no Combined view exists)", () => {
    expect(
      resolveInitialPagedView({
        ...base,
        totalPages: 0,
        currentView: "text",
        hasSearchQuery: true,
      }),
    ).toEqual({ kind: "keep" });
  });

  it("defaults a paged document with no view to Combined", () => {
    expect(
      resolveInitialPagedView({ ...base, currentView: undefined }),
    ).toEqual({ kind: "set", view: COMBINED_VIEW });
  });

  describe("when search has forced a text-like view", () => {
    const forced = {
      ...base,
      currentView: "text",
      hasSearchQuery: true,
    };

    it("waits for the page-match probe before deciding", () => {
      expect(
        resolveInitialPagedView({ ...forced, searchMatchesInPages: null }),
      ).toEqual({ kind: "wait" });
    });

    it("switches to Combined when the match is reachable in the pages", () => {
      expect(
        resolveInitialPagedView({ ...forced, searchMatchesInPages: true }),
      ).toEqual({ kind: "set", view: COMBINED_VIEW });
    });

    it("honours the forced view when the match is not in the pages", () => {
      // e.g. lossy Tesseract OCR, cross-field, or a future translation match
      expect(
        resolveInitialPagedView({ ...forced, searchMatchesInPages: false }),
      ).toEqual({ kind: "keep" });
    });

    it("applies the same logic to an ocr.* view", () => {
      expect(
        resolveInitialPagedView({
          ...forced,
          currentView: "ocr.english",
          searchMatchesInPages: true,
        }),
      ).toEqual({ kind: "set", view: COMBINED_VIEW });
    });
  });

  it("honours a text view opened without a search query", () => {
    expect(
      resolveInitialPagedView({
        ...base,
        currentView: "text",
        hasSearchQuery: false,
        // probe never runs, so this stays null
        searchMatchesInPages: null,
      }),
    ).toEqual({ kind: "keep" });
  });

  it("honours an explicit non-text view such as transcript even during search", () => {
    expect(
      resolveInitialPagedView({
        ...base,
        currentView: "transcript.english",
        hasSearchQuery: true,
        searchMatchesInPages: false,
      }),
    ).toEqual({ kind: "keep" });
  });

  it("honours an explicit combined view", () => {
    expect(
      resolveInitialPagedView({ ...base, currentView: COMBINED_VIEW }),
    ).toEqual({ kind: "keep" });
  });
});
