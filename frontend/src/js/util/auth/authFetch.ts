import store from "../store";
import {
  handleResponseFromAuthRequest,
  logOutTheUserLocally,
} from "./handleResponseFromAuthRequest";
import { GiantState } from "../../types/redux/GiantState";

export default function authFetch(
  url: RequestInfo,
  init?: RequestInit,
): Promise<Response> {
  const request = new Request(url, init);
  const { auth } = store.getState() as unknown as GiantState;

  if (auth.token && auth.token.exp < Date.now() / 1000) {
    logOutTheUserLocally();
    return Promise.reject("Token expired");
  }

  request.headers.set("Authorization", "Bearer " + auth.jwtToken);

  return fetch(request)
    .then((response) => {
      handleResponseFromAuthRequest(
        response.status,
        response.headers.get("X-Offer-Authorization"),
      );
      return response;
    })
    .then(async (response) => {
      if (!response.ok) {
        const body = await response.text();
        throw new Error(body || response.statusText);
      }
      return response;
    });
}
