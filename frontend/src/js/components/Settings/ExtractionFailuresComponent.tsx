import React from 'react';

import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';
import {getExtractionFailures} from '../../actions/metrics/getExtractionFailures';
import { ExtractionFailureSummary, ExtractionFailures } from '../../types/ExtractionFailures';
import { GiantState } from '../../types/redux/GiantState';
import { GiantDispatch } from '../../types/redux/GiantDispatch';
import ResourcesForExtractionFailureComponent from './ResourcesForExtractionFailureComponent';

type Props = {
    getExtractionFailures: typeof getExtractionFailures,
    extractionFailures: ExtractionFailures | null
}

type State = {
    expanded?: string
}

class ExtractionFailuresComponent extends React.Component<Props, State> {
    state = {
        expanded: undefined
    }

    componentDidMount() {
        document.title = 'Extraction Failures - Giant';
        this.props.getExtractionFailures();
    }

    componentWillUnmount() {
        document.title = "Giant";
    }

    shrinkStackTrace = (trace: string) => {
        return trace.split("\n").slice(0, 4).join("\n");
    }

    toggleExpanded = (key: string, alreadyExpanded: boolean) => {
        if(alreadyExpanded) {
            this.setState({ expanded: undefined });
        } else {
            this.setState({ expanded: key });
        }
    }

    renderRow = (failure: ExtractionFailureSummary) => {
        const key = `${failure.extractorName}-${failure.stackTrace}`;
        const expanded = this.state.expanded === key;

        return <tr className='data-table__row' key={`${failure.extractorName}-${failure.stackTrace}`}>
            <td className='data-table__item data-table__item--value'>
                {failure.extractorName}
            </td>
            <td className='data-table__item data-table__item--value'>
                {failure.numberOfBlobs}
            </td>
            <td className='data-table__item data-table__item--value'>
                <pre>{this.shrinkStackTrace(failure.stackTrace)}</pre>
                {expanded ? <ResourcesForExtractionFailureComponent summary={failure}/> : false} 
            </td>
            <td className='data-table__item data-table__item--value'>
                <button className='btn' onClick={() => this.toggleExpanded(key, expanded)}>{expanded ? 'Hide' : 'Show'} resources</button>
            </td>
        </tr>;
    }

    renderNoResults = () => {
        return <tr className='data-table__row'><td className='data-table__item' colSpan={4}>No results found</td></tr>;
    }

    render() {
        if (this.props.extractionFailures && this.props.extractionFailures.results) {
            return (
                <div className='app__main-content'>
                    <h1 className='page-title'>Extraction Failures</h1>
                    <table className='data-table' style={{tableLayout: "fixed"}}>
                        <thead>
                            <tr className='data-table__row'>
                                <th className='data-table__item data-table__item--title' style={{width: "10%"}}>Extractor</th>
                                <th className='data-table__item data-table__item--title' style={{width: "10%"}}>Blobs</th>
                                <th className='data-table__item data-table__item--title'>Stack Trace</th>
                                <th className='data-table__item data-table__item--title' style={{width: "10%"}}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                        {this.props.extractionFailures.results.length
                            ? this.props.extractionFailures.results.map(failure => this.renderRow(failure))
                            : this.renderNoResults()
                        }
                        </tbody>
                    </table>
                </div>
            );
        } else {
            return 'Loading...';
        }
    }
}

function mapStateToProps(state: GiantState) {
    return {
        extractionFailures: state.metrics.extractionFailures
    };
}

function mapDispatchToProps(dispatch: GiantDispatch) {
    return {
        getExtractionFailures: bindActionCreators(getExtractionFailures, dispatch)
    };
}

export default connect(mapStateToProps, mapDispatchToProps)(ExtractionFailuresComponent);
