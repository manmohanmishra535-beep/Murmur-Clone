# Murmur

A text-first microblogging app: a Next.js client and an Express REST API on MongoDB.
Short posts, quiet interface.

This repository contains the **foundation plus Phases 1 (Authentication) and 2 (Posts)**
from the Murmur engineering docs, together with the design system from the Murmur design
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

### Phase 2 — Posts (complete)

| Deliverable | Where |
| --- | --- |
| `Post` model with the documented fields and both indexes | `backend/models/Post.js` |
| Create, read, edit and delete a post | `backend/controllers/postController.js` |
| Image upload, up to 4 per post, JPEG/PNG/WebP/GIF at 5 MB each, into `murmur/posts` | `backend/middleware/upload.js`, `controllers/postController.js` |
| Cloudinary images removed by `publicId` when a post is deleted | `backend/controllers/postController.js` |
| Wire shapes (`serializePost`, `serializeAuthor`, `paginated`) | `backend/utils/serialize.js` |
| Content rules after trimming: 1–280 characters, or an image on its own | `backend/validators/post.js`, `frontend/src/lib/composer.js` |
| Cursor pagination, default 20, maximum 50 | `backend/utils/pagination.js` |
| Composer with up to 4 image previews and a live `n/4` count | `frontend/src/components/Composer.jsx` |
| PostCard with an owner menu: inline edit and a two-step delete | `frontend/src/components/PostCard.jsx` |
| Shared list rendering with infinite scroll | `frontend/src/components/PostList.jsx`, `hooks/useInfiniteScroll.js` |
| Home feed, your profile's Posts tab, and a public single-post page | `frontend/src/pages/index.jsx`, `[username].jsx`, `post/[id].jsx` |

The "done when" line for Phase 2 — *a post with an image appears on the author's profile* —
was verified over real HTTP in a browser against an in-memory MongoDB, with the Cloudinary
upload stubbed because no credentials were available locally.

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

Phases 3 to 5: comments and replies, likes, reposts, bookmarks, the follow graph,
notifications, direct messages, search, `GET /api/posts/explore`, the following timeline,
Socket.IO, Docker and CI.

PostCard already draws the like, repost and bookmark buttons, but on real posts they are
`disabled` with a phase-labelled label instead of pretending to work — only `/design` uses
the interactive fake counters. The placeholder screens say which phase each belongs to,
and the navigation is complete so nothing dead-ends.

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
| POST | `/api/posts` | yes | multipart: `content` plus up to 4 `images` → `201` and a bare post |
| GET | `/api/posts/feed` | yes | The home feed: your posts plus the people you follow |
| GET | `/api/posts/user/:username` | optional | That author's posts, newest first |
| GET | `/api/posts/:id` | optional | A single post, for shared links |
| PATCH | `/api/posts/:id` | yes, owner | JSON `content` → `200`, sets `editedAt` |
| DELETE | `/api/posts/:id` | yes, owner | `204`, and its Cloudinary images go with it |

**Response shapes.** Post lists are `{ items, nextCursor }`, where `nextCursor` is the last
`_id` or `null`. A single post is returned bare rather than wrapped in `{ post }`, which is
what the engineering docs show — this is the one place the API departs from the `{ user }`
wrapper that the Phase 1 auth routes use.

Every post carries `likedByMe`, `repostedByMe` and `bookmarkedByMe`, computed per request.
Those three are always `false` in Phase 2 because the endpoints that would set them are
Phase 3; the fields exist now so the client does not have to change later.

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
| `post.content` | 1 to 280 characters after trimming, or empty when an image is attached |
| post images | 1 to 4 files, JPEG, PNG, WebP or GIF, up to 5 MB each |

---

## Data model

`backend/models/User.js` matches the engineering docs: unique lowercase `username` and
`email`, `password` with `select: false`, `displayName`, `profileImage { url, publicId }`,
`bio`, and `followers` / `following` / `bookmarks` as ObjectId arrays, plus a text index
on `username` and `displayName` for Phase 4 search.

`Post` matches the engineering docs: `author`, `content`, `images[]` (`{ url, publicId }`),
`likes[]`, `likeCount`, `commentCount`, `repostCount`, `repostOf`, `createdAt` and
`editedAt`, with `{ author: 1, createdAt: -1 }` and `{ createdAt: -1 }` indexes. The
`likeCount` and `commentCount` denormalised counters are on the document from the start,
even though only Phase 3 will write them.

`Comment`, `Notification`, `Conversation` and `Message` arrive with their phases.

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

Backend: 63 tests. Authentication (33): register (success, 422 field errors, 409 for
username and email, lowercase normalisation, hashing), login (success, 401 twice, 422),
`/auth/me` (401 without a cookie, 401 for a tampered token, 200 with one), logout, the
health check, profile read (public, owner-only email, 404), profile edit (success, 422 for
bio and display name, rejected non-image upload), plus unit tests for token helpers, the
pagination cursor and `AppError`. Posts (30): create with text, with images, image-only,
422 for empty and over-length content, an unsupported type and an oversized file, orphan
cleanup when a later upload fails, read and 404s, the public read paths, the user timeline
with cursor pagination that new posts cannot shift, limit clamping, the feed, owner-only
edit with `editedAt`, delete with Cloudinary teardown, 403s, and the profile post count.

Frontend: 51 tests over the pure modules — `compactNumber`, `relativeTime`,
`joinedDate`, the client-side validators, the composer counter maths and `isPostable` with
images, the image type/size/batch rules, the Cloudinary transform helper, the post list
helpers (`flattenPages`, `isOwnPost`, `withoutPost`), and the share helper's sheet,
clipboard, cancellation and failure paths.

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
  `suppressHydrationWarning` lets the client value win; real posts arrive client-side only.
- **Reading posts is public, writing is not.** `GET /api/posts/:id` and
  `GET /api/posts/user/:username` use `optionalAuth`, matching the frontend route table,
  where `/post/[id]` and `/[username]` are public so a shared link opens for a signed-out
  visitor. `POST`, `PATCH`, `DELETE` and `GET /api/posts/feed` require a session, and the
  edit and delete controllers check ownership on top of that. The controller is therefore
  not wrapped in a single `router.use(requireAuth)`.
- **The home feed exists in Phase 2.** The docs schedule the home feed with Phase 3, but
  without it writing a post would be a dead end. It reads
  `authors = [...req.user.following, req.user._id]`, which simply degenerates to your own
  posts until the follow graph arrives, and needs no change then.
- **Post images are forced to 16:9.** Cloudinary's transform is
  `w_1200,ar_16:9,c_fill,g_auto,q_auto,f_auto` (`POST_IMAGE_TRANSFORM`), so the media slot
  has exactly one shape at every breakpoint and `<Image width={1200} height={675}>` is
  truthful instead of letterboxing or shifting the layout as images load. Avatars use the
  square `AVATAR_TRANSFORM` and go through the same `cloudinaryUrl()` helper, which never
  stacks a transform twice.
- **An oversized file is refused before it is read.** `validateImageFile` checks type and
  size on the client too, so the common mistakes never cost an upload; the multer limits in
  `middleware/upload.js` and the validator in `validators/post.js` are still the authority.
- **PostCard's `demo` prop.** The design-system page needs the like, repost and bookmark
  buttons to actually toggle for a design reference, but Phase 2 has no endpoints behind
  them. `demo` keeps the local optimistic counters for `/design`, and everywhere else the
  three buttons render `disabled` with an aria label such as "Like, available in Phase 3".
- **The composer stays controlled.** `value`/`onChange` are still owned by the page, with
  `images`/`onImagesChange` alongside them, so `/design` can mirror a draft and the pages
  can clear the composer only after the API confirms the post. Object-URL previews are
  derived and revoked inside the composer.
- **Offline note on `PATCH` and multipart.** Editing edits the text only, and sends JSON;
  images are not replaceable in Phase 2. The docs do not ask for it, and a partial image
  swap would need orphan handling on the edit path as well as the create path.
- **Sharing never fails quietly.** `lib/share.js` is shared by PostList and the single post
  page. It prefers `navigator.share`, falls back to the clipboard, treats a dismissed sheet
  as a cancellation, and reports a genuine failure with the link spelled out — a Share
  click that returns nothing at all is worse than an ugly message. The image rule constants
  live in `lib/images.js` only; the settings page imports them rather than keeping a second
  copy of "5 MB".
- **Only the first post image is `priority`.** Everything below the fold stays lazy, and
  `sizes="(max-width: 720px) 100vw, 600px"` keeps the browser from picking the 3840px
  candidate for a 600px slot.

---

## Next phase

Phase 3 adds comments and replies, the follow graph, likes, reposts and bookmarks with
their endpoints, notifications, and the search and explore reads — then wires the counters
that Phase 2 left `disabled` in PostCard and the tabs that already exist on the profile.
