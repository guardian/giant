import authFetch from '../util/auth/authFetch';
import { Resource } from '../types/Resource';

export function deleteBlob(uri: string): Promise<Resource> {

    return authFetch(`/api/blobs/${uri}`, {method: "DELETE"}).then(res => res.json());
}
