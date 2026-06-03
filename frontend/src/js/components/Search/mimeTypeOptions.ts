import { SelectOption } from "./chipDisplayUtils";

/** Well-known MIME type options with friendly labels for the multi-select dropdown */
export const MIME_TYPE_OPTIONS: SelectOption[] = [
  { value: "application/pdf", label: "PDF" },
  { value: "text/plain", label: "Plain Text" },
  { value: "text/html", label: "HTML" },
  { value: "text/csv", label: "CSV" },
  { value: "image/jpeg", label: "JPEG Image" },
  { value: "image/png", label: "PNG Image" },
  { value: "image/tiff", label: "TIFF Image" },
  { value: "application/msword", label: "Word (.doc)" },
  {
    value:
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    label: "Word (.docx)",
  },
  { value: "application/vnd.ms-excel", label: "Excel (.xls)" },
  {
    value: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    label: "Excel (.xlsx)",
  },
  { value: "application/vnd.ms-powerpoint", label: "PowerPoint (.ppt)" },
  {
    value:
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    label: "PowerPoint (.pptx)",
  },
  { value: "message/rfc822", label: "Email (.eml)" },
  { value: "application/zip", label: "ZIP Archive" },
  { value: "audio/mpeg", label: "MP3 Audio" },
  { value: "video/mp4", label: "MP4 Video" },
];
