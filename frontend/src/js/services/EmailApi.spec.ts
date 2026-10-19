import { beforeEach, expect, it, vi } from "vitest";
import authFetch from "../util/auth/authFetch";
import { getEmailThread } from "./EmailApi";
import { getEmailThread as getThreadAction } from "../actions/email/getEmailThread";
import emails from "../reducers/emailsReducer";
import { emailThreadSchema } from "../types/Email";

vi.mock("../util/auth/authFetch", () => ({ default: vi.fn() }));
beforeEach(() => vi.resetAllMocks());

const response = {
  missingNodes: ["missing"],
  thread: [
    {
      email: {
        uri: "dated",
        haveSource: true,
        display: "Subject",
        metadata: {
          subject: "Subject",
          fromAddress: "sender@example.com",
          fromName: "Sender",
          sentAt: { time: "2026-10-19T12:30:00+01:00", knownTimezone: true },
        },
      },
      neighbours: [{ uri: "ghost", relation: "IN_REPLY_TO" }],
    },
    { email: { uri: "ghost", haveSource: false }, neighbours: [] },
    {
      email: { uri: "undated", haveSource: true, metadata: {} },
      neighbours: [],
    },
  ],
};

it("preserves ordering, neighbours, missing nodes and absent metadata", async () => {
  vi.mocked(authFetch).mockImplementation(async () => Response.json(response));
  expect(await getEmailThread("dated")).toEqual(response);
  expect(authFetch).toHaveBeenCalledWith("/api/emails/thread/dated");
  const dispatch = vi.fn();
  await getThreadAction("dated")(dispatch);
  expect(dispatch).toHaveBeenCalledExactlyOnceWith({
    type: "EMAIL_THREAD_RECEIVE",
    uri: "dated",
    timeline: response,
    receivedAt: expect.any(Number),
  });
  const timeline = emailThreadSchema.parse(response);
  const action = {
    type: "EMAIL_THREAD_RECEIVE" as const,
    uri: "dated",
    timeline,
    receivedAt: 1,
  };
  expect(emails(undefined, action)).toEqual({ uri: "dated", timeline });
  expect(emails({ uri: "previous", timeline }, action)).toEqual({
    uri: "dated",
    timeline,
  });
});

it.each(["2026-10-19T11:30:00Z", "2026-10-19T11:30:00.123456Z"])(
  "accepts timestamp %s with unknown timezone",
  (time) => {
    expect(
      emailThreadSchema.safeParse({
        missingNodes: [],
        thread: [
          {
            email: {
              uri: "email",
              haveSource: true,
              metadata: { sentAt: { time, knownTimezone: false } },
            },
            neighbours: [],
          },
        ],
      }).success,
    ).toBe(true);
  },
);

it.each(
  [
    null,
    {},
    { ...response, missingNodes: null },
    { ...response, thread: null },
    { ...response, missingNodes: [1] },
    ...[
      { uri: "email", hasSource: true },
      { uri: "email", haveSource: "true" },
      { uri: "email", haveSource: true, metadata: null },
      { uri: "email", haveSource: true, display: null },
      ...[
        { subject: null },
        { fromName: 1 },
        { sentAt: null },
        { sentAt: { time: "not a date", knownTimezone: true } },
        { sentAt: { time: "2026-10-19T12:30:00Z" } },
      ].map((metadata) => ({ uri: "email", haveSource: true, metadata })),
    ].map((email) => ({
      missingNodes: [],
      thread: [{ email, neighbours: [] }],
    })),
    {
      missingNodes: [],
      thread: [
        {
          email: { uri: "email", haveSource: true },
          neighbours: [{ uri: "other" }],
        },
      ],
    },
  ].map((data) => ({ data })),
)("rejects invalid data $data via APP_SHOW_ERROR", async ({ data }) => {
  vi.mocked(authFetch).mockResolvedValue(Response.json(data));
  const dispatch = vi.fn();
  await getThreadAction("email")(dispatch);
  expect(dispatch).toHaveBeenCalledExactlyOnceWith({
    type: "APP_SHOW_ERROR",
    message: "Failed to get email thread",
    error: expect.any(Error),
    receivedAt: expect.any(Number),
  });
});

it.each(["json", "network"])(
  "preserves %s failure handling",
  async (failure) => {
    if (failure === "json") {
      vi.mocked(authFetch).mockImplementation(async () => new Response("{"));
    } else {
      vi.mocked(authFetch).mockRejectedValue(new Error("Network failure"));
    }
    const dispatch = vi.fn();
    await getThreadAction("email")(dispatch);
    expect(dispatch).toHaveBeenCalledExactlyOnceWith({
      type: "APP_SHOW_ERROR",
      message: "Failed to get email thread",
      error: expect.any(Error),
      receivedAt: expect.any(Number),
    });
  },
);
