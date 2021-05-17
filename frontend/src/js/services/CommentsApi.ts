import authFetch from '../util/auth/authFetch';
import { CommentAnchor } from '../types/Resource';

export function postComment(uri: string, text: string, anchor?: CommentAnchor) {
    return authFetch(`/api/resources/${uri}/comments`, {
        headers: new Headers({'Content-Type': 'application/json'}),
        method: 'POST',
        body: JSON.stringify({text, anchor})
    });
}

export function fetchComments(uri: string) {
    return authFetch(`/api/resources/${uri}/comments`).then(r => r.json())
}

export function deleteComment(commentId: string) {
    return authFetch(`/api/comments/${commentId}`, {
        method: "DELETE"
    });
}
