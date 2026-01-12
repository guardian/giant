import React, { useState, useEffect } from "react";
import {
  Message,
  Header,
  Segment,
  Container,
  Table,
  Statistic,
} from "semantic-ui-react";
import { Checkbox } from "../UtilComponents/Checkbox";
import authFetch from "../../util/auth/authFetch";
import format from "date-fns/format";
import startOfWeek from "date-fns/startOfWeek";
import endOfWeek from "date-fns/endOfWeek";
import sum from "lodash/sum";

type Upload = {
  timestamp: number;
  description: string;
  tags: {
    collection: string;
    username: string;
    originalPath: string;
    uploadId: string;
    workspace?: string;
  };
};

type UploadSummary = {
  uploadId: string;
  timestamp: number;
  destination: string;
  username: string;
  numberOfFiles: number;
};

function groupByUploadId(uploads: Upload[]): UploadSummary[] {
  return Object.values(
    uploads.reduce(
      (
        acc,
        { timestamp, tags: { collection, workspace, username, uploadId } },
      ) => {
        if (uploadId in acc) {
          acc[uploadId] = {
            ...acc[uploadId],
            numberOfFiles: acc[uploadId].numberOfFiles + 1,
          };
        } else {
          const destination = workspace || collection;
          acc[uploadId] = {
            uploadId,
            destination,
            username,
            timestamp,
            numberOfFiles: 1,
          };
        }

        return acc;
      },
      {} as { [key: string]: UploadSummary },
    ),
  )
    .sort(({ timestamp }) => timestamp)
    .reverse();
}

function groupByWeek(uploads: UploadSummary[]): {
  [key: string]: UploadSummary[];
} {
  return uploads.reduce(
    (acc, upload) => {
      const start = format(
        startOfWeek(upload.timestamp, { weekStartsOn: 1 }),
        "E do MMM yyyy",
      );
      const end = format(
        endOfWeek(upload.timestamp, { weekStartsOn: 1 }),
        "E do MMM yyyy",
      );
      const week: string = `${start} - ${end}`;

      if (week in acc) {
        acc[week] = [...acc[week], upload];
      } else {
        acc[week] = [upload];
      }

      return acc;
    },
    {} as { [key: string]: UploadSummary[] },
  );
}

function UploadsTable({
  uploads,
  showUser,
}: {
  uploads: UploadSummary[];
  showUser: boolean;
}) {
  return (
    <Table basic="very" celled>
      <Table.Header>
        <Table.Row>
          <Table.HeaderCell>Time</Table.HeaderCell>
          {showUser ? <Table.HeaderCell>User</Table.HeaderCell> : false}
          <Table.HeaderCell>Location</Table.HeaderCell>
          <Table.HeaderCell>Files</Table.HeaderCell>
        </Table.Row>
      </Table.Header>
      <Table.Body>
        {uploads.map((upload) => (
          <Table.Row key={upload.uploadId}>
            <Table.Cell>{format(upload.timestamp, "E do MMM p")}</Table.Cell>
            {showUser ? <Table.Cell>{upload.username}</Table.Cell> : false}
            <Table.Cell>{upload.destination}</Table.Cell>
            <Table.Cell>
              {upload.numberOfFiles === 1
                ? "1 file"
                : `${upload.numberOfFiles} files`}
            </Table.Cell>
          </Table.Row>
        ))}
      </Table.Body>
    </Table>
  );
}

export function WeeklyUploadsFeed() {
  const [uploads, setUploads] = useState(
    {} as { [key: string]: UploadSummary[] },
  );

  const [message, setMessage] = useState(
    "No uploads to display" as string | undefined,
  );
  const [showAdminUploads, setShowAdminUploads] = useState(false);

  useEffect(() => {
    const params = showAdminUploads ? `?showAdminUploads=true` : "";

    authFetch(`/api/events/uploads${params}`)
      .then((resp) => resp.json())
      .then(({ events }) => {
        const groupedByUploadId = groupByUploadId(events as Upload[]);
        const groupedByWeek = groupByWeek(groupedByUploadId);

        setUploads(groupedByWeek);
        setMessage(undefined);
      })
      .catch((err) => {
        setMessage("Error loading uploads. You must be an admin.");
      });
  }, [showAdminUploads]);

  return (
    <Container>
      <Checkbox
        selected={showAdminUploads}
        onClick={() => setShowAdminUploads(!showAdminUploads)}
      >
        Show admin uploads
      </Checkbox>
      {message ? (
        <Message warning>
          <Message.Header>{message}</Message.Header>
        </Message>
      ) : (
        false
      )}
      {Object.entries(uploads).map(([header, uploads], ix) => {
        const uniqueUsers = new Set(uploads.map(({ username }) => username))
          .size;
        const fileCount = sum(
          uploads.map(({ numberOfFiles }) => numberOfFiles),
        );

        return (
          <React.Fragment key={header}>
            <Header as="h5" attached={ix === 0 ? "top" : true}>
              {header}
            </Header>
            <Segment attached>
              <Statistic.Group widths="two">
                <Statistic>
                  <Statistic.Value>{uniqueUsers}</Statistic.Value>
                  <Statistic.Label>
                    {uniqueUsers === 1 ? "User" : "Users"}
                  </Statistic.Label>
                </Statistic>
                <Statistic>
                  <Statistic.Value>{fileCount}</Statistic.Value>
                  <Statistic.Label>
                    {uniqueUsers === 1 ? "File" : "Files"}
                  </Statistic.Label>
                </Statistic>
              </Statistic.Group>
              <UploadsTable uploads={uploads} showUser={true} />
            </Segment>
          </React.Fragment>
        );
      })}
    </Container>
  );
}
