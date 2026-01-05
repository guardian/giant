import React, { FC } from "react";
import { Table } from "semantic-ui-react";
import Papa from "papaparse";

type TablePreviewProps = {
  text: string;
};

export const TablePreview: FC<TablePreviewProps> = ({ text }) => {
  const table = Papa.parse(text, { header: false });

  if (table.errors.length > 0) {
    console.error(`Failed to parse CSV: ${table.errors.join(", ")}`);
    return (
      <div className="viewer__no-text-preview">Failed to parse CSV data</div>
    );
  }

  const [header, ...rows] = table.data as string[][];

  return (
    <div className="document__preview-table">
      <Table compact celled selectable>
        <Table.Header>
          <Table.Row>
            {header.map((h) => (
              <Table.HeaderCell>{h}</Table.HeaderCell>
            ))}
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {rows.map((r) => (
            <Table.Row>
              {r.map((c) => (
                <Table.Cell>{c}</Table.Cell>
              ))}
            </Table.Row>
          ))}
        </Table.Body>
      </Table>
    </div>
  );
};
