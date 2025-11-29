export interface InvoiceItem {
  description: string;
  quantity: number;
  unitPrice: number;
  ivaAliquot: number;
  ivaAmount?: number;
}

export interface InvoiceTotals {
  netAmount: number;
  ivaAmount: number;
  totalAmount: number;
}

export interface InvoiceRequest {
  pointOfSale: number;
  voucherType: number;
  concept: number;
  customerDocumentType: number;
  customerDocumentNumber: string;
  issueDate: string;
  currency: string;
  currencyRate: number;
  items: InvoiceItem[];
  totals: InvoiceTotals;
  observations?: string[];
  voucherNumber?: number;
}

export interface InvoiceResponse {
  cae: string;
  caeExpiration: string;
  voucherNumber: number;
  observations?: string[];
}

export interface ServerStatus {
  appServer: string;
  dbServer: string;
  authServer: string;
}

export interface LastVoucherParams {
  pointOfSale: number;
  voucherType: number;
}

export interface GetInvoiceParams extends LastVoucherParams {
  number: number;
}
