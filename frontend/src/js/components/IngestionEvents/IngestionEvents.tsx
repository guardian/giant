

import React, {useEffect, useState} from "react";
import authFetch from "../../util/auth/authFetch";
import {GiantState} from "../../types/redux/GiantState";
import {GiantDispatch} from "../../types/redux/GiantDispatch";
import {connect} from "react-redux";
import {EuiFlexItem, EuiHeader, EuiHealth, EuiIcon, EuiSpacer, EuiIconTip, EuiBadge, EuiFlexGroup, EuiInMemoryTable, EuiBasicTableColumn, EuiLoadingSpinner} from "@elastic/eui";
import '@elastic/eui/dist/eui_theme_light.css';
import hdate from 'human-date';
import {WorkspaceMetadata} from "../../types/Workspaces";
import {bindActionCreators} from "redux";
import {getCollections} from "../../actions/collections/getCollections";
import moment from "moment";
import _ from "lodash";

type Metadata = {
    blobId: string;
    ingestUri: string;
}


type BlobStatus =  {
    metadata: Metadata;
    paths: string[];
    fileSize: number;
    ingestStart: Date;
    mostRecentEvent: Date;
    extractorStatuses: ExtractorStatus[];
    errors: string[];
    workspaceName: string;
}

type IngestionTable = {
    title: string;
    blobs: BlobStatus[]
}

type Status = "Unknown" | "Started" | "Success" | "Failure"

type ExtractorStatusUpdate = {
    eventTime: Date;
    status: Status
}

type ExtractorStatus = {
    extractorType: string;
    statusUpdates: ExtractorStatusUpdate[];
}

const extractorStatusColors = {
    "Success": "success",
    "Started": "primary",
    "Failure": "danger",
    "Unknown": "default"
}

const blobStatusIcons = {
    complete: <EuiIconTip type="checkInCircleFilled" />,
    completeWithErrors: <EuiIconTip type="alert" />,
    inProgress: <EuiLoadingSpinner />
}

const statusToColor = (status: Status) => extractorStatusColors[status]

const mostRecentStatusUpdate = (updates: ExtractorStatusUpdate[]) =>
    updates.reduce((a, b) => a.eventTime > b.eventTime ? a : b)

const getBlobStatus = (statuses: ExtractorStatus[]) => {
    const failures = statuses.filter(status => status.statusUpdates.find(u => u.status === "Failure") !== undefined)
    const inProgress = statuses.filter(status => status.statusUpdates.find(u => ["Failure", "Success"].includes(u.status)) === undefined)
    return failures.length > 0 ? blobStatusIcons.completeWithErrors : inProgress.length > 0 ? blobStatusIcons.inProgress : blobStatusIcons.complete
}

const columns: Array<EuiBasicTableColumn<BlobStatus>> = [
    {
        field: 'extractorStatuses',
        name: '',
        render: (statuses: ExtractorStatus[]) => {
            return getBlobStatus(statuses)
        }

    },
    {
        field: 'paths',
        name: 'Filename(s)',
        sortable: true,
        truncateText: true,
        render: (paths: string[]) => paths.map(p => p.split("/").slice(-1)).join("\n")
    },
    {
        field: 'paths',
        name: 'Path(s)',
        render: (paths: string[]) => paths.join("\n")
    },
    {
        field: 'workspaceName',
        name: 'Workspace name'
    },
    {
        field: 'ingestStart',
        name: 'First event',
        render: (ingestStart: Date) => hdate.prettyPrint(ingestStart, {showTime: true})
    },
    {
        field: 'mostRecentEvent',
        name: 'Most recent event',
        render: (mostRecentEvent: Date) => hdate.prettyPrint(mostRecentEvent, {showTime: true})
    },
    {
        field: 'extractorStatuses',
        name: 'Extractors',
        render: (statuses: ExtractorStatus[]) => {
            return <ul>
                {statuses.map(status => {
                    const mostRecent = mostRecentStatusUpdate(status.statusUpdates)
                    return <li><EuiFlexGroup>
                        <EuiFlexItem>{status.extractorType.replace("Extractor", "")}</EuiFlexItem>
                        <EuiFlexItem grow={false}  >{_.sortBy(status.statusUpdates, s => s.eventTime).map(s =>
                            <EuiBadge color={statusToColor(s.status)}>{s.status} ({moment(s.eventTime).format("HH:mm:ss")  })</EuiBadge>
                        )}</EuiFlexItem>
                    </EuiFlexGroup></li>
            })}
            </ul>

        },
        width: "300"
    },
];

const parseBlobStatus = (status: any): BlobStatus => {
    return {
        ...status,
        ingestStart: new Date(status.ingestStart),
        mostRecentEvent: new Date(status.mostRecentEvent),
        extractorStatuses: status.extractorStatuses.map((s: any) => ({
            ...s,
            statusUpdates: s.statusUpdates.map((u: any) => ({
                ...u,
                eventTime: new Date(u.eventTime)
            }))
        }))
    }
}

function IngestionEvents(
    props: {
        collectionId: string,
        ingestId?: string,
        workspaces: WorkspaceMetadata[],
        breakdownByWorkspace: boolean
    }) {
    const [blobs, updateBlobs] = useState<BlobStatus[]>([])

    const ingestIdSuffix = props.ingestId && props.ingestId !== "all" ? `/${props.ingestId}` : ""
    const [tableData, setTableData] = useState<IngestionTable[]>([])

    console.log(ingestIdSuffix)

    useEffect(() => {
        authFetch(`/api/ingestion-events/${props.collectionId}${ingestIdSuffix}`)
            .then(resp => resp.json())
            .then(json => {
                const blobStatuses = json.map(parseBlobStatus)
                updateBlobs(blobStatuses)
        })
    }, [props.collectionId, props.ingestId, updateBlobs])

    useEffect(() => {
        if (props.breakdownByWorkspace) {
            setTableData(props.workspaces.map((w:WorkspaceMetadata) => ({title: `Workspace: ${w.name}`, blobs: blobs.filter(b => b.workspaceName === w.name)})))
        } else {
            setTableData([{title: `${props.collectionId}${ingestIdSuffix}`, blobs}])
        }

    }, [props.breakdownByWorkspace, blobs, props.workspaces])

    return <>
        {tableData.map((t: IngestionTable) => <>
            <EuiSpacer size={"m"}/>
        <h1>{t.title}</h1>
        <EuiInMemoryTable
            tableCaption="ingestion events"
            items={t.blobs}
            itemId="metadata.blobId"
            // error={"Failed to load data"}
            loading={blobs.length === 0}
            // message={message}
            columns={columns}
            // search={search}
            // pagination={pagination}
            sorting={true}
        />
    </>)}
        </>
}


function mapStateToProps(state: GiantState) {
    return {
        workspacesMetadata: state.workspaces.workspacesMetadata,
        currentUser: state.auth.token?.user,
        collections: state.collections
    };
}

function mapDispatchToProps(dispatch: GiantDispatch) {
    return {
        getCollections: bindActionCreators(getCollections, dispatch),
    };
}

export default connect(mapStateToProps, mapDispatchToProps)(IngestionEvents);