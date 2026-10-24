// httpError.js — error with an HTTP status, picked up by the error middleware
export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
