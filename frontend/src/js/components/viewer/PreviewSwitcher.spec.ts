import { previewLabelForMimeTypes } from "./PreviewSwitcher";

describe("previewLabelForMimeTypes", () => {
  test("returns 'Video' for video mime types", () => {
    expect(previewLabelForMimeTypes(["video/mp4"])).toBe("Video");
  });

  test("returns 'Audio' for audio mime types", () => {
    expect(previewLabelForMimeTypes(["audio/mpeg"])).toBe("Audio");
  });

  test("returns 'Preview' for non-media mime types", () => {
    expect(previewLabelForMimeTypes(["application/pdf"])).toBe("Preview");
  });

  test("prefers 'Video' over 'Audio' when both are present", () => {
    expect(previewLabelForMimeTypes(["audio/mpeg", "video/mp4"])).toBe("Video");
  });
});
