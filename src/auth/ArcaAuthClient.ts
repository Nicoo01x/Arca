import fs from 'fs';
import path from 'path';
import forge from 'node-forge';

import type { ServiceUrls } from '../config/env';
import { SoapClient } from '../core/SoapClient';
import { AuthError } from '../errors/AuthError';
import { ValidationError } from '../errors/ValidationError';
import { addMinutes, isExpired, toWsTimestamp } from '../utils/time';
import { parseXml } from '../utils/xml';
import { withRetry } from '../utils/retry';
import type { AuthClientOptions, AuthToken, CertificateCredentials } from './types';

export interface AuthHooks {
  onRequest?: (meta: Record<string, unknown>) => void;
  onResponse?: (meta: Record<string, unknown>) => void;
  onError?: (error: Error, meta: Record<string, unknown>) => void;
}

export class ArcaAuthClient {
  private readonly credentials: CertificateCredentials;
  private readonly options: AuthClientOptions;
  private readonly urls: ServiceUrls;
  private readonly tokenCache = new Map<string, AuthToken>();
  private readonly hooks?: AuthHooks;

  constructor(credentials: CertificateCredentials, options: AuthClientOptions, hooks?: AuthHooks) {
    this.credentials = credentials;
    this.options = options;
    this.urls = options.urls;
    this.hooks = hooks;
  }

  async getValidToken(service: string): Promise<AuthToken> {
    const cached = this.tokenCache.get(service);
    if (cached && !isExpired(cached.expirationTime)) {
      return cached;
    }

    const token = await this.login(service);
    this.tokenCache.set(service, token);
    return token;
  }

  async login(service: string): Promise<AuthToken> {
    if (!service) {
      throw new ValidationError('Service name is required for authentication');
    }

    const meta: Record<string, unknown> = { service };
    this.hooks?.onRequest?.(meta);

    try {
      const ltr = this.buildLoginTicketRequest(service);
      const signedCms = this.signLoginRequest(ltr);
      const envelope = this.buildLoginEnvelope(signedCms);
      const call = async () =>
        SoapClient.call<{ loginCmsResponse?: { loginCmsReturn?: string } }>({
          url: this.urls.authUrl,
          action: 'loginCms',
          envelope,
          timeoutMs: this.options.httpTimeoutMs
        });

      const { body, rawResponse } = await withRetry(call, {
        maxRetries: this.options.retry?.maxRetries ?? 0,
        baseDelayMs: this.options.retry?.baseDelayMs ?? 250,
        shouldRetry: (error) => !(error instanceof AuthError)
      });

      const loginCmsReturn =
        body?.loginCmsResponse?.loginCmsReturn || (body as any)?.loginCmsReturn;
      if (!loginCmsReturn) {
        throw new AuthError('Auth response did not include loginCmsReturn', { body });
      }

      const ticket = parseXml<{
        loginTicketResponse?: {
          header?: { expirationTime?: string; generationTime?: string };
          credentials?: { token: string; sign: string };
        };
      }>(loginCmsReturn);

      const ltrResponse = ticket.loginTicketResponse;
      if (!ltrResponse?.credentials?.token || !ltrResponse.credentials.sign) {
        throw new AuthError('Missing token or signature in auth response');
      }

      const expirationTime = new Date(ltrResponse.header?.expirationTime || 0);
      const generatedAt = new Date(ltrResponse.header?.generationTime || Date.now());

      const authToken: AuthToken = {
        token: ltrResponse.credentials.token,
        sign: ltrResponse.credentials.sign,
        expirationTime,
        generatedAt,
        service
      };

      this.hooks?.onResponse?.({ ...meta, rawResponse });
      return authToken;
    } catch (error) {
      this.hooks?.onError?.(error as Error, meta);
      if (error instanceof AuthError) {
        throw error;
      }
      throw new AuthError('Authentication failed', undefined, error as Error);
    }
  }

  private buildLoginTicketRequest(service: string): string {
    const now = new Date();
    const uniqueId = Math.floor(now.getTime() / 1000);
    const generationTime = toWsTimestamp(addMinutes(now, -5));
    const expirationTime = toWsTimestamp(addMinutes(now, 30));

    return `
<loginTicketRequest version="1.0">
  <header>
    <uniqueId>${uniqueId}</uniqueId>
    <generationTime>${generationTime}</generationTime>
    <expirationTime>${expirationTime}</expirationTime>
  </header>
  <service>${service}</service>
</loginTicketRequest>`.trim();
  }

  private signLoginRequest(xml: string): string {
    const { certPEM, keyPEM, passphrase } = this.loadCredentials();
    const cert = forge.pki.certificateFromPem(certPEM);
    const privateKey = passphrase
      ? forge.pki.decryptRsaPrivateKey(keyPEM, passphrase)
      : forge.pki.privateKeyFromPem(keyPEM);

    if (!privateKey) {
      throw new ValidationError('Unable to load private key with given passphrase');
    }

    const p7 = forge.pkcs7.createSignedData();
    p7.content = forge.util.createBuffer(xml, 'utf8');
    p7.addCertificate(cert);
    p7.addSigner({
      key: privateKey,
      certificate: cert,
      digestAlgorithm: forge.pki.oids.sha256
    });
    p7.sign({ detached: true });

    const der = forge.asn1.toDer(p7.toAsn1()).getBytes();
    return Buffer.from(der, 'binary').toString('base64');
  }

  private loadCredentials(): { certPEM: string; keyPEM: string; passphrase?: string } {
    const { cert, key, passphrase, certPath, keyPath } = this.credentials;
    const certPEM = cert || (certPath ? fs.readFileSync(path.resolve(certPath), 'utf8') : undefined);
    const keyPEM = key || (keyPath ? fs.readFileSync(path.resolve(keyPath), 'utf8') : undefined);

    if (!certPEM || !keyPEM) {
      throw new ValidationError('Certificate and private key are required');
    }

    return { certPEM, keyPEM, passphrase };
  }

  private buildLoginEnvelope(signedCms: string): string {
    return `
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:wsaa="http://wsaa.view.sua.dvadac.desein.afip.gov">
  <soapenv:Header/>
  <soapenv:Body>
    <wsaa:loginCms>
      <wsaa:in0>${signedCms}</wsaa:in0>
    </wsaa:loginCms>
  </soapenv:Body>
</soapenv:Envelope>`.trim();
  }
}
