import { PartialUser } from "./User";
export type Auth = {
  header: string;
  requesting: boolean;
  require2fa: boolean;
  requirePanda: boolean;
  forbidden: boolean;
  errors: string[];
  jwtToken: string;
  token?: Token;
};

type Token = {
  exp: number;
  user: PartialUser;
  issuedAt: number;
  refreshedAt: number;
  loginExpiry: number;
  verificationExpiry: number;
  permissions: {
    granted: string[];
  };
};
