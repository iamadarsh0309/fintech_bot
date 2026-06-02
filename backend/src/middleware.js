import { HttpError } from "./errors.js";
import { decodeAccessToken } from "./services/security.js";
import { User, ChatSession } from "./models/index.js";

// Wrap async route handlers so thrown errors reach the global error handler.
export function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

// Validate and coerce req.body with a zod schema (FastAPI returns 422 here).
export function validateBody(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const issue = result.error.issues[0];
      const path = issue.path.join(".") || "body";
      next(new HttpError(422, `${path}: ${issue.message}`));
      return;
    }
    req.validated = result.data;
    next();
  };
}

export const authenticate = asyncHandler(async (req, _res, next) => {
  const header = req.headers.authorization || "";
  const [scheme, token] = header.split(" ");
  if (scheme !== "Bearer" || !token) {
    throw new HttpError(401, "Not authenticated");
  }

  const payload = decodeAccessToken(token);
  const userId = payload.sub;
  if (!userId) {
    throw new HttpError(401, "Invalid authentication credentials");
  }

  const user = await User.findByPk(userId);
  if (!user) {
    throw new HttpError(401, "User not found");
  }
  req.user = user;
  next();
});

export async function getUserSessionOr404(sessionId, userId) {
  const chatSession = await ChatSession.findOne({
    where: { id: sessionId, user_id: userId },
  });
  if (!chatSession) {
    throw new HttpError(404, "Session not found");
  }
  return chatSession;
}
