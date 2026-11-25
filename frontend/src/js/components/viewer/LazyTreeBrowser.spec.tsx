import React from "react";
import ReactDOM from "react-dom";
import { act, Simulate } from "react-dom/test-utils";
import { MemoryRouter } from "react-router-dom";
import { getBasicResource } from "../../actions/resources/getResource";
import {
  deleteResourceOccurrence,
  fetchResource,
} from "../../services/ResourceApi";
import { BasicResource, Resource } from "../../types/Resource";
import LazyTreeBrowser from "./LazyTreeBrowser";

vi.mock("../../services/ResourceApi");
vi.mock("./AddToWorkspaceModal", () => ({ default: () => null }));

it("deletes an expandable ZIP using its ingestion even when the tree hides it", async () => {
  const collectionUri = "collection";
  const ingestionUri = "collection/ingestion";
  const archive: BasicResource = {
    uri: "collection/ingestion/archive.zip",
    type: "file",
    isExpandable: true,
    processingStage: { type: "processed" },
  };
  const ingestion: Resource = {
    uri: ingestionUri,
    type: "ingestion",
    isExpandable: true,
    processingStage: { type: "processed" },
    children: [archive],
    parents: [],
    extracted: false,
    mimeTypes: [],
    comments: [],
    fileSize: 0,
    previewStatus: "disabled",
  };
  vi.mocked(fetchResource)
    .mockResolvedValueOnce({
      ...ingestion,
      uri: collectionUri,
      type: "collection",
      children: [ingestion],
    })
    .mockResolvedValueOnce(ingestion);
  vi.mocked(deleteResourceOccurrence).mockReturnValue(new Promise(() => {}));
  const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
  const container = document.createElement("div");
  document.body.appendChild(container);

  try {
    const dispatch = vi.fn();
    await getBasicResource(collectionUri)(dispatch);
    const { resource } = dispatch.mock.calls.find(
      ([action]) => action.type === "RESOURCE_GET_RECEIVE",
    )![0];
    act(() => {
      ReactDOM.render(
        <MemoryRouter>
          <LazyTreeBrowser
            rootResource={resource}
            descendantResources={{}}
            getChildResource={vi.fn()}
          />
        </MemoryRouter>,
        container,
      );
    });
    const archiveName = container.querySelector(
      `[data-uri="/resources/${archive.uri}"]`,
    )!;
    act(() => Simulate.contextMenu(archiveName));
    const deleteItem = Array.from(container.querySelectorAll(".item")).find(
      (item) => item.textContent === "Delete",
    )!;
    act(() => Simulate.click(deleteItem));
    expect(deleteResourceOccurrence).toHaveBeenCalledWith(
      archive.uri,
      ingestionUri,
    );
  } finally {
    confirm.mockRestore();
    ReactDOM.unmountComponentAtNode(container);
    container.remove();
  }
});
