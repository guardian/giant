import { Resource, HighlightableText } from "../types/Resource";
import {
  getDefaultView,
  hasTextContent,
  isResourceForUri,
} from "./resourceUtils";

function makeHighlightableText(contents: string): HighlightableText {
  return { contents, highlights: [] };
}

function makeResource(overrides?: Partial<Resource>): Resource {
  return {
    uri: "test/doc.pdf",
    type: "blob",
    isExpandable: false,
    processingStage: { type: "processed" },
    extracted: true,
    mimeTypes: ["application/pdf"],
    fileSize: 1024,
    parents: [],
    children: [],
    comments: [],
    previewStatus: "disabled",
    text: makeHighlightableText(""),
    ...overrides,
  } as Resource;
}

describe("hasTextContent", () => {
  test("returns true when text has content", () => {
    const resource = makeResource({
      text: makeHighlightableText("Hello world"),
    });
    expect(hasTextContent(resource)).toBe(true);
  });

  test("returns false when text is empty", () => {
    const resource = makeResource({
      text: makeHighlightableText(""),
    });
    expect(hasTextContent(resource)).toBe(false);
  });

  test("returns false when text is only whitespace", () => {
    const resource = makeResource({
      text: makeHighlightableText("   \n\t  "),
    });
    expect(hasTextContent(resource)).toBe(false);
  });

  test("returns false when text is undefined", () => {
    const resource = makeResource({
      text: undefined,
    });
    expect(hasTextContent(resource)).toBe(false);
  });
});

describe("getDefaultView", () => {
  test("returns undefined for non-blob resources", () => {
    const resource = makeResource({
      text: makeHighlightableText("content"),
      type: "file",
    });
    expect(getDefaultView(resource)).toBeUndefined();
  });

  test("returns 'text' when document has text content", () => {
    const resource = makeResource({
      text: makeHighlightableText("Hello world"),
    });
    expect(getDefaultView(resource)).toBe("text");
  });

  test("returns transcript view when transcript exists", () => {
    const resource = makeResource({
      text: makeHighlightableText(""),
      transcript: {
        english: makeHighlightableText("transcript content"),
      },
    });
    expect(getDefaultView(resource)).toBe("transcript.english");
  });

  test("returns first OCR language when text is empty but OCR has content", () => {
    const resource = makeResource({
      text: makeHighlightableText(""),
      ocr: {
        english: makeHighlightableText("OCR text"),
      },
    });
    expect(getDefaultView(resource)).toBe("ocr.english");
  });

  test("skips empty OCR entries and returns first non-empty one", () => {
    const resource = makeResource({
      text: makeHighlightableText(""),
      ocr: {
        french: makeHighlightableText(""),
        english: makeHighlightableText("OCR text"),
      },
    });
    expect(getDefaultView(resource)).toBe("ocr.english");
  });

  test("returns 'preview' when text is empty, no usable OCR, but preview is available", () => {
    const resource = makeResource({
      text: makeHighlightableText(""),
      previewStatus: "pass_through",
    });
    expect(getDefaultView(resource)).toBe("preview");
  });

  test("returns 'preview' when text is empty and all OCR entries are also empty", () => {
    const resource = makeResource({
      text: makeHighlightableText(""),
      ocr: {
        english: makeHighlightableText(""),
      },
      previewStatus: "pdf_generated",
    });
    expect(getDefaultView(resource)).toBe("preview");
  });

  test("returns 'text' as last resort when text is empty and preview is disabled", () => {
    const resource = makeResource({
      text: makeHighlightableText(""),
      previewStatus: "disabled",
    });
    expect(getDefaultView(resource)).toBe("text");
  });

  test("returns undefined when resource.text is undefined", () => {
    const resource = makeResource({
      text: undefined,
    });
    expect(getDefaultView(resource)).toBeUndefined();
  });
});

describe("isResourceForUri", () => {
  test("returns false when there is no resource", () => {
    expect(isResourceForUri(null, "test/doc.pdf")).toBe(false);
  });

  test("returns true when the resource uri matches the route uri exactly", () => {
    const resource = makeResource({ uri: "test/doc.pdf" });
    expect(isResourceForUri(resource, "test/doc.pdf")).toBe(true);
  });

  test("returns false when the resource belongs to a different document", () => {
    const resource = makeResource({ uri: "test/other-doc.pdf" });
    expect(isResourceForUri(resource, "test/doc.pdf")).toBe(false);
  });

  test("matches an encoded resource uri against a decoded route uri", () => {
    const resource = makeResource({ uri: "test/a%20doc.pdf" });
    expect(isResourceForUri(resource, "test/a doc.pdf")).toBe(true);
  });

  test("matches a decoded resource uri against an encoded route uri", () => {
    const resource = makeResource({ uri: "test/a doc.pdf" });
    expect(isResourceForUri(resource, "test/a%20doc.pdf")).toBe(true);
  });

  test("copes with a uri that is not valid percent-encoding", () => {
    const resource = makeResource({ uri: "test/100%.pdf" });
    expect(isResourceForUri(resource, "test/100%.pdf")).toBe(true);
    expect(isResourceForUri(resource, "test/other.pdf")).toBe(false);
  });
});
