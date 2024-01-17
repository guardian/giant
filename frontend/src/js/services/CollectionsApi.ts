import authFetch from '../util/auth/authFetch';
import authUploadWithProgress, { ProgressHandler } from '../util/auth/authUploadWithProgress';
import { Collection } from '../types/Collection';
import { WorkspaceUploadMetadata } from '../components/Uploads/UploadFiles';

export function newCollection(name: string): Promise<Collection> {
    return authFetch('/api/collections', {
        headers: new Headers({'Content-Type': 'application/json'}),
        method: 'POST',
        body: JSON.stringify({name: name})
    }).then(res => res.json());
}

export function fetchCollections(): Promise<Collection[]> {
    return authFetch('/api/collections').then(res => res.json());
}

export function fetchCollection(uri: string): Promise<Collection | undefined> {
    return authFetch(`/api/collections/${uri}`).then(res => {
        if(res.status === 404) {
            return undefined;
        }

        return res.json();
    });
}

type CreateIngestionResponse = { uri: string, bucket: string, region: string, endpoint?: string };

export function createNewIngestion(collectionUri: string, ingestionName: string): Promise<CreateIngestionResponse> {
    return authFetch(`/api/collections/${collectionUri}`, {
        headers: new Headers({'Content-Type': 'application/json'}),
        method: 'POST',
        body: JSON.stringify({fixed: false, languages: ['english'], name: ingestionName })
    }).then(res => res.json());
}

export function uploadFileToIngestion(ingestionName: string, uploadId: string, file: File, path: string, workspace?: WorkspaceUploadMetadata, onProgress?: ProgressHandler) {
    return authUploadWithProgress(
      `/api/collections/${ingestionName}`, uploadId, file, path, workspace, onProgress
    ).then((res: any) => JSON.parse(res));
}

export function uploadFileWithNewIngestion(collectionUri: string, ingestionName: string, uploadId: string, file: File, path: string, workspace?: WorkspaceUploadMetadata, onProgress?: ProgressHandler) {
    return authUploadWithProgress(
      `/api/collections/ingestion/upload/${collectionUri}`, uploadId, file, path, workspace, onProgress, ingestionName
    ).then((res: any) => JSON.parse(res));
}
