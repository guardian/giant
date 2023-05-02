import React from 'react';
import { useEffect } from 'react';
import { fetchResourcesForExtractionFailure } from '../../services/MetricsApi';
import { useState } from 'react';
import { ResourcesForExtractionFailure, ExtractionFailureSummary } from '../../types/ExtractionFailures';
import PageNavigator from '../UtilComponents/PageNavigator';
import { SearchLink } from '../UtilComponents/SearchLink';

export function ResourcesForExtractionFailureComponent({ summary }: { summary: ExtractionFailureSummary }) {
    const [resources, setResources] = useState<ResourcesForExtractionFailure | undefined>(undefined);
    const [page, setPage] = useState(1);

    useEffect(() => {
        fetchResourcesForExtractionFailure(summary.extractorName, summary.stackTrace, page).then(resources => {
            setResources(resources);
        });
    }, [summary.extractorName, summary.stackTrace, page]);

    if(resources === undefined) {
        return <span>Loading...</span>;
    }

    return <table className='data-table' style={{ tableLayout: 'fixed' }}>
        <tbody>
            {resources.results.map(({ uri, parents }) => {
                const displayUri = parents && parents.length > 0 ? parents[0].uri : uri;

                return <tr key={uri} className='data-table__row'>
                    <td className='data-table__item data-table__item--value'>
                        <SearchLink to={`/viewer/${uri}`}>
                            {displayUri}
                        </SearchLink>
                    </td>
                </tr>;
            })}
            <tr>
                <PageNavigator
                    pageSelectCallback={(page: number) => setPage(page)}
                    currentPage={page}
                    pageSpan={5}
                    lastPage={Math.ceil(resources.hits / resources.pageSize)}/>
            </tr>
        </tbody>
    </table>
}