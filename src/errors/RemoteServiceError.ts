import { ArcaError } from './ArcaError';

export interface RemoteErrorItem {
  code?: string;
  message: string;
  source?: string;
}

export class RemoteServiceError extends ArcaError {
  public readonly errors?: RemoteErrorItem[];

  constructor(message: string, errors?: RemoteErrorItem[], details?: unknown, originalError?: Error) {
    super(message, 'REMOTE_SERVICE_ERROR', details, originalError);
    this.errors = errors;
  }
}
