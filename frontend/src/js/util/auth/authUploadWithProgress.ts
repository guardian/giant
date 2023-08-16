import store from "./../store";
import { handleResponseFromAuthRequest } from "./handleResponseFromAuthRequest";
import { WorkspaceUploadMetadata } from "../../components/Uploads/UploadFiles";

export type ProgressHandler = (loadedBytes: number, totalBytes: number) => void;
const RETRY_MAX_LIMIT = 3;

export default function authUploadWithProgress(
  url: string,
  uploadId: string,
  file: File,
  path: string,
  workspace?: WorkspaceUploadMetadata,
  onProgress?: ProgressHandler
) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const retryInitialCount = 0;

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        if (onProgress) {
          onProgress(e.loaded, e.total);
        }
      }
    };

    processRequest(
      xhr,
      url,
      file,
      path,
      uploadId,
      retryInitialCount,
      resolve,
      reject,
      workspace
    );
  });
}

const processRequest = (
  xhr: XMLHttpRequest,
  url: string,
  file: File,
  path: string,
  uploadId: string,
  retryCount: number,
  resolve: (value: unknown) => void,
  reject: (reason?: any) => void,
  workspace?: WorkspaceUploadMetadata
) => {
  xhr.onloadend = () => {
    handleResponseFromAuthRequest(
      xhr.status,
      xhr.getResponseHeader("X-Offer-Authorization")
    );
    if (xhr.status >= 200 && xhr.status < 300) {
      resolve(xhr.response);
    } else {
      if (retryCount < RETRY_MAX_LIMIT) {
        retryRequest(
          retryCount + 1,
          xhr,
          url,
          file,
          path,
          uploadId,
          resolve,
          reject,
          workspace
        );
      } else {
        console.error(
          `request failed due to ${xhr.responseText} - status: ${xhr.status}, retry: ${retryCount} for url: ${url}`
        );
        reject(`${xhr.status} - ${xhr.responseText}`);
      }
    }
  };

  sendRequest(xhr, url, file, path, uploadId, retryCount, workspace);
};

const retryRequest = (
  retryCount: number,
  xhr: XMLHttpRequest,
  url: string,
  file: File,
  path: string,
  uploadId: string,
  resolve: (value: unknown) => void,
  reject: (reason?: any) => void,
  workspace?: WorkspaceUploadMetadata
) => {
  const limit = retryCount ? Math.pow(2, retryCount - 1) * 1000 : 0;
  const pause = Math.random() * limit;

  setTimeout(() => {
    processRequest(
      xhr,
      url,
      file,
      path,
      uploadId,
      retryCount,
      resolve,
      reject,
      workspace
    );
  }, pause);
};

const sendRequest = (
  xhr: XMLHttpRequest,
  url: string,
  file: File,
  path: string,
  uploadId: string,
  retryCount: number,
  workspace?: WorkspaceUploadMetadata
) => {
  xhr.open("POST", url);

  // this isn't nice, but I don't want to get bogged down typing all the redux stuff
  const state = store.getState() as any;
  xhr.setRequestHeader("Authorization", "Bearer " + state.auth.jwtToken);

  xhr.setRequestHeader("Content-Type", file.type);
  xhr.setRequestHeader("Content-Location", encodeURIComponent(path));
  // TODO MRB: this is a lot of headers which is a bit silly and also potentially too 'custom'
  // for the more intrusive firewalls of the world. Uploading as FormData is probably cleaner
  // but we'd need to check it's still fine for big'ish files
  xhr.setRequestHeader("X-PFI-Upload-Id", uploadId);
  if (workspace) {
    xhr.setRequestHeader("X-PFI-Workspace-Id", workspace.workspaceId);
    xhr.setRequestHeader(
      "X-PFI-Workspace-Parent-Node-Id",
      workspace.parentNodeId
    );
    xhr.setRequestHeader("X-PFI-Workspace-Name", workspace.workspaceName);
  }
  xhr.setRequestHeader("X-PFI-Last-Modified", file.lastModified.toString());
  xhr.setRequestHeader("X-PFI-Retry-Count", retryCount.toString());
  xhr.send(file);
};
