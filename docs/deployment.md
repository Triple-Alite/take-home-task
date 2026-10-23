# Deployment: Supabase, Render, and Vercel

The app keeps Firebase Authentication and Prisma. Supabase provides PostgreSQL and a private Storage bucket, Render runs the NestJS API, and Vercel runs the Next.js frontend. The Render blueprint is in `render.yaml`. Free tiers are suitable for a take-home demo, not a production availability guarantee: Render services can sleep and Supabase free projects can pause after inactivity. Confirm current quotas and billing terms in each provider dashboard before deploying.

## 1. Configure Supabase

1. Create a Supabase project and copy its project URL.
2. In **Storage**, create a bucket named `private-images`. Leave public access disabled. The API uses its service-role key server-side, so never expose or commit that key.
3. In **Project Settings → Database → Connection string**, choose the **Session pooler** connection string. Use the session-pooler host and port (normally `5432`) for Prisma. Add `?schema=public&sslmode=require` if those query parameters are not already present. URL-encode special characters in the database password.
4. Apply the Prisma migration against that database from a trusted terminal with `DATABASE_URL` configured:

   ```sh
   npm run db:deploy --workspace @company-platform/api
   ```

   Do not put the connection string into the repository. Supabase direct database connections may require IPv6; the session pooler is generally the simpler option for Render.

## 2. Deploy the API to Render

1. Create the Render account and connect the GitHub repository.
2. Choose **New → Blueprint** and select the repository. Render reads `render.yaml` and creates the API service. The service uses `apps/api` as its root and the lockfile committed in that folder.
3. Supply the requested environment values in Render:
   - `DATABASE_URL`: Supabase session-pooler Prisma connection string.
   - `FIREBASE_PROJECT_ID`: Firebase project ID used by the two client accounts.
   - `FIREBASE_SERVICE_ACCOUNT_JSON`: the Firebase Admin service-account JSON as a single-line secret. Keep it in Render's environment only.
   - `APP_OWNER_UID`, `APP_COLLABORATOR_UID`: the respective Firebase Authentication UIDs.
   - Run the controlled `db:seed` process after the new user migration to create the internal `USER_A` and `USER_B` records. Configure `SEED_USER_A_EMAIL`/`SEED_USER_A_PASSWORD` and `SEED_USER_B_EMAIL`/`SEED_USER_B_PASSWORD` only in a trusted local environment; do not put them in source control or general production runtime configuration.
   - `SUPABASE_URL`: Supabase project URL.
   - `SUPABASE_SERVICE_ROLE_KEY`: Supabase server-side service-role key (secret).
   - `WEB_ORIGIN`: the exact Vercel site origin, for example `https://your-project.vercel.app` (no trailing slash). Update it after the Vercel deployment if its assigned domain was not known when creating the Render service.
4. Wait for the Render build and check `https://<render-service>.onrender.com/api/v1/health/live` and `/api/v1/health/ready`. The API listens on Render's assigned `PORT`, and `/docs` serves Swagger.

The API’s storage adapter expects `STORAGE_PROVIDER=supabase` and uses signed, 120-second reads. Render's filesystem is ephemeral, so do not select `local` storage for deployed images.

## 3. Deploy the frontend to Vercel

1. Import the same GitHub repository into Vercel and set the project **Root Directory** to `apps/web`.
2. Configure these environment variables for the Production environment (and Preview if needed):
   - `NEXT_PUBLIC_API_URL`: `https://<render-service>.onrender.com/api`
   - `NEXT_PUBLIC_SOCKET_URL`: `https://<render-service>.onrender.com`
   - `NEXT_PUBLIC_FIREBASE_API_KEY`
   - `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
   - `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
   - `NEXT_PUBLIC_FIREBASE_APP_ID`
3. Deploy. Set Render's `WEB_ORIGIN` to the exact deployed Vercel origin and redeploy/restart the API if necessary.
4. In Firebase Authentication, enable Email/Password and add the Vercel origin to the authorized domains.

The Firebase web config values are public client configuration. Keep database credentials and the Supabase service-role key exclusively in Render's secret environment variables.

## 4. Verify the live deployment

- Open the Vercel site and sign in with both configured Firebase users.
- Confirm the owner can submit company data and the collaborator sees the update.
- Confirm the collaborator cannot update company data (API returns 403).
- Upload an image as the collaborator and verify both authorized users can read it.
- Confirm an unrelated Firebase account is rejected (401), and private storage objects have no public URL access.
- Test the first request after an idle period; free services may need time to wake up.

No deployment is considered successful until these live checks pass.

## Local development

Use `docker compose up -d postgres`, copy `.env.example` to `apps/api/.env`, and copy the `NEXT_PUBLIC_*` values to `apps/web/.env.local`. `STORAGE_PROVIDER=local` stores image bytes in `.data/private-images` for development only.

## Optional Google Cloud deployment

The previous Cloud Run/Cloud SQL/GCS configuration remains in `deploy/cloudrun/`. It is separate from the Supabase/Render/Vercel setup documented above.
