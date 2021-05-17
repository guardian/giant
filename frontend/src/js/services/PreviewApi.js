import authFetch from '../util/auth/authFetch';

export function authPreviewLink(uri, filename) {
    if (filename) {
        return `/api/preview/auth/${uri}?filename=${filename}`;
    } else {
        return `/api/preview/auth/${uri}`;
    }
}

export function getPreviewType(uri) {
    return authFetch(`/api/preview/download/${uri}`, { method: 'HEAD' }).then(r => {
        if(r.status === 200) {
            return r.headers.get('Content-Type');
        } else {
            return null;
        }
    });
}

export function getPreviewBlob(uri) {
    return authFetch(`/api/preview/download/${uri}`)
        .then(r => r.blob())
        .then(blob => {
            return URL.createObjectURL(blob);
        });
}

export function getPreviewImage(uri) {
    return new Promise((resolve, reject) => {
        getPreviewBlob(uri).then(src => {
            const elem = document.createElement('img');
            elem.src = src;

            elem.onload = () => {
                const { width, height } = elem;
                resolve({ src, width, height });
            };
        }).catch(e => reject(e));
    });
}

export function fetchPreviewLink(uri) {
    return authFetch(`/api/preview/generate/${uri}`, { method: 'POST' }).then(() => {
        return authFetch(authPreviewLink(uri), { credentials: 'same-origin' })
            .then(r => r.text());
    });
}
