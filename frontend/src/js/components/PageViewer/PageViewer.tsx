import React, { FC, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import authFetch from "../../util/auth/authFetch";
import { Page } from "./Page";
import { PageCache } from "./PageCache";
import styles from "./PageViewer.module.css";
import { VirtualScroll } from "./VirtualScroll";

type PageViewerProps = {
  page: number;
};

export const PageViewer: FC<PageViewerProps> = () => {
  const params = new URLSearchParams(document.location.search);

  const query = params.get("q") ?? undefined;
  const page = Number(params.get("page"));

  const { uri } = useParams<{ uri: string }>();

  const [pageCache] = useState(new PageCache(uri, query));
  const [totalPages, setTotalPages] = useState<number | null>(null);

  useEffect(() => {
    authFetch(`/api/pages2/${uri}/pageCount`)
      .then((res) => res.json())
      .then((obj) => setTotalPages(obj.pageCount));

  }, [uri]);

  const renderPage = (pageNumber: number) => {
    const cachedPage = pageCache.getPage(pageNumber);

    return (
      <Page
        getPagePreview={() => cachedPage.preview}
        getPageData={() => cachedPage.data}
      />
    );
  };

  return (
    <main className={styles.main}>
      {totalPages ? (
        <VirtualScroll
          totalPages={totalPages}
          renderPage={renderPage}
          initialPage={page}
        />
      ) : null}
    </main>
  );
};
