import { TiDocument as DocumentIcon } from "react-icons/ti";
import { MdPictureAsPdf as PdfIcon } from "react-icons/md";
import { MdMovie as MovieIcon } from "react-icons/md";
import { MdMic as AudioIcon } from "react-icons/md";
import { MdImage as ImageIcon } from "react-icons/md";
import { MdGridOn as GridIcon } from "react-icons/md";
import { MdSlideshow as SlideshowIcon } from "react-icons/md";
import { MdArchive as ArchiveIcon } from "react-icons/md";
import { MdWeb as WebIcon } from "react-icons/md";
import { MdEmail as EmailIcon } from "react-icons/md";
import { MdCode as CodeIcon } from "react-icons/md";
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
