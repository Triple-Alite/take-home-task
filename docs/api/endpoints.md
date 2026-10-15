# REST API

Base URL: `http://localhost:4000/api` locally. All paths except `/health` require `Authorization: Bearer <Firebase ID token>`. The API independently verifies token signature, expiry, project/audience, and revocation. Roles are derived only from server environment UIDs.

| Method and path | Body | Access | Success | Common errors |
|---|---|---|---|---|
| `GET /health` | none | public liveness | `200 {"status":"ok"}` | `429` rate limit |
| `GET /auth/me` | none | owner or collaborator | `200 {"uid":"...","role":"owner"}` | `401` missing/invalid/disallowed token |
| `GET /company` | none | owner or collaborator | `200` latest company object | `401`, `404` not submitted, `429` |
| `PUT /company` | `{"name":"Northstar Labs","userCount":24,"productCount":7}` | owner only | `200` company object including server-derived `percentage` | `400` validation/unknown field, `401`, `403`, `429` |
| `GET /images` | none | owner or collaborator | `200` array of metadata; storage keys and bytes are never returned | `401`, `404` company not configured, `429` |
| `POST /images` | multipart field `file`, valid JPEG/PNG/WebP, at most 5 MiB | collaborator only | `201` image metadata | `400` missing/oversized multipart, `401`, `403`, `404` company not submitted, `415` wrong content/signature, `429` |
| `GET /images/:id` | none | owner or collaborator | `200` private image stream locally; `302` to a two-minute GCS signed read URL in production | `401`, `403`, `404`, `429` |

Company fields: `name` is 2-120 characters; `userCount` and `productCount` are integers from 0 to 10,000,000. The derived percentage is `products / users * 100`, rounded to one decimal, and zero when users is zero. A caller-supplied percentage, owner UID, role, or unknown property is rejected.

Nest Swagger UI is available at `/docs`. Runnable requests and placeholder token variables are in `bruno/`. Replace token placeholders locally with short-lived Firebase ID tokens; never commit real tokens.
