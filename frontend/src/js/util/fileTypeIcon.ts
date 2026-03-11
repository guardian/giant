import DocumentIcon from "react-icons/lib/ti/document";
import PdfIcon from "react-icons/lib/md/picture-as-pdf";
import MovieIcon from "react-icons/lib/md/movie";
import AudioIcon from "react-icons/lib/md/audiotrack";
import ImageIcon from "react-icons/lib/md/image";
import GridIcon from "react-icons/lib/md/grid-on";
import SlideshowIcon from "react-icons/lib/md/slideshow";
import ArchiveIcon from "react-icons/lib/md/archive";
import WebIcon from "react-icons/lib/md/web";
import React from "react";

const PDF_MIMES = ["application/pdf"];

const SPREADSHEET_MIMES = [
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel.sheet.binary.macroenabled.12",
  "application/vnd.ms-excel.sheet.macroenabled.12",
  "application/vnd.ms-spreadsheetml",
  "text/csv",
];

const PRESENTATION_MIMES = [
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.openxmlformats-officedocument.presentationml.slideshow",
  "application/vnd.ms-powerpoint.presentation.macroenabled.12",
  "application/vnd.ms-powerpoint.slideshow.macroenabled.12",
  "application/vnd.apple.keynote",
];

const ARCHIVE_MIMES = [
  "application/zip",
  "application/gzip",
  "application/x-tar",
  "application/x-gtar",
  "application/x-bzip2",
  "application/x-compress",
  "application/zlib",
  "application/java-archive",
];

const WEB_MIMES = ["text/html", "application/xhtml+xml"];

type IconInfo = {
  icon: React.ComponentType;
  className: string;
};

export function getDocumentIconInfo(mimeTypes: string[] | undefined): IconInfo {
  if (!mimeTypes || mimeTypes.length === 0) {
    return { icon: DocumentIcon, className: "search-result__icon-document" };
  }

  const mime = mimeTypes[0];

  if (mime.startsWith("video/")) {
    return { icon: MovieIcon, className: "search-result__icon-video" };
  }
  if (mime.startsWith("audio/")) {
    return { icon: AudioIcon, className: "search-result__icon-audio" };
  }
  if (mime.startsWith("image/")) {
    return { icon: ImageIcon, className: "search-result__icon-image" };
  }
  if (PDF_MIMES.some((m) => mime.startsWith(m))) {
    return { icon: PdfIcon, className: "search-result__icon-pdf" };
  }
  if (SPREADSHEET_MIMES.some((m) => mime.startsWith(m))) {
    return { icon: GridIcon, className: "search-result__icon-spreadsheet" };
  }
  if (PRESENTATION_MIMES.some((m) => mime.startsWith(m))) {
    return {
      icon: SlideshowIcon,
      className: "search-result__icon-presentation",
    };
  }
  if (ARCHIVE_MIMES.some((m) => mime.startsWith(m))) {
    return { icon: ArchiveIcon, className: "search-result__icon-archive" };
  }
  if (WEB_MIMES.some((m) => mime.startsWith(m))) {
    return { icon: WebIcon, className: "search-result__icon-web" };
  }

  return { icon: DocumentIcon, className: "search-result__icon-document" };
}
