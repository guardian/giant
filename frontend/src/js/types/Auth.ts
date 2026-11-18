import { Token } from "./Token";
export type Auth = {
  header?: string;
  requesting: boolean;
  require2fa: boolean;
  requirePanda: boolean;
  forbidden: boolean;
  errors: (string | undefined)[];
  jwtToken?: string;
  token?: Token;
  username?: string;
  lastSessionKeepaliveRequest?: number;
  lastSessionKeepaliveResponse?: number;
};
