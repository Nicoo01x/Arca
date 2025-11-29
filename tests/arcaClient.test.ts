import { describe, expect, it } from 'vitest';

import { ArcaClient } from '../src/core/ArcaClient';
import { ValidationError } from '../src/errors/ValidationError';

describe('ArcaClient', () => {
  it('initializes invoice client when scope present', () => {
    const client = new ArcaClient({
      cuit: '20123456789',
      serviceScopes: ['wsfe'],
      cert: 'CERT',
      key: 'KEY',
      environment: 'sandbox'
    });
    expect(client.invoice).toBeDefined();
  });

  it('throws on missing cuit', () => {
    expect(
      () =>
        new ArcaClient({
          cuit: '',
          serviceScopes: ['wsfe'],
          cert: 'CERT',
          key: 'KEY',
          environment: 'sandbox'
        })
    ).toThrow(ValidationError);
  });
});
