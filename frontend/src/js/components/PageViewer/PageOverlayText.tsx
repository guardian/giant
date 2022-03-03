import React, { FC } from "react";
import { PdfText } from "./model";

type PageOverlayTextProps = {
  text: PdfText;
};
// This renders invisible text over the PDF to allow selection
// Selection is useful for copy-paste and making comments
export const PageOverlayText: FC<PageOverlayTextProps> = ({ text }) => {
  const { left, top, fontSize, fontFamily, transform, value } = text;
  return (
    <div
      className="pfi-page__pdf-text"
      style={{ left, top, fontSize, fontFamily, transform }}
    >
      {value}
    </div>
  );
};
