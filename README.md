# @nicoo01x/arca-sdk

Node.js + TypeScript SDK to interact with ARCA (formerly AFIP) web services. It wraps the WSAA authentication flow and WSFE electronic invoicing behind a clean, promise-based API while hiding SOAP/XML complexity.

> This library was created and is maintained by **Nicolás Cabanillas**.

## Features
- WSAA-style authentication with X.509 certificates (PKCS#7/CMS signing).
- Electronic invoicing (WSFE) helpers to check status, fetch last voucher, create and query invoices.
- Taxpayer lookup (Padrón) to obtener datos básicos de contribuyentes por CUIT.
- Strong TypeScript typings, clear error classes, and pluggable hooks.
- ESM + CJS builds, Node.js 18+.

## Installation
```bash
npm install @nicolascabanillas/arca-sdk
```

## Quick start (TypeScript)
```ts
import { ArcaClient } from '@nicoo01x/arca-sdk';

const client = new ArcaClient({
  cuit: '20-12345678-3',
  serviceScopes: ['wsfe', 'padron'],
  cert: process.env.ARCA_CERT_PEM!,   // or certPath: '/path/cert.pem'
  key: process.env.ARCA_KEY_PEM!,     // or keyPath: '/path/key.pem'
  passphrase: process.env.ARCA_KEY_PASSPHRASE,
  environment: 'sandbox',
  http: {
    timeoutMs: 15000,
    maxRetries: 3
  }
});

const status = await client.invoice?.getServerStatus();
console.log(status);
```

## JavaScript (CommonJS)
```js
const { ArcaClient } = require('@nicoo01x/arca-sdk');

const client = new ArcaClient({
  cuit: '20-12345678-3',
  serviceScopes: ['wsfe'],
  certPath: process.env.ARCA_CERT_PATH,
  keyPath: process.env.ARCA_KEY_PATH,
  environment: 'sandbox'
});

client.invoice
  ?.getLastVoucherNumber({ pointOfSale: 1, voucherType: 1 })
  .then((num) => console.log(num));
```

## Creating an invoice
```ts
const invoiceRequest = {
  pointOfSale: 1,
  voucherType: 1,
  concept: 1,
  customerDocumentType: 80,
  customerDocumentNumber: '30712345678',
  issueDate: '2025-11-29',
  currency: 'PES',
  currencyRate: 1,
  items: [
    { description: 'Servicios de desarrollo', quantity: 1, unitPrice: 100000, ivaAliquot: 21 }
  ],
  totals: { netAmount: 100000, ivaAmount: 21000, totalAmount: 121000 }
};

const result = await client.invoice?.createInvoice(invoiceRequest);
console.log(result.cae, result.voucherNumber);

// Taxpayer lookup
const taxpayer = await client.taxpayer?.getByCuit('30712345678');
console.log(taxpayer?.name, taxpayer?.ivaCondition);
```

## Configuration
- **environment**: `production | sandbox | testing | custom`. Defaults hit the official SOAP endpoints (`production` -> `https://wsaa.afip.gov.ar/ws/services/LoginCms`, `https://servicios1.afip.gov.ar/wsfev1/service.asmx`, `https://aws.afip.gov.ar/sr-padron/webservices/personaServiceA`; `sandbox`/`testing` -> homologation hosts `wsaahomo/wswhomo/awshomo`). Override via `urls` or env vars (`ARCA_*_URL`) to point elsewhere.
- **cert/key**: pass PEM strings (`cert`, `key`) or filesystem paths (`certPath`, `keyPath`). Keep secrets outside source control.
- **http**: `timeoutMs`, `maxRetries`, `baseDelayMs` for exponential backoff.
- **hooks**: `onRequest`, `onResponse`, `onError` receive metadata for logging without exposing private keys.

## Error handling
- `ValidationError` for missing/invalid inputs.
- `AuthError` for WSAA failures.
- `NetworkError` for connectivity/timeouts.
- `RemoteServiceError` for SOAP faults or service-level errors (includes remote error list when available).

## Development
```bash
npm install
npm run lint
npm run test
npm run build
```

## Testing with mocks
Unit tests mock SOAP responses so you can run them without ARCA connectivity:
```bash
npm run test
```

## About the author
This library was created and is maintained by **Nicolás Cabanillas** to simplify integration with ARCA (formerly AFIP) in Node.js projects.
