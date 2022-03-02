import React, { FC, useEffect, useState } from "react";
import { VirtualScroll } from "./VirtualScroll";
import { PageCache } from "./PageCache";
import authFetch from "../../util/auth/authFetch";
import { useParams } from "react-router-dom";
import { Page } from "./Page";

type PageViewerProps = {
  page: number;
};

export const PageViewer: FC<PageViewerProps> = () => {
  const { uri } = useParams<{ uri: string }>();
  const [page] = useState(
    Number(new URLSearchParams(document.location.search).get("page"))
  );

  const [pageCache] = useState(new PageCache(uri));
  const [totalPages, setTotalPages] = useState<number | null>(null);

  useEffect(() => {
    authFetch(`/api/pages2/${uri}/pageCount`)
      .then((res) => res.json())
      .then((obj) => setTotalPages(obj.pageCount));
  }, [uri]);

  const renderPage = (pageNumber: number) => {
    return (
      <Page
        getPagePreview={() => pageCache.getPagePreview(pageNumber)}
        getPageText={() => pageCache.getPageText(pageNumber)}
      />
    );
  };

  return totalPages ? (
    <VirtualScroll
      totalPages={totalPages}
      renderPage={renderPage}
      initialPage={page}
    />
  ) : null;
};
