# Testing and verification

## Automated commands

Run commands from the repository root:

```powershell
npm test
npm run test:api --workspace @company-platform/api
npm --workspace @company-platform/api run test:e2e
npm --workspace @company-platform/api run lint
npm --workspace @company-platform/web exec tsc -- --noEmit
npm run build
```

The API unit tests and browser-facing component/domain tests run without Firebase or PostgreSQL. The authorization e2e suite uses a Nest testing module and mocked Firebase verification; it is not a live Firebase/PostgreSQL integration test. Real database migration and persistence validation requires an isolated PostgreSQL database configured with `DATABASE_URL`.

## Manual Firebase and database checks

1. Configure two Firebase Email/Password accounts and record their UIDs.
2. Configure API Admin credentials and the two expected UIDs in the API environment.
3. Apply migrations with `npm run db:deploy --workspace @company-platform/api`.
4. Provision the internal rows with `npm run db:seed --workspace @company-platform/api`.
5. Check `GET /api/v1/health/live` and `GET /api/v1/health/ready`.
6. Use separate short-lived Firebase ID tokens in Bruno to exercise the endpoint matrix in the README.

Never use a production database for test resets. The seed does not reset records or change existing Firebase passwords.

## Bruno

Open the `bruno/` collection and select the Local environment. Set `ownerFirebaseIdToken` and `collaboratorFirebaseIdToken` to short-lived tokens locally; do not commit them. The collection uses `/api/v1` routes. Check the role and expected response for each request before running it.

## Current limits

The test suite does not provision real Firebase users or connect to the configured hosted database. No live deployment, end-to-end login, coverage threshold, or production image access is claimed by these automated tests.
