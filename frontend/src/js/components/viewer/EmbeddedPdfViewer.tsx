import React, { useCallback } from 'react';
import PropTypes from 'prop-types';

const viewerLocation = '/third-party/pdfjs-2.4.456-dist/web/viewer.html';



export function EmbeddedPdfViewer({ doc }: { doc: string }) {
    const url = `${viewerLocation}?file=${doc}`;

    const iframeRef = useCallback((iframe: HTMLIFrameElement | null) => {
        if(iframe) {
            iframe.addEventListener('load',  () => {
                // Hide the download and print buttons to try to avoid users habitually downloading things.
                // A better to do this would be to hook into the PDF.js 'webviewerloaded' event and customise
                // the configuration. We'd need a release with https://github.com/mozilla/pdf.js/pull/11837.
                const iframeDocument = iframe.contentDocument!;
                const toolbarToHide = iframeDocument.querySelector("#toolbarViewerRight");
                const rotatebuttons = [
                    iframeDocument.getElementById("pageRotateCcw"),
                    iframeDocument.getElementById("pageRotateCw")
                ]
                rotatebuttons.forEach(elem => {
                    if (elem) {
                        // allow to be squashed onto the toolbar
                        elem.style.minWidth = "0px";
                        // get rid of descriptor text as there's no space in the toolbar
                        elem.innerHTML = "";
                        iframeDocument.getElementById("toolbarViewerLeft")?.append(elem)
                    }
                })


                if(toolbarToHide) {
                    toolbarToHide.setAttribute('style', 'visibility: hidden');
                }
            });
        }
    }, []);

    return <iframe
        title='Document Preview'
        style={{ height: '100%', border: 'none' }}
        src={url}
        ref={iframeRef}
    ></iframe>;
}

EmbeddedPdfViewer.propTypes = {
    doc: PropTypes.string.isRequired
}
