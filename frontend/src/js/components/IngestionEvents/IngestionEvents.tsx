

import React, {useEffect, useState} from "react";
import authFetch from "../../util/auth/authFetch";
import {GiantState} from "../../types/redux/GiantState";
import {GiantDispatch} from "../../types/redux/GiantDispatch";
import {connect} from "react-redux";
import {EuiFlexItem, EuiHeader, EuiHealth, EuiSpacer} from "@elastic/eui";
import {EuiBasicTableColumn} from "@elastic/eui";
import {EuiInMemoryTable} from "@elastic/eui";
import '@elastic/eui/dist/eui_theme_light.css';
import hdate from 'human-date';
import {EuiBadge} from "@elastic/eui";
import {EuiFlexGroup} from "@elastic/eui";
import {WorkspaceMetadata} from "../../types/Workspaces";
import {bindActionCreators} from "redux";
import {getCollections} from "../../actions/collections/getCollections";

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
    extractorStatuses: string[][]
    errors: string[];
    workspaceName: string;
}

type IngestionTable = {
    title: string;
    blobs: BlobStatus[]
}

type ExtractorStatus = "Unknown" | "Started" | "Success" | "Failure"

const statusColors = {
    "Success": "success",
    "Started": "primary",
    "Failure": "danger",
    "Unknown": "default"
}
const statusToColor = (status: ExtractorStatus) => {
    return statusColors[status]
}

const columns: Array<EuiBasicTableColumn<BlobStatus>> = [
    {
        field: 'paths',
        name: 'Filename(s)',
        sortable: true,
        truncateText: true,
        render: (paths: string[]) => {
            const x  = paths.map(p => p.split("/").slice(-1)).join("\n")
            return x
        }
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
        render: (statuses: string[][]) => {
            return <ul>
                {statuses.map(status => {
                    return <li><EuiFlexGroup>
                        <EuiFlexItem>{status[0].replace("Extractor", "")}</EuiFlexItem>
                        <EuiFlexItem grow={false}><EuiBadge color={statusToColor(status[1] as ExtractorStatus)}>{status[1]}</EuiBadge></EuiFlexItem>
                    </EuiFlexGroup></li>
            })}
            </ul>

        },
    },
    {
        field: 'extractorStatuses',
        name: 'Ingestion status',
        render: (statuses: string[][]) =>
            statuses.filter(s => s[1] === "Success" || s[1] === "error").length === statuses.length ? "Complete" : "In progress"
    },
];

const parseBlobStatus = (status: any): BlobStatus => {
    return {
        ...status,
        ingestStart: new Date(status.ingestStart),
        mostRecentEvent: new Date(status.mostRecentEvent)
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