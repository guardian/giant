import DocumentIcon from "react-icons/lib/ti/document";
import PdfIcon from "react-icons/lib/md/picture-as-pdf";
import MovieIcon from "react-icons/lib/md/movie";
import AudioIcon from "react-icons/lib/md/mic";
import ImageIcon from "react-icons/lib/md/image";
import GridIcon from "react-icons/lib/md/grid-on";
import SlideshowIcon from "react-icons/lib/md/slideshow";
import ArchiveIcon from "react-icons/lib/md/archive";
import WebIcon from "react-icons/lib/md/web";
import EmailIcon from "react-icons/lib/md/email";
import CodeIcon from "react-icons/lib/md/code";
import React from "react";

type IconInfo = {
  icon: React.ComponentType;
  className: string;
};

// Maps file categories (from the backend's MimeDetails.categoryFor) to icons.
// Valid categories: document, pdf, video, audio, image, spreadsheet, presentation, archive, web, email, technical
const categoryIconMap: Record<string, IconInfo> = {
  pdf: { icon: PdfIcon, className: "search-result__icon-pdf" },
  video: { icon: MovieIcon, className: "search-result__icon-video" },
  audio: { icon: AudioIcon, className: "search-result__icon-audio" },
  image: { icon: ImageIcon, className: "search-result__icon-image" },
  spreadsheet: { icon: GridIcon, className: "search-result__icon-spreadsheet" },
  presentation: {
    icon: SlideshowIcon,
    className: "search-result__icon-presentation",
  },
  archive: { icon: ArchiveIcon, className: "search-result__icon-archive" },
  web: { icon: WebIcon, className: "search-result__icon-web" },
  email: { icon: EmailIcon, className: "search-result__icon-email" },
  technical: { icon: CodeIcon, className: "search-result__icon-technical" },
};

const defaultIcon: IconInfo = {
  icon: DocumentIcon,
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
