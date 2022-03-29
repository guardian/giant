import authFetch from '../util/auth/authFetch';

export function deleteBlob(uri: string): Promise<Response> {

    return authFetch(`/api/blobs/${uri}?deleteFolders=true`, {method: "DELETE"})
}
