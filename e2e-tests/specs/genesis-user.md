# Genesis user setup without two-factor authentication

Historical planning notes. The executable scenario now lives in
`e2e-tests/features/genesis.feature`, with steps in `e2e-tests/steps/`.

## Status and seed

Source-informed plan; browser exploration and execution are pending. The planner's
`planner_setup_page`, `browser_*`, and `planner_save_plan` tools were unavailable
in this session, and the local frontend at `http://localhost:3000` was not running.
This Markdown file was saved directly as a fallback.

Seed: `e2e-tests/seed.spec.ts`. It currently imports Playwright's `test` and
`expect` and contains an empty `seed` test; it provides no navigation,
authentication, fixtures, or application state. No Playwright configuration or
test dependency is currently declared in the frontend project. Resolve those
prerequisites before asking the generator to execute this plan.

## Scope and starting state

Create the first administrator through the database authentication UI, skip
optional 2FA, and prove the account can log in and access user administration.
Workspace uploads and extraction belong in a subsequent test.

Every scenario starts independently with:

- A dedicated local test instance, an empty user store, and a newly started
  backend process. Genesis state is cached in the backend, so clearing browser
  storage or resetting the database alone is insufficient for repeatable runs.
- Genesis creation enabled, the `database` user provider selected, and
  `auth.database.require2FA = false`.
- A running frontend and its backend dependencies, with the frontend URL supplied
  by the test configuration. Navigate to `/`; do not assume a separate genesis URL.
- A fresh browser context with no saved authentication state.
- A unique username such as `genesis-e2e-<run-id>`, display name
  `Genesis E2E <run-id>`, and a test-only password meeting the configured minimum
  length (the repository default is 12 characters).

Provision separate disposable instances per scenario, or reset the dedicated
instance and restart its backend between scenarios and retries. Do not run these
against an already initialized instance or concurrently against the same store.
Dispose of test resources afterward; deleting the administrator through the UI
is not a reliable genesis reset.

## 1. Create the initial administrator, skip 2FA, and log in

1. Open `/` and wait for the heading **Create Genesis User**. Verify the
   **Username**, **Display Name**, **Password**, and **Confirm Password** inputs
   are visible, and **Continue** is disabled while they are empty.
2. Fill all four inputs using the scenario's credentials, with identical password
   and confirmation. Expect **Continue** to become enabled and password validation
   errors to disappear.
3. Click **Continue**. Expect **Setup Two Factor Authentication**, an
   **Authentication Code** input, a disabled **Finish** button, and the
   **Skip this step** button. Generating the setup secret is expected even though
   activation will be skipped. Do not enter an authentication code.
4. Click **Skip this step** once. Expect successful completion of the real
   `PUT /setup` request and transition to the **Login** form. The genesis and
   two-factor setup headings must disappear. Account creation does not log the
   user in automatically.
5. Fill **Username** and **Password** with the newly created credentials, then
   click **Login**. Expect the authenticated application and its **Toggle main
   navigation** control. The Login form must disappear, and no authentication-code
   challenge or separate registration step should intervene.
6. Open Settings and select **Users**. Expect the **Users** heading and a row
   containing the exact created username and display name. Verify that row's
   **Admin** control is selected. Confirm the Settings navigation locator against
   the running UI before generating code; do not assume its icon has a text label.
7. Open `/` in another fresh, unauthenticated browser context against the same
   instance. Expect **Login**, with no **Create Genesis User** heading. Log in
   again using the same credentials and verify authenticated navigation is
   available without an authentication-code challenge.

**Success:** the first user persists as an administrator, setup is no longer
offered, and password-only login works from a fresh session.

**Failure:** setup request fails, the UI shows success without a usable account,
login requests a 2FA code, admin access is missing, or genesis reappears after
creation. A missing skip button is a configuration/precondition failure; do not
bypass it with a direct setup API call.

## 2. Required fields and password validation

Start with the independent fresh state above. Let `N` be the configured minimum
password length.

1. Open `/` and verify **Create Genesis User**. Fill otherwise valid values while
   leaving each required field empty in turn. Expect **Continue** disabled in
   every case.
2. Fill all fields, using matching passwords of `N - 1` characters. Expect
   **Password is too short (minimum N characters)** and disabled **Continue**.
3. Supply a valid-length password and a different valid-length confirmation.
   Expect **Passwords do not match** and disabled **Continue**.
4. Correct both password fields to the same value of exactly `N` characters.
   Expect both errors to disappear and **Continue** to become enabled. Click it
   and verify the two-factor setup screen and **Skip this step** are available.
   End here without creating a user.

**Success:** invalid entries cannot advance, and correcting them allows progress
at the minimum-length boundary. No `PUT /setup` should occur in this scenario.

**Failure:** invalid data advances, validation persists after correction, or a
user is created before clicking **Skip this step** or **Finish**.

## Generator notes and source references

- Verify locators in a live browser. Prefer headings and exact button names;
  use exact placeholders for inputs. Current labels use `htmlFor="#username"`
  rather than `htmlFor="username"`, so label-based locators may not resolve.
- Use bounded retrying assertions and wait for real requests where helpful;
  avoid fixed sleeps and mocked success responses. Do not treat a changed heading
  alone as proof that account creation succeeded.
- Main UI: `frontend/src/js/components/users/CreateGenesisUser.jsx` and
  `frontend/src/js/components/Login/Login.jsx`.
- Setup request and transition: `frontend/src/js/services/UserApi.js`,
  `frontend/src/js/actions/users/createGenesisUser.js`, and
  `frontend/src/js/reducers/usersReducer.js`.
- Backend setup and admin registration: `backend/app/controllers/genesis/Genesis.scala`
  and `backend/app/utils/auth/providers/DatabaseUserProvider.scala`.
- Administration assertion: `frontend/src/js/components/Settings/Users.tsx`.
- Configuration and operational context: `backend/conf/application.conf` and
  `docs/02-admin-quickstart.md`.
