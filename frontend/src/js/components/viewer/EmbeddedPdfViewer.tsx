import React, { useLayoutEffect, useRef } from "react";
import PropTypes from "prop-types";

const viewerLocation = "/third-party/pdfjs-6.5.438-dist/web/viewer.html";

type ViewerWindow = Window & {
  PDFViewerApplicationOptions?: {
    set(name: string, value: boolean | number): void;
  };
};

export function EmbeddedPdfViewer({ doc }: { doc: string }) {
  const url = `${viewerLocation}?file=${encodeURIComponent(doc)}`;

  const iframe = useRef<HTMLIFrameElement>(null);

  useLayoutEffect(() => {
    const configureViewer = (event: Event) => {
      const source = (event as CustomEvent<{ source: ViewerWindow }>).detail
        .source;
      if (source !== iframe.current?.contentWindow) return;

      const options = source.PDFViewerApplicationOptions;
      options?.set("supportsDownloading", false);
      options?.set("supportsPrinting", false);
      options?.set("annotationEditorMode", -1); // Disable annotation editing.
    };

    document.addEventListener("webviewerloaded", configureViewer);
    return () =>
      document.removeEventListener("webviewerloaded", configureViewer);
  }, []);

  return (
    <iframe
      title="Document Preview"
      style={{ height: "100%", border: "none" }}
      src={url}
      ref={iframe}
    ></iframe>
  );
}

EmbeddedPdfViewer.propTypes = {
  doc: PropTypes.string.isRequired,
};
