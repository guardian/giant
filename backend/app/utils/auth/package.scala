package utils

import play.api.mvc.Security.AuthenticatedRequest

package object auth {
  type UserIdentityRequest[A] = AuthenticatedRequest[A, User]
}
