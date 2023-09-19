import React, {ReactNode, useEffect, useState} from "react";
import authFetch from "../../util/auth/authFetch";
import {EuiFlexItem, EuiToolTip, EuiText, EuiButtonIcon, EuiScreenReaderOnly, EuiSpacer, EuiIconTip, EuiBadge, EuiFlexGroup, EuiInMemoryTable, EuiBasicTableColumn, EuiLoadingSpinner, EuiCodeBlock} from "@elastic/eui";
import '@elastic/eui/dist/eui_theme_light.css';
import hdate from 'human-date';
import {WorkspaceMetadata} from "../../types/Workspaces";
import moment from "moment";
import _ from "lodash";
import { BlobStatus, ExtractorStatus, IngestionTable, Status, extractorStatusColors } from "./types";
import styles from "./IngestionEvents.module.css";

type BlobProgress = "complete" | "completeWithErrors" | "inProgress"

const blobStatusIcons = {
    complete: <EuiIconTip type="checkInCircleFilled" content={"Ingestion complete"} />,
    completeWithErrors: <EuiIconTip type="alert" content={"Ingestion complete with some errors"} />,
    inProgress: <EuiToolTip content={"Ingestion in progress"}><EuiLoadingSpinner /></EuiToolTip>
}

const SHORT_READABLE_DATE = "DD MMM HH:mm:ss"

const statusToColor = (status: Status) => extractorStatusColors[status]

const getFailedStatuses = (statuses: ExtractorStatus[]) => 
    statuses.filter(status => status.statusUpdates.find(u => u.status === "Failure") !== undefined);

const getFailedBlobs = (blobs: BlobStatus[]) => {
    return  blobs.filter(wb => {                
        return getFailedStatuses(wb.extractorStatuses).length > 0;        
    });
}

const getBlobStatus = (statuses: ExtractorStatus[]): BlobProgress => {
    const failures = getFailedStatuses(statuses);
    const inProgress = statuses.filter(status => status.statusUpdates.find(u => !u.status || ["Failure", "Success"].includes(u.status)) === undefined)
    return failures.length > 0 ? "completeWithErrors" : inProgress.length > 0 ? "inProgress" : "complete"
}

const blobIngestedMultipleTimes = (status:BlobStatus) => status.extractorStatuses.find(s => s.statusUpdates.filter(u => u.status === "Started").length > 1) !== undefined

const extractorStatusList = (status: ExtractorStatus, title?: string) => {
    const statusUpdateStrings = status.statusUpdates.map(u => `${moment(u.eventTime).format(SHORT_READABLE_DATE)} ${u.status}`)
    return status.statusUpdates.length > 0 ? <p>
        {title && <><b>{title}</b> <br /></>}
        <ul>
            {statusUpdateStrings.map(s => <li key={s}>{s}</li>)}
        </ul>
    </p> : "No events so far"
}

// throw away everything after last / to get the filename from a path
const pathsToFileNames = (paths: string[]) => paths.map(p => p.split("/").slice(-1)).join("\n")


const blobStatusText = {
    complete: "Complete",
    completeWithErrors: "Complete with errors",
    inProgress: "In progress"
}

const statusIconColumn = {
        field: 'extractorStatuses',
        name: '',
        width: '40',
        render: (statuses: ExtractorStatus[]) => {
            return blobStatusIcons[getBlobStatus(statuses)]
        }
    }

const columns: Array<EuiBasicTableColumn<BlobStatus>> = [
    {
        field: 'paths',
        name: 'Filename(s)',
        sortable: true,
        truncateText: true,
        render: pathsToFileNames
    },
    {
        field: 'ingestStart',
        name: 'First event time',
        sortable: true,
        render: (ingestStart: Date) => moment(ingestStart).format(SHORT_READABLE_DATE)
    },
    {
        name: 'Ingestion run time',
        render: (row: BlobStatus) =>
            <>{moment.duration(moment(row.mostRecentEvent).diff(moment(row.ingestStart))).humanize()} {
                blobIngestedMultipleTimes(row) && <EuiIconTip
                aria-label="Info"
                size="m"
                type="iInCircle"
                color="primary"
                content={"This file has been ingested more than once so ingestion run time may not be accurate."}
            />}</>
    },
    {
        field: 'extractorStatuses',
        name: 'Status',
        render: (statuses: ExtractorStatus[]) => {
            return blobStatusText[getBlobStatus(statuses)]
        }
    },
    {
        field: 'extractorStatuses',
        name: 'Extractors',
        render: (statuses: ExtractorStatus[]) => {
            return statuses.length > 0 ? (<ul>
                {statuses.map(status => {
                    const mostRecent = status.statusUpdates.length > 0 ? status.statusUpdates[status.statusUpdates.length - 1] : undefined
                    return <li key={status.extractorType}><EuiFlexGroup>
                        <EuiFlexItem>{status.extractorType.replace("Extractor", "")}</EuiFlexItem>
                        <EuiFlexItem grow={false}>
                            {mostRecent?.status ?
                                (<EuiToolTip content = {extractorStatusList(status, `All ${status.extractorType} events`)}>
                                    <EuiBadge color={statusToColor(mostRecent.status)}>
                                        {mostRecent.status} ({moment(mostRecent.eventTime).format("HH:mm:ss")  })
                                    </EuiBadge>
                            </EuiToolTip>) : <>No updates</>
                            }
                        </EuiFlexItem>
                    </EuiFlexGroup></li>
            })}
            </ul>) : <></>

        },
        width: "300"
    },

];

const parseBlobStatus = (status: any): BlobStatus => {
    return {
        ...status,
        paths: status.paths.map((p: any) => p ? p : "unknown-filename"),
        ingestStart: new Date(status.ingestStart),
        mostRecentEvent: new Date(status.mostRecentEvent),
        mimeTypes: status.mimeTypes?.split(","),
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

const blobStatusId = (blobStatus: BlobStatus) => `${blobStatus.metadata.ingestId}-${blobStatus.metadata.blobId}`

const renderExpandedRow = (blobStatus: BlobStatus) => {
    return <EuiText>
        <h3>{pathsToFileNames(blobStatus.paths)}</h3>
        <p>Full file path(s) : {blobStatus.paths.join(", ")}. Ingestion started on {hdate.prettyPrint(blobStatus.ingestStart)}</p>
        {blobStatus.mimeTypes && `This file is of type ${blobStatus.mimeTypes.join(",")}.`} Giant has run the following extractors on the file:
        <div className={styles.expandedRowExtractorStatus}>
            {blobStatus.extractorStatuses.map(extractorStatus => {
                const numErrors = extractorStatus.statusUpdates.filter(su => su.status === "Failure").length
                const numStarted = extractorStatus.statusUpdates.filter(su => su.status === "Started").length
                const mostRecent = extractorStatus.statusUpdates.length > 0 ? extractorStatus.statusUpdates[extractorStatus.statusUpdates.length - 1] : undefined
                return <><h4>{extractorStatus.extractorType}</h4>
                    <p>The extractor {extractorStatus.extractorType} has been started {numStarted} times. There have been {numErrors} errors.<br />
                        {mostRecent ? <>The most recent status event is '{mostRecent.status}' which happened on {hdate.prettyPrint(mostRecent.eventTime, {showTime: true})}</> : ""} <br /> <br />

                        All {extractorStatus.extractorType} events:

                        {extractorStatusList(extractorStatus)}


                </p></>
            })}
        </div>
        {blobStatus.errors.length > 0 &&
            <>
                <h4>Errors encountered processing this file</h4>
                {blobStatus.errors.map(error => <EuiCodeBlock>{error.message}</EuiCodeBlock>)}
            </>
        }
    </EuiText>
}

export function IngestionEvents(
    {collectionId, ingestId, workspaces, breakdownByWorkspace, showErrorsOnly}: {
        collectionId: string,
        ingestId?: string,
        workspaces: WorkspaceMetadata[],
        breakdownByWorkspace: boolean,
        showErrorsOnly: boolean,
    }) {
    const [blobs, updateBlobs] = useState<BlobStatus[] | undefined>(undefined)
    const [tableData, setTableData] = useState<IngestionTable[]>([])

    const ingestIdSuffix = ingestId && ingestId !== "all" ? `/${ingestId}` : ""

    // Expanding rows logic - we use itemIdToExpandedRowMap to keep track of which rows have been expanded
    const [itemIdToExpandedRowMap, setItemIdToExpandedRowMap ] = useState<
        Record<string, ReactNode>
    >({});
    const openRow = (blobStatus: BlobStatus) => {
        const map = {...itemIdToExpandedRowMap}
        const id = blobStatusId(blobStatus)
        map[id] = renderExpandedRow(blobStatus)
        setItemIdToExpandedRowMap(map)
    }

    const closeRow = (blobStatus: BlobStatus) => {
        const map = {...itemIdToExpandedRowMap}
        delete map[blobStatusId(blobStatus)]
        setItemIdToExpandedRowMap(map)
    }

    const columnsWithWorkspace = breakdownByWorkspace ?
        columns : columns.concat(    {
            field: 'workspaceName',
            sortable: true,
            name: 'Workspace name'
        })

    const columnsWithExpandingRow: Array<EuiBasicTableColumn<BlobStatus>> = [
        ...columnsWithWorkspace,
        statusIconColumn,
        {
            align: 'right',
            width: '40px',
            isExpander: true,
            name: (<EuiScreenReaderOnly><span>Expand rows</span></EuiScreenReaderOnly>),
            render: (row: BlobStatus) => (
                <EuiButtonIcon
                    onClick={() => itemIdToExpandedRowMap[blobStatusId(row)] ? closeRow(row) : openRow(row)}
                    aria-label={
                        itemIdToExpandedRowMap[blobStatusId(row)] ? 'Collapse' : 'Expand'
                    }
                    iconType={
                        itemIdToExpandedRowMap[blobStatusId(row)] ? 'arrowDown' : 'arrowRight'
                    }
                />
            )
        }
    ]

    useEffect(() => {
        authFetch(`/api/ingestion-events/${collectionId}${ingestIdSuffix}`)
            .then(resp => resp.json())
            .then(json => {
                const blobStatuses: BlobStatus[] = json.map(parseBlobStatus)
                updateBlobs(blobStatuses)
        })
    }, [collectionId, ingestId, updateBlobs, ingestIdSuffix])

    const getWorkspaceBlobs = (allBlobs: BlobStatus[], workspaceName: string, errorsOnly: boolean | undefined) => {       
        const workspaceBlobs = allBlobs.filter(b => b.workspaceName === workspaceName);

        if (errorsOnly) return getFailedBlobs(workspaceBlobs);
        
        return workspaceBlobs;
    }

    useEffect(() => {
        if (blobs) {
            if (breakdownByWorkspace) {
                setTableData(workspaces
                    .map((w: WorkspaceMetadata) => ({
                        title: `Workspace: ${w.name}`,
                        blobs: getWorkspaceBlobs(blobs, w.name, showErrorsOnly)
                    })))
            } else {
                setTableData([
                    {
                        title: `${collectionId}${ingestIdSuffix}`,
                        blobs: showErrorsOnly ? getFailedBlobs(blobs) : blobs
                    }])
            }
        } else {
            setTableData([])
        }
    }, [breakdownByWorkspace, blobs, workspaces, ingestIdSuffix, collectionId, showErrorsOnly, setItemIdToExpandedRowMap])

    return (
        <>
        {tableData.map((t: IngestionTable) =>
            <div key={t.title}>
            <EuiSpacer size={"m"}/>
            <h1>{t.title}</h1>
            <EuiInMemoryTable
                tableCaption="ingestion events"
                items={t.blobs}
                itemId={blobStatusId}
                loading={t.blobs === undefined}
                columns={columnsWithExpandingRow}
                sorting={true}
                itemIdToExpandedRowMap={itemIdToExpandedRowMap}
            />
            </div>
        )}
        </>
    )
}

