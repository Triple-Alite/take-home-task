# Company Collaboration Platform

A two-user company workspace. A Firebase-authenticated owner maintains the company record; the configured collaborator reads the latest submission and uploads images. The NestJS API independently verifies every Firebase ID token and enforces the owner/collaborator role on each REST and Socket.IO connection.

## Local setup

Requirements: Node.js 20+, npm, Docker, and a Firebase project with Email/Password authentication enabled. Copy `.env.example` to `apps/api/.env`; copy only the `NEXT_PUBLIC_*` entries into `apps/web/.env.local`. Set the two Firebase UIDs and Firebase web SDK configuration, then run:

```powershell
docker compose up -d postgres
npm install
npm run db:generate
npm run db:migrate
npm run dev
```

Create one Firebase email/password account for each configured UID. The API uses Application Default Credentials or `FIREBASE_SERVICE_ACCOUNT_JSON` for Firebase Admin verification. Local private image files are written under `.data/private-images`.

Open `http://localhost:3000`; the API listens on `http://localhost:4000`. Swagger UI is at `/docs`.

## Data and security

The displayed percentage is `productCount / userCount * 100`, rounded to one decimal place; if user count is zero it is zero. It is derived on the server as well as the client. One company record is keyed to the configured owner UID. The collaborator can read that record and upload images but cannot edit company data. Both users can view its images. Uploads are limited to JPEG, PNG, and WebP, 5 MiB maximum, and verified using file signatures. PostgreSQL stores metadata only. Development storage is private local disk; production storage uses a private GCS bucket and short-lived signed reads.

See `docs/architecture.md`, `docs/security.md`, `docs/deployment.md`, and `docs/api/` for operational details and the Bruno collection.

Run `npm test` for unit tests, `npm run test:api --workspace @company-platform/api` for HTTP authorization tests, and `npm run build` for both production builds. Real Firebase/PostgreSQL integration requires the configuration above.
