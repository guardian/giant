

import React, {useEffect, useState} from "react";
import authFetch from "../../util/auth/authFetch";
import {EuiFlexItem, EuiToolTip, EuiSpacer, EuiIconTip, EuiBadge, EuiFlexGroup, EuiInMemoryTable, EuiBasicTableColumn, EuiLoadingSpinner} from "@elastic/eui";
import '@elastic/eui/dist/eui_theme_light.css';
import hdate from 'human-date';
import {WorkspaceMetadata} from "../../types/Workspaces";
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
    eventTime?: Date;
    status?: Status
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

const getBlobStatus = (statuses: ExtractorStatus[]) => {
    const failures = statuses.filter(status => status.statusUpdates.find(u => u.status === "Failure") !== undefined)
    const inProgress = statuses.filter(status => status.statusUpdates.find(u => !u.status || ["Failure", "Success"].includes(u.status)) === undefined)
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
        sortable: true,
        name: 'Workspace name'
    },
    {
        field: 'ingestStart',
        name: 'First event',
        sortable: true,
        render: (ingestStart: Date) => hdate.prettyPrint(ingestStart, {showTime: true})
    },
    {
        field: 'mostRecentEvent',
        name: 'Most recent event',
        sortable: true,
        render: (mostRecentEvent: Date) => hdate.prettyPrint(mostRecentEvent, {showTime: true})
    },
    {
        field: 'extractorStatuses',
        name: 'Extractors',
        render: (statuses: ExtractorStatus[]) => {
            return <ul>
                {statuses.map(status => {
                    const mostRecent = status.statusUpdates[status.statusUpdates.length - 1]
                    const allUpdatesTooltip = <p><b>All {status.extractorType} events</b> <br /> {status.statusUpdates.map(u => <>{`${moment(u.eventTime).format("DD MMM HH:mm:ss")} ${u.status}`}<br/></>)}</p>
                    return <li><EuiFlexGroup>
                        <EuiFlexItem>{status.extractorType.replace("Extractor", "")}</EuiFlexItem>
                        <EuiFlexItem grow={false}>
                            <EuiToolTip content={allUpdatesTooltip}>
                                {mostRecent.status && <EuiBadge color={statusToColor(mostRecent.status)}>{mostRecent.status} ({moment(mostRecent.eventTime).format("HH:mm:ss")  })</EuiBadge>}
                            </EuiToolTip>
                        </EuiFlexItem>
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
            extractorType: s.extractorType.replace("Extractor", ""),
            statusUpdates: _.sortBy(s.statusUpdates
                // discard empty status updates (does this make sense? Maybe we should tag them as 'unknown status' instead
                .filter((u: any) => u.eventTime !== undefined && u.status !== undefined)
                .map((u: any) => ({
                    ...u,
                    eventTime: new Date(u.eventTime)
            })), update => update.eventTime)
        }))
    }
}

export function IngestionEvents(
    {collectionId, ingestId, workspaces, breakdownByWorkspace}: {
        collectionId: string,
        ingestId?: string,
        workspaces: WorkspaceMetadata[],
        breakdownByWorkspace: boolean
    }) {
    const [blobs, updateBlobs] = useState<BlobStatus[] | undefined>(undefined)

    const ingestIdSuffix = ingestId && ingestId !== "all" ? `/${ingestId}` : ""
    const [tableData, setTableData] = useState<IngestionTable[]>([])


    useEffect(() => {
        authFetch(`/api/ingestion-events/${collectionId}${ingestIdSuffix}`)
            .then(resp => resp.json())
            .then(json => {
                const blobStatuses: BlobStatus[] = json.map(parseBlobStatus)
                updateBlobs(blobStatuses)
        })
    }, [collectionId, ingestId, updateBlobs, ingestIdSuffix])

    useEffect(() => {
        if (blobs) {
            if (breakdownByWorkspace) {
                setTableData(workspaces
                    .map((w: WorkspaceMetadata) => ({
                        title: `Workspace: ${w.name}`,
                        blobs: blobs.filter(b => b.workspaceName === w.name)
                    })))
            } else {
                setTableData([{title: `${collectionId}${ingestIdSuffix}`, blobs}])
            }
        } else {
            setTableData([])
        }

    }, [breakdownByWorkspace, blobs, workspaces, ingestIdSuffix, collectionId])

    return <>
        {tableData.map((t: IngestionTable) => <>
            <EuiSpacer size={"m"}/>
        <h1>{t.title}</h1>
        <EuiInMemoryTable
            tableCaption="ingestion events"
            items={t.blobs}
            itemId="metadata.blobId"
            loading={blobs === undefined}
            columns={columns}
            sorting={true}
        />
    </>)}
        </>
}

