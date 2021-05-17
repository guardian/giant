import authFetch from '../util/auth/authFetch';
import { ResourcesForExtractionFailure, ExtractionFailures } from '../types/ExtractionFailures';

export function fetchExtractionFailures(): Promise<ExtractionFailures> {
    return authFetch('/api/extractions/failures').then(res => res.json());
}

export function fetchResourcesForExtractionFailure(extractorName: string, stackTrace: string, page: number): Promise<ResourcesForExtractionFailure> {
    const request = {
        extractorName,
        stackTrace
    };

    return authFetch(`/api/extractions/failures/resources?page=${page}`, {
        headers: new Headers({'Content-Type': 'application/json'}),
        method: 'POST',
        body: JSON.stringify(request)
    }).then(res => res.json());
}

export function fetchMimeTypeCoverage() {
    return authFetch('/api/mimetypes/coverage')
        .then(res => res.json());
}
