import { buildSegments } from "./ResourceTrail";
import { BasicResource, Resource, ProcessingStage } from "../../types/Resource";

test("Create segments for collection", () => {
  const resource: BasicResource = {
    type: "collection",
    uri: "collection",
    display: "collection",
    isExpandable: true,
    processingStage: { type: "processed" },
  };

  const segments = [{ uri: "collection", display: "collection" }];

  expect(buildSegments(resource)).toStrictEqual(segments);
});

test("Create segments for ingestion", () => {
  const resource: BasicResource = {
    type: "ingestion",
    uri: "collection/ingestion",
    display: "ingestion",
    isExpandable: true,
    processingStage: { type: "processed" },
  };

  const segments = [
    { uri: "collection", display: "collection" },
    { uri: "collection/ingestion", display: "ingestion" },
  ];

  expect(buildSegments(resource)).toStrictEqual(segments);
});

test("Create segments for directory", () => {
  const resource: BasicResource = {
    type: "directory",
    uri: "collection/ingestion/an/encoded$20%23%20folder",
    display: "collection/ingestion/an/encoded # folder",
    isExpandable: true,
    processingStage: { type: "processed" },
  };

  const segments = [
    { uri: "collection", display: "collection" },
    { uri: "collection/ingestion", display: "ingestion" },
    { uri: "collection/ingestion/an", display: "an" },
    {
      uri: "collection/ingestion/an/encoded$20%23%20folder",
      display: "encoded # folder",
    },
  ];

  expect(buildSegments(resource)).toStrictEqual(segments);
});

test("Create segments for directory without a display name", () => {
  const resource: BasicResource = {
    type: "directory",
    uri: "collection/ingestion/an/encoded%20%23%20folder",
    isExpandable: true,
    processingStage: { type: "processed" },
  };

  const segments = [
    { uri: "collection", display: "collection" },
    { uri: "collection/ingestion", display: "ingestion" },
    { uri: "collection/ingestion/an", display: "an" },
    {
      uri: "collection/ingestion/an/encoded%20%23%20folder",
      display: "encoded # folder",
    },
  ];

  expect(buildSegments(resource)).toStrictEqual(segments);
});

test("Create default segments for blob", () => {
  const uri =
    "v66OEG5v1dRsQwNfaaPfq-V50wYP3b07Ns9CVznKM9JhOaPAT3FFEctsCgcTm1c1c7kt5Pa_QHHkPwxEg-lviw";
  const resource: BasicResource = {
    type: "blob",
    uri,
    isExpandable: false,
    processingStage: { type: "processed" },
  };

  expect(buildSegments(resource)).toStrictEqual([{ uri, display: uri }]);
});
