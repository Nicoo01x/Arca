export type EnvironmentName = 'production' | 'sandbox' | 'testing' | 'custom';

export interface ServiceUrls {
  authUrl: string;
  wsfeUrl: string;
  padronUrl: string;
}

const DEFAULT_ENVIRONMENTS: Record<Exclude<EnvironmentName, 'custom'>, ServiceUrls> = {
  production: {
    authUrl: process.env.ARCA_PROD_AUTH_URL || 'https://arca.afip.gob.ar/ws/services/LoginCms',
    wsfeUrl: process.env.ARCA_PROD_WSFE_URL || 'https://arca.afip.gob.ar/ws/services/fe',
    padronUrl: process.env.ARCA_PROD_PADRON_URL || 'https://aws.afip.gov.ar/sr-padron/webservices/personaServiceA'
  },
  sandbox: {
    authUrl: process.env.ARCA_SANDBOX_AUTH_URL || 'https://wsaahomo.afip.gov.ar/ws/services/LoginCms',
    wsfeUrl: process.env.ARCA_SANDBOX_WSFE_URL || 'https://wswhomo.afip.gov.ar/wsfev1/service.asmx',
    padronUrl: process.env.ARCA_SANDBOX_PADRON_URL || 'https://awshomo.afip.gov.ar/sr-padron/webservices/personaServiceA'
  },
  testing: {
    authUrl: process.env.ARCA_TEST_AUTH_URL || 'https://test.afip.gob.ar/ws/services/LoginCms',
    wsfeUrl: process.env.ARCA_TEST_WSFE_URL || 'https://test.afip.gob.ar/wsfev1/service.asmx',
    padronUrl: process.env.ARCA_TEST_PADRON_URL || 'https://test.afip.gob.ar/sr-padron/webservices/personaServiceA'
  }
};

export const resolveEnvironment = (
  environment: EnvironmentName,
  overrides?: Partial<ServiceUrls>
): ServiceUrls => {
  if (environment === 'custom') {
    if (!overrides?.authUrl || !overrides?.wsfeUrl || !overrides?.padronUrl) {
      throw new Error('Custom environment requires authUrl, wsfeUrl and padronUrl');
    }
    return overrides as ServiceUrls;
  }

  const base = DEFAULT_ENVIRONMENTS[environment];
  return {
    authUrl: overrides?.authUrl || base.authUrl,
    wsfeUrl: overrides?.wsfeUrl || base.wsfeUrl,
    padronUrl: overrides?.padronUrl || base.padronUrl
  };
};
