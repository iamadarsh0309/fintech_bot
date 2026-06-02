import dotenv from "dotenv";

dotenv.config();

function parseBool(value, fallback) {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }
  return ["1", "true", "yes", "on"].includes(String(value).toLowerCase());
}

function parseCorsOrigins(value) {
  if (!value) {
    return ["http://localhost:3000"];
  }
  // Accept either a JSON array string or a comma-separated list.
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) {
      return parsed;
    }
  } catch {
    // fall through to comma-separated parsing
  }
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

// Sequelize speaks plain "postgres://"; strip SQLAlchemy's driver suffix if present.
function normalizeDatabaseUrl(value) {
  return value
    .replace(/^postgresql\+psycopg2:\/\//, "postgres://")
    .replace(/^postgresql:\/\//, "postgres://");
}

export const settings = {
  projectName: "AI Loan Advisor Chatbot",
  databaseUrl: normalizeDatabaseUrl(
    process.env.DATABASE_URL ||
      "postgres://postgres:postgres@localhost:5432/fintech_agent",
  ),
  jwtSecretKey: process.env.JWT_SECRET_KEY || "change-me",
  jwtAlgorithm: process.env.JWT_ALGORITHM || "HS256",
  jwtAccessTokenExpireMinutes: Number(
    process.env.JWT_ACCESS_TOKEN_EXPIRE_MINUTES || 1440,
  ),
  llmWrapperUrl:
    process.env.LLM_WRAPPER_URL ||
    "https://llm-wrapper-741152993481.asia-south1.run.app",
  llmWrapperToken: process.env.LLM_WRAPPER_TOKEN || "",
  backendCorsOrigins: parseCorsOrigins(process.env.BACKEND_CORS_ORIGINS),
  seedSampleData: parseBool(process.env.SEED_SAMPLE_DATA, true),
  exposeDebugEndpoints: parseBool(process.env.EXPOSE_DEBUG_ENDPOINTS, false),
  port: Number(process.env.PORT || 8000),
};
