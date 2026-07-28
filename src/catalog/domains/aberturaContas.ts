import {
  AccountConfigWebhookResponseSchema,
  AccountDeleteWebhookParamsSchema,
  AccountDeleteWebhookResponseSchema,
  AccountDetailWebhookParamsSchema,
  AccountDetailWebhookResponseSchema,
  AccountListWebhookParamsSchema,
  AccountListWebhookResponseSchema,
  AccountWebhookBodySchema,
  CreateAccountBodySchema,
  CreateAccountCertificateParamsSchema,
  CreateAccountCertificateResponseSchema,
  CreateAccountResponseSchema,
  GetAccountCredentialsParamsSchema,
  GetAccountCredentialsResponseSchema,
} from 'sdk-node-apis-efi';
import { createDomainBuilders } from '../types.js';

const { body, params } = createDomainBuilders('abertura-contas');

export const ABERTURA_CONTAS_DEFINITIONS = [
  body({
    method: 'createAccount',
    httpMethod: 'post',
    route: '/conta-simplificada',
    bodySchema: CreateAccountBodySchema,
    responseSchema: CreateAccountResponseSchema,
  }),
  params({
    method: 'createAccountCertificate',
    httpMethod: 'post',
    route: '/conta-simplificada/:idContaSimplificada/certificado',
    paramsSchema: CreateAccountCertificateParamsSchema,
    responseSchema: CreateAccountCertificateResponseSchema,
  }),
  params({
    method: 'getAccountCredentials',
    httpMethod: 'get',
    route: '/conta-simplificada/:idContaSimplificada/credenciais',
    paramsSchema: GetAccountCredentialsParamsSchema,
    responseSchema: GetAccountCredentialsResponseSchema,
  }),
  body({
    method: 'accountConfigWebhook',
    httpMethod: 'post',
    route: '/webhook',
    bodySchema: AccountWebhookBodySchema,
    responseSchema: AccountConfigWebhookResponseSchema,
  }),
  params({
    method: 'accountDeleteWebhook',
    httpMethod: 'delete',
    route: '/webhook/:identificadorWebhook',
    paramsSchema: AccountDeleteWebhookParamsSchema,
    responseSchema: AccountDeleteWebhookResponseSchema,
    responseKind: 'void',
  }),
  params({
    method: 'accountDetailWebhook',
    httpMethod: 'get',
    route: '/webhook/:identificadorWebhook',
    paramsSchema: AccountDetailWebhookParamsSchema,
    responseSchema: AccountDetailWebhookResponseSchema,
  }),
  params({
    method: 'accountListWebhook',
    httpMethod: 'get',
    route: '/webhooks',
    paramsSchema: AccountListWebhookParamsSchema,
    responseSchema: AccountListWebhookResponseSchema,
  }),
] as const;
