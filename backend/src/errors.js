// Mirrors FastAPI's HTTPException: carries a status code and a `detail` message
// that the global error handler serializes as `{ "detail": ... }`.
export class HttpError extends Error {
  constructor(statusCode, detail) {
    super(detail);
    this.name = "HttpError";
    this.statusCode = statusCode;
    this.detail = detail;
  }
}
