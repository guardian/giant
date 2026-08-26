import authFetch from "../util/auth/authFetch";
import authUploadWithProgress, {
  ProgressHandler,
} from "../util/auth/authUploadWithProgress";
import { Collection, Language } from "../types/Collection";
import { WorkspaceUploadMetadata } from "../components/Uploads/UploadFiles";
import { z } from "zod";

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

const LanguageArray = z.array(Language);

// The supported languages are hardcoded on the backend so we only need to fetch them once.
let supportedLanguages: Language[] | undefined = undefined;

export async function fetchSupportedLanguages(): Promise<Language[]> {
  if (!supportedLanguages) {
    return await authFetch("/api/ingestion/languages")
      .then((res) => res.json())
      .then((json: any) => {
        const parsed = LanguageArray.safeParse(json);
        if (!parsed.success) {
          console.error(
            "Failed to parse response from /api/ingestion/languages",
            parsed.error,
          );
          return [];
        }
        supportedLanguages = parsed.data;
        return parsed.data;
      })
      .catch((err) => {
        console.error(
          "Failed to fetch supported languages from /api/ingestion/languages",
          err,
        );
        return [];
      });
  }

  return supportedLanguages;
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
