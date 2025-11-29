export type EnvironmentName = 'production' | 'sandbox' | 'testing' | 'custom';

export interface ServiceUrls {
  authUrl: string;
  wsfeUrl: string;
}

const DEFAULT_ENVIRONMENTS: Record<Exclude<EnvironmentName, 'custom'>, ServiceUrls> = {
  production: {
    authUrl: process.env.ARCA_PROD_AUTH_URL || 'https://arca.afip.gob.ar/ws/services/LoginCms',
    wsfeUrl: process.env.ARCA_PROD_WSFE_URL || 'https://arca.afip.gob.ar/ws/services/fe'
  },
  sandbox: {
    authUrl: process.env.ARCA_SANDBOX_AUTH_URL || 'https://wsaahomo.afip.gov.ar/ws/services/LoginCms',
    wsfeUrl: process.env.ARCA_SANDBOX_WSFE_URL || 'https://wswhomo.afip.gov.ar/wsfev1/service.asmx'
  },
  testing: {
    authUrl: process.env.ARCA_TEST_AUTH_URL || 'https://test.afip.gob.ar/ws/services/LoginCms',
    wsfeUrl: process.env.ARCA_TEST_WSFE_URL || 'https://test.afip.gob.ar/wsfev1/service.asmx'
  }
};

export const resolveEnvironment = (
  environment: EnvironmentName,
  overrides?: Partial<ServiceUrls>
): ServiceUrls => {
  if (environment === 'custom') {
    if (!overrides?.authUrl || !overrides?.wsfeUrl) {
      throw new Error('Custom environment requires authUrl and wsfeUrl');
    }
    return overrides as ServiceUrls;
  }

  const base = DEFAULT_ENVIRONMENTS[environment];
  return {
    authUrl: overrides?.authUrl || base.authUrl,
    wsfeUrl: overrides?.wsfeUrl || base.wsfeUrl
  };
};
