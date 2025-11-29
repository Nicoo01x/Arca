import { describe, expect, it, vi } from 'vitest';

import { TaxpayerClient } from '../src/services/taxpayer/TaxpayerClient';
import { SoapClient } from '../src/core/SoapClient';
import { RemoteServiceError } from '../src/errors/RemoteServiceError';

const futureDate = new Date(Date.now() + 60_000);

const mockAuthClient = {
  getValidToken: vi.fn().mockResolvedValue({
    token: 'token',
    sign: 'sign',
    expirationTime: futureDate,
    generatedAt: new Date(),
    service: 'wsfe'
  })
} as any;

describe('TaxpayerClient', () => {
  it('returns taxpayer details', async () => {
    vi.spyOn(SoapClient, 'call').mockResolvedValue({
      rawRequest: '',
      rawResponse: '',
      body: {
        personaResponse: {
          personaReturn: {
            persona: {
              idPersona: '20123456789',
              nombre: 'Test SA',
              domicilioFiscal: { direccion: 'Calle 123', codPostal: '1000', idProvincia: '01' },
              caracterizacion: [{ descripcion: 'Responsable Inscripto' }]
            }
          }
        }
      }
    });

    const client = new TaxpayerClient(mockAuthClient, {
      url: 'https://example.com/padron',
      cuit: '20123456789'
    });

    const data = await client.getByCuit('20123456789');
    expect(data.name).toBe('Test SA');
    expect(data.ivaCondition).toBe('Responsable Inscripto');
  });

  it('maps faults to RemoteServiceError', async () => {
    vi.spyOn(SoapClient, 'call').mockResolvedValue({
      rawRequest: '',
      rawResponse: '',
      body: {
        personaResponse: {
          faultstring: 'CUIT inválido'
        }
      }
    });

    const client = new TaxpayerClient(mockAuthClient, {
      url: 'https://example.com/padron',
      cuit: '20123456789'
    });

    await expect(client.getByCuit('x')).rejects.toBeInstanceOf(RemoteServiceError);
  });
});
