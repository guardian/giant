import React from 'react';
import PropTypes from 'prop-types';
import DocumentIcon from 'react-icons/lib/ti/document';
import EmailIcon from 'react-icons/lib/md/email';
import hdate from 'human-date';
import * as R from 'ramda';
import md5 from 'md5';

import { SearchLink } from '../UtilComponents/SearchLink';
import { HighlightedText } from '../UtilComponents/HighlightedText';
import { searchResultPropType } from '../../types/SearchResults';

export class SearchResult extends React.Component {
    static propTypes = {
        lastUri: PropTypes.string,
        searchResult: searchResultPropType,
        index: PropTypes.number.isRequired
    }

    renderHighlight = (highlight, index) => {
        return (
            <div key={index} className='search-result__highlight'>
                <span className='search-result__highlight-field'>{highlight.display}: </span>
                <HighlightedText value={highlight.highlight} />
            </div>
        );
    }

    getTitle() {
        switch (this.props.searchResult.details._type) {
            case 'email': {
                const subject = this.props.searchResult.details.subject;
                return <h3 key={this.props.searchResult.uri} className='search-result__title'>{subject ? subject : '<No Subject>'}</h3>;
            }
            case 'document': {
                const names = this.props.searchResult.details.fileUris.map(uri => R.last(uri.split('/')));
                return R.uniq(names).map(name => {
                    return <h3 key={md5(name)} className='search-result__title'>{name}</h3>;
                });
            }
            default: {
                return false;
            }
        }
    }

    renderIcon() {
        let linkParams = {};
        const fieldWithMostHighlights = this.props.searchResult.fieldWithMostHighlights;
        // The fieldWithMostHighlights might be, say, metadata.fileUris
        // or one of the many fields for which we don't have an separate view
        // (generally these are metadata that appear in the sidebar)
        if (fieldWithMostHighlights && (fieldWithMostHighlights === 'text' || fieldWithMostHighlights.startsWith('ocr') || fieldWithMostHighlights.startsWith('transcript') || fieldWithMostHighlights.startsWith('vttTranscript'))) {
            linkParams = { view: fieldWithMostHighlights };
        }

        switch (this.props.searchResult.details._type) {
            case 'email': {
                return (
                    <React.Fragment>
                        <div>
                            <EmailIcon className='search-result__icon-email'/>
                        </div>
                        <div>
                            <SearchLink className='search-result__link'
                                        to={`/viewer/${this.props.searchResult.uri}`}
                                        params={linkParams}>
                                {this.getTitle()}
                            </SearchLink>
                        </div>
                    </React.Fragment>
                );
            }
            case 'document': {
                return (
                    <React.Fragment>
                        <div>
                            <DocumentIcon className='search-result__icon-document' />
                        </div>
                        <div>
                            <SearchLink className='search-result__link'
                                        to={`/viewer/${this.props.searchResult.uri}`}
                                        params={linkParams}>
                                {this.getTitle()}
                            </SearchLink>
                        </div>
                    </React.Fragment>
                );
            }
            default: {
                return (
                    <span className='search-result__type'>{'Unknown Resource Type'}</span>
                );
            }
        }
    }

    renderProperty = (title, ...contents) => {
        if(title && contents) {
            return (
                <div className='search-result__details'>
                    <div>{title}:</div>
                    {contents.map(item => <p className='search-result__details-info' key={md5(item)}>{item}</p>)}
                </div>
            );
        }
    };


    renderAdditionalInfo() {
        switch (this.props.searchResult.details._type) {
            case 'email': {
                return (
                    <React.Fragment>
                        {this.renderProperty('From', this.props.searchResult.details.from.email)}
                        {this.renderProperty('Attachments', this.props.searchResult.details.attachmentCount)}
                    </React.Fragment>
                );
            }
            case 'document': {
                return this.renderProperty('File Types', this.props.searchResult.details.mimeTypes);
            }
            default: {
                return false;
            }
        }
    }

    render () {
        const isLastResult = this.props.lastUri === this.props.searchResult.uri;
        const targetId = isLastResult ? 'jump-to-result' : '';
        const createdAt = this.props.searchResult.createdAt ? hdate.prettyPrint(new Date(this.props.searchResult.createdAt), {showTime: true}) : undefined;

        return (
            <div id={targetId} className='search-result'>
                <div className='search-result__info' >
                    <div className={isLastResult ? 'search-result__info--last-result-overlay' : ''}/>

                    <div className='search-result__summary'>
                        {this.renderIcon()}
                    </div>

                    {createdAt ? this.renderProperty('Created', createdAt): false}
                    {this.renderAdditionalInfo()}
                </div>

                <div className='search-result__content'>
                    {this.props.searchResult.highlights.length ? this.props.searchResult.highlights.map(this.renderHighlight) : <p className='centered'>No highlights found for the current search term</p>}
                </div>

            </div>
        );
    }
}
