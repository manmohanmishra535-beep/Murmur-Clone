"use strict";

const User = require("../models/User");
const Post = require("../models/Post");
const AppError = require("../utils/AppError");
const asyncHandler = require("../utils/asyncHandler");
const { serializeUser, paginated } = require("../utils/serialize");
const { notify, removeNotification } = require("../utils/notify");
const { uploadBuffer, destroyImage, FOLDERS } = require("../config/cloudinary");
const { parseLimit, paginate, cursorFilter } = require("../utils/pagination");

// Everything a user row needs, including the arrays its counts come from.
const USER_LIST_FIELDS = "username displayName profileImage bio followers following";

// Search and suggestions both answer with at most one screenful.
const SEARCH_LIMIT = 10;

/** GET /api/users/:username - public profile plus the viewer's relationship flags. */
const getProfile = asyncHandler(async (req, res) => {
  const username = String(req.params.username || "").toLowerCase();

  const user = await User.findOne({ username });
  if (!user) throw AppError.notFound("That account does not exist.");

  const viewerId = req.user ? String(req.user._id) : null;

  const isFollowing =
    req.user && req.user.following
      ? req.user.following.some((id) => String(id) === String(user._id))
      : false;

  const postCount = await Post.countDocuments({ author: user._id });

  res.status(200).json({
    user: serializeUser(user, {
      includeEmail: viewerId === String(user._id),
      isFollowing,
      counts: { postCount },
    }),
  });
});

/**
 * PATCH /api/users/me - displayName, bio and an optional avatar.
 * Text fields are validated by updateMeRules; the image is replaced on
 * Cloudinary and the old asset is deleted by publicId.
 */
const updateMe = asyncHandler(async (req, res) => {
  const user = req.user;

  if (typeof req.body.displayName === "string") user.displayName = req.body.displayName;
  if (typeof req.body.bio === "string") user.bio = req.body.bio;

  if (req.file) {
    const previousPublicId = user.profileImage && user.profileImage.publicId;

    const uploaded = await uploadBuffer(req.file.buffer, FOLDERS.avatars, {
      transformation: [{ width: 400, height: 400, crop: "fill", gravity: "face" }],
    });

    user.profileImage = { url: uploaded.secure_url, publicId: uploaded.public_id };
    await user.save();

    // Only remove the old asset once the new one is committed.
    if (previousPublicId && previousPublicId !== uploaded.public_id) {
      await destroyImage(previousPublicId);
    }
  } else {
    await user.save();
  }

  res.status(200).json({ user: serializeUser(user, { includeEmail: true }) });
});

/** Loads a user for the follow routes, or 404s. */
async function requireUser(id) {
  const user = await User.findById(id).select("_id");
  if (!user) throw AppError.notFound("That account does not exist.");
  return user;
}

/**
 * POST /api/users/:id/follow - idempotent, so a double tap cannot follow twice.
 * Both sides of the relationship are written with $addToSet: the follower's
 * `following` array and the followed user's `followers` array.
 */
const followUser = asyncHandler(async (req, res) => {
  const target = await requireUser(req.params.id);
  if (String(target._id) === String(req.user._id)) {
    throw AppError.badRequest("SELF_FOLLOW", "You cannot follow yourself.");
  }

  const alreadyFollowing = (req.user.following || []).some(
    (id) => String(id) === String(target._id)
  );

  await Promise.all([
    User.updateOne({ _id: req.user._id }, { $addToSet: { following: target._id } }),
    User.updateOne({ _id: target._id }, { $addToSet: { followers: req.user._id } }),
  ]);

  // Only a real change is worth telling anyone about.
  if (!alreadyFollowing) {
    await notify({
      recipient: target._id,
      actor: req.user._id,
      type: "follow",
      dedupe: true,
    });
  }

  res.status(200).json({ following: true });
});

/**
 * DELETE /api/users/:id/follow - also idempotent; unfollowing twice is fine.
 * The follow notification goes with the follow, so unfollowing and following
 * again cannot leave a stale row behind.
 */
const unfollowUser = asyncHandler(async (req, res) => {
  const target = await requireUser(req.params.id);

  await Promise.all([
    User.updateOne({ _id: req.user._id }, { $pull: { following: target._id } }),
    User.updateOne({ _id: target._id }, { $pull: { followers: req.user._id } }),
  ]);

  await removeNotification({
    recipient: target._id,
    actor: req.user._id,
    type: "follow",
  });

  res.status(200).json({ following: false });
});

/**
 * Followers and following are ObjectId arrays on the user document, so the
 * members are resolved against the User collection with the same cursor rule
 * every other list uses: { _id: { $lt: cursor } }, newest first. Each row
 * carries isFollowing, because the user list renders a follow button.
 */
async function listRelations(req, res, field) {
  const target = await User.findById(req.params.id).select(field);
  if (!target) throw AppError.notFound("That account does not exist.");

  const ids = target[field] || [];
  const limit = parseLimit(req.query.limit);

  // The two _id conditions stay in an $and because mongoose cannot cast `$in`
  // and `$lt` written inside a single object.
  const cursor = cursorFilter(req.query.cursor);
  const filter = cursor._id
    ? { $and: [{ _id: { $in: ids } }, cursor] }
    : { _id: { $in: ids } };

  const docs = await User.find(filter)
    .sort({ _id: -1 })
    .limit(limit + 1)
    .select(USER_LIST_FIELDS);

  const { items, nextCursor } = paginate(docs, limit);

  // One aggregate for the whole page, so a user list never runs a query per row.
  const counts = items.length
    ? await Post.aggregate([
        { $match: { author: { $in: items.map((user) => user._id) } } },
        { $group: { _id: "$author", count: { $sum: 1 } } },
      ])
    : [];
  const postCounts = new Map(counts.map((row) => [String(row._id), row.count]));

  const viewerFollowing = req.user && req.user.following ? req.user.following : [];

  res.status(200).json(
    paginated(items, nextCursor, (user) =>
      serializeUser(user, {
        isFollowing: viewerFollowing.some((id) => String(id) === String(user._id)),
        counts: { postCount: postCounts.get(String(user._id)) || 0 },
      })
    )
  );
}

const listFollowers = asyncHandler((req, res) => listRelations(req, res, "followers"));
const listFollowing = asyncHandler((req, res) => listRelations(req, res, "following"));

/** One aggregate for a page of rows, so a roster never runs a query per user. */
async function postCountsFor(users) {
  if (users.length === 0) return new Map();
  const counts = await Post.aggregate([
    { $match: { author: { $in: users.map((user) => user._id) } } },
    { $group: { _id: "$author", count: { $sum: 1 } } },
  ]);
  return new Map(counts.map((row) => [String(row._id), row.count]));
}

/**
 * GET /api/users/search?q= - up to 10 matching accounts.
 *
 * Two plans, as the docs describe. A case-insensitive prefix match on username
 * is what makes as-you-type results feel immediate (the text index cannot match
 * a partial word), and the text index on username and displayName finds a match
 * inside a longer display name. They are merged here rather than combined in one
 * query, because $text may not sit inside an $or.
 */
const searchUsers = asyncHandler(async (req, res) => {
  const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
  if (!q) return res.status(200).json({ items: [], nextCursor: null });

  // The term becomes a pattern, so its own metacharacters are escaped first.
  const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  const prefixMatches = await User.find({ username: new RegExp(`^${escaped}`, "i") })
    .sort({ _id: -1 })
    .limit(SEARCH_LIMIT)
    .select(USER_LIST_FIELDS);

  let textMatches = [];
  try {
    textMatches = await User.find({ $text: { $search: q } })
      .sort({ _id: -1 })
      .limit(SEARCH_LIMIT)
      .select(USER_LIST_FIELDS);
  } catch {
    // A deployment whose text index has not been built still answers on prefix.
  }

  const seen = new Set();
  const items = [...prefixMatches, ...textMatches]
    .filter((user) => {
      const id = String(user._id);
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    })
    .slice(0, SEARCH_LIMIT);

  const postCounts = await postCountsFor(items);
  const viewerFollowing = req.user && req.user.following ? req.user.following : [];

  res.status(200).json({
    items: items.map((user) =>
      serializeUser(user, {
        isFollowing: viewerFollowing.some((id) => String(id) === String(user._id)),
        counts: { postCount: postCounts.get(String(user._id)) || 0 },
      })
    ),
    nextCursor: null,
  });
});

/**
 * GET /api/users/suggested - the other half of /explore.
 *
 * The frontend route table describes /explore as "User search and suggested
 * accounts", but the API table only names search, so this is the missing half:
 * the accounts with the most followers that the viewer is not already following.
 */
const suggestedUsers = asyncHandler(async (req, res) => {
  const exclude = [...(req.user.following || []), req.user._id];

  const rows = await User.aggregate([
    { $match: { _id: { $nin: exclude } } },
    { $addFields: { followerCount: { $size: { $ifNull: ["$followers", []] } } } },
    { $sort: { followerCount: -1, _id: -1 } },
    { $limit: SEARCH_LIMIT },
    {
      $project: {
        username: 1,
        displayName: 1,
        profileImage: 1,
        bio: 1,
        followers: 1,
        following: 1,
      },
    },
  ]);

  const postCounts = await postCountsFor(rows);

  res.status(200).json({
    items: rows.map((row) =>
      // Nobody in this list is followed yet, so the flag is false by definition.
      serializeUser(row, {
        isFollowing: false,
        counts: { postCount: postCounts.get(String(row._id)) || 0 },
      })
    ),
    nextCursor: null,
  });
});

module.exports = {
  getProfile,
  updateMe,
  followUser,
  unfollowUser,
  listFollowers,
  listFollowing,
  searchUsers,
  suggestedUsers,
};
