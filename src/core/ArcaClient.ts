import { resolveEnvironment, EnvironmentName, ServiceUrls } from '../config/env';
import { ArcaAuthClient, AuthHooks } from '../auth/ArcaAuthClient';
import type { CertificateCredentials } from '../auth/types';
import { ElectronicInvoiceClient } from '../services/wsfe/ElectronicInvoiceClient';
import { ValidationError } from '../errors/ValidationError';

export interface HttpConfig {
  timeoutMs?: number;
  maxRetries?: number;
  baseDelayMs?: number;
}

export interface ArcaClientConfig extends CertificateCredentials {
  cuit: string;
  serviceScopes: string[];
  environment: EnvironmentName;
  urls?: Partial<ServiceUrls>;
  http?: HttpConfig;
  hooks?: AuthHooks;
}

export class ArcaClient {
  public readonly auth: ArcaAuthClient;
  public readonly invoice?: ElectronicInvoiceClient;
  public readonly environment: EnvironmentName;
  private readonly urls: ServiceUrls;

  constructor(config: ArcaClientConfig) {
    this.validateConfig(config);
    this.environment = config.environment;
    this.urls = resolveEnvironment(config.environment, config.urls);

    this.auth = new ArcaAuthClient(
      {
        cert: config.cert,
        key: config.key,
        passphrase: config.passphrase,
        certPath: config.certPath,
        keyPath: config.keyPath
      },
      {
        cuit: config.cuit,
        service: 'wsaa',
        urls: this.urls,
        httpTimeoutMs: config.http?.timeoutMs,
        retry: {
          maxRetries: config.http?.maxRetries ?? 1,
          baseDelayMs: config.http?.baseDelayMs ?? 250
        }
      },
      config.hooks
    );

    if (config.serviceScopes.includes('wsfe')) {
      this.invoice = new ElectronicInvoiceClient(this.auth, {
        url: this.urls.wsfeUrl,
        cuit: config.cuit,
        timeoutMs: config.http?.timeoutMs,
        hooks: config.hooks
      });
    }
  }

  close(): void {
    // Placeholder for future resource cleanup
  }

  private validateConfig(config: ArcaClientConfig) {
    if (!config.cuit) {
      throw new ValidationError('CUIT is required');
    }
    if (!config.serviceScopes || config.serviceScopes.length === 0) {
      throw new ValidationError('At least one service scope is required');
    }
    if (!['production', 'sandbox', 'testing', 'custom'].includes(config.environment)) {
      throw new ValidationError('Invalid environment');
    }
    if (!config.cert && !config.certPath) {
      throw new ValidationError('Certificate is required');
    }
    if (!config.key && !config.keyPath) {
      throw new ValidationError('Private key is required');
    }
  }
}
