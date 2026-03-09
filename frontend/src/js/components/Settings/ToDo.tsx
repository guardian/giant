import {useEffect, useState} from "react";
import authFetch from "../../util/auth/authFetch";
import {EuiBasicTable, EuiButton, EuiPopover, EuiToolTip} from "@elastic/eui";

interface Failure {
  at: number,
  stackTrace: string
}

interface ToDoItem {
  extractor: string;
  ingestion: string;
  attempts: number;
  priority: number;
  size: number;
  blobUri: string;
  lockedBy: string | undefined;
  failures: Failure[];
}

interface ToDo {
  total: number;
  items: ToDoItem[];
}

interface ToDoDisplayProps {
  title: string,
  todo: ToDo,
}
const ToDoDisplay = ({title, todo}: ToDoDisplayProps) => <>
  <h2>{title}</h2>
  <div>Showing {todo.items.length} of {todo.total} items</div>
  { /* TODO some grouping by worker, possibly serverside */ }
  { /* TODO make priority changeable */ }
  { /* TODO consider some sort of search */ }
  { /* TODO highlight same blob being locked by multiple workers */ }
  <EuiBasicTable tableLayout="auto" items={todo.items} css={{
    th: {
      position: "sticky",
      top: 0,
      background: "white",
      zIndex: 1,
      borderBottom: "1px solid lightgrey",
      boxSizing: "border-box"
    }
  }} columns={[
    {
      name: "Blob URI",
      field: "blobUri",
      width: "min-content",
      render: (blobUri: string, item) =>
        <a href={`/viewer/${blobUri}`} target="_blank" rel="noreferrer">
          {blobUri.substring(0, 4)}...{blobUri.substring(blobUri.length - 4)}
        </a>,
    },
    {
      name: "Extractor",
      field: "extractor",
    },
    {
      name: "Ingestion",
      field: "ingestion",
      style: {
        whiteSpace: "nowrap",
      }
    },
    {
      name: "Attempts",
      field: "attempts",
    },
    {
      name: "Priority",
      field: "priority",
    },
    {
      name: "Size (bytes)",
      field: "size",
      render: (size: number, item) => size.toLocaleString(),
      align: "right",
    },
    {
      name: <span>Previous Failures?<br/>(hover for stack trace)</span>,
      field: "failures",
      render: (failures: Failure[], item) =>
        <EuiToolTip position="left" content={ <ul>
          {failures.map(({at, stackTrace}) => (
            <li title={stackTrace}>
              <strong>{new Date(at).toLocaleString()}</strong>
              <br/>
              {stackTrace.split("\n")[0].substring(0, 70)}...
            </li>
          ))}
        </ul>}>
          <span>{failures.length} failure{failures.length !== 1 && "s"}</span>
        </EuiToolTip>
    }
  ]} />
</>

export const ToDo = () => {

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [data, setData] = useState<{
    inProgress: ToDo,
    waiting: ToDo,
    failed: ToDo
  } | null>(null);

  const refresh = () => {
    setIsRefreshing(true);
    authFetch("/api/todo").then(res => res.json()).then(res => {
      setData(res);
      setIsRefreshing(false);
    });
  }
  useEffect(refresh, []);

  return (
    <div>
      <EuiButton isLoading={isRefreshing} disabled={isRefreshing} onClick={refresh} iconType="refresh"
                 style={{position: "fixed", right: "5px", zIndex: 2, marginTop: "5px"}}>
        {isRefreshing ? "Refreshing" : "Refresh"}
      </EuiButton>
      {data ? (<>
        <ToDoDisplay title="In Progress" todo={data.inProgress} />
        <ToDoDisplay title="Waiting" todo={data.waiting} />
        <ToDoDisplay title="Exceeded Max. Attempts" todo={data.failed} />
      </>) : (<div>Loading...</div>)}
    </div>
  );
}
