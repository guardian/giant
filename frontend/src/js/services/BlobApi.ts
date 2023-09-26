import authFetch from '../util/auth/authFetch';

export function deleteBlobForAdmin(uri: string): Promise<Response> {
    // Do not delete blob if it has children
    return authFetch(`/api/blobs/${uri}?checkChildren=true&isAdminDelete=true`, {method: "DELETE"})
}

export function deleteBlob(blobUri: string) {
    return authFetch(`/api/blobs/${blobUri}?checkChildren=true&isAdminDelete=false`, {method: "DELETE"});
}
