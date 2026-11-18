import { z } from "zod";
import PropTypes from "prop-types";

export const token = PropTypes.shape({
  issuedAt: PropTypes.number.isRequired,
  refreshedAt: PropTypes.number.isRequired,
  exp: PropTypes.number.isRequired,
});

// Mirrors Authentication.token, utils.auth.User and UserPermissions.
// Validation checks the payload shape; it does not verify the JWT signature.
export const tokenSchema = z.looseObject({
  user: z.looseObject({
    username: z.string(),
    displayName: z.string(),
  }),
  issuedAt: z.number(),
  refreshedAt: z.number(),
  exp: z.number(),
  loginExpiry: z.number(),
  verificationExpiry: z.number(),
  permissions: z.looseObject({ granted: z.array(z.string()) }),
});

export type Token = z.infer<typeof tokenSchema>;
