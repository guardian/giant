import { getDocumentIconInfo } from "./fileTypeIcon";

describe("getDocumentIconInfo", () => {
  test("returns document icon for undefined category", () => {
    const result = getDocumentIconInfo(undefined);
    expect(result.className).toBe("search-result__icon-document");
  });

  test("returns document icon for unknown category", () => {
    const result = getDocumentIconInfo("unknown");
    expect(result.className).toBe("search-result__icon-document");
  });

  test("returns pdf icon for pdf category", () => {
    const result = getDocumentIconInfo("pdf");
    expect(result.className).toBe("search-result__icon-pdf");
  });

  test("returns video icon for video category", () => {
    const result = getDocumentIconInfo("video");
    expect(result.className).toBe("search-result__icon-video");
  });

  test("returns audio icon for audio category", () => {
    const result = getDocumentIconInfo("audio");
    expect(result.className).toBe("search-result__icon-audio");
  });

  test("returns image icon for image category", () => {
    const result = getDocumentIconInfo("image");
    expect(result.className).toBe("search-result__icon-image");
  });

  test("returns spreadsheet icon for spreadsheet category", () => {
    const result = getDocumentIconInfo("spreadsheet");
    expect(result.className).toBe("search-result__icon-spreadsheet");
  });

  test("returns presentation icon for presentation category", () => {
    const result = getDocumentIconInfo("presentation");
    expect(result.className).toBe("search-result__icon-presentation");
  });

  test("returns archive icon for archive category", () => {
    const result = getDocumentIconInfo("archive");
    expect(result.className).toBe("search-result__icon-archive");
  });

  test("returns web icon for web category", () => {
    const result = getDocumentIconInfo("web");
    expect(result.className).toBe("search-result__icon-web");
  });

  test("returns email icon for email category", () => {
    const result = getDocumentIconInfo("email");
    expect(result.className).toBe("search-result__icon-email");
  });

  test("returns technical icon for technical category", () => {
    const result = getDocumentIconInfo("technical");
    expect(result.className).toBe("search-result__icon-technical");
  });

  test("returns document icon for document category", () => {
    const result = getDocumentIconInfo("document");
    expect(result.className).toBe("search-result__icon-document");
  });
});
