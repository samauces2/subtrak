# SubTrack — Project progress

Last update: 2026-10-29.

## Status
**First functional local MVP implemented. Not deployed.**

## Approved decisions
- Responsive web application first, with a desktop web layout. A native mobile application is future scope.
- Approved interface: top navigation, Dashboard, Mis suscripciones, reusable create/edit modal; tables become cards on narrow screens.
- React, TypeScript, Vite, Tailwind CSS and Vitest; no login, backend or database.
- LocalStorage behind a repository interface; versioned JSON backups before public release.
- Stable `billingAnchorDate` preserves month, day and recurrence phase. Entered `nextBillingDate` remains a reference/lower bound; upcoming dates are derived without recording payments.
- Month-end clipping restores the original day; annual February 29 returns in leap years.
- Pause/resume preserves the calendar. Changing the date or frequency starts a new anchor.
- Imports replace all data only after full validation, a record-count preview and explicit confirmation. Invalid files leave existing records unchanged.
- Default currency MXN, locale es-MX; MXN, USD and EUR listed first, with other currencies supported by the browser's Intl currency catalog. Currency-specific minor units.
- Upcoming charges show every occurrence in the 30-day interval starting today, including repeated weekly charges.

## Completed
- [x] Local React/TypeScript/Vite setup, Tailwind, npm lockfile and build scripts.
- [x] Responsive dashboard, subscription list, create/edit modal, first-use and no-results states.
- [x] Create, edit, delete with confirmation, pause/resume, categories and optional notes.
- [x] Search and filters by state and category.
- [x] Pure recurrence/calendar and budget functions; separate currency totals; no confirmed-payment claims.
- [x] LocalStorage repository, runtime validation, malformed/versioned-data recovery and storage-failure handling.
- [x] JSON export/import with validated replacement and original-document download for recovery.
- [x] Detection of another tab's data changes to prevent overwriting stale data without reloading.
- [x] 79 deterministic Vitest tests covering billing, dates, currencies, pause state, persisted data and backup validation.
- [x] Production build and TypeScript checks pass.
- [x] Dependency audit: zero vulnerabilities after upgrading Vitest.
- [x] Browser checks: create, reload persistence, edit, pause/reactivate with dashboard updates, export and restore the exported backup, confirmed deletion of the agent-created test record. Preview left empty for first use.
- [x] Desktop and narrow-screen browser layout checks; no horizontal document overflow in the narrow layout observed.

## Remaining before public release
1. Finish a broader manual pass on physical phones/tablets, multiple browsers and screen readers.
2. Review the working local version with the user and incorporate feedback.
3. Choose static hosting and deploy after the local review.

## Run locally
See README.md. `npm run dev` starts the local preview, `npm test` runs tests, and `npm run build` generates `dist/`.

## Feedback — 2026-10-29
- Updated categories: Entretenimiento, Streaming, Fitness, Educación, Nube, Software, Otro.
- Legacy music/gaming records and backups migrate to Entretenimiento without losing subscriptions.
- Category changes pass 49 tests and the production build.
- User chose explicitly confirmed payments for the current calendar year. Implemented “Pagado este año” alongside annual budget equivalents, separated by currency.
- Added per-subscription payment recording, all-payment history and confirmed removal of incorrect payments. Supports historical dates and prevents duplicate confirmations.
- Payment amounts/names/currencies are snapshots; pause, deletion or repricing does not alter the paid total.
- Schema v2 exports and restores payments. v1 documents migrate with empty history; existing storage key is retained.
- All 79 tests and the production build pass. Browser checks in separate localhost storage confirmed three MXN 249 payments → MXN 747, reload persistence, duplicate rejection and removal → MXN 498. Test records were removed afterward.
- Existing user subscriptions were left intact; no payments were confirmed against them.

## Docker image automation — 2026-10-29
- Prepared a multi-stage Dockerfile: Node 24 builds/tests the app; Nginx serves static output on port 8080 as a non-root user.
- Added an allowlisted .dockerignore, SPA/cache/health configuration and a repeatable container smoke-check script.
- Successfully built the local image and both AMD64/ARM64 variants; all 79 tests pass inside the Docker build. Runtime smoke checks pass with read-only filesystem, temporary /tmp and dropped capabilities.
- Added a SHA-pinned GitHub Actions workflow: PR validation, merged-PR verification, manual publication approval and Docker Hub publication to samauces/subtrak with latest and full-commit tags.
- Configured the GitHub dockerhub environment: required reviewer samauces2, self-review permitted, admin bypass disabled, branch policy main only.
- Publication requires the owner to configure DOCKERHUB_TOKEN in the dockerhub environment. No token was requested through chat or committed; no image has been pushed to Docker Hub and no Azure resources have been created.
- Remote main initially contains only README.md; the initial application and Docker automation will be submitted together for review in a pull request.
- Full setup and daily-use instructions: docs/docker-publication.md.
