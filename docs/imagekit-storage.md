# ImageKit photo storage

New uploads use ImageKit when `PHOTO_STORAGE_PROVIDER=imagekit`. Existing Cloudinary
URLs are left intact; switching providers does not recover inaccessible old files.
The server keeps image bytes outside MongoDB and persists the returned image URL
and folder-prefixed asset ID on the owning record.

Set these server environment variables locally and in Vercel production:

- `PHOTO_STORAGE_PROVIDER=imagekit`
- `IMAGEKIT_PRIVATE_KEY` (secret)
- `IMAGEKIT_PUBLIC_KEY`
- `IMAGEKIT_URL_ENDPOINT=https://ik.imagekit.io/unicostatistics`
- `IMAGEKIT_WEBHOOK_SECRET` (separate secret from the webhook dashboard)

Never place private keys in renderer code or commit environment files.

## Webhook

Configure `https://unico-statistics.vercel.app/api/webhooks/imagekit` in ImageKit.
Choose `file.created`, `file.updated`, and `file.deleted` where available. Upload
transformation events can also be subscribed to if transformations are enabled.
Ordinary photo uploads do not depend on webhook delivery.

The POST route verifies the raw JSON body using the official ImageKit SDK and
Standard Webhooks headers. Invalid, altered, expired, and unsigned events are
rejected. Without a signing secret, it returns 503. GET reports whether the
endpoint is configured without exposing credentials.

Accepted events are recorded in the Activity Log. They do not change staff photo
ownership or erase staff records. The current handler is informational; repeated
provider deliveries can produce repeated activity entries.

## Verification

Run `npm --prefix server run test:photos` and `npm run build`.
The photo tests cover durable-save failures, image fallback/retry, provider asset
IDs and folder validation, plus authentic, tampered, expired and unsigned webhooks.
