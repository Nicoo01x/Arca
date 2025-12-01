import { describe, expect, it, vi, beforeEach } from 'vitest';

import { ArcaAuthClient } from '../src/auth/ArcaAuthClient';
import { SoapClient } from '../src/core/SoapClient';
import { AuthError } from '../src/errors/AuthError';

const dummyCredentials = {
  cert: `-----BEGIN CERTIFICATE-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAv
-----END CERTIFICATE-----`,
  key: `-----BEGIN PRIVATE KEY-----
MIIBVgIBADANBgkqhkiG9w0BAQEFAASCAT8wggE7AgEAAk
-----END PRIVATE KEY-----`
};

describe('ArcaAuthClient', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('parses login response and caches token', async () => {
    const authClient = new ArcaAuthClient(
      dummyCredentials,
      {
        cuit: '20123456789',
        service: 'wsaa',
        urls: {
          authUrl: 'https://wsaa.afip.gov.ar/ws/services/LoginCms',
          wsfeUrl: 'https://servicios1.afip.gov.ar/wsfev1/service.asmx'
        }
      },
      undefined
    );

    vi.spyOn(authClient as any, 'signLoginRequest').mockReturnValue('signedCms');
    vi.spyOn(SoapClient, 'call').mockResolvedValue({
      rawRequest: '',
      rawResponse: '',
      body: {
        loginCmsResponse: {
          loginCmsReturn: `
<loginTicketResponse>
  <header>
    <expirationTime>2099-01-01T00:00:00Z</expirationTime>
    <generationTime>2098-12-31T00:00:00Z</generationTime>
  </header>
  <credentials>
    <token>token123</token>
    <sign>sign123</sign>
  </credentials>
</loginTicketResponse>`
        }
      }
    });

    const token = await authClient.getValidToken('wsfe');
    expect(token.token).toBe('token123');
    expect(token.sign).toBe('sign123');

    // Second call should hit cache
    const token2 = await authClient.getValidToken('wsfe');
    expect(token2).toBe(token);
    expect(SoapClient.call).toHaveBeenCalledTimes(1);
  });

  it('throws AuthError on missing return', async () => {
    const authClient = new ArcaAuthClient(dummyCredentials, {
      cuit: '20123456789',
      service: 'wsaa',
      urls: {
        authUrl: 'https://wsaa.afip.gov.ar/ws/services/LoginCms',
        wsfeUrl: 'https://servicios1.afip.gov.ar/wsfev1/service.asmx'
      }
    });

    vi.spyOn(authClient as any, 'signLoginRequest').mockReturnValue('signedCms');
    vi.spyOn(SoapClient, 'call').mockResolvedValue({
      rawRequest: '',
      rawResponse: '',
      body: {}
    });

    await expect(authClient.login('wsfe')).rejects.toBeInstanceOf(AuthError);
  });
});
