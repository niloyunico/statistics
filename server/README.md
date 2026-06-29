# UNICO Auth Server

A small, secure backend that lets people sign in to the UNICO desktop app with
real accounts. **This server holds the MongoDB connection string — the desktop
app never does.** The app only ever talks to this server's HTTPS API and gets back
a short‑lived login token.

```
Desktop app  --(username/password over HTTPS)-->  THIS server  --(MongoDB driver)-->  MongoDB Atlas
   (no DB credentials)                          (.env holds the URI)
```

## Endpoints
- `GET  /api/health` → `{ ok, db }`
- `POST /api/login`  `{ username, password }` → `{ ok, token, user }` (401 on bad creds)
- `GET  /api/me`     `Authorization: Bearer <token>` → `{ ok, user }`
- `GET  /api/data`   *(auth)* → `{ ok, data, updatedAt }` — the whole app-state snapshot
- `PUT  /api/data`   *(auth)* `{ data }` → `{ ok, updatedAt }` — save the app-state snapshot

Passwords are stored as **bcrypt hashes**; tokens are signed **JWTs** (12h).

## What ends up in your cluster (database `unico`)
- **`users`** — login accounts (created by `npm run seed` / added later). Bcrypt-hashed.
- **`appdata`** — one shared document (`_id: "shared"`) holding the app's whole state
  (statistics, staff, quality, settings). The app **pushes** it on sign-in and every 15s
  when it changes, and **pulls** it on sign-in so every signed-in device sees the same data.

**Why your cluster is empty until you do this:** with no `MONGODB_URI`, the server uses a
throwaway in-memory store — nothing is written to Atlas. Set `MONGODB_URI` (below), restart
the server, then sign in from the app: `unico.users` and `unico.appdata` will appear, and
`Data Size` in Atlas will grow above 0 B.

---

## 1. Run it locally right now (no database needed)
A dev in‑memory store is used when `MONGODB_URI` is empty, so you can test the
login flow immediately:

```bash
cd server
npm install
# optional: pick the dev admin login
set SEED_ADMIN_USER=admin && set SEED_ADMIN_PASSWORD=test123   # Windows cmd
npm start
```
It prints the dev admin login. In the app's **Sign in → Server settings**, set the
address to `http://localhost:4000` (or whatever `PORT` you used) and sign in.

Run the self‑test any time: `npm test`.

---

## 2. Connect your real MongoDB Atlas (production)

**a. Rotate the exposed password.** The password in your screenshot is compromised.
Atlas → **Database Access → (your user) → Edit → Edit Password**.

**b. Create a dedicated, NON‑admin database user.** Do **not** use the `atlasAdmin`
user for the app. Atlas → **Database Access → Add New Database User**:
- Username e.g. `unico_app`
- Built‑in role **“Read and write to any database”** (or a custom role scoped to the
  `unico` database). *Never* `atlasAdmin`.

**c. Allow the server's IP.** Atlas → **Network Access → Add IP Address** → add the
IP of wherever this server runs (your host/VPS, or `0.0.0.0/0` if the host IP is
dynamic — acceptable only because this user is scoped to one database, not admin).

**d. Get the connection string** (Atlas → Connect → Drivers) and put everything in
`server/.env` (copy from `.env.example`):
```
MONGODB_URI=mongodb+srv://unico_app:<new-password>@cluster0.awwyvp1.mongodb.net/
DB_NAME=unico
JWT_SECRET=<a long random string>   # node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
PORT=4000
ALLOWED_ORIGINS=*
SEED_ADMIN_USER=admin
SEED_ADMIN_PASSWORD=<the first admin's password>
```

**e. Create the first admin and start:**
```bash
npm run seed     # creates the admin user in MongoDB (bcrypt-hashed)
npm start
```

---

## 3. Deploy so other machines can sign in
For multiple devices, this server must be reachable over the internet on **HTTPS**.
Easiest options (free tiers): **Render**, **Railway**, or **Fly.io** — or any VPS.
- Push the `server/` folder, set the same env vars in the host's dashboard.
- Use the host's **HTTPS** URL (e.g. `https://unico-auth.onrender.com`).
- Add that host's egress IP to Atlas Network Access.
- Optionally set `ALLOWED_ORIGINS` to `app://unico` instead of `*`.

## 4. Point the desktop app at it
On each device: **Sign in screen → Server settings → enter the server URL**
(e.g. `https://unico-auth.onrender.com`). It's saved per device. Until a URL is set,
the app behaves exactly as before (offline, no cloud login).

## 5. Adding more users
For now, add users directly to the `users` collection (username, bcrypt
`passwordHash`, `role`, `active:true`) — or copy `seed-admin.js` into a small script.
A future in‑app “Users & Roles” → server sync can manage this from the UI.

## Security checklist
- [ ] Rotated the exposed Atlas password
- [ ] App connects with a **non‑admin**, database‑scoped user (not `atlasAdmin`)
- [ ] `MONGODB_URI` lives only in `server/.env` (which is git‑ignored) / the host's env — never in the desktop app
- [ ] Strong random `JWT_SECRET`
- [ ] Server served over **HTTPS** in production
