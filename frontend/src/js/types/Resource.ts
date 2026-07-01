import PropTypes from "prop-types";
import { PartialUser } from "./User";

export type ProcessingStage =
  | { type: "processing"; tasksRemaining: number; note?: string }
  | { type: "processed" }
  | { type: "failed" };

export type BasicResource = {
  uri: string;
  type: "file" | "directory" | "ingestion" | "collection" | "blob" | "email";
  isExpandable: boolean;
  processingStage: ProcessingStage;
  display?: string;
  children?: BasicResource[];
  parents?: BasicResource[];
};

export type BasicResourceWithSingleBlobChild = BasicResource & {
  type: "file";
  children: [BasicResource];
};

export const basicResourcePropType = PropTypes.shape({
  uri: PropTypes.string.isRequired,
  type: PropTypes.string.isRequired,
});

export type HighlightType = "search_result" | "comment";

export type Highlight = {
  id: string;
  type: HighlightType;
  range: ResourceRange;
};

export type ResourceRange = {
  startCharacter: number;
  endCharacter: number;
};

export type CommentData = {
  // from the server
  id: string;
  author: PartialUser;
  postedAt: number;
  text: string;
  anchor?: CommentAnchor;
};

export type CommentAnchor =
  | { type: "text"; startCharacter: number; endCharacter: number }
  | {
      type: "ocr";
      language: string;
      startCharacter: number;
      endCharacter: number;
    };

export type HighlightableText = {
  contents: string;
  highlights: Highlight[];
};

export type LanguageDataField = {
  detectedLanguageCode?: string;
  translation?: string;
};

export type OcrLanguageData = {
  detectedLanguageCode: {
    [lang: string]: string;
  };
  translation: {
    [lang: string]: string;
  };
};

export type LanguageData = {
  text?: LanguageDataField;
  emailSubject?: LanguageDataField;
  emailBody?: LanguageDataField;
  ocr?: OcrLanguageData;
};

export type Resource = BasicResource & {
  extracted: boolean;
  mimeTypes: string[];
  fileSize: number;
  parents: BasicResource[];
  children: BasicResource[];
  comments: CommentData[];
  selection?: ResourceRange;
  previewStatus: string;
  // The API omits `text` entirely for resources with no extracted text
  // (e.g. large documents whose document-level extraction was skipped/failed).
  // It must be optional so call sites are forced to guard against it.
  text?: HighlightableText;
  ocr?: {
    [lang: string]: HighlightableText;
  };
  transcript?: {
    [lang: string]: HighlightableText;
  };
  vttTranscript?: {
    [lang: string]: HighlightableText;
  };
  languageData?: LanguageData;
};

export const resourcePropType = PropTypes.shape({
  uri: PropTypes.string.isRequired,
  type: PropTypes.string.isRequired,
  parents: PropTypes.arrayOf(basicResourcePropType).isRequired,
  children: PropTypes.arrayOf(basicResourcePropType).isRequired,
});
