import { beforeEach, expect, it, vi } from "vitest";
import authFetch from "../util/auth/authFetch";
import {
  fetchCollection,
  fetchCollections,
  newCollection,
} from "./CollectionsApi";
import { fetchIngestions, authDownloadLink } from "./DocumentApi";
import { getCollection } from "../actions/collections/getCollection";
import { getCollections } from "../actions/collections/getCollections";
import collectionsReducer from "../reducers/collectionsReducer";
import { collectionWithUsersSchema } from "../types/Collection";

vi.mock("../util/auth/authFetch", () => ({ default: vi.fn() }));
beforeEach(() => vi.resetAllMocks());

const ingestion = {
  uri: "collection/ingestion",
  display: "Ingestion",
  startTime: "2026-10-13T12:00:00+01:00",
  languages: [
    { key: "english", ocr: "eng", iso6391Code: "en", analyzer: "english" },
  ],
  fixed: true,
  default: false,
};
const collection = {
  uri: "collection",
  display: "Collection",
  ingestions: [ingestion],
  users: ["user"],
};

it("validates detail/list responses and preserves timestamps and extra fields", async () => {
  const data = {
    ...collection,
    extra: "keep",
    ingestions: [{ ...ingestion, extra: 1 }],
  };
  vi.mocked(authFetch).mockImplementation(async () => Response.json(data));
  expect(await fetchCollection("collection")).toEqual(data);
  expect(await fetchIngestions("collection")).toEqual(data);
  vi.mocked(authFetch).mockResolvedValue(Response.json([data]));
  expect(await fetchCollections()).toEqual([data]);
});

it("accepts omitted and nullable Option fields and empty arrays", () => {
  expect(collectionWithUsersSchema.safeParse(collection).success).toBe(true);
  expect(
    collectionWithUsersSchema.safeParse({
      ...collection,
      createdBy: null,
      ingestions: [
        { ...ingestion, endTime: null, path: null, failureMessage: null },
      ],
    }).success,
  ).toBe(true);
  expect(
    collectionWithUsersSchema.safeParse({
      ...collection,
      createdBy: "user",
      ingestions: [
        {
          ...ingestion,
          endTime: "2026-10-13T12:30:00Z",
          path: "ingestion",
          failureMessage: "failed",
        },
      ],
    }).success,
  ).toBe(true);
  expect(
    collectionWithUsersSchema.safeParse({
      ...collection,
      users: [],
      ingestions: [],
    }).success,
  ).toBe(true);
});

it("validates creation without inventing users and preserves the 404 fallback", async () => {
  const created = {
    uri: "new",
    display: "New",
    ingestions: [],
    createdBy: "user",
  };
  vi.mocked(authFetch).mockResolvedValue(Response.json(created));
  expect(await newCollection("New")).toEqual(created);
  vi.mocked(authFetch).mockResolvedValue(
    new Response("not JSON", { status: 404 }),
  );
  expect(await fetchCollection("missing")).toBeUndefined();
  const dispatch = vi.fn();
  await getCollection("missing")(dispatch);
  expect(dispatch).toHaveBeenLastCalledWith(
    expect.objectContaining({
      type: "APP_SHOW_ERROR",
      error: "Collection does not exist",
    }),
  );
});

it.each(
  [
    null,
    { ...collection, uri: undefined },
    { ...collection, users: undefined },
    { ...collection, users: null },
    { ...collection, ingestions: null },
    { ...collection, ingestions: [{ ...ingestion, startTime: "not a date" }] },
    { ...collection, ingestions: [{ ...ingestion, endTime: 123 }] },
    { ...collection, ingestions: [{ ...ingestion, languages: [{}] }] },
    { ...collection, ingestions: [{ ...ingestion, fixed: undefined }] },
  ].map((data) => ({ data })),
)(
  "rejects malformed collection $data through existing errors",
  async ({ data }) => {
    vi.mocked(authFetch).mockImplementation(async () => Response.json(data));
    await expect(fetchIngestions("collection")).rejects.toThrow();
    const dispatch = vi.fn();
    await getCollection("collection")(dispatch);
    expect(dispatch).toHaveBeenLastCalledWith(
      expect.objectContaining({
        type: "APP_SHOW_ERROR",
        message: "Failed to get collection: collection",
        error: expect.any(Error),
      }),
    );
    vi.mocked(authFetch).mockResolvedValue(Response.json([data]));
    await getCollections()(dispatch);
    expect(dispatch).toHaveBeenLastCalledWith(
      expect.objectContaining({
        type: "APP_SHOW_ERROR",
        message: "Failed to get collections",
        error: expect.any(Error),
      }),
    );
  },
);

it.each(["json", "network", "non-array"])(
  "handles %s failures without receiving collections",
  async (failure) => {
    if (failure === "network")
      vi.mocked(authFetch).mockRejectedValue(new Error("offline"));
    else
      vi.mocked(authFetch).mockImplementation(async () =>
        failure === "json" ? new Response("{") : Response.json(collection),
      );
    const dispatch = vi.fn();
    await getCollections()(dispatch);
    expect(dispatch).toHaveBeenCalledTimes(2);
    expect(dispatch).toHaveBeenLastCalledWith(
      expect.objectContaining({ type: "APP_SHOW_ERROR" }),
    );
    if (failure !== "non-array") {
      await expect(newCollection("New")).rejects.toThrow();
      await expect(fetchIngestions("collection")).rejects.toThrow();
      await getCollection("collection")(dispatch);
      expect(dispatch).toHaveBeenLastCalledWith(
        expect.objectContaining({ type: "APP_SHOW_ERROR" }),
      );
    }
  },
);

it("retains collection replacement, append and download link behavior", () => {
  const first = collectionWithUsersSchema.parse(collection);
  const updated = { ...first, display: "Updated" };
  const second = { ...first, uri: "second" };
  const state = collectionsReducer([], {
    type: "COLLECTIONS_GET_RECEIVE",
    collections: [first],
    receivedAt: 0,
  });
  expect(
    collectionsReducer(state, {
      type: "COLLECTION_GET_RECEIVE",
      collection: updated,
      receivedAt: 1,
    }),
  ).toEqual([updated]);
  expect(
    collectionsReducer(state, {
      type: "COLLECTION_GET_RECEIVE",
      collection: second,
      receivedAt: 1,
    }),
  ).toEqual([first, second]);
  expect(authDownloadLink("uri")).toBe("/api/download/auth/uri");
  expect(authDownloadLink("uri", "file")).toBe(
    "/api/download/auth/uri?filename=file",
  );
});
