# Coding, Debugging, and MyInsights Packaging Practices

This is the working contract for any Codex or developer changing this repository. Read it before editing code. It is intentionally specific to the Kite React/Vite Veeva CRM MyInsights application in this checkout.

The goal is not merely to make source code look correct. A change is complete only when its data path is understood, its behavior is tested, the production build is inspected, and, when requested, the actual MyInsights ZIP is proven deployable.

## 1. Non-negotiable working rules

1. Start from the current checkout, not assumptions or old conversation context.
2. Preserve user work. Never reset, discard, or overwrite unrelated changes.
3. Keep a narrow request narrow. Do not refactor adjacent code unless the requested change requires it.
4. Treat exact Salesforce/Veeva object names, field API names, record type IDs, picklist values, and URL hosts as case-sensitive configuration facts. Verify them in current source before using them.
5. Trace behavior end to end: rendered field -> component state -> mapper -> query/write function -> CRM object and API field.
6. Put CRM access behind the existing data-service layers. Do not call `window.ds` directly from React components.
7. Local mock success is not proof of live CRM success. Production uses the Veeva Data Service bridge and must never silently fall back to fixtures.
8. Diagnose before fixing. Reproduce the issue, identify the failing boundary, then make the smallest correction that addresses the cause.
9. Do not call a ZIP deployable because `npm run build` returned zero. Inspect and test the artifact itself.
10. Never put credentials, session IDs, access tokens, `.env` values, or reusable vendor keys in source, browser bundles, logs, screenshots, or ZIPs.
11. Do not commit, push, create a branch, or change remote state unless the user asks for it.

## 2. First pass before every task

Run these read-only checks first in PowerShell:

```powershell
git status --short --branch
git branch --show-current
git rev-parse --abbrev-ref --symbolic-full-name '@{u}'
git diff --stat
git diff --name-only
```

Then:

- Read the files named by the request and their closest tests.
- Search with `rg` for the exact label, API name, constant, method, or error text.
- Check whether nearby files already contain user changes.
- Read `package.json`, `vite.config.js`, and `scripts/postbuild.mjs` before changing build or packaging behavior.
- For CRM fetch-sequence work, use `CRM_QUERY_FETCH_SEQUENCE.md` as a map, but verify it against current code because documentation can become stale.
- For a Stakeholder UI-to-CRM field addition, follow `STAKEHOLDER_FIELD_MAPPING_GUIDE.md` and verify every step against the current Stakeholder mapper and modal.
- For desktop/iPad behavior, read `DESKTOP_IPAD_VERSION_HANDOFF.md` and verify its statements against `src/App.jsx` and `src/lib/runtime/viewMode.js`.

Before editing, be able to state:

- What behavior is changing?
- Which source file owns it?
- Which CRM object and exact API field are involved?
- Is it a read, mapping, UI, validation, or write problem?
- Which focused test proves the requested behavior?
- Does the change affect desktop, iPad/offline, online CRM, mock preview, export, or packaging?

If an answer cannot be established from current code and the decision would materially change behavior, ask the user instead of guessing.

## 3. Repository architecture and ownership

The runtime path is:

```text
index.html
  -> public/static/q.js
  -> public/static/MyInsightsLibrary.js
  -> src/main.jsx
  -> src/App.jsx
  -> src/pages/* and src/components/*
  -> src/lib/dataservice/accountPlan/*
  -> src/lib/dataservice/query.js
  -> src/lib/dataservice/client.js
  -> window.ds in Veeva OR mockAdapter in development/mock mode
```

Use these boundaries:

- `src/App.jsx`: application controller, runtime-mode split, page loading/cache state, global notices, approval/export flows, and shell behavior.
- `src/pages/*`: business pages and page-specific presentation/state.
- `src/components/*`: shared visual and shell components.
- `src/lib/dataservice/client.js`: the only boundary that selects real `window.ds` versus the local mock adapter.
- `src/lib/dataservice/query.js`: primitive Data Service wrappers, query sanitation, response unwrapping, in-flight request deduplication, and Salesforce ID helpers.
- `src/lib/dataservice/accountPlan/*`: domain loaders, joins, mappings, picklists, saves, and business rules.
- `src/lib/mockData/*`: Salesforce/Veeva-shaped local fixtures and mock Data Service behavior.
- `src/lib/export/*`: PDF/PPT generation. Treat export behavior as a separate consumer of mapped data.
- `test/*`: focused regression tests. Add a test beside the closest established behavior family.
- `scripts/postbuild.mjs`: the authoritative production packaging step.

Do not bypass these layers to get a quick result. A component-level CRM workaround creates different behavior between local preview, online CRM, offline iPad, exports, and tests.

## 4. Coding practices

### 4.1 Scope and preservation

- Inspect `git diff` before and after editing.
- Edit only files needed for the request and its regression test.
- Preserve existing labels, help text, casing, ordering, URLs, and business rules unless explicitly included in scope.
- Do not perform broad search-and-replace when an exact constant or mapping entry owns the behavior.
- Do not rewrite a file merely to reformat it. Avoid noisy line-ending and encoding changes.
- Retain historical ZIPs and evidence unless the user explicitly asks to remove them. A stale string in an archived ZIP is not the same as an active-source reference.
- Prefer a named constant or helper when several consumers must share the same rule. Do not create abstraction for one trivial use.

### 4.2 React and state

- Keep render functions pure. Put external effects in effects or event handlers.
- Store one source of truth. Derive display values instead of copying the same business state into multiple hooks.
- Update state immutably and use functional updates when the next value depends on the previous value.
- Preserve loading, empty, error, and success as distinct states. Do not replace a real error with a generic empty state.
- Keep save buttons tied to dirty state when that is the existing surface contract; submit only changed CRM fields.
- After a successful save, update the saved baseline immediately so dirty-state UI resets correctly.
- Reuse existing loaders and caches in `App.jsx`; do not add page-level duplicate fetches for data already owned by the app controller.
- Maintain desktop/iPad gates. A desktop-only launcher, relationship query, or CRM record link must not leak into iPad behavior.
- Validate layout with the rendered DOM at relevant viewport sizes. Source/CSS inspection alone does not prove alignment, overflow, or visibility.
- Preserve accessibility: semantic controls, visible focus, useful labels, keyboard operation, and readable error/status text.

### 4.3 Data transformations and types

- Normalize Veeva cell-shaped responses at the data boundary. UI components should receive predictable flat shapes.
- Preserve the distinction between `null`, an empty string, `false`, and `0`. Do not use broad truthiness where those values have different CRM meanings.
- Coerce values at the write boundary according to the CRM data type, not only in the input control. A numeric-looking text box is not proof that a numeric payload is written.
- Keep multi-picklist storage semicolon-delimited when that is the CRM field contract.
- Preserve array order unless a documented sort owns the order. Do not add UI sorting that silently overrides query ordering.
- When a field is removed or renamed, search active source, tests, docs, build scripts, and the newly generated bundle. Report archived-artifact references separately.

### 4.4 Errors and observability

- Catch errors only where the code can add context, recover, or present a useful state.
- Do not silently swallow primary data failures. Optional metadata/fallback queries may degrade gracefully only when the UI behavior is defined.
- Error messages should name the operation and object/area without exposing records or credentials.
- Temporary diagnostics must be narrow and sanitized. Remove temporary `console.log`/`debugger` statements before handoff unless durable logging was requested.
- A timeout is not an assertion failure. Check whether the child process is still running and whether artifacts were created before diagnosing application code.

## 5. Veeva CRM and Data Service practices

### 5.1 Runtime boundary

`src/lib/dataservice/client.js` intentionally uses fixtures only during Vite development or explicit mock mode. A production build with no Veeva bridge returns a clear runtime error. Never change production to fall back silently to mock account data.

`index.html` must load scripts in this order:

1. `q.js`
2. `MyInsightsLibrary.js`
3. the React application module

`window.Q` and `window.ds` being defined in a normal browser does not prove that a native/offline or online CRM call succeeds.

### 5.2 Query construction

- Use wrappers in `src/lib/dataservice/query.js`, not direct `ds` calls.
- In Data Service parameters, `where` contains the expression only; do not prefix it with `WHERE`.
- `sort` contains expressions such as `LastModifiedDate DESC`; do not prefix them with `ORDER BY`.
- Quote string and ID values correctly and escape embedded apostrophes.
- Ensure every query field list is unique. Duplicate fields can make the Data Service reject the entire query.
- Keep object and field API names exact and case-sensitive.
- Use the repository helpers for 15/18-character Salesforce ID matching. Do not invent slightly different ID clauses in components.
- Use `inClause()` because online and offline VQL use different `IN` syntax.
- Shared/iPad queries must not contain dotted relationship fields such as `Owner.Name`. `runQuery` strips them by default because one dotted field can break an offline query.
- Use `allowDottedFields: true` only for a proven online/desktop query path with a tested non-dotted fallback.
- Prefer parallel reads only when they are independent. If query B needs an ID returned by query A, make that dependency explicit.
- Keep in-flight request coalescing behavior intact. It prevents concurrent duplicate requests but is not a permanent result cache.

### 5.3 Context and joins

- Use `getDataForCurrentObject` only for fields supported by the active MyInsights entry point.
- For Account Plan content, resolve the current plan through the established `requireCurrentAccountPlanId()`/shell-context path.
- Desktop selection uses the explicit plan-ID override; iPad normally uses Veeva/HTML context. Do not collapse these into one guessed URL value.
- Query related objects explicitly and join using IDs when context does not supply the needed field.
- When answering a CRM mapping question, report all of the following:
  - displayed label/key;
  - component that renders it;
  - mapper/property name;
  - loader/query function;
  - CRM object;
  - exact field API name;
  - relationship/join key;
  - create/update payload path, if writable.

### 5.4 Writes

- Keep create/update/delete behavior in domain data-service modules, not UI components.
- Build the payload from an allowlist of expected fields. Do not spread an entire UI model into a CRM request.
- Ensure the target object ID comes from the correct owning object. Similar-looking Account Plan and Account Profile IDs are not interchangeable.
- Do not write Veeva-managed fields including `Last_Device_vod__c`, `Mobile_Created_Datetime_vod__c`, `Mobile_Last_Modified_Datetime_vod__c`, `MyInsights_Modified_By_vod__c`, or `OwnerId`.
- Treat `updateRecord` cautiously for Veeva/offline objects and test the actual supported target.
- Online MyInsights content must not rely on creating or updating `Task`.
- Keep optimistic UI reversible. If a write fails, restore the prior value and preserve the actionable error.
- Add payload-level tests for required lookups, field names, null handling, number/boolean conversion, and excluded fields.

### 5.5 Mock parity

- Every Data Service method used by production code must be represented by the mock adapter or a deliberate failing stub.
- Mock methods must return the same top-level and cell shapes as the real wrapper expects.
- Update fixtures when adding fields, objects, picklist metadata, filters, joins, or write behavior.
- Ensure the mock parser understands the real query shape. Never weaken production queries solely to satisfy a simplistic fixture parser.
- Production aliases intentionally replace mock fixtures with a live-only module. Verify that a production bundle does not contain mock account records.

## 6. Debugging workflow

Use this order rather than editing on first suspicion:

1. **Reproduce**: record the page, runtime mode, viewport, plan/record context, action, expected result, actual result, and exact error.
2. **Classify the boundary**: rendering, state/cache, mapping, query syntax, CRM permissions/metadata, write payload, online/offline difference, export, or package loading.
3. **Trace from the symptom to the source of truth**: component -> mapped property -> loader -> field list/query -> CRM API name. For writes, continue to the exact payload.
4. **Compare runtimes**: local mock, built local package, desktop hosted CRM, and iPad/offline are different environments.
5. **Inspect actual evidence**: browser console, network/Data Service result, rendered DOM, listener/HTTP status, generated `dist/index.html`, or extracted ZIP.
6. **Form one concrete hypothesis** and use the smallest check that can disprove it.
7. **Add or update a focused regression test**, then implement the narrow fix.
8. **Run focused tests, rendered QA when UI is involved, build, and artifact checks**.
9. **Review the final diff** for scope, debugging residue, secrets, and unintended copy/API changes.

### Local server verification

Start the server with logs outside the repository when practical:

```powershell
npm.cmd run dev -- --host 127.0.0.1 --port 5173
```

Do not infer that the server is running from the command alone. Confirm the actual listener and HTTP response:

```powershell
netstat -ano | Select-String ':5173 '
Invoke-WebRequest http://127.0.0.1:5173/ -UseBasicParsing
```

Then inspect browser console/network output and the rendered user flow. HTTP 200 only proves that a document was served.

For desktop/iPad-specific work, test at least:

- desktop: viewport wider than 1400 pixels, launcher first, then selected-plan shell;
- iPad/tablet: representative 820x1180 or 1024x768 viewport, shell directly, no desktop-only launcher/link.

### Common diagnosis traps

- `node --test ... test` can report `MODULE_NOT_FOUND` because Node treats `test` as a module path. Enumerate test files explicitly.
- A full serial suite may take over two minutes. Use a roughly 300-second timeout before calling it hung.
- A build timeout can occur after the process produced valid files. Check command state and artifacts before rerunning.
- `Cannot redefine property: process` in a generic browser smoke can be a bootstrap-tool conflict. Do not ignore it, but distinguish it from package structure and verify using the actual built shape/runtime.
- `pdfjs-dist` dev optimization needs `optimizeDeps.esbuildOptions.target` aligned with the build/esbuild target (`es2022` here).
- A stale field in an old ZIP does not prove active code still uses it. Search active paths and the fresh build separately.
- Missing data can be permissions, invalid optional fields, dotted offline fields, 15/18-character ID mismatch, wrong object ownership, or a swallowed fallback, not necessarily "no records."

## 7. Testing practices

Use the smallest relevant gate first:

```powershell
node --test --test-concurrency=1 test\relevantFeature.test.mjs
```

For multiple tests, pass every file explicitly:

```powershell
$tests = Get-ChildItem test -Filter '*.test.mjs' -File |
  Sort-Object FullName |
  ForEach-Object { $_.FullName }
node --test --test-concurrency=1 $tests
```

Testing rules:

- Add a regression that fails for the original bug or locks the requested behavior.
- Assert user-visible behavior and CRM payload/query facts, not private implementation trivia.
- For field/API changes, test both the read mapping and write payload when both exist.
- For query changes, assert object, fields, `where`, `sort`, and fallback behavior.
- For UI changes, combine automated assertions with rendered checks at affected viewports.
- For export work, regenerate the required mock export before tests that inspect it. `src/lib/export/accountPlanPptLogo.test.js` needs `node scripts/generate-mock-ppt.mjs` after a build cleans `dist`.
- Run `git diff --check` before handoff.
- Run the production build after focused tests. Tests alone do not prove Vite bundling or MyInsights packaging.

If the broad suite has unrelated failures, do not hide them. Report the exact failing tests, explain whether they are pre-existing or caused by the change, and still provide focused evidence.

## 8. MyInsights build and ZIP workflow

### 8.1 Authoritative build

Use the repository command:

```powershell
npm.cmd run build
```

Allow at least 120 seconds; allow about 300 seconds when the environment is slow.

The command runs:

```text
vite build
  -> single-file React/CSS output in dist/index.html
  -> scripts/postbuild.mjs
  -> q.js and MyInsightsLibrary.js embedded as base64 data-URI scripts
  -> dist/assets and dist/static removed
  -> ZIP containing index.html at the ZIP root
  -> date-stamped and timestamped ZIP copies in dist/
```

This repository intentionally differs from a conventional multi-file MyInsights package. Source `index.html` references `./static/q.js` and `./static/MyInsightsLibrary.js` in the required order. The postbuild embeds both into the final HTML, so the final ZIP is expected to contain only root `index.html`. Do not add standalone runtime files to the final ZIP merely to satisfy a generic auditor.

Do not manually zip the project folder, `dist` parent folder, source files, `.git`, `node_modules`, `.env`, test fixtures, or old ZIPs.

### 8.2 Required artifact checks

After every packaging build:

1. Identify the newly created ZIP by timestamp; do not hand off an older similarly named artifact.
2. Confirm the ZIP opens and contains exactly one root entry named `index.html`.
3. Confirm there is no wrapper directory.
4. Confirm extracted `index.html` is byte-for-byte identical to `dist/index.html`.
5. Confirm both embedded runtime data URIs exist and `q.js` appears before `MyInsightsLibrary.js`.
6. Confirm no root-absolute asset paths such as `src="/` or `href="/` and no unresolved local `./static/` script paths remain.
7. Confirm the bundle contains the new expected API names/URLs/copy and does not contain retired values relevant to the change.
8. Confirm no mock fixture records, localhost endpoints, or sensitive values entered the production bundle.
9. Extract to a new scratch directory and smoke-test that extracted package shape in a browser. State clearly that a local browser cannot prove the native CRM bridge.
10. Compute and report the ZIP SHA-256.

PowerShell inspection example:

```powershell
Add-Type -AssemblyName System.IO.Compression.FileSystem
$zipPath = (Get-ChildItem .\dist\kite_myinsights_v2_*.zip |
  Sort-Object LastWriteTime -Descending |
  Select-Object -First 1).FullName
$archive = [System.IO.Compression.ZipFile]::OpenRead($zipPath)
try {
  $archive.Entries | Select-Object FullName, Length
} finally {
  $archive.Dispose()
}
Get-FileHash -Algorithm SHA256 $zipPath
```

Use a fresh, explicitly verified scratch directory for extraction. Never recursively delete a computed or broad path. The safe pattern is to create a new unique directory, extract into it, inspect it, and leave cleanup until its resolved path is confirmed.

### 8.3 Secret and production-data checks

- Never print secret matches. Report only pass/fail and sanitized file locations if a review is required.
- Check the final extracted HTML, not only source.
- Compare against known local environment values without echoing those values.
- Reject and rebuild any package that contains a reusable API key, bearer token, session ID, private endpoint credential, `.env` content, or production data fixture.
- Browser-executed code cannot securely hold a reusable secret. External APIs must use an approved server/gateway or short-lived credential design.

### 8.4 Package handoff evidence

Report all of these:

- build command and exit result;
- focused/full test results;
- exact absolute ZIP path;
- ZIP root entries;
- embedded script presence and order;
- extracted-index versus `dist/index.html` hash/byte match;
- expected/retired string checks relevant to the change;
- secret/mock/localhost scan result;
- browser-smoke target and result;
- SHA-256;
- limitations, especially lack of live CRM/iPad verification.

## 9. Git pull, commit, and push practices

Only do these when requested.

### Safe pull

1. Verify branch, upstream, and dirty state.
2. If tracked or untracked work would be at risk, preserve it in a clearly named stash, including untracked files when needed.
3. Use `git pull --ff-only` when history permits.
4. Reapply the stash deliberately and resolve conflicts by understanding both sides.
5. Keep the stash until final verification if it is the recovery path for user work.

### Commit and push

1. Run focused checks, `git diff --check`, and the production build.
2. Review `git diff` and `git status --short`.
3. Stage only intended paths unless the user explicitly puts the entire worktree in scope.
4. Commit with a message matching the requested change.
5. Push using the target verified from the current branch/upstream. Do not infer it from the folder name.
6. For the known branch patterns, use an explicit refspec such as `git push origin HEAD:react_v1`, `HEAD:react_v2`, or `HEAD:react_v4` only when it matches the verified target.
7. If rejected with `fetch first`, fetch, rebase on the target branch, rerun verification, and push again. Do not force-push by default.
8. If SSH reports `Permission denied (publickey)`, diagnose authorization first; do not rewrite history.
9. Verify `HEAD`, the remote target commit, ahead/behind counts, and final worktree state before saying "pushed."

## 10. Definition of done

A coding change is done when:

- current branch/upstream and initial worktree state were checked;
- the exact source-of-truth path was identified;
- the edit stayed inside requested scope;
- no unrelated user work was overwritten;
- a focused regression test passed;
- relevant rendered/runtime behavior was checked;
- `git diff --check` passed;
- `npm.cmd run build` passed and the fresh `dist/index.html` was inspected;
- no temporary diagnostics, secrets, mock production data, or unintended old values remain;
- any requested ZIP passed the artifact checks above;
- any requested push was confirmed against the exact remote commit.

Do not say "fully verified" when a required environment was unavailable. Use precise language such as:

- source verified;
- focused tests passed;
- production build and ZIP verified locally;
- browser smoke passed with mock data;
- live Veeva CRM bridge not available in this session;
- iPad/offline behavior not device-verified.

## 11. Handoff format for another Codex

Use this concise structure after completing work:

```markdown
Outcome: <what changed and where>

CRM path: <UI -> mapper -> query/write -> object.field>

Verification:
- <focused tests and counts>
- <rendered/browser checks>
- <build result>
- <ZIP structure/hash/scan evidence if requested>

Git:
- branch/upstream: <...>
- commit/push: <... or not requested>
- remaining unrelated worktree changes: <...>

Limitations: <anything not live/device verified>
```

The next Codex should be able to reproduce every claimed result from commands, source locations, and the artifact path, not from trust in a summary.
