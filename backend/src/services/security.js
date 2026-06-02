import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

import { settings } from "../config.js";
import { HttpError } from "../errors.js";

const BCRYPT_ROUNDS = 12;

export function getPasswordHash(password) {
  return bcrypt.hashSync(password, BCRYPT_ROUNDS);
}

export function verifyPassword(plainPassword, hashedPassword) {
  try {
    return bcrypt.compareSync(plainPassword, hashedPassword);
  } catch {
    return false;
  }
}

export function createAccessToken(subject) {
  return jwt.sign({}, settings.jwtSecretKey, {
    algorithm: settings.jwtAlgorithm,
    subject: String(subject),
    expiresIn: `${settings.jwtAccessTokenExpireMinutes}m`,
  });
}

export function decodeAccessToken(token) {
  try {
    return jwt.verify(token, settings.jwtSecretKey, {
      algorithms: [settings.jwtAlgorithm],
    });
  } catch {
    throw new HttpError(401, "Invalid authentication credentials");
  }
}
