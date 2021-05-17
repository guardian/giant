import React from 'react';
import {searchResultsPropType} from '../../../types/SearchResults';
import { Histogram, BarSeries, withParentSize, XAxis, YAxis } from '@data-ui/histogram';
import {format} from 'date-fns';
import _ from 'lodash';
import PropTypes from 'prop-types';

const ResponsiveHistogram = withParentSize((props) => {
  return (
    <Histogram
        {...props}
        width={props.parentWidth}
        height={props.parentHeight}
      />
  );
});

export default class TimeHistogram extends React.Component {
    static propTypes = {
        results: searchResultsPropType,
        updateSearchText: PropTypes.func,
        q: PropTypes.string
    }

    render() {
        const createdAt = this.props.results.aggs.find(a => a.key === 'createdAt');
        if (!createdAt || !createdAt.buckets) {
            return false;
        }

        const buckets = _.flatMap(createdAt.buckets, b => b.buckets);

        if (buckets.length < 1) {
            return false;
        }

        let binnedData = buckets.map(b => {
            const [year, month] = b.key.split('/');
            const start = new Date(year, month - 1);
            const end = new Date(start);
            end.setMonth(start.getMonth() + 1);
            return {
                id: b.key,
                bin0: start,
                bin1: end,
                count: b.count
            };
        });

        binnedData = _.sortBy(binnedData, i => i.bin0);

        const renderTime = (millis) => {
            return format(new Date(millis), 'MM/yyyy');
        };

        const renderTimeFancy = (millis) => {
            return format(new Date(millis), 'MMMM yyyy');
        };

        const queryByDate = (datum) => {
            const qAsArray = this.props.q !== '["*"]' ? JSON.parse(this.props.q) : [""];
            // Filter existing date chips from the current query string and any double spaces that result from thsi removal
            const qWithoutDateChips = qAsArray.filter(chip => chip.n !== 'Created Before' && chip.n !== 'Created After');
            const cleanedQWithoutDateChips = qWithoutDateChips.filter((chip, index) => !(chip === '' && qAsArray[index - 1] === ''));

            // Create the new date chips
            const beforeDateString = format(new Date(datum.bin1), 'MM/yyyy');
            const afterDateString = format(new Date(datum.bin0), 'MM/yyyy');
            const beforeChip = {
                n: 'Created Before',
                v: beforeDateString,
                op: '+',
                t: 'date'
            };

            const afterChip = {
                n: 'Created After',
                v: afterDateString,
                op: '+',
                t: 'date'
            };

            const query = JSON.stringify(cleanedQWithoutDateChips.concat([beforeChip, '', afterChip, '']));
            this.props.updateSearchText(query);
      }


        return (
            <div style={{width: '100%', height: '200px'}}>
                <ResponsiveHistogram
                    ariaLabel='Created At distribution'
                    vertical
                    binCount={binnedData.length}
                    binType="numeric"
                    renderTooltip={({datum}) => (
                        <div>
                            <strong>{renderTimeFancy(datum.bin0)}</strong>
                            <div>{datum.count} documents</div>
                        </div>
                    )}>

                    <BarSeries
                        fill='rgb(31, 45, 62)'
                        binnedData={binnedData.filter(b => b.count !== 0)}
                        onClick={({datum}) => queryByDate(datum)}
                    >
                    </BarSeries>

                    <XAxis tickFormat={renderTime}/>
                    <YAxis />
                  </ResponsiveHistogram>
            </div>
        );
    }
}

