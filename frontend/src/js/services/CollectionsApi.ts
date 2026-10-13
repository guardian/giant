import authFetch from "../util/auth/authFetch";
import authUploadWithProgress, {
  ProgressHandler,
} from "../util/auth/authUploadWithProgress";
import {
  Collection,
  Language,
  LanguageSchema,
  collectionSchema,
  collectionWithUsersSchema,
  collectionsSchema,
} from "../types/Collection";
import { WorkspaceUploadMetadata } from "../components/Uploads/UploadFiles";
import { z } from "zod";

export async function newCollection(name: string) {
  const res = await authFetch("/api/collections", {
    headers: new Headers({ "Content-Type": "application/json" }),
    method: "POST",
    body: JSON.stringify({ name: name }),
  });
  const data: unknown = await res.json();
  const result = collectionSchema.safeParse(data);
  if (!result.success) throw result.error;
  return result.data;
}

export async function fetchCollections(): Promise<Collection[]> {
  const res = await authFetch("/api/collections");
  const data: unknown = await res.json();
  const result = collectionsSchema.safeParse(data);
  if (!result.success) throw result.error;
  return result.data;
}

export async function fetchCollection(
  uri: string,
): Promise<Collection | undefined> {
  const res = await authFetch(`/api/collections/${uri}`);
  if (res.status === 404) return undefined;
  const data: unknown = await res.json();
  const result = collectionWithUsersSchema.safeParse(data);
  if (!result.success) throw result.error;
  return result.data;
}

const LanguageArray = z.array(LanguageSchema);

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
