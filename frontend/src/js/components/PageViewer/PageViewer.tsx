import React, { FC, useState } from "react";
import { VirtualScroll } from "./VirtualScroll";

type PageViewerProps = {
  uri: string;
    page: number;
};

export const PageViewer: FC<PageViewerProps> = () => {
  const [pages, setPages] = useState([]);

  const renderPage = (page: number) => {
    return <div>Page: {page}</div>
  }

  return <VirtualScroll totalPages={200} renderPage={renderPage}/>
};
