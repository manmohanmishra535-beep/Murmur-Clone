"use strict";

const { body } = require("express-validator");
const { MESSAGE_MAX } = require("../services/conversationService");

/** POST /api/conversations - the other participant, by id. */
const createConversationRules = [
  body("userId")
    .exists({ values: "null" })
    .withMessage("Choose someone to message.")
    .bail()
    .isMongoId()
    .withMessage("Choose a valid account."),
];

/** POST /api/conversations/:id/messages - plain text, 1 to 2000 characters. */
const createMessageRules = [
  body("text")
    .exists({ values: "null" })
    .withMessage("Write a message.")
    .bail()
    .isString()
    .withMessage("Write your message as plain text.")
    .bail()
    .trim()
    .isLength({ max: MESSAGE_MAX })
    .withMessage(`Keep your message to ${MESSAGE_MAX} characters.`)
    .bail()
    .isLength({ min: 1 })
    .withMessage("Write a message."),
];

module.exports = { createConversationRules, createMessageRules };
