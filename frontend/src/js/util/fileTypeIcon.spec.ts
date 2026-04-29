import { getDocumentIconInfo } from "./fileTypeIcon";

describe("getDocumentIconInfo", () => {
  test("returns document icon for undefined mimeTypes", () => {
    const result = getDocumentIconInfo(undefined);
    expect(result.className).toBe("search-result__icon-document");
  });

  test("returns document icon for empty array", () => {
    const result = getDocumentIconInfo([]);
    expect(result.className).toBe("search-result__icon-document");
  });

  test("returns pdf icon for application/pdf", () => {
    const result = getDocumentIconInfo(["application/pdf"]);
    expect(result.className).toBe("search-result__icon-pdf");
  });

  test("returns video icon for video/ mime types", () => {
    const result = getDocumentIconInfo(["video/mp4"]);
    expect(result.className).toBe("search-result__icon-video");
  });

  test("returns audio icon for audio/ mime types", () => {
    const result = getDocumentIconInfo(["audio/mpeg"]);
    expect(result.className).toBe("search-result__icon-audio");
  });

  test("returns image icon for image/ mime types", () => {
    const result = getDocumentIconInfo(["image/png"]);
    expect(result.className).toBe("search-result__icon-image");
  });

  test("returns spreadsheet icon for Excel mime types", () => {
    const result = getDocumentIconInfo(["application/vnd.ms-excel"]);
    expect(result.className).toBe("search-result__icon-spreadsheet");
  });

  test("returns spreadsheet icon for CSV", () => {
    const result = getDocumentIconInfo(["text/csv"]);
    expect(result.className).toBe("search-result__icon-spreadsheet");
  });

  test("returns presentation icon for PowerPoint", () => {
    const result = getDocumentIconInfo(["application/vnd.ms-powerpoint"]);
    expect(result.className).toBe("search-result__icon-presentation");
  });

  test("returns archive icon for zip", () => {
    const result = getDocumentIconInfo(["application/zip"]);
    expect(result.className).toBe("search-result__icon-archive");
  });

  test("returns web icon for text/html", () => {
    const result = getDocumentIconInfo(["text/html"]);
    expect(result.className).toBe("search-result__icon-web");
  });

  test("returns document icon for unknown mime type", () => {
    const result = getDocumentIconInfo(["application/octet-stream"]);
    expect(result.className).toBe("search-result__icon-document");
  });

  test("uses only the first mime type", () => {
    const result = getDocumentIconInfo(["application/pdf", "text/html"]);
    expect(result.className).toBe("search-result__icon-pdf");
  });
});
