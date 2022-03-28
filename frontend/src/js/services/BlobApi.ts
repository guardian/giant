import authFetch from '../util/auth/authFetch';
import { Resource } from '../types/Resource';

export function deleteBlob(uri: string): Promise<Response> {

    return authFetch(`/api/blobs/${uri}`, {method: "DELETE"})
}
