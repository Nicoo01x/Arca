import type { ServiceUrls } from '../config/env';

export interface CertificateCredentials {
  cert?: string;
  key?: string;
  passphrase?: string;
  certPath?: string;
  keyPath?: string;
}

export interface AuthToken {
  token: string;
  sign: string;
  expirationTime: Date;
  generatedAt: Date;
  service: string;
}

export interface AuthClientOptions {
  cuit: string;
  service: string;
  urls: ServiceUrls;
  httpTimeoutMs?: number;
  retry?: {
    maxRetries: number;
    baseDelayMs: number;
  };
}
