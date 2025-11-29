import axios, { AxiosError } from 'axios';

import { RemoteServiceError } from '../errors/RemoteServiceError';
import { NetworkError } from '../errors/NetworkError';
import { parseXml } from '../utils/xml';

export interface SoapCallArgs {
  url: string;
  action?: string;
  envelope: string;
  timeoutMs?: number;
  headers?: Record<string, string>;
}

export interface SoapCallResult<TBody = unknown> {
  rawRequest: string;
  rawResponse: string;
  body: TBody;
}

export class SoapClient {
  static async call<TBody = unknown>(args: SoapCallArgs): Promise<SoapCallResult<TBody>> {
    const { url, action, envelope, timeoutMs, headers } = args;
    const finalHeaders: Record<string, string> = {
      'Content-Type': 'text/xml; charset=utf-8',
      SOAPAction: action || '',
      ...headers
    };

    try {
      const response = await axios.post(url, envelope, {
        headers: finalHeaders,
        timeout: timeoutMs
      });

      const rawResponse = typeof response.data === 'string' ? response.data : String(response.data);
      const parsed = parseXml<{ Envelope?: { Body?: any } }>(rawResponse);
      const fault = parsed?.Envelope?.Body?.Fault;
      if (fault) {
        const faultString = fault.faultstring || fault.faultcode || 'SOAP Fault';
        throw new RemoteServiceError(faultString, undefined, fault);
      }

      return {
        rawRequest: envelope,
        rawResponse,
        body: parsed?.Envelope?.Body as TBody
      };
    } catch (error) {
      if (error instanceof RemoteServiceError) {
        throw error;
      }

      if (axios.isAxiosError(error)) {
        const err = error as AxiosError;
        throw new NetworkError(
          `SOAP call failed: ${err.message}`,
          { url, status: err.response?.status },
          err
        );
      }

      throw new NetworkError('Unexpected SOAP client error', { url }, error as Error);
    }
  }
}
