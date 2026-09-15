import { TiDocument } from "react-icons/ti";
import { MdPictureAsPdf } from "react-icons/md";
import { MdMovie } from "react-icons/md";
import { MdMic } from "react-icons/md";
import { MdImage } from "react-icons/md";
import { MdGridOn } from "react-icons/md";
import { MdSlideshow } from "react-icons/md";
import { MdArchive } from "react-icons/md";
import { MdWeb } from "react-icons/md";
import { MdEmail } from "react-icons/md";
import { MdCode } from "react-icons/md";
import React from "react";

type IconInfo = {
  icon: React.ComponentType;
  className: string;
};

// Maps file categories (from the backend's MimeDetails.categoryFor) to icons.
// Valid categories: document, pdf, video, audio, image, spreadsheet, presentation, archive, web, email, technical
const categoryIconMap: Record<string, IconInfo> = {
  pdf: { icon: MdPictureAsPdf, className: "search-result__icon-pdf" },
  video: { icon: MdMovie, className: "search-result__icon-video" },
  audio: { icon: MdMic, className: "search-result__icon-audio" },
  image: { icon: MdImage, className: "search-result__icon-image" },
  spreadsheet: { icon: MdGridOn, className: "search-result__icon-spreadsheet" },
  presentation: {
    icon: MdSlideshow,
    className: "search-result__icon-presentation",
  },
  archive: { icon: MdArchive, className: "search-result__icon-archive" },
  web: { icon: MdWeb, className: "search-result__icon-web" },
  email: { icon: MdEmail, className: "search-result__icon-email" },
  technical: { icon: MdCode, className: "search-result__icon-technical" },
};

const defaultIcon: IconInfo = {
  icon: TiDocument,
  className: "search-result__icon-document",
};

export function getDocumentIconInfo(
  fileCategory: string | undefined,
): IconInfo {
  if (!fileCategory) {
    return defaultIcon;
  }
  return categoryIconMap[fileCategory] ?? defaultIcon;
}
