import { CommentAnchor, CommentData, Resource } from "../types/Resource";

function commentInView(anchor: CommentAnchor, view?: string): boolean {
  if (!view) {
    return false;
  }

  if (view.startsWith("ocr")) {
    const language = view.split(".")[1];
    return anchor.type === "ocr" && anchor.language === language;
  }

  return anchor.type === "text";
}

export function filterCommentsInView(
  comments: CommentData[],
  view?: string,
): CommentData[] {
  return comments.filter(({ anchor }) => {
    // Document-level comments (no anchor) are shown in every view
    if (!anchor) {
      return true;
    }
    return commentInView(anchor, view);
  });
}

export function getCommentSnippet(
  anchor: CommentAnchor | undefined,
  resource: Resource,
  maxLength: number = 80,
): string | undefined {
  if (!anchor) {
    return undefined;
  }

  const text = getTextForAnchor(anchor, resource);
  if (!text) {
    return undefined;
  }

  const snippet = text.slice(anchor.startCharacter, anchor.endCharacter);
  if (snippet.length <= maxLength) {
    return snippet;
  }
  return snippet.slice(0, maxLength) + "…";
}

export function getCommentViewLabel(anchor: CommentAnchor | undefined): string {
  if (!anchor) {
    return "Document";
  }
  if (anchor.type === "ocr") {
    return `OCR ${anchor.language}`;
  }
  return "Text";
}

export function getViewForAnchor(
  anchor: CommentAnchor | undefined,
): string | undefined {
  if (!anchor) {
    return undefined;
  }
  if (anchor.type === "ocr") {
    return `ocr.${anchor.language}`;
  }
  return "text";
}

function getTextForAnchor(
  anchor: CommentAnchor,
  resource: Resource,
): string | undefined {
  if (anchor.type === "text") {
    return resource.text?.contents;
  }
  if (anchor.type === "ocr" && resource.ocr) {
    return resource.ocr[anchor.language]?.contents;
  }
  return undefined;
}
