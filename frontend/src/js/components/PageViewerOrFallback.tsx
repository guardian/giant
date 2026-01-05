import { FC, useEffect, useState } from "react";
import authFetch from "../util/auth/authFetch";
import { useParams } from "react-router-dom";
import Viewer from "./viewer/Viewer";
import { PageViewer } from "./PageViewer/PageViewer";
import React from "react";

export const PageViewerOrFallback: FC<{}> = () => {
  const { uri } = useParams<{ uri: string }>();

  const [totalPages, setTotalPages] = useState<number | null>(null);

  useEffect(() => {
    authFetch(`/api/pages2/${uri}/pageCount`)
      .then((res) => res.json())
      .then((obj) => setTotalPages(obj.pageCount));
  }, [uri]);

  if (totalPages === null) {
    return null;
  } else if (totalPages === 0) {
    return <Viewer match={{ params: { uri } }} />;
  } else {
    return <PageViewer uri={uri} totalPages={totalPages} />;
  }
};
