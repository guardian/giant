import authFetch from '../util/auth/authFetch';

export function deleteBlob(uri: string): Promise<Response> {
    // Do not delete blob if it has children
    return authFetch(`/api/blobs/${uri}?checkChildren=true`, {method: "DELETE"})
}
