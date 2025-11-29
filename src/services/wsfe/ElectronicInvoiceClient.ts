import { ArcaAuthClient } from '../../auth/ArcaAuthClient';
import { AuthHooks } from '../../auth/ArcaAuthClient';
import { SoapClient } from '../../core/SoapClient';
import { RemoteServiceError } from '../../errors/RemoteServiceError';
import { ValidationError } from '../../errors/ValidationError';
import type { InvoiceRequest, InvoiceResponse, LastVoucherParams, ServerStatus } from './types';

export interface ElectronicInvoiceClientOptions {
  url: string;
  cuit: string;
  timeoutMs?: number;
  hooks?: AuthHooks;
}

export class ElectronicInvoiceClient {
  private readonly authClient: ArcaAuthClient;
  private readonly url: string;
  private readonly cuit: string;
  private readonly timeoutMs?: number;
  private readonly hooks?: AuthHooks;

  constructor(authClient: ArcaAuthClient, options: ElectronicInvoiceClientOptions) {
    this.authClient = authClient;
    this.url = options.url;
    this.cuit = options.cuit;
    this.timeoutMs = options.timeoutMs;
    this.hooks = options.hooks;
  }

  async getServerStatus(): Promise<ServerStatus> {
    const { token, sign } = await this.authClient.getValidToken('wsfe');
    const envelope = this.buildEnvelope(
      'FEDummy',
      `<ws:Auth>${this.authHeader(token, sign)}</ws:Auth>`
    );
    const { body } = await SoapClient.call<{ FEDummyResponse?: { FEDummyResult?: any } }>({
      url: this.url,
      action: 'FEDummy',
      envelope,
      timeoutMs: this.timeoutMs
    });
    const result = body?.FEDummyResponse?.FEDummyResult;
    return {
      appServer: result?.AppServer ?? 'unknown',
      dbServer: result?.DbServer ?? 'unknown',
      authServer: result?.AuthServer ?? 'unknown'
    };
  }

  async getLastVoucherNumber(params: LastVoucherParams): Promise<number> {
    this.validateVoucherParams(params);
    const { token, sign } = await this.authClient.getValidToken('wsfe');
    const envelope = this.buildEnvelope(
      'FECompUltimoAutorizado',
      `
<ws:Auth>${this.authHeader(token, sign)}</ws:Auth>
<ws:PtoVta>${params.pointOfSale}</ws:PtoVta>
<ws:CbteTipo>${params.voucherType}</ws:CbteTipo>
`.trim()
    );

    const { body } = await SoapClient.call<{
      FECompUltimoAutorizadoResponse?: { FECompUltimoAutorizadoResult?: { CbteNro?: number } };
    }>({
      url: this.url,
      action: 'FECompUltimoAutorizado',
      envelope,
      timeoutMs: this.timeoutMs
    });

    const number =
      body?.FECompUltimoAutorizadoResponse?.FECompUltimoAutorizadoResult?.CbteNro;
    if (typeof number !== 'number') {
      throw new RemoteServiceError('Invalid FECompUltimoAutorizado response', undefined, { body });
    }
    return number;
  }

  async createInvoice(invoice: InvoiceRequest): Promise<InvoiceResponse> {
    this.validateInvoice(invoice);
    const { token, sign } = await this.authClient.getValidToken('wsfe');
    const voucherNumber =
      invoice.voucherNumber !== undefined
        ? invoice.voucherNumber
        : (await this.getLastVoucherNumber({
            pointOfSale: invoice.pointOfSale,
            voucherType: invoice.voucherType
          })) + 1;

    const ivaElements = invoice.items
      .map((item, index) => {
        const ivaAmount =
          item.ivaAmount ??
          Number((item.quantity * item.unitPrice * (item.ivaAliquot / 100)).toFixed(2));
        return `
  <ws:AlicIva>
    <ws:Id>${this.ivaIdFromAliquot(item.ivaAliquot)}</ws:Id>
    <ws:BaseImp>${(item.quantity * item.unitPrice).toFixed(2)}</ws:BaseImp>
    <ws:Importe>${ivaAmount.toFixed(2)}</ws:Importe>
  </ws:AlicIva>
`.trim();
      })
      .join('');

    const detail = `
<ws:FECAEDetRequest>
  <ws:Concepto>${invoice.concept}</ws:Concepto>
  <ws:DocTipo>${invoice.customerDocumentType}</ws:DocTipo>
  <ws:DocNro>${invoice.customerDocumentNumber}</ws:DocNro>
  <ws:CbteDesde>${voucherNumber}</ws:CbteDesde>
  <ws:CbteHasta>${voucherNumber}</ws:CbteHasta>
  <ws:CbteFch>${invoice.issueDate.replace(/-/g, '')}</ws:CbteFch>
  <ws:ImpTotal>${invoice.totals.totalAmount.toFixed(2)}</ws:ImpTotal>
  <ws:ImpTotConc>0</ws:ImpTotConc>
  <ws:ImpNeto>${invoice.totals.netAmount.toFixed(2)}</ws:ImpNeto>
  <ws:ImpOpEx>0</ws:ImpOpEx>
  <ws:ImpIVA>${invoice.totals.ivaAmount.toFixed(2)}</ws:ImpIVA>
  <ws:ImpTrib>0</ws:ImpTrib>
  <ws:MonId>${invoice.currency}</ws:MonId>
  <ws:MonCotiz>${invoice.currencyRate}</ws:MonCotiz>
  <ws:Iva>${ivaElements}</ws:Iva>
</ws:FECAEDetRequest>`.trim();

    const envelope = this.buildEnvelope(
      'FECAESolicitar',
      `
<ws:FeCAEReq>
  <ws:FeCabReq>
    <ws:CantReg>1</ws:CantReg>
    <ws:PtoVta>${invoice.pointOfSale}</ws:PtoVta>
    <ws:CbteTipo>${invoice.voucherType}</ws:CbteTipo>
  </ws:FeCabReq>
  <ws:FeDetReq>
    ${detail}
  </ws:FeDetReq>
</ws:FeCAEReq>
<ws:Auth>${this.authHeader(token, sign)}</ws:Auth>
`.trim()
    );

    const { body } = await SoapClient.call<{
      FECAESolicitarResponse?: {
        FECAESolicitarResult?: {
          FeDetResp?: { FECAEDetResponse?: any };
          Errors?: { Err?: Array<{ Code: string; Msg: string }> };
        };
      };
    }>({
      url: this.url,
      action: 'FECAESolicitar',
      envelope,
      timeoutMs: this.timeoutMs
    });

    const result = body?.FECAESolicitarResponse?.FECAESolicitarResult;
    if (result?.Errors?.Err?.length) {
      const errors = result.Errors.Err.map((err) => ({
        code: String(err.Code),
        message: err.Msg
      }));
      throw new RemoteServiceError('Invoice creation failed', errors, { body });
    }

    const det = result?.FeDetResp?.FECAEDetResponse;
    if (!det?.CAE || !det?.CAEFchVto || typeof det?.CbteDesde !== 'number') {
      throw new RemoteServiceError('Invalid invoice response', undefined, { body });
    }

    return {
      cae: det.CAE,
      caeExpiration: det.CAEFchVto,
      voucherNumber: det.CbteDesde,
      observations: det.Observaciones?.Obs?.map((o: any) => o.Msg)
    };
  }

  async getInvoice(params: { pointOfSale: number; voucherType: number; number: number }) {
    this.validateVoucherParams({ pointOfSale: params.pointOfSale, voucherType: params.voucherType });
    if (params.number <= 0) {
      throw new ValidationError('Invoice number must be positive');
    }
    const { token, sign } = await this.authClient.getValidToken('wsfe');
    const envelope = this.buildEnvelope(
      'FECompConsultar',
      `
<ws:Auth>${this.authHeader(token, sign)}</ws:Auth>
<ws:FeCompConsReq>
  <ws:CbteTipo>${params.voucherType}</ws:CbteTipo>
  <ws:PtoVta>${params.pointOfSale}</ws:PtoVta>
  <ws:CbteNro>${params.number}</ws:CbteNro>
</ws:FeCompConsReq>
`.trim()
    );

    const { body } = await SoapClient.call<{
      FECompConsultarResponse?: {
        FECompConsultarResult?: {
          ResultGet?: any;
          Errors?: { Err?: Array<{ Code: string; Msg: string }> };
        };
      };
    }>({
      url: this.url,
      action: 'FECompConsultar',
      envelope,
      timeoutMs: this.timeoutMs
    });

    const result = body?.FECompConsultarResponse?.FECompConsultarResult;
    if (result?.Errors?.Err?.length) {
      const errors = result.Errors.Err.map((err) => ({ code: String(err.Code), message: err.Msg }));
      throw new RemoteServiceError('Failed to retrieve invoice', errors, { body });
    }

    const data = result?.ResultGet;
    if (!data?.CbteDesde) {
      throw new RemoteServiceError('Invalid invoice query response', undefined, { body });
    }

    return {
      cae: data.CodAutorizacion,
      caeExpiration: data.FchVto,
      voucherNumber: data.CbteDesde,
      observations: data.Observaciones?.Obs?.map((o: any) => o.Msg)
    } as InvoiceResponse;
  }

  private validateVoucherParams(params: LastVoucherParams) {
    if (params.pointOfSale <= 0) {
      throw new ValidationError('pointOfSale must be positive');
    }
    if (params.voucherType <= 0) {
      throw new ValidationError('voucherType must be positive');
    }
  }

  private validateInvoice(invoice: InvoiceRequest) {
    const requiredStringFields: Array<keyof InvoiceRequest> = [
      'customerDocumentNumber',
      'issueDate',
      'currency'
    ];
    requiredStringFields.forEach((field) => {
      if (!invoice[field]) {
        throw new ValidationError(`Missing required field: ${String(field)}`);
      }
    });

    if (invoice.items.length === 0) {
      throw new ValidationError('Invoice must contain at least one item');
    }

    invoice.items.forEach((item, index) => {
      if (item.quantity <= 0 || item.unitPrice < 0) {
        throw new ValidationError(`Invalid quantity or price for item ${index + 1}`);
      }
    });

    const calculatedNet = invoice.items.reduce(
      (acc, item) => acc + item.quantity * item.unitPrice,
      0
    );
    const calculatedIva = invoice.items.reduce(
      (acc, item) => acc + item.quantity * item.unitPrice * (item.ivaAliquot / 100),
      0
    );
    const roundedNet = Number(calculatedNet.toFixed(2));
    const roundedIva = Number(calculatedIva.toFixed(2));

    if (Math.abs(roundedNet - invoice.totals.netAmount) > 0.01) {
      throw new ValidationError('Net amount does not match items total');
    }
    if (Math.abs(roundedIva - invoice.totals.ivaAmount) > 0.01) {
      throw new ValidationError('IVA amount does not match items IVA');
    }
    if (
      Math.abs(invoice.totals.totalAmount - (invoice.totals.netAmount + invoice.totals.ivaAmount)) >
      0.01
    ) {
      throw new ValidationError('Total amount must equal net plus IVA');
    }
  }

  private authHeader(token: string, sign: string): string {
    return `
<ws:Token>${this.escape(token)}</ws:Token>
<ws:Sign>${this.escape(sign)}</ws:Sign>
<ws:Cuit>${this.cuit}</ws:Cuit>
`.trim();
  }

  private buildEnvelope(action: string, innerXml: string): string {
    this.hooks?.onRequest?.({ action, innerXml });
    const envelope = `
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ws="http://ar.gov.afip.dif.FEV1/">
  <soapenv:Header/>
  <soapenv:Body>
    <ws:${action}>
      ${innerXml}
    </ws:${action}>
  </soapenv:Body>
</soapenv:Envelope>`.trim();
    return envelope;
  }

  private ivaIdFromAliquot(aliquot: number): number {
    // Basic mapping for most common aliquots
    const mapping: Record<number, number> = {
      21: 5,
      10.5: 4,
      27: 6,
      0: 3
    };
    const id = mapping[aliquot];
    if (!id) {
      throw new ValidationError(`Unsupported IVA aliquot: ${aliquot}`);
    }
    return id;
  }

  private escape(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }
}
