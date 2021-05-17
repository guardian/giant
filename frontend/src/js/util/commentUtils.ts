import { CommentAnchor, CommentData } from "../types/Resource";

function commentInView(anchor: CommentAnchor, view?: string): boolean {
    if(!view) {
        return false;
    }

    if(view.startsWith('ocr')) {
        const language = view.split(".")[1];
        return anchor.type === 'ocr' && anchor.language === language;
    }

    return anchor.type === 'text';
}

export function filterCommentsInView(comments: CommentData[], view?: string): CommentData[] {
    return comments.filter(({ anchor }) => {
        return anchor && commentInView(anchor, view);
    });
}