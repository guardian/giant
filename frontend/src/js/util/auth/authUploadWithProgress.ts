import store from './../store';
import { handleResponseFromAuthRequest } from './handleResponseFromAuthRequest';
import { WorkspaceUploadMetadata } from '../../components/Uploads/UploadFiles';

export type ProgressHandler = (loadedBytes: number, totalBytes: number) => void

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
        xhr.upload.onprogress = (e) => {
            if (e.lengthComputable) {
                if(onProgress) {
                    onProgress(e.loaded, e.total);
                }
            }
        };

        xhr.onloadend = () => {
            handleResponseFromAuthRequest(
                xhr.status,
                xhr.getResponseHeader('X-Offer-Authorization')
            );
            if (xhr.status >= 200 && xhr.status < 300) {
                resolve(xhr.response);
            } else {
                reject(`${xhr.status} - ${xhr.responseText}`);
            }
        };

        xhr.open('POST', url);

        // this isn't nice, but I don't want to get bogged down typing all the redux stuff
        const state = store.getState() as any;
        xhr.setRequestHeader('Authorization', 'Bearer ' + state.auth.jwtToken);

        xhr.setRequestHeader('Content-Type', file.type);
        xhr.setRequestHeader('Content-Location', encodeURIComponent(path));
        // TODO MRB: this is a lot of headers which is a bit silly and also potentially too 'custom'
        // for the more intrusive firewalls of the world. Uploading as FormData is probably cleaner
        // but we'd need to check it's still fine for big'ish files
        xhr.setRequestHeader('X-PFI-Upload-Id', uploadId);
        if(workspace) {
            xhr.setRequestHeader('X-PFI-Workspace-Id', workspace.workspaceId);
            xhr.setRequestHeader('X-PFI-Workspace-Parent-Node-Id', workspace.parentNodeId);
            xhr.setRequestHeader('X-PFI-Workspace-Name', workspace.workspaceName);
        }
        xhr.setRequestHeader('X-PFI-Last-Modified', file.lastModified.toString());
        xhr.send(file);
    });
}
