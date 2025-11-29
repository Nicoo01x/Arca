export class ArcaError extends Error {
  public readonly code: string;
  public readonly details?: unknown;
  public readonly originalError?: Error;

  constructor(message: string, code: string, details?: unknown, originalError?: Error) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.details = details;
    this.originalError = originalError;
  }
}
