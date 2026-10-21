# Murmur

A text-first microblogging app: a Next.js client and an Express REST API on MongoDB.
Short posts, quiet interface.

This repository contains the **foundation plus Phases 1 (Authentication), 2 (Posts), 3
(Social) and 4 (Advanced)** from the Murmur engineering docs, together with the design
system from the Murmur design system v1.0 document. Phase 5's deployment setup — Docker,
CI/CD and the Vercel/Render configuration — is in place as well; see **Deployment** below.

Identity is delegated to **Clerk**: sign-up, sign-in, social providers, password resets and
sessions live there. The API verifies Clerk's session token on every request and keeps the
app's own `User` row for posts, follows and messages, so the data model is unchanged.

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
| Sign-up, sign-in, sign-out, social providers, password reset, sessions | Clerk (hosted identity provider) |
| Session verification on every API request; networkless when `CLERK_JWT_KEY` is set | `backend/app.js`, `backend/middleware/auth.js` |
| App profile linked to the Clerk user id and created on first sign-in | `backend/services/userProvisioning.js`, `backend/models/User.js` |
| Handle rules kept: Clerk username when it fits, else the email's local part, de-duplicated | `backend/services/userProvisioning.js` |
| Protected routes and ownership helper | `backend/middleware/auth.js` |
| Profile read (`GET /api/users/:username`) and profile edit (`PATCH /api/users/me`, avatar upload) | `backend/controllers/userController.js` |
| Validation, error shape, rate limits, helmet, CORS, sanitising | `backend/middleware/*`, `backend/validators/*` |
| Custom login, register, password-reset and OAuth-callback screens over Clerk's API — no Clerk-branded UI | `frontend/src/pages/login.jsx`, `register.jsx`, `sso-callback.jsx`, `[username].jsx`, `settings.jsx` |
| Route protection in middleware plus a client-side session guard | `frontend/src/middleware.js`, `frontend/src/hooks/useRequireAuth.js` |
| Design tokens and the core component set | `frontend/src/styles/tokens.css`, `frontend/tailwind.config.js`, `frontend/src/components/*` |

The "done when" line for Phase 1 — *a user can sign up, log in, and edit a profile;
unauthenticated calls return 401* — is covered by the API tests: the suite mints session
tokens with a throwaway RSA key and exercises the same verification path as production, so
it needs no Clerk account. The hosted sign-up form itself needs real Clerk keys; see
**Setup**.

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

### Phase 3 — Social (complete)

| Deliverable | Where |
| --- | --- |
| Like and unlike a post, idempotent, `{ liked, likeCount }` | `backend/controllers/postController.js` |
| `Comment` model in its own collection with `{ post: 1, createdAt: -1 }` | `backend/models/Comment.js` |
| Add, list and delete comments on a post | `backend/controllers/commentController.js`, `routes/comments.js` |
| Follow, unfollow, followers and following, both sides written together | `backend/controllers/userController.js` |
| `commentCount` and `likeCount` moved with `$inc` in the same request | `controllers/postController.js`, `controllers/commentController.js` |
| Home feed restricted to followed accounts plus yourself, newest first | `backend/controllers/postController.js` (`getFeed`) |
| `GET /api/posts/explore` behind the home screen's "For you" tab | `backend/controllers/postController.js` |
| Like wired into PostCard with `aria-pressed` and an updated label | `frontend/src/components/PostCard.jsx` |
| Optimistic like with rollback, straight through the query cache | `frontend/src/hooks/usePostActions.js` |
| Reply thread with its own composer, delete and pagination | `components/CommentForm.jsx`, `components/CommentList.jsx`, `pages/post/[id].jsx` |
| Follow button on profiles and on every user row | `components/FollowButton.jsx`, `components/UserList.jsx` |
| `/…/followers` and `/…/following` pages | `frontend/src/pages/[username]/followers.jsx`, `following.jsx` |

The "done when" line for Phase 3 — *the home feed shows only followed users' posts, newest
first* — is covered by the API tests (the feed after following, and again after unfollowing)
and by a 26-check run over real HTTP against the running API and an in-memory MongoDB, which
drove two accounts through account creation → post → follow → feed → like → reply → delete →
unfollow. The browser itself could not be used for this pass: the browser surface here never
becomes visible, so the page never hydrates. The UI is therefore covered by the production
build, the linter and the component-free lib tests rather than by clicking.

### Phase 4 — Advanced (complete)

| Deliverable | Where |
| --- | --- |
| Repost and un-repost, one per account per post, `repostOf` on a real `Post` | `backend/controllers/postController.js` |
| Bookmark and un-bookmark, plus `GET /api/posts/bookmarks` | `controllers/postController.js` |
| `Notification` model with the documented compound index | `backend/models/Notification.js` |
| Notification rows for like, reply, follow, repost and message, never for your own action | `backend/utils/notify.js` |
| `GET /api/notifications`, `unread-count`, `PATCH /read` | `backend/controllers/notificationController.js` |
| `Conversation` and `Message` models with their indexes | `backend/models/Conversation.js`, `Message.js` |
| Inbox, open-or-create a conversation, paged thread, send a message | `backend/controllers/messageController.js`, `services/conversationService.js` |
| `GET /api/users/search` (prefix plus text index) and `GET /api/users/suggested` | `backend/controllers/userController.js` |
| Socket.IO on the API's own HTTP server, authenticated by the same Clerk session token | `backend/realtime/io.js` |
| Live pushes: `notification:new`, `notification:remove`, `message:new`, `post:counts`, `typing:start`/`typing:stop` | `backend/realtime/emitter.js`, `controllers/*` |
| One socket per session behind `SocketProvider`, opening on login and closing on logout | `frontend/src/context/SocketContext.jsx` |
| Push handlers that write into the React Query cache, so nothing refetches | `context/SocketContext.jsx`, `lib/notifications.js`, `lib/messages.js` |
| Infinite scroll extended to bookmarks, notifications and message threads | `hooks/useFeed.js`, `hooks/useNotifications.js`, `hooks/useMessages.js` |
| Repost and bookmark wired into PostCard as real toggles | `components/PostCard.jsx`, `hooks/usePostActions.js` |
| `/explore`, `/notifications`, `/messages`, `/messages/[id]`, `/bookmarks` | `frontend/src/pages/*` |
| Unread count badge, drawn by `NavItem` and read from the shared count query | `hooks/useNotifications.js`, `components/Sidebar.jsx`, `BottomBar.jsx`, `NavItem.jsx` |

The Phase 4 "done when" line — *a like triggers a live notification without a page
refresh* — is the centre of `backend/tests/advanced.test.js`, which starts a real HTTP
server with Socket.IO attached, signs two accounts in over REST, then likes as one and
asserts the `notification:new` frame arrives at the other's socket with the same payload
the list endpoint returns. The same check runs again against the real `server.js` in the
end-to-end pass below.

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

Nothing from the delivery table is outstanding. The deployment setup is written and
committed — Docker images, the compose stack, the CI/CD pipeline, the Render blueprint and
the Vercel steps — but it has not been pointed at real accounts, so the Deployment section
documents the one-time connection rather than a live URL. The web app also needs a Clerk
application and its two keys before it can sign anyone in; see **Setup**.

Three things are honest about their limits rather than faking data. The profile's **Replies**
and **Likes** tabs stay empty: the API reference defines no "this account's replies" or
"posts this account liked" endpoint, so neither can be filled from what the docs specify.
The rail's **Trends** block says the same — there is no trending endpoint, so it shows no
numbers rather than invented ones. Both are labelled in the UI, and the navigation is
complete so nothing dead-ends.

---

## Prerequisites

- Node 20 or later
- A MongoDB instance (local, Docker, or Atlas) — optional, see *Running without MongoDB*
- A free Clerk application — required for sign-in
- A free Cloudinary account — only needed for image uploads

## Setup

```bash
# 1. Dependencies
npm run install:all          # or: npm --prefix backend install && npm --prefix frontend install

# 2. Environment files
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env.local
```

Create an application at <https://dashboard.clerk.com> and copy two keys from **API keys**:

- **Publishable key** → `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` in `frontend/.env.local`, and
  `CLERK_PUBLISHABLE_KEY` in `backend/.env`.
- **Secret key** → `CLERK_SECRET_KEY` in `backend/.env`. It is server-only; never give it a
  `NEXT_PUBLIC_` name.

Optional but recommended: copy the **JWT public key** (PEM) into `CLERK_JWT_KEY`. With it the
API verifies session tokens locally; without it the SDK fetches and caches the instance's
JWKS. If you want people to choose their `@handle` at sign-up, enable **Username** in the
Clerk dashboard's sign-up options — otherwise the API derives one from the email's local
part (see `backend/services/userProvisioning.js`).

No Clerk account yet? From `frontend/`, `npx clerk init` provisions a temporary
"accountless" development instance and writes the keys to `frontend/.env.local`; copy the same
secret and publishable key into `backend/.env`. On a Pages Router it also scaffolds
`/sign-in` and `/sign-up` pages and their route variables, which this app does not use — delete
those pages and the four `NEXT_PUBLIC_CLERK_SIGN_*` lines. Claim the instance later with
`npx clerk auth login`, or replace the keys with a real application's.

Fill in `MONGO_URI` as well. `CLOUDINARY_*` can stay empty; the API starts and logs that
uploads are disabled.

```bash
# 3. Run both apps
npm run dev            # API on :5000 (nodemon), web on :3000
```

Open <http://localhost:3000>, create an account through Clerk, and the profile page loads.

### Environment variables

**backend/.env**

| Variable | Purpose |
| --- | --- |
| `MONGO_URI` | Mongo connection string, for example `mongodb://localhost:27017/murmur` |
| `CLERK_SECRET_KEY` | Server-only Clerk secret key; verifies session tokens |
| `CLERK_PUBLISHABLE_KEY` | The matching publishable key |
| `CLERK_JWT_KEY` | Optional PEM public key: verify tokens without calling Clerk |
| `CLERK_AUTHORIZED_PARTIES` | Optional comma-separated extra origins whose tokens are accepted (previews) |
| `CLIENT_URL` | The web app's origin: CORS, Socket.IO, and the default authorized party |
| `PORT` | API port, default 5000 |
| `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` | Image uploads |

**frontend/.env.local**

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_API_URL` | Axios base URL, for example `http://localhost:5000/api` |
| `NEXT_PUBLIC_SOCKET_URL` | Socket.IO endpoint, for example `http://localhost:5000` |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk's publishable key; the provider and middleware need it |

The `NEXT_PUBLIC_*` values are inlined by `next build`, so a change needs a rebuild — on
Vercel, a redeploy. `CLERK_SECRET_KEY` is different: Next's middleware reads it at runtime,
so it belongs in the host's environment on Vercel as well, not only in the API.

### Running without MongoDB

The API needs a database. Two easy options:

1. Docker: `docker run -d -p 27017:27017 --name murmur-mongo mongo:7`
2. In-memory, for a quick look:

```js
// backend/dev.tmp.js
const { MongoMemoryServer } = require("mongodb-memory-server");
MongoMemoryServer.create().then((mongo) => {
  process.env.MONGO_URI = mongo.getUri();
  // Clerk keys still come from .env; they are required before this loads.
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

## Deployment

The app has two halves that deploy differently, because they need different things. The web
app is stateless and runs anywhere Next.js runs. The API holds one MongoDB pool and the
Socket.IO connections, so it needs a process that stays alive — which is why the API is not
on Vercel.

| Piece | Where | Why |
| --- | --- | --- |
| Web | Vercel | Next.js pages, static assets, image optimisation |
| API | Render (Docker) | Socket.IO needs a long-lived process; Vercel Functions do not hold WebSockets open |
| Database | MongoDB Atlas | Managed, reachable from the API host, backups in the dashboard |
| Images | Cloudinary | Already the upload target |

This is the split the engineering docs' environment table describes (Vercel for the frontend,
Render/Railway/a VPS for the API). A single-platform Vercel deployment would lose the live
notifications and chat that Phase 4 is built on.

### Web on Vercel

1. Import the repository into Vercel.
2. Set **Root Directory** to `frontend`. This is a monorepo: at the repository root Vercel
   finds a `package.json` with no Next app, and the build would produce nothing to serve.
   The framework preset stays *Next.js*; the install and build commands are the defaults.
3. Add the environment variables, for **Production** and, if previews should work, **Preview**:

   | Variable | Value |
   | --- | --- |
   | `NEXT_PUBLIC_API_URL` | `https://<api-host>/api` |
   | `NEXT_PUBLIC_SOCKET_URL` | `https://<api-host>` |
   | `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | the publishable key from Clerk |
   | `CLERK_SECRET_KEY` | the secret key; Next's middleware reads it at runtime |

4. Deploy. Every push to the branch Vercel tracks rebuilds it.

`NEXT_PUBLIC_*` values are inlined by `next build`, so **changing one needs a redeploy**, not
a restart. `CLERK_SECRET_KEY` is not inlined: it is read by the middleware on each request
and must be present in the Vercel environment. `frontend/.env.local` is not read by Vercel;
the dashboard is the only source there.

Clerk only issues a session token for the origins configured for its application. Add the
Vercel production domain in the Clerk dashboard (and the preview domains, if previews should
sign in), and make sure the API's `CLIENT_URL` is the same origin — that value is the
authorized party the token is checked against.

**Deploying the web app before the API exists** is still possible: leave `NEXT_PUBLIC_API_URL`
and `NEXT_PUBLIC_SOCKET_URL` unset, and the build falls back to `http://localhost:5000`.
Every page renders and `/design` works in full, but sign-in completes only against a local
API, and remote pages report "Cannot reach the Murmur API". Add the two URLs and redeploy
once the API has a host.

### API on Render

`render.yaml` is a blueprint for the API: a Docker web service built from
`backend/Dockerfile`, health-checked at `/api/health`, with the Clerk and Mongo values
supplied on first deploy. Connect the repository as a Blueprint, or create a Docker service
by hand with the same settings.

| Variable | Value |
| --- | --- |
| `NODE_ENV` | `production` |
| `MONGO_URI` | the Atlas connection string |
| `CLERK_SECRET_KEY` | the same Clerk application's secret key |
| `CLERK_PUBLISHABLE_KEY` | the matching publishable key |
| `CLERK_JWT_KEY` | optional PEM public key for offline verification |
| `CLIENT_URL` | the Vercel production URL, exactly, with no trailing slash |
| `CLERK_AUTHORIZED_PARTIES` | optional extra origins, comma-separated (preview deployments) |
| `CLOUDINARY_*` | the three values from Cloudinary, or empty to disable uploads |

The service must stay at **one instance**. Socket.IO keeps its rooms in process memory, so a
second instance would only see half the sockets; the docs' own note is to add the Redis
adapter before scaling. A free Render instance sleeps when idle, which drops sockets; the
client reconnects and refetches the unread count when it does, so notifications sent while it
was asleep are not replayed, only the badge catches up.

### CORS, Clerk and the two origins

There is no session cookie in this design. The browser asks Clerk for a session token and
sends it as `Authorization: Bearer …` on every API call and in the Socket.IO handshake, so
the web app and the API can live on unrelated domains without `SameSite` or third-party
cookie rules. `CLERK_SECRET_KEY` never reaches the browser; `CLERK_PUBLISHABLE_KEY` is
public by design.

Two failure modes are worth knowing:

- **`CLIENT_URL` not exactly the frontend origin** → CORS blocks the request, the socket
  handshake is refused, and Clerk's token is rejected because its `azp` claim is not an
  authorized party.
- **`CLERK_SECRET_KEY` / publishable key from different Clerk applications** → the API
  cannot verify the frontend's token, so every request is a `401`.

Preview deployments get their own hostnames (`<project>-<hash>.vercel.app`). A `CLIENT_URL`
pinned to production will refuse them; either keep previews as read-only UI, or add each
preview origin to `CLERK_AUTHORIZED_PARTIES` and to Clerk's allowed origins.

`GET /api/health` is the uptime check: `{ "status": "ok", "db": "connected" }` when Mongo is
reachable. Every response also carries `X-Request-Id`, and the request log line starts with
the same id, so a report from production can be matched to a log entry.

### Docker

```bash
cp backend/.env.example backend/.env     # MONGO_URI and the Clerk keys
# Clerk's publishable key is also needed at build time; put both in a root .env:
#   CLERK_PUBLISHABLE_KEY=pk_test_...
#   CLERK_SECRET_KEY=sk_test_...
docker compose up --build                # MongoDB + API + web
```

Open <http://localhost:3000>. The compose stack is a development stack on purpose: it serves
plain HTTP on localhost. Production runs the same images behind HTTPS.

Both images are multi-stage, run as the unprivileged `node` user and carry a `HEALTHCHECK`.
The web image is a Next.js standalone build; its `NEXT_PUBLIC_*` values are build arguments:

```bash
docker build -t murmur-web frontend \
  --build-arg NEXT_PUBLIC_API_URL=https://api.example.com/api \
  --build-arg NEXT_PUBLIC_SOCKET_URL=https://api.example.com \
  --build-arg NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_...
```

The API image is the one published by CI, so a VPS can run exactly the tested build:

```bash
docker run -d --name murmur-api -p 5000:5000 \
  -e NODE_ENV=production -e PORT=5000 \
  -e MONGO_URI=... -e CLERK_SECRET_KEY=sk_live_... \
  -e CLERK_PUBLISHABLE_KEY=pk_live_... -e CLERK_JWT_KEY="$(cat clerk-jwt.pem)" \
  -e CLIENT_URL=https://murmur.example.com \
  ghcr.io/<owner>/murmur-clone/api:<commit-sha>
```

### CI/CD

`.github/workflows/ci.yml` runs on every push and pull request:

| Job | Does |
| --- | --- |
| *API tests* | `npm ci`, a production `npm audit`, then the Jest suite on a real in-memory MongoDB (the binary is cached between runs) |
| *Web tests, lint and build* | `npm ci`, a production `npm audit`, Jest, `next lint`, `next build` (with a well-formed dummy Clerk publishable key, since Clerk validates its shape) |
| *Images build* | builds both Docker images without pushing, so a broken Dockerfile fails before merge |
| *Publish the API image* | **default branch only**: pushes `ghcr.io/<repo>/api:<sha>` and `:latest` |
| *Deploy the API* | **default branch only**: POSTs the Render deploy hook |
| *Deploy the web app* | **default branch only**: POSTs the Vercel deploy hook, if one is configured |
| *Health check* | polls `GET /api/health` and the frontend's `/login` after a deploy |

Deployment only runs after the tests and the image builds pass, and the image is tagged with
the commit SHA, which is the docs' "a tagged build with passing tests".

Configuration is optional so a fresh clone is green:

| Kind | Name | Used for |
| --- | --- | --- |
| Secret | `RENDER_DEPLOY_HOOK` | triggering the API deploy |
| Secret | `VERCEL_DEPLOY_HOOK` | triggering a Vercel deploy; not needed if Vercel's Git integration deploys main already |
| Variable | `API_URL` | the health check's target |
| Variable | `WEB_URL` | the health check's frontend target |

Unset values are reported in the log and skipped, not treated as failures. The audit step is
`--audit-level=high` for the API (its production tree is clean) and `--audit-level=critical`
for the web app, because Next bundles a `postcss` version with a high advisory whose only fix
is a major Next upgrade; that is tracked rather than hidden, but it should not fail every
build.

Sentry, which the docs suggest for both halves, is not wired up: it needs an account and a
DSN, and nothing in this repository has one.

---

## API reference (implemented routes)

All routes are under `/api` and speak JSON. Errors always use
`{ "error": { "code", "message", "fields?" } }`. Success is `200`, `201` on create and
`204` on delete. Lists use cursor pagination (`limit`, `cursor`), default 20, maximum 50.

| Method | Path | Auth | Notes |
| --- | --- | --- | --- |
| GET | `/api/health` | no | `{ status: "ok", db: "connected" }` |
| GET | `/api/auth/me` | yes | `200 { user }`; creates the app profile on the first call |
| GET | `/api/users/:username` | optional | Public profile with counts and `isFollowing` |
| PATCH | `/api/users/me` | yes | multipart: `displayName`, `bio`, `image` |
| POST | `/api/users/:id/follow` | yes | `200 { following: true }`, idempotent |
| DELETE | `/api/users/:id/follow` | yes | `200 { following: false }`, idempotent |
| GET | `/api/users/:id/followers` | optional | Paged user rows, each with `isFollowing` |
| GET | `/api/users/:id/following` | optional | Paged user rows, each with `isFollowing` |
| POST | `/api/posts` | yes | multipart: `content` plus up to 4 `images` → `201` and a bare post |
| GET | `/api/posts/feed` | yes | The home feed: your posts plus the people you follow |
| GET | `/api/posts/explore` | yes | Newest posts from everyone |
| GET | `/api/posts/user/:username` | optional | That author's posts, newest first |
| GET | `/api/posts/:id` | optional | A single post, for shared links |
| PATCH | `/api/posts/:id` | yes, owner | JSON `content` → `200`, sets `editedAt` |
| DELETE | `/api/posts/:id` | yes, owner | `204`, with its Cloudinary images, its replies, its reposts and their notifications |
| POST | `/api/posts/:id/like` | yes | `200 { liked: true, likeCount }`, idempotent |
| DELETE | `/api/posts/:id/like` | yes | `200 { liked: false, likeCount }`, idempotent |
| POST | `/api/posts/:id/repost` | yes | JSON `content` optional → `201` with the new post, `200` if you already reposted |
| DELETE | `/api/posts/:id/repost` | yes | `204`, idempotent; the id may be the original or your repost |
| POST | `/api/posts/:id/bookmark` | yes | `200 { bookmarked: true }`, idempotent |
| DELETE | `/api/posts/:id/bookmark` | yes | `200 { bookmarked: false }`, idempotent |
| GET | `/api/posts/bookmarks` | yes | The viewer's saved posts, paged |
| POST | `/api/posts/:id/comments` | yes | JSON `content` → `201` and a bare comment |
| GET | `/api/posts/:id/comments` | optional | Paged replies, newest first |
| DELETE | `/api/comments/:id` | yes, owner | `204`, and `commentCount` moves back |
| GET | `/api/notifications` | yes | Paged rows, newest first |
| GET | `/api/notifications/unread-count` | yes | `200 { count }` |
| PATCH | `/api/notifications/read` | yes | `204`, marks everything read |
| GET | `/api/conversations` | yes | The inbox, most recently active first, capped at 50 |
| POST | `/api/conversations` | yes | JSON `userId` → `200` with the existing conversation or a new one |
| GET | `/api/conversations/:id/messages` | yes, participant | Paged messages, newest first |
| POST | `/api/conversations/:id/messages` | yes, participant | JSON `text` → `201` and a bare message |
| GET | `/api/users/search?q=` | yes | Up to 10 accounts matching a username prefix or display name |
| GET | `/api/users/suggested` | yes | Up to 10 accounts the viewer does not follow, most followed first |

**Authentication.** Sign-up, sign-in, sign-out and password resets are Clerk's sessions, but
the forms are ours: `login.jsx` and `register.jsx` drive Clerk's sign-in and sign-up resources
directly, so the pages match the design system and carry no Clerk branding. Every "yes" row
above needs `Authorization: Bearer <Clerk session token>`.
The token is verified by `clerkMiddleware` — locally when `CLERK_JWT_KEY` is set, otherwise
against Clerk's cached JWKS — and its `azp` claim must be in `CLERK_AUTHORIZED_PARTIES`.
The first verified request creates the app's `User` row: `clerkId` from the token's `sub`,
email and handle from the token's custom claims (or from Clerk's Backend API when the claims
are absent), with the handle de-duplicated. A row created before Clerk existed is adopted by
the verified email, so its posts, followers and bookmarks survive the migration.

**Response shapes.** Post lists, comment lists, user lists, notification lists, the inbox and
message threads are all `{ items, nextCursor }`, where `nextCursor` is the last `_id` or
`null`. The inbox is the one exception in what `nextCursor` means — its order is by activity,
not by insertion, so it returns `nextCursor: null` and simply stops at 50 rather than offering
a cursor that could skip a conversation. A single post, a single comment and a single message
are returned bare rather than wrapped in `{ post }` / `{ comment }` / `{ message }`, which is
what the engineering docs show — this is the one place the API departs from the `{ user }`
wrapper that `/api/auth/me` uses.

Every post carries `likedByMe`, `repostedByMe` and `bookmarkedByMe`, computed per request.
All three are live as of Phase 4: `repostedByMe` is resolved with one query per page, and it
reads `true` for the original *and* for a repost of it, so the repost button looks the same
wherever the viewer meets the post.

### Socket.IO events

The socket carries live pushes and one client-to-server write. Everything that changes data
goes over REST, so there is only ever one code path that writes.

| Event | Direction | Payload |
| --- | --- | --- |
| `notification:new` | server → client | a full notification row, same shape as the list |
| `notification:remove` | server → client | `{ _id, read }` — the row to drop, and whether the badge should move |
| `message:new` | server → client | a full message, same shape as the thread |
| `message:send` | client → server | `{ conversationId, text }`, acked with `{ ok: true, message }` or `{ ok: false, error }` |
| `typing:start` / `typing:stop` | both | `{ conversationId }`, forwarded to the other participant only |
| `post:counts` | server → client | `{ postId, likeCount, commentCount, repostCount }` for the author's own post |

`notification:remove` is an addition to the docs' event table. The docs ask that unliking
remove the like notification; without a removal event an open notifications screen would keep
showing a row the server had already deleted. The `read` flag travels with it so a client
knows whether to decrement the badge or just drop the row.

The handshake carries the same Clerk session token the REST client sends, in the connection's
`auth.token` payload — no second credential, no token in a query string — and each socket
joins a room named after its app user id, so a push to one person is `io.to(userId)`.

Status codes in use: `400` (`SELF_FOLLOW`, `SELF_CONVERSATION`), `401`, `403`, `404`,
`409` (`ALREADY_EXISTS`), `413`, `422` (`VALIDATION_FAILED`), `429` (`RATE_LIMITED`), `500`.

### Validation rules

| Field | Rule |
| --- | --- |
| `username` | 3 to 15 characters, letters/numbers/underscores, stored lowercase, unique. Assigned by the API from the Clerk profile; not user input |
| `email` | valid address, stored lowercase, unique. Owned and verified by Clerk |
| `bio` | up to 160 characters |
| `displayName` | up to 50 characters |
| `image` | JPEG, PNG, WebP or GIF, up to 5 MB |
| `post.content` | 1 to 280 characters after trimming, or empty when an image is attached |
| post images | 1 to 4 files, JPEG, PNG, WebP or GIF, up to 5 MB each |
| `comment.content` | 1 to 280 characters after trimming, always required |
| `repost.content` | optional, up to 280 characters after trimming |
| `message.text` | 1 to 2000 characters after trimming; the docs set no limit, this is the ceiling the UI also uses |
| `userId` | a user `_id`; your own id is a `400 SELF_CONVERSATION` |
| `q` | the search term; empty or missing answers an empty list rather than an error |
| `limit` | 1 to 50, defaulting to 20 on every list endpoint |
| `cursor` | a post/comment/user/notification/message `_id`; a malformed one is a 422, never a 500 |

---

## Data model

`backend/models/User.js` keeps the engineering docs' profile fields — unique lowercase
`username` and `email`, `displayName`, `profileImage { url, publicId }`, `bio`, and
`followers` / `following` / `bookmarks` as ObjectId arrays — plus a sparse unique `clerkId`
that links the row to the Clerk user. `password` and the reset-token fields are gone: Clerk
owns them. The text index on `username` and `displayName` backs the search screen.

`Post` matches the engineering docs: `author`, `content`, `images[]` (`{ url, publicId }`),
`likes[]`, `likeCount`, `commentCount`, `repostCount`, `repostOf`, `createdAt` and
`editedAt`, with `{ author: 1, createdAt: -1 }` and `{ createdAt: -1 }` indexes.

`Comment` matches the engineering docs: `post`, `author`, `content`, with the
`{ post: 1, createdAt: -1 }` index that serves the thread. Comments live in their own
collection rather than inside the post, so a post with thousands of replies never grows the
post document; `Post.commentCount` is the denormalised count kept beside it.

`Notification` matches the engineering docs: `recipient`, `actor`, `type`
(`like` | `comment` | `follow` | `repost` | `message`), an optional `post`, an optional
`conversation`, `read` and `createdAt`, with the `{ recipient: 1, read: 1, createdAt: -1 }`
index the unread badge and the list both read.

`Conversation` matches the engineering docs: `participants[]`, `lastMessage` and
`updatedAt`, with `{ participants: 1, updatedAt: -1 }`. The pair of participants is not a
unique key, which is the one place this deviates — see the notes below.

`Message` matches the engineering docs: `conversation`, `sender`, `text`, `readAt` (reserved;
no endpoint reads it yet) and `createdAt`, with `{ conversation: 1, createdAt: -1 }`.

`User`'s text index on `username` and `displayName` was added with Phase 1 and is now what
`GET /api/users/search` runs its `$text` half against.

---

## Security

- No passwords, hashes or reset tokens are stored: Clerk owns credentials, so a copy of the
  database cannot be replayed against the login form
- Every request verifies a Clerk session token (`clerkMiddleware`), locally when
  `CLERK_JWT_KEY` is set, and checks the token's `azp` against `CLERK_AUTHORIZED_PARTIES`
- The session token stays inside Clerk's SDK, is attached per request as a bearer header,
  and is never written to `localStorage` by the app
- CORS limited to `CLIENT_URL`
- helmet, `x-powered-by` removed, `express-mongo-sanitize` on all input
- 10 KB JSON body limit; global 100 requests / 15 min
- Upload type and size checked on the server, not only in the browser
- Post text and bios render as text through React, never `dangerouslySetInnerHTML`
- Ownership checks return 403 for someone else's document
- The Socket.IO handshake verifies the same Clerk token; a socket without one is refused
  before any handler runs, and a room is named after the user id rather than taken from the
  client, so one account cannot subscribe to another's pushes
- Production dependencies are audited on every push (`npm audit --omit=dev`), and the
  deploy job only runs on a commit whose tests and image builds passed

## Testing

```bash
npm test                       # both apps
npm --prefix backend test      # Jest + Supertest + mongodb-memory-server
npm --prefix frontend test     # Jest on the pure lib modules
```

Backend: 170 tests. Authentication and profiles (33): `/auth/me` (401 with no token, a
malformed one, a token signed with another key, an expired one, and one issued for another
origin), first-call profile creation (the handle from the Clerk username, the email's local
part as a fallback, a de-duplicated handle, display name and avatar from the token's claims,
and the Clerk id never serialised), reuse on later calls, adoption of a row created before
Clerk by its verified email, a bad token treated as anonymous on a public read, the health
check and its request id (generated, kept when the caller supplies a sane one, replaced when
it does not), profile read (public, owner-only email, 404), profile edit (success, 422 for
bio and display name, rejected non-image upload), plus unit tests for the handle helpers,
the pagination cursor and `AppError`. Posts (30): create with text, with images, image-only,
422 for empty and over-length content, an unsupported type and an oversized file, orphan
cleanup when a later upload fails, read and 404s, the public read paths, the user timeline
with cursor pagination that new posts cannot shift, limit clamping, the feed, owner-only
edit with `editedAt`, delete with Cloudinary teardown, 403s, and the profile post count.

Social (53): likes (the documented shape, the counter moving with the `likes` array and the
array never leaking, idempotent double tap, several accounts, 404, unlike, the counter never
reading below zero, and other people's likes left alone); comments (auth, the documented
201 shape, `commentCount` moving in both directions, 422 for empty and over-length text, 404
for a missing post, newest-first listing, public reads, cursor pagination, owner-only delete,
403 for someone else's reply, and a post's replies leaving with the post); follows
(idempotent both ways, both sides of the relationship written, `SELF_FOLLOW`, 404,
`isFollowing` on the profile); follower and following lists (row flags, real counts, public
reads, cursor pagination, 404, and a deleted account dropping out of a list rather than
leaving a hole); the feed (followed accounts plus yourself, newest first, unfollowing
removing their posts again, per-viewer flags on one post, and one account's feed never
leaking into another's); explore; and cursor hygiene (a malformed cursor is a 422 on every
list endpoint instead of a 500).

Advanced (54): reposts (the documented create, the original nested in `repostOf`,
`repostCount` moving, a repeat POST answering the same repost rather than stacking a second,
reposting a repost flattening to the original, `repostedByMe` true on both the original and a
repost of it, and 204s that are safe to repeat); bookmarks (save, unsave, the list, paging,
and one account's bookmarks staying invisible to another); notifications (a row for each of
the five types, no row when the actor is the author, the like row leaving with the unlike,
`unread-count`, marking everything read, the cascade when a post is deleted, and a 422
cursor); search and suggestions (username prefix, a display-name word, the cap of 10, no
private fields in a row, an empty `q`, a regex metacharacter, and suggestions excluding
yourself and the people you already follow); conversations and messages (401s, opening the
same conversation twice returning one conversation, `SELF_CONVERSATION`, an unknown account,
a malformed id, the inbox newest first with the other participant resolved, message paging, a
non-participant getting 403, and empty or oversized text); and a Socket.IO suite that starts a
real HTTP server and connects a real `socket.io-client` — rejecting a missing and an invalid
token, refusing one issued for another origin, accepting the same token the REST client uses,
and then proving the Phase 4 done-when by liking over REST and receiving `notification:new` on
the author's socket, along with `notification:remove`, `post:counts`, a socket-sent message
stored for both participants, a failed send returning an ack instead of throwing, and typing
reaching the peer only.

Frontend: 109 tests over the pure modules — `compactNumber`, `relativeTime`,
`joinedDate`, the profile validators (display name and bio), the Clerk error-message helper,
the composer counter maths and
`isPostable` with images, the image type/size/batch rules, the Cloudinary transform helper,
the post list helpers (`flattenPages`, `isOwnPost`, `withoutPost`, `withLike`,
`withCommentCount`, `withoutComment`, `withFollow`, `canFollow`, `displayedPost`,
`isPlainRepost`, `withRepost`, `withBookmark`, `withCounts`), the notification cache helpers
(`notificationText`, `notificationPhrase`, `notificationHref`, `prependNotification`,
`withoutNotification`, `isUnread`, `bumpUnread`, `flattenNotifications`), the message helpers
(`messagesInOrder`, `appendMessage`, `withLastMessage`, `dayKey`, `conversationLabel`), and
the share helper's sheet, clipboard, cancellation and failure paths.

Component tests with React Testing Library and the Playwright end-to-end flow are still not
part of `npm test`: the Jest config only collects `src/**/*.test.js`, and the browser surface
in this environment cannot complete hydration, so the UI is verified by the production build,
the linter and end-to-end runs over real HTTP against the running API. The Phase 3 pass was 26
checks; the Phase 4 pass is 58, against the real `server.js` with Socket.IO attached and the
production frontend build, covering the whole Phase 4 surface including live delivery.

---

## Notes and decisions

- **Clerk owns identity; MongoDB owns the profile.** Sign-up, sign-in, passwords, social
  providers and resets live in Clerk, so the API stores no credential and cannot leak one.
  The `User` row keeps the fields the rest of the app needs (handle, email, bio, avatar,
  follow graph, bookmarks) and links to Clerk with a sparse unique `clerkId`.
- **The auth forms are ours, not Clerk's prebuilt components.** Clerk's prebuilt UI carries
  its own branding (removing it is a paid-plan feature), so `login.jsx` and `register.jsx`
  drive Clerk's sign-in and sign-up resources directly: same sessions, same OAuth handshake,
  same password handling, but Murmur's markup and no vendor badge. `/sso-callback` finishes
  Google's redirect, and the API never sees a password.
- **The app profile is created lazily.** `GET /api/auth/me` provisions the row on the first
  verified request: the handle comes from the Clerk username when it fits the app's rule,
  otherwise from the email's local part, and is de-duplicated. This means no webhook is
  required to sign up, and a fresh local database works on the first page load. The trade-off
  is that a rename in Clerk does not reach the app profile until the row is recreated; a
  `user.updated` webhook is the follow-up if profile sync matters.
- **Rows from before Clerk are adopted by email.** A `User` with no `clerkId` and the same
  verified email is linked to the Clerk user instead of duplicated, so existing posts,
  followers and bookmarks survive the switch.
- **Bearer tokens, not cookies.** Clerk's session token is attached per request and sent in
  the socket handshake's `auth.token`. Nothing is stored in `localStorage` by the app, and
  the API sets no cookie, so the Vercel/Render split needs no `SameSite=None`, no
  `credentials: true`, and no shared parent domain.
- **Middleware checks the Clerk session, and the API checks it again.** `clerkMiddleware`
  in the web app only decides whether to redirect to `/login`; the API verifies the token
  itself on every request. A forged request never reaches a handler just because the page
  rendered.
- **One place handles a rejected session.** A `401` from the API (other than `/auth/me`)
  signs the browser out of Clerk and sends it to `/login`, which avoids a redirect loop when
  Clerk considers the session valid but the API does not (for example a preview origin that
  is not an authorized party).
- **Profiles are genuinely public.** The frontend route table marks `/[username]` as
  public, so `GET /api/users/:username` uses optional auth and returns "not found" for
  an unknown handle. Everything else under `/api/users` needs a session.
- **`bufferCommands` stays on.** The docs' "fail fast" intent is served by
  `serverSelectionTimeoutMS`; disabling buffering races Mongoose's automatic model init
  on connection open and crashed the first query on Windows.
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
  `authors = [...req.user.following, req.user._id]`, which degenerated to your own posts
  until the follow graph arrived and needs no change now that it has.
- **Likes are idempotent on both verbs.** `POST` and `DELETE /like` answer `200` with
  `{ liked, likeCount }` whatever the previous state was. `$addToSet` and `$pull` guard the
  array so a retry can never add the same account twice, `$inc` moves the denormalised
  counter in the same write, and the count handed back is re-read after the write so the
  client never displays a guess of its own.
- **Following writes both sides and refuses a self-follow.** The follower's `following` and
  the followed account's `followers` are updated with `$addToSet` in one `Promise.all`, so
  the two lists cannot drift and a double tap is harmless. Following yourself is a `400
  SELF_FOLLOW` rather than a write that is silently dropped.
- **Threads and follower lists are readable signed out.** Same reasoning as posts and
  profiles: `/post/[id]` is a public route, and the follower list hangs off a public
  profile, so `GET /api/posts/:id/comments` and both user lists use `optionalAuth`.
  `isFollowing` is filled in per row only when a session is present.
- **A malformed cursor is a 422, not a 500.** `cursorFilter` checks the query-string value
  with `mongoose.isValidObjectId` before it reaches Mongo. A cursor is client input like any
  other field, and the docs' pipeline says bad input is a `422`.
- **`$in` and `$lt` cannot share one `_id` object in Mongoose.** Paging a follower list
  needs both "these member ids" and "before this cursor"; written as a single object,
  Mongoose throws `Can't use _id`. They are two conditions inside an `$and` instead.
- **Like state lives in the query cache, not in PostCard.** Phase 2 kept a local copy of
  `liked`/`likeCount`, which went stale as soon as the `post` prop changed.
  `patchCachedPost` writes the optimistic like into every list and into the single-post
  cache, so the same post shown in a feed and on its permalink cannot disagree, and a failed
  request restores a snapshot. Only the `demo` specimen keeps local counters, because it has
  no server behind it.
- **The reply action does two different things.** In a list the reply count is a real
  `<Link>` to `/post/[id]`, so it can be middle-clicked; on the permalink it is a button
  that puts the caret in the reply box.
- **Following is the home screen's default tab.** The docs describe the home screen as "For
  you" and "Following", and the Phase 3 "done when" line is about followed accounts, so
  Following opens first.
- **Explore arrives a phase early.** `GET /api/posts/explore` is listed in the API
  reference's Posts module, and the home screen has had a "For you" tab since Phase 1.
  Leaving that tab as a placeholder while it is the default view was worse than shipping the
  one cursor query behind it. Search, the other half of `/explore`, arrived with Phase 4.
- **Deleting a post deletes its replies, its reposts and its notifications.**
  `Comment.deleteMany({ post })` and `Post.deleteMany({ repostOf: post._id })` run beside
  `post.deleteOne()`, and the notifications for the post and for each of its reposts go with
  them, so nothing is left pointing at a document that no longer exists.
- **Post images are forced to 16:9.** Cloudinary's transform is
  `w_1200,ar_16:9,c_fill,g_auto,q_auto,f_auto` (`POST_IMAGE_TRANSFORM`), so the media slot
  has exactly one shape at every breakpoint and `<Image width={1200} height={675}>` is
  truthful instead of letterboxing or shifting the layout as images load. Avatars use the
  square `AVATAR_TRANSFORM` and go through the same `cloudinaryUrl()` helper, which never
  stacks a transform twice.
- **An oversized file is refused before it is read.** `validateImageFile` checks type and
  size on the client too, so the common mistakes never cost an upload; the multer limits in
  `middleware/upload.js` and the validator in `validators/post.js` are still the authority.
- **PostCard's `demo` prop.** The design-system page needs every counter to toggle without a
  server, so `demo` keeps local optimistic counters for `/design` and is the only place they
  exist. Real posts use `usePostActions`, which writes into the query cache.
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
- **A repost is a real `Post` document.** `repostOf` points at the original and `content` may
  be empty or a comment of your own, which is exactly how the data model describes it: the
  feed renders it as the original with a "Reposted by @someone" line, and a repost with
  content of its own renders the reposter's card around a bordered copy of the original.
- **One repost per account per post, and repeating the POST is not an error.** The button is
  a toggle, so a second `POST` answers `200` with the repost that already exists instead of
  stacking a duplicate and inflating `repostCount`. First one is a `201`. `DELETE` is a `204`
  whether or not there was anything to undo. Same reasoning as the idempotent like and
  follow, and it keeps `aria-pressed` honest.
- **Reposting a repost flattens to the original.** `resolveOriginal` walks `repostOf` until it
  finds the post that was written first, so the graph is never more than one level deep and a
  chain of reposts cannot build up.
- **`repostedByMe` costs one extra query per page, and is correct on both sides.** There is no
  `reposts` array on `Post`, so the flag cannot come from the document. `viewerReposts`
  collects both the post ids on the page and the ids of the originals they carry, runs one
  `find({ author, repostOf: { $in: ids } })`, and passes the set down. A like, repost or
  bookmark made from a repost card therefore shows as pressed on the original too, and vice
  versa.
- **Bookmarks are idempotent and private.** `$addToSet` / `$pull` on the viewer's own
  `bookmarks` array, answering `{ bookmarked }`. `GET /api/posts/bookmarks` reads that array
  and pages by post `_id`, not by the time it was saved — the docs give the list a `limit`
  and a `cursor` but the model stores no per-bookmark timestamp, so the two cannot both be
  honoured. Saving a post you saved months ago does not float it to the top.
- **Notifications are created inside the request that caused them, then pushed.** v1 has no
  job queue, so `notify()` runs after the write, wrapped so that a failure to record a
  notification can never fail the like or the follow. It is skipped when the actor is the
  recipient, and `dedupe` stops a toggling action from stacking rows.
- **A toggling action takes its notification back.** Unliking, unfollowing and un-reposting
  delete the row they created, so flipping a heart on and off cannot leave a stale row behind
  or inflate the badge. The deletion is pushed as `notification:remove` — an event the docs'
  table does not have, because the docs only describe the row being removed and an open screen
  would otherwise keep showing it. The row's `read` flag travels with it so the client knows
  whether the badge should move or just the row should disappear.
- **`post:counts` is pushed to the author's room.** Whoever likes, replies to or reposts a
  post changes counters that the author may be looking at. The push goes to the author rather
  than to "everyone viewing", because the author is the only person the server knows is
  interested, and it carries the same numbers the REST response does, so the two cannot
  disagree.
- **One socket for the session, and its handlers write into the query cache.**
  `SocketProvider` opens a socket after login and closes it on logout; every handler updates
  the React Query cache the screens already read from, so a push never causes a refetch. On
  reconnect the unread count is refetched, because pushes missed while the socket was down
  cannot be recovered.
- **The socket sends messages; REST is the fallback.** `useSendMessage` uses `message:send`
  when the socket is connected and `POST /conversations/:id/messages` otherwise. Both reach
  the same server-side service, so there is still one code path per feature, and a send works
  on a flaky connection where the socket has not come up yet.
- **`getOrCreateConversation` is find-then-create, not an upsert.** MongoDB refuses an upsert
  whose filter matches the same array twice (`$all` plus `$size` on `participants`), and
  splitting it would trade one problem for another. Two people opening the chat with each
  other in the same instant could therefore create two conversations, and the inbox would show
  both. The fix is a canonical pair key with a unique index; it is noted here rather than
  built, because the window is one round trip wide and the docs do not call for it.
- **The inbox sorts by activity, so it has no cursor.** "Most recently active first" means an
  offset cursor would be unstable — a new message can move a conversation across the page
  boundary — and an `_id` cursor does not describe that order at all. It returns
  `{ items, nextCursor: null }` and stops at 50, rather than offering a cursor that could skip
  a conversation.
- **Message threads arrive newest first, like every other list, and are reversed for
  display.** The cursor rule is the same `_id < cursor` on every endpoint; the thread is the
  one place the natural reading order is the opposite, so `messagesInOrder` flips it once, at
  render time.
- **Search answers with two queries in a `try`.** A case-insensitive escaped-regex prefix
  match on `username` gets the obvious case, and a `$text` query gets display-name words; the
  results are merged and capped at 10. The `$text` half is wrapped so that a deployment whose
  text index has not been built yet still answers over the prefix match instead of failing.
  `GET /api/users/suggested` is an addition like explore was: `/explore` is meant to be
  "search and suggested accounts", and the API reference defines no suggestion endpoint.
- **The rail's suggestions are the same query the explore page runs.** Two lists of people
  that could disagree is worse than one; the rail simply shows the first three and links on for
  the rest. It is only fetched for a signed-in viewer, because the endpoint needs a session
  and a guest would otherwise be bounced to the login screen by the 401 handler.
- **Patching a cached post descends one level.** A repost card renders the original, not
  itself, so a like pressed there has to land on the nested `repostOf` as well as on the post
  id. `patchCachedPost` does both, which is what keeps the copy in the feed and the copy on
  the permalink from drifting apart.

---

## After v1

The docs' own list, unchanged: move the follow lists to a `Follow` collection once an
account passes a few thousand followers, and add the Socket.IO Redis adapter before running
more than one API instance — which is also what would make the API horizontally scalable on
a host that offers it.

Two things this repository would add first: a Next 16 upgrade, which would clear the
`postcss` advisory the audit currently has to tolerate, and the canonical pair key with a
unique index on `Conversation`, which closes the double-open window described above.
