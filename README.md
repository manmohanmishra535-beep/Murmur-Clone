# Murmur

A text-first microblogging app: a Next.js client and an Express REST API on MongoDB.
Short posts, quiet interface.

This repository contains the **foundation plus Phase 1 (Authentication)** from the
Murmur engineering docs, together with the design system from the Murmur design
system v1.0 document.

```
twitter-clone/
├── backend/          Express API, Mongoose models, Jest + Supertest tests
├── frontend/         Next.js (Pages Router, JavaScript), Tailwind, design system
├── package.json      Scripts to run both apps together
└── .gitignore
```

---

## What is implemented

### Phase 1 — Authentication (complete)

| Deliverable | Where |
| --- | --- |
| Register, login, logout, current user | `backend/routes/auth.js`, `backend/controllers/authController.js` |
| bcrypt hashing at cost 12, `password` has `select: false` | `backend/models/User.js` |
| HS256 JWT in an httpOnly cookie named `token` | `backend/utils/token.js` |
| Protected routes and ownership helper | `backend/middleware/auth.js` |
| Profile read (`GET /api/users/:username`) and profile edit (`PATCH /api/users/me`, avatar upload) | `backend/controllers/userController.js` |
| Validation, error shape, rate limits, helmet, CORS, sanitising | `backend/middleware/*`, `backend/validators/*` |
| Login, register, profile, settings screens with inline validation | `frontend/src/pages/login.jsx`, `register.jsx`, `[username].jsx`, `settings.jsx` |
| Route protection in middleware plus a client-side session guard | `frontend/src/middleware.js`, `frontend/src/hooks/useRequireAuth.js` |
| Design tokens and the core component set | `frontend/src/styles/tokens.css`, `frontend/tailwind.config.js`, `frontend/src/components/*` |

The "done when" line for Phase 1 — *a user can sign up, log in, and edit a profile;
unauthenticated calls return 401* — is covered by the API tests and was verified over
real HTTP.

### Design system (complete)

`tokens.css` and `tailwind.config.js` are the delivered files; Tailwind reads the same
CSS variables, so a theme change never needs a rebuild. Components built:
Button, Avatar, Input, Textarea, Tabs, NavItem, PostCard, Composer, Toast, Skeleton,
PageHeader, EmptyState, plus the app shell (Sidebar, RightRail, BottomBar, AppShell)
and the icon set.

There is a live reference page at **`/design`** that mirrors the design document:
swatches that copy their token name, the type scale, space/shape/motion, every
component, the layout rules and the do/don't list. It includes a theme switcher.

### Deliberately not built yet

Phases 2 to 5: posts and comments, likes/reposts/bookmarks beyond the PostCard UI,
the home feed query, follows, notifications, direct messages, search, Socket.IO,
Docker and CI. The placeholder screens say which phase each belongs to, and the
navigation is complete so nothing dead-ends.

---

## Prerequisites

- Node 20 or later
- A MongoDB instance (local, Docker, or Atlas) — optional, see *Running without MongoDB*
- A free Cloudinary account — only needed for image uploads

## Setup

```bash
# 1. Dependencies
npm run install:all          # or: npm --prefix backend install && npm --prefix frontend install

# 2. Environment files
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env.local
```

Generate a secret for `JWT_SECRET`:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Fill in `MONGO_URI` and `JWT_SECRET` at minimum. `CLOUDINARY_*` can stay empty; the API
starts and logs that uploads are disabled.

```bash
# 3. Run both apps
npm run dev            # API on :5000 (nodemon), web on :3000
```

Open <http://localhost:3000>, register a user, and the profile page loads.

### Environment variables

**backend/.env**

| Variable | Purpose |
| --- | --- |
| `MONGO_URI` | Mongo connection string, for example `mongodb://localhost:27017/murmur` |
| `JWT_SECRET` | Signs access tokens, at least 32 characters |
| `JWT_EXPIRES_IN` | Token lifetime, default `7d` |
| `CLIENT_URL` | Single allowed CORS origin and Socket.IO origin |
| `API_URL` | Public API URL, used only to decide the cookie's `SameSite` in production |
| `COOKIE_SAMESITE` | Optional override: `lax`, `none` or `strict` |
| `PORT` | API port, default 5000 |
| `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` | Image uploads |

**frontend/.env.local**

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_API_URL` | Axios base URL, for example `http://localhost:5000/api` |
| `NEXT_PUBLIC_SOCKET_URL` | Socket.IO endpoint (Phase 4) |

### Running without MongoDB

The API needs a database. Two easy options:

1. Docker: `docker run -d -p 27017:27017 --name murmur-mongo mongo:7`
2. In-memory, for a quick look:

```js
// backend/dev.tmp.js
const { MongoMemoryServer } = require("mongodb-memory-server");
MongoMemoryServer.create().then((mongo) => {
  process.env.MONGO_URI = mongo.getUri();
  process.env.JWT_SECRET = "at-least-32-characters-long-secret-value-here";
  require("./server").default ?? require("./server");
});
```

---

## Scripts

From the repository root:

| Command | Does |
| --- | --- |
| `npm run install:all` | Installs both apps |
| `npm run dev` | API (nodemon) and web (next dev) together |
| `npm test` | Backend Jest suite, then frontend Jest suite |
| `npm run lint` | `next lint` for the frontend |
| `npm run build` | Production build of the frontend |

Per app: `backend` has `dev`, `start`, `test`, `test:watch`; `frontend` has `dev`,
`build`, `start`, `lint`, `test`.

---

## API reference (implemented routes)

All routes are under `/api` and speak JSON. Errors always use
`{ "error": { "code", "message", "fields?" } }`. Success is `200`, `201` on create and
`204` on delete. Lists use cursor pagination (`limit`, `cursor`), default 20, maximum 50.

| Method | Path | Auth | Notes |
| --- | --- | --- | --- |
| GET | `/api/health` | no | `{ status: "ok", db: "connected" }` |
| POST | `/api/auth/register` | no | username, email, password → `201 { user }` and a cookie |
| POST | `/api/auth/login` | no | email, password → `200 { user }` and a cookie |
| POST | `/api/auth/logout` | yes | `204`, clears the cookie |
| GET | `/api/auth/me` | yes | `200 { user }` |
| GET | `/api/users/:username` | optional | Public profile with counts and `isFollowing` |
| PATCH | `/api/users/me` | yes | multipart: `displayName`, `bio`, `image` |

Status codes in use: `400`, `401`, `403`, `404`, `409` (`ALREADY_EXISTS`), `413`, `422`
(`VALIDATION_FAILED`), `429` (`RATE_LIMITED`), `500`.

### Validation rules

| Field | Rule |
| --- | --- |
| `username` | 3 to 15 characters, letters/numbers/underscores, stored lowercase, unique |
| `email` | valid address, stored lowercase, unique |
| `password` | at least 8 characters |
| `bio` | up to 160 characters |
| `displayName` | up to 50 characters |
| `image` | JPEG, PNG, WebP or GIF, up to 5 MB |

---

## Data model

`backend/models/User.js` matches the engineering docs: unique lowercase `username` and
`email`, `password` with `select: false`, `displayName`, `profileImage { url, publicId }`,
`bio`, and `followers` / `following` / `bookmarks` as ObjectId arrays, plus a text index
on `username` and `displayName` for Phase 4 search.

`Post`, `Comment`, `Notification`, `Conversation` and `Message` arrive with their phases.

---

## Security

- bcrypt at cost 12; the hash never leaves the server and is stripped by `toJSON`
- JWT (HS256) in an httpOnly cookie; `Secure` and `SameSite=None` only when the frontend
  and API are on different hosts in production
- CORS limited to `CLIENT_URL` with credentials on
- helmet, `x-powered-by` removed, `express-mongo-sanitize` on all input
- 10 KB JSON body limit; global 100 requests / 15 min, and 10 / 15 min on login and register
- Upload type and size checked on the server, not only in the browser
- Post text and bios render as text through React, never `dangerouslySetInnerHTML`
- Ownership checks return 403 for someone else's document
- Login answers identically for a wrong password and an unknown email, so the endpoint
  cannot be used to enumerate accounts

## Testing

```bash
npm test                       # both apps
npm --prefix backend test      # Jest + Supertest + mongodb-memory-server
npm --prefix frontend test     # Jest on the pure lib modules
```

Backend: 33 tests covering register (success, 422 field errors, 409 for username and
email, lowercase normalisation, hashing), login (success, 401 twice, 422), `/auth/me`
(401 without a cookie, 401 for a tampered token, 200 with one), logout, the health
check, profile read (public, owner-only email, 404), profile edit (success, 422 for bio
and display name, rejected non-image upload), plus unit tests for token helpers, the
pagination cursor and `AppError`.

Frontend: 19 tests over the pure modules — `compactNumber`, `relativeTime`,
`joinedDate`, the client-side validators and the composer counter maths.

Component tests with React Testing Library and the Playwright end-to-end flow are
scheduled with Phase 2, when PostCard and the feed become real; the lib tests above are
the pieces that already exist.

---

## Notes and decisions

- **`bcryptjs` instead of `bcrypt`.** Same `$2a$` format and the same cost factor 12,
  but no native build step, which keeps `npm install` working on Windows and in Alpine
  images without prompting. Swapping back is a one-line change in `models/User.js`.
- **`bufferCommands` stays on.** The docs' "fail fast" intent is served by
  `serverSelectionTimeoutMS`; disabling buffering races Mongoose's automatic model init
  on connection open and crashed the first query on Windows.
- **Profiles are genuinely public.** The frontend route table marks `/[username]` as
  public, so `GET /api/users/:username` uses optional auth and returns "not found" for
  an unknown handle. Everything else under `/api/users` needs a session.
- **`SameSite` is inferred, not hardcoded.** `none` is used only when `CLIENT_URL` and
  `API_URL` are on different hosts in production; otherwise `lax`. `COOKIE_SAMESITE`
  overrides it.
- **Middleware checks for the cookie, not the token.** It cannot verify a JWT without
  the secret, so it is a UX shortcut; the API re-verifies every request. Middleware does
  not redirect signed-in users away from `/login` — with an expired cookie that would
  bounce forever between `/` and `/login`. The login page redirects once
  `/api/auth/me` confirms the session.
- **Theme preference lives in `localStorage` for now.** The settings page writes
  `data-theme` on `<html>` and `_document.jsx` applies it before paint to avoid a flash.
  The design doc suggests storing it on the profile; the `User` schema has no field for
  it yet, so that moves to Phase 5 when `PATCH /api/users/me` grows one.
- **Fonts load from Google Fonts via `<link>`.** `next/font` downloads at build time,
  which would make a build require network access. The token stacks fall back to system
  faces if the request fails.
- **Auth state is `React Query` + one context.** Server state belongs to React Query
  (already installed and provided); the small `AuthContext` holds only the current user,
  which is shared by the whole shell.
- **The profile page keys its loading state off `isPending`.** `/api/users/:username` can
  only be fetched once `router.query.username` exists, so the query starts *disabled*.
  A disabled React Query v5 query is `isPending`, not `isLoading`, and the page is
  pre-rendered with an empty query — checking `isLoading` made the server HTML show
  "Could not load this profile" for a moment on every load. `isPending` renders the
  skeleton instead, and a genuine transport failure now gets its own message rather than
  the "account does not exist" one.
- **PostCard's `<time>` opts out of hydration warnings.** Relative timestamps
  ("2h", "3d") are computed from `Date.now()` while the design-system page's sample posts
  are rendered on both the server and the client, so the two values legitimately differ.
  `suppressHydrationWarning` lets the client value win; real posts from Phase 2 arrive
  client-side only.

---

## Next phase

Phase 2 adds the `Post` model, `routes/posts.js`, image upload via multer to Cloudinary
in `murmur/posts`, and wires the existing Composer, PostCard and `usePostActions` to it.
