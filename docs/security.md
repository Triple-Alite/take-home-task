# Security Notes

- Firebase ID tokens are verified server-side with Firebase Admin, including revocation checks. The browser cannot select a role. Set distinct `APP_OWNER_UID` and `APP_COLLABORATOR_UID` values from the corresponding Firebase accounts; all other UIDs are denied.
- API and Socket.IO use the same allowlist. REST role guards make company writes owner-only and uploads collaborator-only. The API has a global 60-request/minute throttle, strict DTO validation, Helmet headers, and exact-origin CORS.
- Logs are JSON and recursively redact fields whose names resemble tokens, authorization, passwords, secrets, cookies, email, or credentials. Do not add raw request headers, token claims, or uploaded content to logs.
- GCS buckets must have uniform bucket-level access and public access prevention enabled. Grant the Cloud Run runtime identity object create/read/delete access only on the application bucket. Signed reads live for two minutes; `iam.serviceAccounts.signBlob` permission may be needed for signed URL generation.
- Configure bucket CORS for the deployed web origin so browser `fetch` can follow signed image reads. Keep the allowed origin narrow and allow only GET.
- Local image storage has directory mode 0700 and file mode 0600. Do not serve the storage directory as static content or place it under `public/`.
- The application does not include account provisioning, password reset, invitation, or self-registration. Create exactly two Firebase email/password users out of band and provide their UIDs to the API.
- HTTPS is required in production. Cloud Run terminates TLS. Do not place service-account JSON, Firebase ID tokens, database passwords, or real `.env` files in source control.
