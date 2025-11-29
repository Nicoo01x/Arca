// Public entry point for ARCA SDK authored by Nicolás Cabanillas
export { ArcaClient, type ArcaClientConfig } from './core/ArcaClient';
export { SoapClient } from './core/SoapClient';
export { ArcaAuthClient } from './auth/ArcaAuthClient';
export { type AuthToken } from './auth/types';
export { ElectronicInvoiceClient } from './services/wsfe/ElectronicInvoiceClient';
export * from './services/wsfe/types';
export { TaxpayerClient, type TaxpayerDetails } from './services/taxpayer/TaxpayerClient';
export * from './errors/ArcaError';
export * from './errors/AuthError';
export * from './errors/NetworkError';
export * from './errors/RemoteServiceError';
export * from './errors/ValidationError';
export { resolveEnvironment, type EnvironmentName } from './config/env';
