export type Metadata = {
  blobId: string;
  ingestId: string;
};

type IngestionError = {
  message: string;
  stackTrace?: string;
};

type IngestionErrorWithEventType = {
  eventType: string;
  errors: IngestionError[];
};

export type Status = "Unknown" | "Started" | "Success" | "Failure";

export type IngestionEventStatus = {
  eventTime: Date;
  eventType: string;
  eventStatus: Status;
};

export type BlobStatus = {
  metadata: Metadata;
  paths: string[];
  fileSize?: number;
  ingestStart: Date;
  mostRecentEvent: Date;
  eventStatuses: IngestionEventStatus[];
  extractorStatuses: ExtractorStatus[];
  errors: IngestionErrorWithEventType[];
  workspaceName: string;
  mimeTypes: string[];
  infiniteLoop: boolean;
};

export type IngestionTable = {
  title: string;
  blobs: BlobStatus[];
};

export type ExtractorStatusUpdate = {
  eventTime?: Date;
  status?: Status;
};

export type ExtractorStatus = {
  extractorType: string;
  statusUpdates: ExtractorStatusUpdate[];
};

export const extractorStatusColors = {
  Success: "success",
  Started: "primary",
  Failure: "danger",
  Unknown: "default",
};

export enum FilterState {
  All = "all",
  ErrorsOnly = "errorsOnly",
}
