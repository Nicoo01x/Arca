import { describe, expect, it, vi, beforeEach } from 'vitest';

import { ElectronicInvoiceClient } from '../src/services/wsfe/ElectronicInvoiceClient';
import { SoapClient } from '../src/core/SoapClient';
import { RemoteServiceError } from '../src/errors/RemoteServiceError';
import type { InvoiceRequest } from '../src/services/wsfe/types';

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

const baseInvoice: InvoiceRequest = {
  pointOfSale: 1,
  voucherType: 1,
  concept: 1,
  customerDocumentType: 80,
  customerDocumentNumber: '20123456789',
  issueDate: '2025-01-01',
  currency: 'PES',
  currencyRate: 1,
  items: [
    {
      description: 'Test item',
      quantity: 1,
      unitPrice: 100,
      ivaAliquot: 21
    }
  ],
  totals: {
    netAmount: 100,
    ivaAmount: 21,
    totalAmount: 121
  }
};

describe('ElectronicInvoiceClient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthClient.getValidToken.mockClear();
  });

  it('creates invoice successfully', async () => {
    vi.spyOn(SoapClient, 'call')
      .mockResolvedValueOnce({
        rawRequest: '',
        rawResponse: '',
        body: {
          FECompUltimoAutorizadoResponse: {
            FECompUltimoAutorizadoResult: { CbteNro: 10 }
          }
        }
      })
      .mockResolvedValueOnce({
        rawRequest: '',
        rawResponse: '',
        body: {
          FECAESolicitarResponse: {
            FECAESolicitarResult: {
              FeDetResp: {
                FECAEDetResponse: {
                  CAE: '123',
                  CAEFchVto: '20250131',
                  CbteDesde: 11
                }
              }
            }
          }
        }
      });

    const client = new ElectronicInvoiceClient(mockAuthClient, {
      url: 'https://example.com/wsfe',
      cuit: '20123456789'
    });

    const response = await client.createInvoice(baseInvoice);
    expect(response.cae).toBe('123');
    expect(response.voucherNumber).toBe(11);
    expect(SoapClient.call).toHaveBeenCalledTimes(2);
  });

  it('maps service errors', async () => {
    vi.spyOn(SoapClient, 'call')
      .mockResolvedValueOnce({
        rawRequest: '',
        rawResponse: '',
        body: {
          FECompUltimoAutorizadoResponse: {
            FECompUltimoAutorizadoResult: { CbteNro: 10 }
          }
        }
      })
      .mockResolvedValueOnce({
        rawRequest: '',
        rawResponse: '',
        body: {
          FECAESolicitarResponse: {
            FECAESolicitarResult: {
              Errors: {
                Err: [{ Code: '100', Msg: 'Invalid data' }]
              }
            }
          }
        }
      });

    const client = new ElectronicInvoiceClient(mockAuthClient, {
      url: 'https://example.com/wsfe',
      cuit: '20123456789'
    });

    await expect(client.createInvoice(baseInvoice)).rejects.toBeInstanceOf(RemoteServiceError);
  });
});
