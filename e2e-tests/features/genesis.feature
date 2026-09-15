Feature: Set up the first Giant administrator
  On a fresh installation, the first user can create an administrator account.
  Two-factor authentication is optional in the local test environment.

  Scenario: Create the genesis administrator without two-factor authentication
    Given Giant has not been set up
    When I enter username "genesis-e2e", display name "Genesis E2E", and password "Genesis-e2e-password" and continue
    Then I am offered two-factor authentication setup
    When I skip two-factor authentication
    Then I see the login page
    When I open user administration in a fresh browser session
    And I log in as "genesis-e2e" with password "Genesis-e2e-password"
    Then I can access user administration without an authentication code
    And user "genesis-e2e" named "Genesis E2E" is an administrator
