import { vi } from "vitest";
import { getAuthToken, receiveToken } from "./getAuthToken";
import { getToken } from "../../services/AuthApi";
import { tokenSchema } from "../../types/Token";

vi.mock("../../services/AuthApi", () => ({ getToken: vi.fn() }));

const payload = {
  user: { username: "alice", displayName: "Alice" },
  issuedAt: 1700000000000,
  refreshedAt: 1700000000000,
  exp: 1700000300,
  loginExpiry: 1700086400000,
  verificationExpiry: 1700000600000,
  permissions: { granted: ["CanSearch"] },
};

function header(value: unknown) {
  return (
    "Bearer " + btoa("{}") + "." + btoa(JSON.stringify(value)) + ".signature"
  );
}

beforeEach(() => {
  vi.resetAllMocks();
  localStorage.clear();
});

test("validates decoded claims and preserves additional claims", () => {
  const value = { ...payload, future: "claim" };
  expect(receiveToken(header(value))).toMatchObject({
    type: "AUTH_TOKEN_GET_RECEIVE",
    token: value,
  });
  expect(tokenSchema.safeParse(payload).success).toBe(true);
});

test.each([
  null,
  {},
  { ...payload, exp: "1700000300" },
  { ...payload, loginExpiry: undefined },
  { ...payload, verificationExpiry: null },
  { ...payload, user: { username: "alice" } },
  { ...payload, permissions: { granted: [null] } },
  { ...payload, permissions: null },
])("rejects invalid claims: %j", (value) => {
  expect(tokenSchema.safeParse(value).success).toBe(false);
  expect(() => receiveToken(header(value))).toThrow();
});

test.each(["Bearer invalid", "Bearer", ""])(
  "rejects malformed JWTs: %s",
  (value) => expect(() => receiveToken(value)).toThrow(),
);

test("stores and dispatches a validated login token", async () => {
  const authHeader = header(payload);
  vi.mocked(getToken).mockResolvedValue(
    new Response(null, {
      status: 204,
      headers: { "X-Offer-Authorization": authHeader },
    }),
  );
  const dispatch = vi.fn();
  await getAuthToken("alice", "password")(dispatch);
  expect(localStorage.pfiAuthHeader).toBe(authHeader);
  expect(dispatch).toHaveBeenCalledWith(
    expect.objectContaining({ type: "AUTH_TOKEN_GET_RECEIVE", token: payload }),
  );
});

test.each([header({ ...payload, exp: null }), "Bearer malformed"])(
  "routes invalid tokens to the login error without persisting them",
  async (authHeader) => {
    vi.mocked(getToken).mockResolvedValue(
      new Response(null, {
        status: 204,
        headers: { "X-Offer-Authorization": authHeader },
      }),
    );
    const dispatch = vi.fn();
    await getAuthToken("alice", "password")(dispatch);
    expect(localStorage.getItem("pfiAuthHeader")).toBeNull();
    expect(dispatch).toHaveBeenLastCalledWith(
      expect.objectContaining({
        type: "AUTH_TOKEN_SHOW_ERROR",
        username: "alice",
      }),
    );
    expect(dispatch).not.toHaveBeenCalledWith(
      expect.objectContaining({ type: "AUTH_TOKEN_GET_RECEIVE" }),
    );
  },
);

test.each([
  [401, "Pfi2fa", "AUTH_REQUIRE_2FA"],
  [401, "Panda", "AUTH_REQUIRE_PANDA"],
  [403, "", "AUTH_FORBIDDEN"],
])(
  "preserves status/header login challenges",
  async (status, authenticate, type) => {
    vi.mocked(getToken).mockResolvedValue(
      new Response("challenge", {
        status,
        headers: { "WWW-Authenticate": authenticate },
      }),
    );
    const dispatch = vi.fn();
    await getAuthToken("alice", "password")(dispatch);
    expect(dispatch).toHaveBeenLastCalledWith(
      expect.objectContaining({ type }),
    );
  },
);

test("routes rejected challenge body reads to the login error", async () => {
  const response = new Response("", {
    status: 401,
    headers: { "WWW-Authenticate": "Pfi2fa" },
  });
  vi.spyOn(response, "text").mockRejectedValue(new Error("body read failed"));
  vi.mocked(getToken).mockResolvedValue(response);
  const dispatch = vi.fn();
  await getAuthToken("alice", "password")(dispatch);
  expect(dispatch).toHaveBeenLastCalledWith(
    expect.objectContaining({
      type: "AUTH_TOKEN_SHOW_ERROR",
      username: "alice",
    }),
  );
});
