import authFetch from '../util/auth/authFetch';

export function deleteBlob(uri: string): Promise<Response> {
    // Do not delete blob if it has children
    return authFetch(`/api/blobs/${uri}?checkChildren=true`, {method: "DELETE"})
}

export function reprocessBlob(itemId: string) {
    return authFetch(`/api/blobs/${itemId}/reprocess`, {
        headers: new Headers({'Content-Type': 'application/json'}),
        method: 'POST',
        body: JSON.stringify({
            "rerunFailed": true,
            "rerun": true
        })
    }).then(res => res.status === 204);
}
