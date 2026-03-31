import authFetch from "../util/auth/authFetch";
import authUploadWithProgress, {
  ProgressHandler,
} from "../util/auth/authUploadWithProgress";
import { Collection } from "../types/Collection";
import { WorkspaceUploadMetadata } from "../components/Uploads/UploadFiles";

export function newCollection(name: string): Promise<Collection> {
  return authFetch("/api/collections", {
    headers: new Headers({ "Content-Type": "application/json" }),
    method: "POST",
    body: JSON.stringify({ name: name }),
  }).then((res) => res.json());
}

export function fetchCollections(): Promise<Collection[]> {
  return authFetch("/api/collections").then((res) => res.json());
}

export function fetchCollection(uri: string): Promise<Collection | undefined> {
  return authFetch(`/api/collections/${uri}`).then((res) => {
    if (res.status === 404) {
      return undefined;
    }

    return res.json();
  });
}

export type LanguageOption = { key: string; value: string; text: string };

export function fetchSupportedLanguages(): Promise<LanguageOption[]> {
  return authFetch("/api/ingestion/languages")
    .then((res) => res.json())
    .then((languages: string[]) =>
      languages.map((lang) => ({
        key: lang,
        value: lang,
        text: lang.charAt(0).toUpperCase() + lang.slice(1),
      })),
    );
}

export function uploadFileWithNewIngestion(
  collectionUri: string,
  ingestionName: string,
  uploadId: string,
  file: File,
  path: string,
  isFastLane: boolean,
  language: string,
  workspace?: WorkspaceUploadMetadata,
  onProgress?: ProgressHandler,
) {
  return authUploadWithProgress(
    `/api/collections/ingestion/upload/${collectionUri}`,
    uploadId,
    file,
    path,
    isFastLane,
    language,
    workspace,
    onProgress,
    ingestionName,
  ).then((res: any) => JSON.parse(res));
}
