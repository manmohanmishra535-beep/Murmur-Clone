# Questions and answers

Code-backed answers to questions this repository raises. Each entry names the files that
settle it, so the answer can be checked rather than taken on trust.

## How do REST and Socket.IO divide the work?

**Short answer.** REST is the only transport that changes stored data. Socket.IO carries
server-to-client pushes, plus one client-to-server write (`message:send`) that calls the
same service as the REST message route. This is the rule that keeps the two transports from
turning into two APIs.

| Responsibility | Transport | Implementation |
| --- | --- | --- |
| Reads and writes for posts, likes, follows, bookmarks, notifications and conversations | REST under `/api` | `backend/routes/`, `backend/controllers/` |
| Tell one user about a like, follow, comment or message | `notification:new` / `notification:remove` | `backend/utils/notify.js`, after the write is stored |
| Show a new message in both participants' threads | `message:new` | `createMessage` in `backend/services/conversationService.js` |
| Keep the author's like, comment and repost counts live | `post:counts` | `pushCounts` in the post and comment controllers |
| Send a chat message | `message:send` or `POST /api/conversations/:id/messages` | Both call `createMessage` |
| Show that someone is typing | `typing:start` / `typing:stop` | Relayed by `backend/realtime/io.js`; never stored |

### Why the socket write is not a second code path

`backend/realtime/io.js` authenticates the handshake, then calls `createMessage(userId,
conversationId, text)`. The REST controller does the same thing:

```js
// backend/controllers/messageController.js
const postMessage = asyncHandler(async (req, res) => {
  const message = await createMessage(req.user._id, req.params.id, req.body.text);
  // ...
});
```

`createMessage` is the only function that stores a message. It also updates the
conversation's `lastMessage`, emits `message:new` to both participants, and creates the
recipient's notification. Opening a second write path over the socket would duplicate all
of that; reusing the service means the two transports cannot drift apart.

### The client applies pushes to the query cache

`frontend/src/context/SocketContext.jsx` opens one socket after login and closes it on
logout. Its handlers write directly into React Query rather than refetching:

- `notification:new` prepends the row and moves the unread badge; `notification:remove`
  drops a toggled-off row and moves the badge back.
- `message:new` appends to the open thread and updates the conversation preview.
- `post:counts` patches the viewer's cached post wherever it is on screen.

On a reconnect the provider invalidates the notifications query, because pushes sent while
the socket was down were missed. `useSendMessage` prefers `message:send` when the socket is
connected and falls back to REST when it is not; both return the same message shape, and the
client de-duplicates by `_id`.

### Authentication and fan-out

The handshake carries the same Clerk session token the REST client sends as a bearer header
(`auth.token` in `frontend/src/context/SocketContext.jsx`). A connection without a valid
token is refused. Each socket joins a private room named after its app user id, and
`emitToUser` targets that room. When the realtime layer is not attached — tests, scripts —
`emitToUser` is a no-op, so a push can never fail the write that triggered it.

### Trade-off

Socket.IO keeps its rooms in process memory, so the API must run as one instance. Scaling
out needs the Socket.IO Redis adapter first; the deployment section of the README says the
same. Pushes are best-effort: the REST response remains authoritative, and a missed push is
recovered by the client's next fetch or reconnect.

### Where to look

- `backend/realtime/io.js` — handshake auth, rooms, `message:send`, typing relay.
- `backend/realtime/emitter.js` — the single Socket.IO handle and `emitToUser`.
- `backend/services/conversationService.js` — `createMessage`, the one message writer.
- `backend/utils/notify.js` — notification storage and the two notification events.
- `frontend/src/context/SocketContext.jsx` — one socket per session, cache writes.
- `frontend/src/hooks/useMessages.js` — socket-first send with a REST fallback.
