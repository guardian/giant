import React, { FC, useCallback } from "react";
import { Page as PageData } from "./model";

type PageProps = {
  // Pass in funcitons here so the page can handle the life cycle of it's own elements
  getPagePreview: () => Promise<HTMLCanvasElement>;
  getPageText: () => Promise<PageData>;
};

export const Page: FC<PageProps> = ({ getPagePreview, getPageText }) => {
  const mountCanvas = useCallback((pageRef) => {
    getPagePreview().then((canvas) => pageRef?.appendChild(canvas));
    getPageText();
  }, []);

  return <div ref={mountCanvas} />;
};
