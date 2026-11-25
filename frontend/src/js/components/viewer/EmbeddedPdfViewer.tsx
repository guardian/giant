import React from "react";
import PropTypes from "prop-types";

const viewerLocation = "/third-party/pdfjs-6.5.438-dist/web/viewer.html";

export function EmbeddedPdfViewer({ doc }: { doc: string }) {
  const url = `${viewerLocation}?file=${encodeURIComponent(doc)}`;

  return (
    <iframe
      title="Document Preview"
      style={{ height: "100%", border: "none" }}
      src={url}
    ></iframe>
  );
}

EmbeddedPdfViewer.propTypes = {
  doc: PropTypes.string.isRequired,
};
