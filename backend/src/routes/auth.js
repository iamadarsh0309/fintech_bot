import { Router } from "express";

import { User } from "../models/index.js";
import { HttpError } from "../errors.js";
import { asyncHandler, validateBody } from "../middleware.js";
import { signupSchema, loginSchema } from "../schemas.js";
import {
  createAccessToken,
  getPasswordHash,
  verifyPassword,
} from "../services/security.js";

export const authRouter = Router();

authRouter.post(
  "/auth/signup",
  validateBody(signupSchema),
  asyncHandler(async (req, res) => {
    const { username, password } = req.validated;

    const existingUser = await User.findOne({ where: { username } });
    if (existingUser) {
      throw new HttpError(409, "Username already exists");
    }

    const user = await User.create({
      username,
      password_hash: getPasswordHash(password),
    });

    res.status(201).json({
      id: user.id,
      username: user.username,
      created_at:
        user.created_at instanceof Date
          ? user.created_at.toISOString()
          : user.created_at,
    });
  }),
);

authRouter.post(
  "/auth/login",
  validateBody(loginSchema),
  asyncHandler(async (req, res) => {
    const { username, password } = req.validated;

    const user = await User.findOne({ where: { username } });
    if (!user || !verifyPassword(password, user.password_hash)) {
      throw new HttpError(401, "Invalid username or password");
    }

    res.json({
      access_token: createAccessToken(user.id),
      token_type: "bearer",
    });
  }),
);
