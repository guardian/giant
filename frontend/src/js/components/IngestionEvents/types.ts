export type Metadata = {
    blobId: string;
    ingestId: string;
}

export type BlobStatus =  {
    metadata: Metadata;
    paths: string[];
    fileSize?: number;
    ingestStart: Date;
    mostRecentEvent: Date;
    extractorStatuses: ExtractorStatus[];
    errors: string[];
    workspaceName: string;
}

export type IngestionTable = {
    title: string;
    blobs: BlobStatus[]
}

export type Status = "Unknown" | "Started" | "Success" | "Failure"

export type ExtractorStatusUpdate = {
    eventTime?: Date;
    status?: Status
}

export type ExtractorStatus = {
    extractorType: string;
    statusUpdates: ExtractorStatusUpdate[];
}

export const extractorStatusColors = {
    "Success": "success",
    "Started": "primary",
    "Failure": "danger",
    "Unknown": "default"
}

export type FilterState = "all" | "errorsOnly"