import { CommentData, Resource } from "../types/Resource";
import {
  filterCommentsInView,
  getCommentSnippet,
  getCommentViewLabel,
  getViewForAnchor,
} from "./commentUtils";

const makeResource = (overrides: Partial<Resource> = {}): Resource => ({
  uri: "test-uri",
  type: "blob",
  isExpandable: false,
  processingStage: { type: "processed" },
  extracted: true,
  mimeTypes: ["text/plain"],
  fileSize: 100,
  parents: [],
  children: [],
  comments: [],
  previewStatus: "enabled",
  text: {
    contents: "Hello world, this is a test document with some content.",
    highlights: [],
  },
  ocr: {
    en: {
      contents: "OCR English text from the scanned page.",
      highlights: [],
    },
    fr: {
      contents: "Texte OCR français de la page numérisée.",
      highlights: [],
    },
  },
  ...overrides,
});

const textComment: CommentData = {
  id: "c1",
  author: { username: "alice", displayName: "Alice" },
  postedAt: Date.now(),
  text: "Interesting passage",
  anchor: { type: "text", startCharacter: 0, endCharacter: 11 },
};

const ocrEnComment: CommentData = {
  id: "c2",
  author: { username: "bob", displayName: "Bob" },
  postedAt: Date.now(),
  text: "Check this OCR",
  anchor: { type: "ocr", language: "en", startCharacter: 0, endCharacter: 11 },
};

const ocrFrComment: CommentData = {
  id: "c3",
  author: { username: "bob", displayName: "Bob" },
  postedAt: Date.now(),
  text: "Vérifier ceci",
  anchor: { type: "ocr", language: "fr", startCharacter: 0, endCharacter: 10 },
};

const documentComment: CommentData = {
  id: "c4",
  author: { username: "alice", displayName: "Alice" },
  postedAt: Date.now(),
  text: "General note about this document",
};

const allComments = [textComment, ocrEnComment, ocrFrComment, documentComment];

describe("filterCommentsInView", () => {
  test("shows text comments and document-level comments in text view", () => {
    const result = filterCommentsInView(allComments, "text");
    expect(result).toEqual([textComment, documentComment]);
  });

  test("shows OCR English comments and document-level comments in ocr.en view", () => {
    const result = filterCommentsInView(allComments, "ocr.en");
    expect(result).toEqual([ocrEnComment, documentComment]);
  });

  test("shows OCR French comments and document-level comments in ocr.fr view", () => {
    const result = filterCommentsInView(allComments, "ocr.fr");
    expect(result).toEqual([ocrFrComment, documentComment]);
  });

  test("shows only document-level comments when view is undefined", () => {
    const result = filterCommentsInView(allComments, undefined);
    expect(result).toEqual([documentComment]);
  });

  test("shows only document-level comments for a view with no matching anchored comments", () => {
    const result = filterCommentsInView(allComments, "ocr.de");
    expect(result).toEqual([documentComment]);
  });
});

describe("getCommentSnippet", () => {
  const resource = makeResource();

  test("returns snippet for text anchor", () => {
    expect(getCommentSnippet(textComment.anchor, resource)).toBe("Hello world");
  });

  test("returns snippet for OCR anchor", () => {
    expect(getCommentSnippet(ocrEnComment.anchor, resource)).toBe(
      "OCR English",
    );
  });

  test("returns undefined for document-level comment", () => {
    expect(getCommentSnippet(undefined, resource)).toBeUndefined();
  });

  test("truncates long snippets", () => {
    const longResource = makeResource({
      text: {
        contents: "A".repeat(200),
        highlights: [],
      },
    });
    const anchor = {
      type: "text" as const,
      startCharacter: 0,
      endCharacter: 200,
    };
    const snippet = getCommentSnippet(anchor, longResource, 80);
    expect(snippet).toHaveLength(81); // 80 chars + ellipsis
    expect(snippet!.endsWith("…")).toBe(true);
  });

  test("returns undefined when text content is empty", () => {
    const emptyResource = makeResource({
      text: { contents: "", highlights: [] },
    });
    const anchor = {
      type: "text" as const,
      startCharacter: 0,
      endCharacter: 5,
    };
    expect(getCommentSnippet(anchor, emptyResource)).toBeUndefined();
  });
});

describe("getCommentViewLabel", () => {
  test("returns 'Text' for text anchor", () => {
    expect(getCommentViewLabel(textComment.anchor)).toBe("Text");
  });

  test("returns 'OCR en' for OCR English anchor", () => {
    expect(getCommentViewLabel(ocrEnComment.anchor)).toBe("OCR en");
  });

  test("returns 'Document' for no anchor", () => {
    expect(getCommentViewLabel(undefined)).toBe("Document");
  });
});

describe("getViewForAnchor", () => {
  test("returns 'text' for text anchor", () => {
    expect(getViewForAnchor(textComment.anchor)).toBe("text");
  });

  test("returns 'ocr.en' for OCR English anchor", () => {
    expect(getViewForAnchor(ocrEnComment.anchor)).toBe("ocr.en");
  });

  test("returns undefined for no anchor", () => {
    expect(getViewForAnchor(undefined)).toBeUndefined();
  });
});
