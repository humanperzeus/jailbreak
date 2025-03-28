import Joi from "joi";

export const agentValidator = Joi.object({
  // Required fields from the request
  owner: Joi.string().required(),
  name: Joi.string().min(3).max(16).required(),
  initial_pool_size: Joi.number().min(0.5).max(10000).required().positive(),
  fee_multiplier: Joi.number().min(1).max(100).required().positive(),
  tournament_id: Joi.string().pattern(/^\d+$/).required(),
  tournamentPDA: Joi.string().required(),
  opening_message: Joi.string().min(10).max(130).default(""),
  pfp: Joi.string().uri().required(),
  assistant_id: Joi.string().required(),
  developer_fee: Joi.number().min(0).max(100).required().positive(),
  airdrop_split: Joi.object({
    winner: Joi.number().min(0).max(100).required().positive(),
    creator: Joi.number().min(0).max(100).required().positive(),
  }).required(),
  idl: Joi.object({
    address: Joi.string().required(),
  }).required(),
  entryFee: Joi.number().min(0).required().positive(),
  usd_prize: Joi.number().min(0).required().positive(),
  winning_prize: Joi.number().min(0).required().positive(),
  // Fields that have default values in the database
  phrases: Joi.array().items(Joi.string().min(4).max(255)).default([]),
  instructions: Joi.string().min(100).max(10000).default(""),
  status: Joi.string().default("upcoming"),
  language: Joi.string().default("english"),
  disable: Joi.array().items(Joi.string()).default([]),
  start_date: Joi.date().default(Date.now),
  expiry: Joi.date().default(() => new Date(Date.now() + 24 * 60 * 60 * 1000)),
  model: Joi.string().default("gpt-4o-mini"),
  contextLimit: Joi.number().default(10),
  chatLimit: Joi.number().default(100),
  characterLimit: Joi.number().default(500),
  charactersPerWord: Joi.number().allow(null).default(null),
  suffix: Joi.string().allow(null).default(null),
  agent_logic: Joi.string().allow(null).default(null),
  winner: Joi.string().allow(null).default(null),
  break_attempts: Joi.number().default(0),
  expiry_logic: Joi.string().default("last_sender"),
  tools_description: Joi.string(),
  success_function: Joi.string().allow(null).default(null),
  fail_function: Joi.string().allow(null).default(null),
  tool_choice: Joi.string().default("none"),
  tools: Joi.array().items(Joi.object()).default([]),
  tag: Joi.string(),
  tldr: Joi.string(),
  task: Joi.string(),
  winning_message: Joi.string(),
  type: Joi.string(),
  style: Joi.array().items(Joi.string()),
});
