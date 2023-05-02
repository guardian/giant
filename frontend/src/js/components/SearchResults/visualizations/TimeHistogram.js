import React from 'react';
import {searchResultsPropType} from '../../../types/SearchResults';
import {format} from 'date-fns';
import _ from 'lodash';
import PropTypes from 'prop-types';
import {
    Axis,
    Chart,
    Settings as EuiSettings,
    ScaleType, BarSeries
} from "@elastic/charts";
import '@elastic/charts/dist/theme_light.css';

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

        const esData = binnedData.map(b => {
            return {
                ...b,
                time: b.bin0.getTime(),
            }
        })

        return (
            <div style={{width: '100%', height: '200px'}}>
                <Chart size={{height: 200}}>
                    <EuiSettings
                        showLegend={false}
                        onElementClick={(event) => queryByDate(event[0][0].datum)}
                    />
                    <BarSeries
                        id="documents"
                        name="Documents"
                        data={esData}
                        xScaleType={ScaleType.Time}
                        xAccessor="time"
                        yAccessors={['count']}
                    />

                    <Axis
                        id="bottom-axis"
                        position="bottom"
                        tickFormat={renderTime}
                        ticks={binnedData.length}
                    />
                    <Axis
                        id="left-axis"
                        position="left"
                        title={"count"}
                    />
                </Chart>
            </div>
        );
    }
}

