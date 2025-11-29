import { ArcaError } from './ArcaError';

export class AuthError extends ArcaError {
  constructor(message: string, details?: unknown, originalError?: Error) {
    super(message, 'AUTH_ERROR', details, originalError);
  }
}
