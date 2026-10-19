/**
 * Sample content for the design-system page. Mirrors the design PDF examples.
 *
 * Timestamps are relative to "now" so the specimen keeps reading like a live
 * feed ("2h"). PostCard's <time> opts out of hydration warnings for that
 * reason: the elapsed time is legitimately different on the server and client.
 */
export const MOCK_POSTS = [
  {
    _id: "mock-1",
    author: {
      _id: "u-priya",
      username: "priya",
      displayName: "Priya Nair",
    },
    content:
      "Trains on the Western line were on time this morning and nobody knows why. Enjoy it while it lasts. #Mumbai",
    createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    likeCount: 1284,
    commentCount: 42,
    repostCount: 318,
    likedByMe: false,
    repostedByMe: false,
    bookmarkedByMe: false,
  },
  {
    _id: "mock-2",
    author: {
      _id: "u-rohan",
      username: "rohan_s",
      displayName: "Rohan Shah",
    },
    content:
      "Reminder that a 280 character limit is a design constraint, not a bug. Say less, mean more.",
    createdAt: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
    likeCount: 428,
    commentCount: 12,
    repostCount: 96,
    likedByMe: true,
    repostedByMe: false,
    bookmarkedByMe: false,
  },
];
