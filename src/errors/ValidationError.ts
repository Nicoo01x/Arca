import { ArcaError } from './ArcaError';

export class ValidationError extends ArcaError {
  constructor(message: string, details?: unknown, originalError?: Error) {
    super(message, 'VALIDATION_ERROR', details, originalError);
  }
}
