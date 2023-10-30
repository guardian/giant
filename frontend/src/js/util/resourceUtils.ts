import { BasicResource, BasicResourceWithSingleBlobChild, HighlightableText, Resource } from '../types/Resource';
import { HighlightsState } from '../types/redux/GiantState';

// safety-valve against a large flat structure slowing down the browser
export const MAX_NUMBER_OF_CHILDREN = 1000;

export function hasSingleBlobChild(resource: BasicResource): resource is BasicResourceWithSingleBlobChild {
    return !!(
        resource.type === 'file'
        && resource.children
        && resource.children.length === 1
        && resource.children[0].type === 'blob'
    );
}

export function hasSingleIngestionChild(resource: BasicResource): boolean {
    return !!(
        resource.type === 'collection'
        && resource.children
        && resource.children.length === 1
        && resource.children[0].type === 'ingestion'
    )
}

export function hasSingleExpandableBlobChild(resource: BasicResource): boolean {
    return hasSingleBlobChild(resource) && resource.children[0].isExpandable;
}

export function canLinkTo(resource: BasicResource): boolean {
    return resource.type === 'email' || (resource.type === 'file' && !resource.isExpandable);
}

export function hrefFromResource(resource: BasicResource): string {
    if (hasSingleBlobChild(resource)) {
        return `/resources/${resource.children[0].uri}`;
    }

    return `/resources/${resource.uri}`;
}

export function getCurrentResource(prefix: string): string {
    // We need to take the URI so we can compare it against the one in the Redux
    // resource key and work out whether we need to load it or not.
    //
    // We originally used the splat match from ReactRouter here
    //   this.props.match.params['0']
    //
    // but that provides us with the decoded URL, apart from '?' (%3F) or '#' (%23).
    // We need to compare against the encoded URL in the uri field of a resource
    // and if the filename in Giant contains those characters we will end up double
    // encoding the percent:
    //
    //   In URL:
    //      /resources/crank%20up%20the%20amps/url%20encoding%20hell/url-encoding-hell/hash%20%23%C2%A0mark/3.txt
    //   In ReactRouter splat:
    //      /resources/crank up the amps/url encoding hell/url-encoding-hell/hash %23 mark/3.txt
    //   Problematic double encode from splat:
    //     /resources/crank%20up%20the%20amps/url%20encoding%20hell/url-encoding-hell/hash%20%2523%20mark/3.txt
    //
    // As far as I know those are the only exceptions so we could special-case them
    // but for overall safety lets read the encoded URL directly from window.location.

    // slice(2) because:
    //
    //   "/resources/b/c".split("/") === ["", "resources", "b", "c"]
    //
    return window.location.pathname.split("/").slice(2).join("/");
}

export function getDefaultView(resource: Resource): string | undefined {
    if (resource.type !== 'blob') {
        return undefined;
    }

    if (resource.transcript) {
        return `transcript.${Object.keys(resource.transcript)[0]}`;
    }

    // We removed the isBasic check in Viewer during conversion to Typescript because it meant changing the definitions
    // of Resource and BasicResource in ways that would ripple across the codebase.
    // This is effectively the same thing, but without TypeScript really knowing what's going on.
    if (resource.text === undefined) {
        return undefined;
    }

    if (resource.text.contents.trim().length === 0 && resource.ocr) {
        const ocrEntries = Object.entries(resource.ocr);
        const firstNonEmptyEntry = ocrEntries.find(([_, { contents }]) => contents.trim().length > 0);

        if(firstNonEmptyEntry) {
            return `ocr.${firstNonEmptyEntry[0]}`;
        }
    }

    return 'text';
}

export function definitelyNotAUnifiedViewer(resource: Resource | null): {view: string, highlightableText: HighlightableText} | undefined {
    if (!resource) {
        return undefined;
    }
    const ocrWithHighlights = resource.ocr && Object.entries(resource.ocr).find(([k, { highlights }]) => highlights.length > 0);
    if (ocrWithHighlights) {
        const [view, highlightableText] = ocrWithHighlights;
        return {
            view,
            highlightableText,
        };
    }

    const noTextButHasOcr = resource.text.contents.length === 0 && resource.ocr ? Object.entries(resource.ocr)[0] : undefined;
    if (noTextButHasOcr) {
        const [view, highlightableText] = noTextButHasOcr;
        return {
            view,
            highlightableText,
        };
    }

    return {
        view: 'text',
        highlightableText: resource.text
    };
}

export function getCurrentHighlight(highlights: HighlightsState, resource: Resource, query: string): number | undefined {
    const toDisplay = definitelyNotAUnifiedViewer(resource);
    if (toDisplay) {
        return highlights[`${resource.uri}-${query}`]?.[toDisplay.view].currentHighlight;
    }
    return undefined;
}

export function getTotalHighlights(resource: Resource): number | undefined {
    const toDisplay = definitelyNotAUnifiedViewer(resource);
    return toDisplay?.highlightableText.highlights.length;
}
