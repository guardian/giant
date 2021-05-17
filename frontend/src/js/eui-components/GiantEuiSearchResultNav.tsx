import { GiantState } from '../types/redux/GiantState';
import { GiantDispatch } from '../types/redux/GiantDispatch';
import { bindActionCreators } from 'redux';
import { connect } from 'react-redux';
import { setCurrentHighlight } from '../actions/highlights';
import React, { useEffect } from 'react';
import { EuiHeaderSectionItemButton, EuiIcon } from '@elastic/eui';
import { definitelyNotAUnifiedViewer, getCurrentHighlight, getTotalHighlights } from '../util/resourceUtils';

type Props = ReturnType<typeof mapStateToProps> &
    ReturnType<typeof mapDispatchToProps>

function scrollToHighlight(highlightNumber: number) {
    const highlights = document.querySelectorAll('result-highlight');

    const currentHighlightElement = document.querySelector('.result-highlight--focused');
    if (currentHighlightElement) {
        currentHighlightElement.classList.remove('result-highlight--focused');
    }

    if (highlights[highlightNumber]) {
        highlights[highlightNumber].classList.add('result-highlight--focused');
        highlights[highlightNumber].scrollIntoView({
            inline: 'center',
            block: 'center'
        });
    } else {
        console.error(`Could not find element number ${highlightNumber} in highlights of length ${highlights.length}`);
    }
}

function GiantEuiSearchResultNav({resource, currentQuery, setCurrentHighlight, highlights}: Props) {
    const toDisplay = definitelyNotAUnifiedViewer(resource);

    const highlightableText = toDisplay?.highlightableText;

    useEffect(() => {
        if (resource && currentQuery && toDisplay) {
            const currentHighlight = getCurrentHighlight(highlights, resource, currentQuery.q) ?? 0;
            if (toDisplay.highlightableText.highlights.length) {
                setCurrentHighlight(resource.uri, currentQuery.q, toDisplay.view, currentHighlight);
                scrollToHighlight(currentHighlight);
            }
        }
    // TODO MRB: refactor this hook to not rely on so many props
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [highlightableText]);

    function nextHighlight() {
        if (!toDisplay || !resource || !currentQuery) {
            return;
        }

        const previousHighlight: number = getCurrentHighlight(highlights, resource, currentQuery.q) ?? -1;
        const newHighlight: number = (previousHighlight + 1) % (getTotalHighlights(resource) ?? 0);

        setCurrentHighlight(resource.uri, currentQuery.q, toDisplay.view, newHighlight);
        scrollToHighlight(newHighlight);
    }

    function previousHighlight() {
        if (!toDisplay || !resource || !currentQuery) {
            return;
        }

        const previousHighlight: number = getCurrentHighlight(highlights, resource, currentQuery.q) ?? 0;
        const newHighlight: number = ((previousHighlight === 0) ? (getTotalHighlights(resource) ?? 0) : previousHighlight) - 1;

        setCurrentHighlight(resource.uri, currentQuery.q, toDisplay.view, newHighlight);
        scrollToHighlight(newHighlight);
    }

    return <React.Fragment>
        <EuiHeaderSectionItemButton
            onClick={nextHighlight}>
            <EuiIcon type="arrowDown" size="m" />
        </EuiHeaderSectionItemButton>
        <EuiHeaderSectionItemButton
            onClick={previousHighlight}>
            <EuiIcon type="arrowUp" size="m" />
        </EuiHeaderSectionItemButton>
    </React.Fragment>;
}

function mapStateToProps(state: GiantState) {
    return {
        resource: state.resource,
        currentQuery: state.search.currentQuery,
        highlights: state.highlights
    };
}

function mapDispatchToProps(dispatch: GiantDispatch) {
    return {
        setCurrentHighlight: bindActionCreators(setCurrentHighlight, dispatch),
    };
}

export default connect(mapStateToProps, mapDispatchToProps)(GiantEuiSearchResultNav);
