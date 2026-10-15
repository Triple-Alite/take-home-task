# Architecture

## Components

- `apps/web` is a strict-TypeScript Next.js App Router client. Firebase Auth handles email/password sign-in; a typed API helper attaches the current Firebase ID token to every Nest request. React Hook Form and Zod validate the owner form. Socket.IO refreshes the shared view after company submissions and uploads.
- `apps/api` is a NestJS REST API with Prisma/PostgreSQL, Firebase Admin token verification, DTO validation, role guards, throttling, Helmet, and a Socket.IO namespace.
- PostgreSQL stores one `Company` per configured owner UID and image metadata. Image bytes are stored in a private local directory in development or a private GCS bucket in production.

## Request flow

1. Firebase authenticates the email/password account and the browser receives an ID token.
2. The API verifies the token signature, audience/project, expiry, and revocation state with Firebase Admin. It derives `owner` or `collaborator` only from the two server-configured UIDs.
3. Nest guards enforce the route role. The owner alone can upsert the company. Either configured user can read it and its image metadata; only the collaborator can upload.
4. Uploaded content is limited to 5 MiB and JPEG/PNG/WebP signatures are checked before storing. The database receives the storage key and metadata, never the bytes.
5. Authorized image reads are checked against the configured owner company. Local mode streams from a private path; GCS mode redirects to a V4 read URL expiring after two minutes.
6. Successful writes broadcast only the updated company fields or new image metadata to the authenticated company room.

## Percentage

`percentage = round((products / users) * 100, 1)`. It is `0` when user count is zero. The UI previews the value, but the API independently derives and persists it. Counts are non-negative integers capped at 10,000,000.
