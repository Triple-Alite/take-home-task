# Deployment

The committed production target is Google Cloud Run for both Next.js and NestJS, Cloud SQL for PostgreSQL, private Cloud Storage for image bytes, Firebase Authentication, and Secret Manager for the database URL. No cloud account, project, Firebase configuration, or deployment credential was available in this workspace, so no resource or live deployment is claimed.

## Prerequisites

1. Create a GCP project and enable Cloud Run, Cloud Build, Artifact Registry, Cloud SQL Admin, Secret Manager, and Cloud Storage APIs.
2. Create a PostgreSQL Cloud SQL instance/database and a private GCS bucket. Enable uniform bucket-level access and public access prevention. Add the `deploy/cloudrun/gcs-cors.json` policy with your real web origin.
3. Create two Firebase Authentication email/password users and record their UIDs. In Firebase project settings, enable Email/Password. Configure a Cloud Run runtime service account with Cloud SQL Client, Secret Manager Secret Accessor, and object access scoped to the bucket. Allow it to sign blobs for V4 URLs if required.
4. Store the production Prisma connection string in Secret Manager as `DATABASE_URL`. It must target the Cloud SQL instance, use TLS/socket configuration appropriate to the chosen connector, and URL-encode credentials. Do not use the local Docker credentials.
5. Apply the migration from a trusted deployment environment with network access: `npm run db:deploy`.

## Build and deploy

Copy `deploy/cloudrun/cloudbuild.yaml` substitutions for the project, region, image bucket, Cloud SQL instance, API URL, web origin, Firebase project and the two UIDs. Set the Cloud Run runtime service account. Submit with Cloud Build after `npm install` has created a committed lockfile:

```powershell
gcloud builds submit --config deploy/cloudrun/cloudbuild.yaml --substitutions=_REGION=us-central1,_FIREBASE_PROJECT_ID=your-project,_APP_OWNER_UID=owner-uid,_APP_COLLABORATOR_UID=collaborator-uid,_GCS_BUCKET=private-bucket,_CLOUD_SQL_INSTANCE=your-project:us-central1:collaboration,_RUNTIME_SERVICE_ACCOUNT=collaboration-runtime@your-project.iam.gserviceaccount.com,_WEB_ORIGIN=https://workspace.example.com,_NEXT_PUBLIC_API_URL=https://api.example.com/api .
```

Configure DNS/custom domains and matching `WEB_ORIGIN`/`NEXT_PUBLIC_API_URL` before deployment. Add the four Firebase web SDK public configuration values as Cloud Build substitutions/build arguments in the Cloud Build config. Public Firebase web config is not a secret; owner/collaborator UIDs and database credentials are runtime config/secrets.

After deployment, verify `/api/health`, Swagger at `/docs`, sign in with each configured Firebase account, confirm collaborator PUT requests return 403, submit a company as owner, upload an image as collaborator, and confirm both users receive real-time updates. Verify an unrelated Firebase user receives 401. Deployment is complete only after those live checks pass.

## Local-only development

Use `docker compose up -d postgres`, local Firebase project credentials, `STORAGE_DIR` and the root README steps. Local storage is intentionally disabled when `NODE_ENV=production` and `GCS_BUCKET` is absent.
