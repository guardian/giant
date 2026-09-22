# Remaining TypeScript migration plan

This is an ordered, mutable backlog, not one PR per heading. All file paths below
are relative to `frontend/src/`. Work top to bottom and within each step in listed
order. A step can span several daily PRs; stop at a reviewable diff rather than
filling a five-file quota. Supporting types, schemas and tests count toward its size.

After a successful migration and checks, remove only the completed file bullets
from this plan. Remove the whole step (heading and notes) when it has no remaining
files. Keep partially completed steps and their outstanding work. Do not renumber
remaining steps: the numbers identify the original dependency order. The merged PR
is the progress record; do not append a completed-work log here.

Before choosing a batch, reconcile the plan with the actual checkout. If an entry
was already migrated, confirm its TS replacement/merged equivalent and remove that
stale entry alongside the next real migration. Do not treat an absent file alone
as proof of completion. If new JS files appear, place them near their dependencies.
If an early step is blocked, explain the dependency in the PR, retain the unfinished
entry, and choose the next independent step. Do not skip hard files indefinitely.

## Basis for the order

Inventory: 119 tracked JS/JSX source and test files at analysis on 2026-09-14.
The fetched main branch has the same remaining JS inventory. The application already
has strict TypeScript, Zod, domain types, and partial Redux state/action/dispatch
contracts in `js/types/redux/`. Extend those contracts incrementally instead of
creating a second type system. Utilities precede services; API schemas precede
state and UI consumers; root store wiring comes last to avoid forcing a broad
conversion through partially typed reducers.

Legacy PropTypes are clues, not authoritative JSON contracts. In particular,
SearchResults.js coexists with SearchResults.ts, search pages are computed by the
client, filters have a hideable field absent from PropTypes, and the email wire
format uses haveSource. Read backend serializers and actual consumers for each
boundary. Existing TypeScript API modules may need supporting validation changes
when their JS consumers migrate; unrelated TS cleanup is not part of the plan.

## Remaining steps

### 06. Links and overlays

Navigation helpers and keyboard handling are now typed. Derive own versus router/Redux-injected props without changing component APIs.

- `js/components/UtilComponents/SelectionPopover.jsx`

### 07. Preferences and application errors

Create a shared preferences schema for localStorage, including missing/malformed values and existing defaults in index.jsx. Extend AppAction and the app slice in GiantState for errors, warnings, preferences, and initial config. Reuse the schema when index.jsx is migrated.

- `js/actions/preferences.js`
- `js/actions/problems.js`
- `js/reducers/appReducer.js`
- `js/components/UtilComponents/ErrorBar.jsx`
- `js/components/Settings/FeatureSwitches.jsx`

### 08. Cluster API slice

Add recursive directory-entry and cluster schemas at the service boundary, then type actions and reducer. The existing fileEntry PropTypes initializer references itself: inspect callers and preserve its public export while correcting the recursive definition.

- `js/types/Cluster.js`
- `js/services/ClusterApi.js`
- `js/actions/getNodes.js`
- `js/reducers/clusterReducer.js`

### 09. Filter API slice

Use backend/app/model/frontend/Filter.scala: recursive suboptions and hideable are part of the contract even though the old PropTypes are incomplete. Validate in FiltersApi before dispatching.

- `js/types/SearchFilter.js`
- `js/services/FiltersApi.js`
- `js/actions/getFilters.js`
- `js/reducers/filtersReducer.js`

### 10. Search wire contracts and service

Consolidate SearchResults.js into the existing SearchResults.ts; do not overwrite the TS file. Preserve legacy PropTypes exports and check explicit and extensionless imports. Use backend/app/model/frontend/SearchResult.scala for the _type-discriminated details and recursive aggregations. Separate the wire response from client-computed pages. Define a shared schema for serialized query fragments (strings/date chips/etc.) by reading InputSupper and its callers; validate both the query JSON and API responses, including suggested fields. This is a small-file-count but complex PR.

- `js/types/SearchResults.js`
- `js/services/SearchApi.js`

### 11. Search actions and state

Consume the validated search response, preserve stale-response suppression, and compute pages in the reducer. Extend the existing SearchState and GiantAction types rather than making parallel versions.

- `js/actions/search/performSearch.js`
- `js/actions/search/getSuggestedFields.js`
- `js/actions/search/clearSearch.js`
- `js/reducers/searchReducer.js`

Follow-up after `js/actions/search/performSearch.js` is migrated to TypeScript:
consolidate search query-string parsing around the shared schema from step 10.
Parse and validate once at the search action boundary, then pass typed query
fragments through the request, Redux state and consumers, including
`calculateSearchTitle`, instead of reparsing JSON in each consumer. Use the same
schema across the app, including the query editor as it migrates; preserve chip
type, operator and workspace/folder IDs, date conversion semantics, URL
serialization and stale-response suppression. Replace the title-only schema in
`documentTitle.ts`. Keep this follow-up in the plan until it is complete, even if
the file migrations above have finished.

### 12. Collection and document data

Reuse Collection.ts and inspect CollectionsApi.ts, whose responses are currently mostly unvalidated. Add shared collection schemas at the touched boundary as supporting TS changes. Check that DocumentApi.fetchIngestions returns a collection object, despite its name.

- `js/services/DocumentApi.js`
- `js/actions/collections/getCollection.js`
- `js/actions/collections/getCollections.js`
- `js/reducers/collectionsReducer.js`

### 13. Resource actions and descendants

Reuse Resource.ts, existing resource actions, and ResourceApi.ts. Validate the basic/full responses used by this batch at their boundary; preserve child/grandchild flattening and loading/error handling. Allow a smaller batch for these nested contracts.

- `js/actions/resources/getResource.js`
- `js/actions/resources/clearResource.js`
- `js/reducers/descendantResourcesReducer.js`

### 14. Email API slice

Follow controllers/api/Emails.scala and model/frontend/email/EmailThread.scala. The wire key is haveSource, not the old PropTypes hasSource; metadata and timestamps need the actual serializer shape. Preserve thread ordering, neighbours, and missingNodes.

- `js/types/Email.js`
- `js/services/EmailApi.js`
- `js/actions/email/getEmailThread.js`
- `js/reducers/emailsReducer.js`

### 15. Authentication contracts and token receipt

Reconcile Token.js with the existing private Token type in Auth.ts. Validate decoded JWT payloads with a shared schema (validation is not signature verification); preserve header/status-based login behavior and rejection paths. AuthApi returns Response/text for several methods, so do not invent JSON parsing there.

- `js/types/Token.js`
- `js/services/AuthApi.js`
- `js/actions/auth/getAuthToken.js`
- `js/reducers/authReducer.js`
- `js/util/isLoggedIn.js`

### 16. Session lifecycle and download link

Use the typed token/action contracts, preserving expiry, renewal, logout and text-download behavior.

- `js/actions/auth/invalidateAuthToken.js`
- `js/actions/auth/sessionKeepalive.js`
- `js/components/Login/SessionKeepalive.js`
- `js/components/DownloadLink/DownloadLink.jsx`
- `js/components/DownloadLink/index.js`

### 17. User API contracts

UserApi has many distinct response shapes: inspect controllers/api/Users.scala, setup/auth handlers and already-typed actions/users callers. Reuse User.ts where accurate and add endpoint schemas rather than one permissive catch-all. Keep this service migration separate from its UI.

- `js/services/UserApi.js`

### 18. User permissions and state

Consume validated service results and extend existing UserAction/GiantState users types for the complete reducer state, including initial and failure states.

- `js/actions/users/getMyPermissions.js`
- `js/actions/users/setUserPermissions.js`
- `js/actions/users/addCollectionToUser.js`
- `js/reducers/usersReducer.js`

### 19. Setup actions and wizard primitives

Preserve setup response variants and async validation contracts; keep WizardSlide runtime exports used by JavaScript callers.

- `js/actions/users/genesisSetupCheck.js`
- `js/actions/users/createGenesisUser.js`
- `js/types/WizardSlide.js`
- `js/components/UtilComponents/Wizard.jsx`
- `js/components/users/Setup2Fa.jsx`

### 20. Registration forms

Migrate Setup2Fa consumers after UserApi. These forms are 246–317 lines each: take one or two per PR, preserving database-user/Panda variants and validation behavior.

- `js/components/users/CreateNewUser.jsx`
- `js/components/users/RegisterUser.jsx`
- `js/components/users/Register.jsx`

### 21. Genesis and login forms

CreateGenesisUser precedes Login, which imports it. Both are about 300 lines: normally use separate PRs and retain authentication/2FA/setup behavior.

- `js/components/users/CreateGenesisUser.jsx`
- `js/components/Login/Login.jsx`

### 22. Collection and settings navigation

Now consume typed collection and permission slices. Type connected props as well as component-owned props.

- `js/components/Collections/Collections.jsx`
- `js/components/Collections/CollectionsSidebar/CollectionItem.jsx`
- `js/components/Collections/CollectionsSidebar/CollectionsSidebar.jsx`
- `js/components/Settings/DatasetPermissions.jsx`
- `js/components/Settings/SettingsSidebar.jsx`

### 23. Search filter UI

Migrate leaves before parents; reuse recursive filter and aggregation types and preserve expansion/selection semantics. Split the batch if recursive props make it too large.

- `js/components/SearchSidebar/SearchFilterValue.jsx`
- `js/components/SearchSidebar/SearchFilterOption.jsx`
- `js/components/SearchSidebar/SearchFilter.jsx`
- `js/components/SearchSidebar/SearchSidebar.jsx`

### 24. Search result rows

Use discriminated result details, highlights, recipients and collection types. The row and compact table together are substantial; do not add unrelated components just to reach five.

- `js/components/SearchResults/SearchResult.jsx`
- `js/components/SearchResults/CompactResultsTable.jsx`
- `js/components/SearchResults/SearchResults.jsx`

### 25. Search charts and status

Reuse aggregation bucket types; explicitly type chart events/scales and empty data. Keep chart rendering behavior stable.

- `js/components/SearchResults/visualizations/TimeHistogram.jsx`
- `js/components/Search/SearchVisualizations.jsx`
- `js/components/Search/SearchStatus.jsx`

### 26. Query editor leaves

Use the shared query fragment schema from SearchApi. InlineInput has imperative input/ref/event handling: keep its public behavior intact.

- `js/components/UtilComponents/InputSupper/LabelSupper.jsx`
- `js/components/UtilComponents/InputSupper/SuggestionsPanel.jsx`
- `js/components/UtilComponents/InputSupper/InlineInput.jsx`

### 27. Query chips

Chip.jsx is about 450 lines: migrate it as its own batch with supporting types/tests. Reuse the established query/date types and retain keyboard and edit-state transitions.

- `js/components/UtilComponents/InputSupper/Chip.jsx`

### 28. Query editor integration

The editor is about 450 lines and parses JSON in its constructor. Reuse the same query schema and safeParse handling as SearchApi, catching malformed JSON before use. Preserve serialization, focus, suggestions and ref behavior.

- `js/components/UtilComponents/InputSupper/index.jsx`

### 29. Email visualization

Timeline is about 377 lines of D3 layout: migrate separately before Thread. Preserve missing-node and undated-message behavior using the email wire types; then type Thread and its viewer consumer.

- `js/components/EmailBrowser/Timeline.jsx`
- `js/components/EmailBrowser/Thread.jsx`
- `js/components/viewer/EmailDetails.jsx`

### 30. Preview and download dialog

PreviewApi uses HEAD/blob/text, not JSON: type those results directly. DownloadModal is about 321 lines; keep it separate if necessary and preserve async download state.

- `js/services/PreviewApi.js`
- `js/components/viewer/DownloadModal.jsx`

### 31. Viewer controls

Dependencies (preferences, keyboard helpers and overlays) are now typed. Preserve selection/highlighting and preview status transitions.

- `js/components/viewer/HighlightToggle.jsx`
- `js/components/viewer/ViewerActions.jsx`
- `js/components/viewer/TextPopover.jsx`
- `js/components/viewer/StatusBar.jsx`

### 32. Viewer metadata and sidebar

Migrate metadata children before ViewerSidebar using established Resource, User and action contracts; keep supported resource variants explicit.

- `js/components/viewer/DocumentMetadata.jsx`
- `js/components/viewer/EmailMetadata.jsx`
- `js/components/viewer/ViewerSidebar.jsx`

### 33. Redux integration

Only after the slices/actions are typed, reconcile reducers/index with GiantState (including router, cluster, filters, emails and expandedFilters naming). Prefer inferring root state from reducers if this avoids duplication without circular store/action types. Align GiantDispatch and middleware with the installed Redux/thunk/router versions; preserve middleware return values and URL synchronization. Do not introduce a Redux framework migration.

- `js/reducers/index.js`
- `js/util/storeMiddleware.js`
- `js/util/store.js`

### 34. Application composition and bootstrap

Migrate Header, then App, then index. Use the shared preferences/token schemas for persisted startup data and inspect the config bootstrap path. Preserve routes, providers, initial dispatch ordering and startup failure behavior. Keep allowJs/config cleanup outside this automation.

- `js/components/Header.jsx`
- `js/App.jsx`
- `index.jsx`
