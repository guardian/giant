import "./icons";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
// Use the same ES build as Vite in the browser (Node defaults to EUI’s CJS build).
import {
  EuiButtonIcon,
  EuiIcon,
  EuiIconTip,
  EuiPagination,
} from "@elastic/eui/es";

describe("EUI icons in Vite", () => {
  it.each(["apps", "home", "menu", "faceSad", "sortUp", "check"])(
    "renders %s immediately without a dynamic import",
    (type) => {
      const markup = renderToStaticMarkup(<EuiIcon type={type} />);
      expect(markup).toContain("<path");
    },
  );

  it("renders button and status icons", () => {
    const container = document.createElement("div");
    container.innerHTML = renderToStaticMarkup(
      <>
        <EuiButtonIcon iconType="refresh" aria-label="Refresh workspace" />
        <EuiIconTip type="info" content="Ingestion information" />
        <EuiIconTip type="alert" content="Ingestion failed" />
      </>,
    );
    const icons = container.querySelectorAll("svg");
    expect(icons).toHaveLength(3);
    icons.forEach((icon) => expect(icon.querySelector("path")).not.toBeNull());
  });

  it("renders icons requested internally by pagination", () => {
    const container = document.createElement("div");
    container.innerHTML = renderToStaticMarkup(
      <EuiPagination pageCount={10} activePage={4} onPageClick={() => {}} />,
    );
    const icons = container.querySelectorAll("svg");
    expect(icons.length).toBeGreaterThan(0);
    icons.forEach((icon) => expect(icon.querySelector("path")).not.toBeNull());
  });
});
