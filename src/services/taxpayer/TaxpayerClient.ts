import { ArcaAuthClient } from '../../auth/ArcaAuthClient';
import { SoapClient } from '../../core/SoapClient';
import { RemoteServiceError } from '../../errors/RemoteServiceError';
import { ValidationError } from '../../errors/ValidationError';

export interface TaxpayerClientOptions {
  url: string;
  cuit: string;
  timeoutMs?: number;
}

export interface TaxpayerDetails {
  cuit: string;
  name: string;
  address?: string;
  postalCode?: string;
  province?: string;
  ivaCondition?: string;
}

export class TaxpayerClient {
  private readonly authClient: ArcaAuthClient;
  private readonly url: string;
  private readonly cuit: string;
  private readonly timeoutMs?: number;

  constructor(authClient: ArcaAuthClient, options: TaxpayerClientOptions) {
    this.authClient = authClient;
    this.url = options.url;
    this.cuit = options.cuit;
    this.timeoutMs = options.timeoutMs;
  }

  async getByCuit(targetCuit: string): Promise<TaxpayerDetails> {
    if (!targetCuit) {
      throw new ValidationError('CUIT is required to query taxpayer');
    }
    const { token, sign } = await this.authClient.getValidToken('wsfe');
    const envelope = this.buildEnvelope(
      `
<ser:token>${this.escape(token)}</ser:token>
<ser:sign>${this.escape(sign)}</ser:sign>
<ser:cuitRepresentada>${this.cuit}</ser:cuitRepresentada>
<ser:idPersona>${targetCuit}</ser:idPersona>
`.trim()
    );

    const { body } = await SoapClient.call<{
      personaResponse?: {
        personaReturn?: {
          persona?: {
            idPersona?: string;
            nombre?: string;
            domicilioFiscal?: {
              direccion?: string;
              codPostal?: string;
              idProvincia?: string;
            };
            caracterizacion?: Array<{ idCaracterizacion?: string; descripcion?: string }>;
          };
        };
        faultstring?: string;
      };
    }>({
      url: this.url,
      envelope,
      action: 'getPersona',
      timeoutMs: this.timeoutMs,
      headers: { SOAPAction: 'getPersona' }
    });

    const resp = body?.personaResponse;
    if (resp?.faultstring) {
      throw new RemoteServiceError('Padron lookup failed', [{ message: resp.faultstring }], {
        body
      });
    }

    const persona = resp?.personaReturn?.persona;
    if (!persona?.idPersona || !persona?.nombre) {
      throw new RemoteServiceError('Invalid padron response', undefined, { body });
    }

    const ivaCondition =
      persona.caracterizacion?.find((c) => c.descripcion)?.descripcion || undefined;
    const address = persona.domicilioFiscal?.direccion;

    return {
      cuit: String(persona.idPersona),
      name: persona.nombre,
      address,
      postalCode: persona.domicilioFiscal?.codPostal,
      province: persona.domicilioFiscal?.idProvincia,
      ivaCondition
    };
  }

  private buildEnvelope(inner: string): string {
    return `
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ser="http://persona.ws.servicios.afip.gov.ar/">
  <soapenv:Header/>
  <soapenv:Body>
    <ser:getPersona>
      ${inner}
    </ser:getPersona>
  </soapenv:Body>
</soapenv:Envelope>`.trim();
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
