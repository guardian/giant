import React from 'react';
import PropTypes from 'prop-types';
import ReactFauxDOM from 'react-faux-dom';
import * as R from 'ramda';
import * as d3 from 'd3';
import ReactTooltip from 'react-tooltip';
import {emailThreadPropType} from '../../types/Email';
import _ from 'lodash';
import {format} from 'date-fns';

export default class Timeline extends React.Component {
    static propTypes = {
        data: emailThreadPropType,
        selected: PropTypes.string,
        onSelect: PropTypes.func,
        gridSpacing: PropTypes.number,
        emailRectSize: PropTypes.number,
        addressPadding: PropTypes.number
    };

    static defaultProps = {
        // size of the grid containing the squares
        gridSpacing: 50,
        // size of the rectangles representing emails
        emailRectSize: 20,
        // padding for addresses where the chart won't initially overlap
        addressPadding: 100
    }

    select (uri) {
        this.props.onSelect && this.props.onSelect(uri);
    }

    render () {
        return (
            <div>
                { this.props.data.thread ? <ReactTooltip effect='solid' insecure={false} html={true}/> : false }
                { this.renderTimeline() }
            </div>
        );
    }

    knownAddresses (thread) {
        return thread
            .map(e => e.email.metadata)
            .filter(Boolean)
            .filter((m, i, acc) => {
                return i <= acc.findIndex(m2 => m2.fromAddress === m.fromAddress);
            })
            .map(m => {
                return {address: m.fromAddress, name: m.fromName};
            });
    }

    renderTimeline () {
        const data = this.props.data;
        if (!data.thread) return false;

        // create the distinct set of fromAddress in the data set
        const knownRecipients = this.knownAddresses(data.thread);

        // create the set of email uris in the data set
        const knownUris = this.props.data.thread.map(e => e.email.uri);

        // Flag so we can skip the unknown row if need be
        const anyUnknowns = data.thread.some(v => !_.get(v, 'email.haveSource') || (_.get(v, 'email.metadata.fromName') === undefined && _.get(v, 'email.metadata.fromAddress') === undefined));
        // Flag so we can skip the timestamps
        const anyTimestamps = data.thread.some(v => _.get(v, 'email.metadata.sentAt'));

        // You can end up where you've got no recipient so the above map won't add an unknown address
        if (anyUnknowns && !knownRecipients.some(r => R.equals(r, {address: undefined, name: undefined}))) {
            knownRecipients.push({address: undefined, name: undefined});
        }

        // compute the size of the chart
        const totalWidth = knownUris.length * this.props.gridSpacing;
        const totalHeight = knownRecipients.length * this.props.gridSpacing;

        // horizontal axis (each email is in it's own column)
        const timelineAxis = d3.scalePoint()
            .domain(knownUris)
            .range([0, totalWidth])
            .padding([0.5]);

        // vertical axis that holds each unique fromAddress (plus an extra slot for unknown addresses)
        const knownAddresses = knownRecipients.map(a => a ? a.address : a);

        const userAxis = d3.scalePoint()
            .domain(knownAddresses)
            .range([0, totalHeight])
            .padding([0.5]);

        const addresses = this.renderAddresses(knownRecipients, userAxis, anyUnknowns, anyTimestamps);
        const chart = this.renderChart(data, timelineAxis, userAxis, anyTimestamps);

        return <div className='timeline__container'>
            <div className='timeline__chart'>
                { chart ? chart : false }
            </div>
            { addresses ? addresses : false }
        </div>;
    }

    renderAddresses (knownRecipients, userAxis, anyUnknowns, anyTimestamps) {
        const data = this.props.data;
        if (!data.thread) return false;

        const faux = new ReactFauxDOM.createElement('div');

        const addresses = knownRecipients.map(r => r.name ? r.name : r.address ? r.address : '<Unknown>');

        const width = Math.max(...addresses.map(r => r.length)) * 7;
        const timestampHeight = anyTimestamps ? this.props.gridSpacing : 0;

        const svgDoc = d3.select(faux)
            .attr('key', 'faux-dom-addresses')
            .attr('class', 'timeline__addresses-svg')
            .append('svg')
            .attr('width', width)
            .attr('height', userAxis.range()[1] + timestampHeight)
            .attr('class', 'timeline');

        // draw dividing lines
        this.renderDividingLines(svgDoc, userAxis);

        const addText = (elem, className, offset) => {
            elem.append('text')
                .attr('font-size', '10px')
                .attr('x', offset)
                .attr('y', (address, i) => {
                    return (((i) * this.props.gridSpacing) + 10) + offset;
                })
                .attr('class', className)
                .text(address => address);
        };

        // put the name on each line
        const names = svgDoc.append('g')
            .selectAll('text')
            .data(addresses)
            .enter();
        // shadow
        addText(names, 'timeline__addresses--text-shadow', 1);
        // actual text
        addText(names, 'timeline__addresses--text', 0);

        return faux.toReact();
    }

    renderChart (data, timelineAxis, userAxis, anyTimestamps) {
        // This creates the faux DOM root that we pass into D3
        const faux = new ReactFauxDOM.createElement('div');

        // create the array of all relationships from the data set
        const relationships = data.thread.map(t =>
            t.neighbours
                .map(n => {
                    return {from: t.email.uri, relation: n.relation, to: n.uri};
                })
        ).reduce((acc, neighbours) => [...acc, ...neighbours], []);

        const emailRectSize = this.props.emailRectSize;

        const timestampHeight = anyTimestamps ? this.props.gridSpacing : 0;
        const chartHeight = userAxis.range()[1];

        // function that provides the point co-ordinates for a given email
        const emailCoordinates = (uri) => {
            const thread = data.thread.find(x => x.email.uri === uri);
            if (thread) {
                const x = timelineAxis(thread.email.uri) + this.props.addressPadding;
                const fromAddress = _.get(thread, 'email.metadata.fromAddress');
                const y = userAxis(fromAddress);
                return [x, y];
            } else {
                // this should never happen
                console.warn(`Returning [0,0] for unknown uri ${uri}`);
                return [0,0];
            }
        };

        const svgDoc = d3.select(faux)
            .attr('key', 'faux-dom-chart')
            .attr('class', 'timeline__chart-svg')
            .append('svg')
            .attr('width', timelineAxis.range()[1] + this.props.addressPadding)
            .attr('height', chartHeight + timestampHeight)
            .attr('class', 'timeline');


        // draw dividing lines
        this.renderDividingLines(svgDoc, userAxis);

        // predicate to determine if a relationship is connected to a selected email
        const relationshipSelected = (rel) => this.props.selected === rel.from || this.props.selected === rel.to;

        // add relationships onto the SVG
        const drawRelationships = (predicate, className) => {
            const relationshipsToDraw = relationships.filter(predicate);
            svgDoc.append('g')
                .selectAll('line')
                .data(relationshipsToDraw)
                .enter()
                .append('line')
                .attr('x1', rel => emailCoordinates(rel.from)[0])
                .attr('y1', rel => emailCoordinates(rel.from)[1])
                .attr('x2', rel => emailCoordinates(rel.to)[0])
                .attr('y2', rel => emailCoordinates(rel.to)[1])
                .attr('class', className);
        };

        // draw lines that are not connected to any selected email
        drawRelationships(rel => rel.relation === 'REFERENCED' && !relationshipSelected(rel), 'timeline__reference');
        drawRelationships(rel => rel.relation === 'IN_REPLY_TO' && !relationshipSelected(rel), 'timeline__reply');

        // draw lines that are connected to the selected email on top
        drawRelationships(rel => rel.relation === 'REFERENCED' && relationshipSelected(rel), 'timeline__reference timeline__reference--selected');
        drawRelationships(rel => rel.relation === 'IN_REPLY_TO' && relationshipSelected(rel), 'timeline__reply timeline__reply--selected');

        // create real e-mails
        svgDoc.append('g')
            .selectAll('rect')
            .data(data.thread)
            .enter()
            .append('rect')
            .attr('x', thread => {
                return emailCoordinates(thread.email.uri)[0] - (emailRectSize/2);
            })
            .attr('y', thread => {
                return emailCoordinates(thread.email.uri)[1] - (emailRectSize/2);
            })
            .attr('width', emailRectSize)
            .attr('height', emailRectSize)
            .attr('class', thread => {
                const classes = thread.email.haveSource ?
                    'timeline__email' :
                    'timeline__email timeline__email--ghost';
                const selected = this.props.selected === thread.email.uri;
                return selected ? classes + ' timeline__email--selected' : classes;
            })
            .attr('data-tip', thread => {
                const maybeMetadata = _.get(thread, 'email.metadata');
                const maybeTime = _.get(maybeMetadata, 'sentAt.time');
                const maybeKnownTimezone = _.get(maybeMetadata, 'sentAt.knownTimezone');
                return maybeMetadata ?
                `
                    <strong>From:</strong> ${maybeMetadata.fromAddress}<br/>
                    <strong>Subject:</strong> ${maybeMetadata.subject}<br/>
                    ${
                        maybeTime
                        ?
                            `<strong>Date:</strong> ${maybeTime} ${maybeKnownTimezone === false ? '(!)' : ''}<br/>`
                        :
                            ''
                    }

                `
                :
                `
                    <strong>No data for email ${thread.email.uri}</strong>
                `
                ;
            })
            .on('click', thread => {if (thread.email.haveSource) { this.select(thread.email.uri); }});

        // add the axis at the bottom (without labels, we do that below)
        const axis = d3
            .axisBottom(timelineAxis)
            .tickFormat('') // don't use this for labels as we want two lines
            .tickValues(timelineAxis.domain().filter(uri => {
                const thread = data.thread.find(t => t.email.uri === uri);
                return _.get(thread, 'email.metadata.sentAt') !== undefined; // only draw tick when we have a date
            }));

        svgDoc
            .append('g')
            .attr('transform', `translate(${this.props.addressPadding},${chartHeight})`)
            .call(axis);

        // add timestamps
        const threadsWithTimestamps = data.thread.filter(t => _.get(t, 'email.metadata.sentAt'));
        if (threadsWithTimestamps.length > 0) {
            const textElems = svgDoc.append('g')
                .selectAll('text')
                .data(threadsWithTimestamps)
                .enter()
                .append('text')
                .attr('font-size', '10px')
                .style('text-anchor', 'middle')
                .attr('transform', thread => {
                    return `translate(${emailCoordinates(thread.email.uri)[0]-10},${chartHeight+15})rotate(-45)`;
                });

            textElems.append('tspan').text(t => {
                const sentAt = _.get(t, 'email.metadata.sentAt.time');
                return format(new Date(sentAt), 'HH:mm');
            }).attr('x', 0).attr('dy', '10px');
            textElems.append('tspan').text(t => {
                const sentAt = _.get(t, 'email.metadata.sentAt.time');
                return format(new Date(sentAt), 'dd/MM/yyyy');
            }).attr('x', 0).attr('dy', '10px');
        }

        return faux.toReact();
    }

    renderDividingLines (svgDoc, userAxis) {
        const width = svgDoc.attr('width');
        svgDoc.append('g')
            .selectAll('line')
            .data(userAxis.domain().filter(x => x !== undefined))
            .enter()
            .append('line')
            .attr('x1', 0)
            .attr('y1', (user, i) => (i+1) * this.props.gridSpacing)
            .attr('x2', width)
            .attr('y2', (user, i) => (i+1) * this.props.gridSpacing)
            .attr('class', 'timeline__userdivider');
    }
}
