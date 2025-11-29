import { ArcaError } from './ArcaError';

export class NetworkError extends ArcaError {
  constructor(message: string, details?: unknown, originalError?: Error) {
    super(message, 'NETWORK_ERROR', details, originalError);
  }
}
