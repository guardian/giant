import { beforeEach, expect, it, vi } from "vitest";
import PropTypes from "prop-types";
import authFetch from "../util/auth/authFetch";
import { fetchFilters } from "./FiltersApi";
import { getFilters } from "../actions/getFilters";
import { searchFilterOption, searchFiltersSchema } from "../types/SearchFilter";
import { GiantDispatch } from "../types/redux/GiantDispatch";
import filtersReducer from "../reducers/filtersReducer";

vi.mock("../util/auth/authFetch", () => ({ default: vi.fn() }));
const option = { value: "leaf", display: "Leaf" };
const filter = {
  key: "ingestion",
  display: "Datasets",
  hideable: false,
  options: [
    {
      ...option,
      suboptions: [{ ...option, explanation: "Help", suboptions: [option] }],
    },
  ],
};
beforeEach(() => vi.resetAllMocks());

it("fetches and dispatches recursive filters", async () => {
  vi.mocked(authFetch).mockResolvedValue(Response.json([filter]));
  const dispatch = vi.fn<GiantDispatch>();
  await getFilters()(dispatch);
  expect(authFetch).toHaveBeenCalledWith("/api/filters");
  expect(dispatch).toHaveBeenNthCalledWith(1, {
    type: "FILTERS_GET_REQUEST",
    receivedAt: expect.any(Number),
  });
  expect(dispatch).toHaveBeenNthCalledWith(2, {
    type: "FILTERS_GET_RECEIVE",
    filters: [filter],
    receivedAt: expect.any(Number),
  });
  expect(
    filtersReducer([], {
      type: "FILTERS_GET_RECEIVE",
      filters: [filter],
      receivedAt: 0,
    }),
  ).toEqual([filter]);
});

it("accepts empty lists and absent or null optional fields", () => {
  expect(searchFiltersSchema.safeParse([]).success).toBe(true);
  for (const optional of [{}, { explanation: null, suboptions: null }]) {
    expect(
      searchFiltersSchema.safeParse([
        { ...filter, options: [{ ...option, ...optional }] },
      ]).success,
    ).toBe(true);
  }
});

it.each(
  [
    null,
    {},
    [{ ...filter, hideable: undefined }],
    [{ ...filter, display: null }],
    [{ ...filter, options: null }],
    [{ ...filter, options: [{ value: "leaf" }] }],
    [{ ...filter, options: [{ ...option, explanation: 1 }] }],
    [{ ...filter, options: [{ ...option, suboptions: [null] }] }],
    [
      {
        ...filter,
        options: [{ ...option, suboptions: [{ ...option, value: 1 }] }],
      },
    ],
  ].map((data) => ({ data })),
)(
  "rejects invalid response $data through the existing error action",
  async ({ data }) => {
    vi.mocked(authFetch).mockImplementation(async () => Response.json(data));
    await expect(fetchFilters()).rejects.toThrow();
    const dispatch = vi.fn<GiantDispatch>();
    await getFilters()(dispatch);
    expect(dispatch).toHaveBeenCalledTimes(2);
    expect(dispatch).toHaveBeenLastCalledWith({
      type: "APP_SHOW_ERROR",
      message: "Failed to get filters",
      error: expect.any(Error),
      receivedAt: expect.any(Number),
    });
  },
);

it.each(["json", "network"])(
  "handles %s failures without receiving filters",
  async (failure) => {
    if (failure === "json")
      vi.mocked(authFetch).mockResolvedValue(new Response("{"));
    else vi.mocked(authFetch).mockRejectedValue(new Error("Network failure"));
    const dispatch = vi.fn<GiantDispatch>();
    await getFilters()(dispatch);
    expect(dispatch).toHaveBeenCalledTimes(2);
    expect(dispatch).toHaveBeenLastCalledWith({
      type: "APP_SHOW_ERROR",
      message: "Failed to get filters",
      error: expect.any(Error),
      receivedAt: expect.any(Number),
    });
  },
);

it("validates nested options for JavaScript PropTypes consumers", () => {
  const error = vi.spyOn(console, "error").mockImplementation(() => {});
  try {
    PropTypes.resetWarningCache();
    PropTypes.checkPropTypes(
      { option: searchFilterOption },
      { option: filter.options[0] },
      "prop",
      "FilterTest",
    );
    expect(error).not.toHaveBeenCalled();
    PropTypes.checkPropTypes(
      { option: searchFilterOption },
      { option: { ...option, suboptions: [{ ...option, value: 1 }] } },
      "prop",
      "FilterTest",
    );
    expect(error).toHaveBeenCalledWith(
      expect.stringContaining("option.suboptions[0].value"),
    );
  } finally {
    error.mockRestore();
  }
});
