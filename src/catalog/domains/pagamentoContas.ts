import {
  PayConfigWebhookResponseSchema,
  PayDeleteWebhookBodySchema,
  PayDetailBarCodeParamsSchema,
  PayDetailBarCodeResponseSchema,
  PayDetailPaymentParamsSchema,
  PayDetailPaymentResponseSchema,
  PayListPaymentsParamsSchema,
  PayListPaymentsResponseSchema,
  PayListWebhookParamsSchema,
  PayListWebhookResponseSchema,
  PayRequestBarCodeBodySchema,
  PayRequestBarCodeParamsSchema,
  PayRequestBarCodeResponseSchema,
  PayWebhookBodySchema,
} from 'sdk-node-apis-efi';
import { createDomainBuilders } from '../types.js';

const { body, params, paramsBody } = createDomainBuilders('pagamento-contas');

export const PAGAMENTO_CONTAS_DEFINITIONS = [
  params({
    method: 'payDetailBarCode',
    httpMethod: 'get',
    route: '/codBarras/:codBarras',
    paramsSchema: PayDetailBarCodeParamsSchema,
    responseSchema: PayDetailBarCodeResponseSchema,
  }),
  paramsBody({
    method: 'payRequestBarCode',
    httpMethod: 'post',
    route: '/codBarras/:codBarras',
    paramsSchema: PayRequestBarCodeParamsSchema,
    bodySchema: PayRequestBarCodeBodySchema,
    responseSchema: PayRequestBarCodeResponseSchema,
  }),
  params({
    method: 'payDetailPayment',
    httpMethod: 'get',
    route: '/:idPagamento',
    paramsSchema: PayDetailPaymentParamsSchema,
    responseSchema: PayDetailPaymentResponseSchema,
  }),
  params({
    method: 'payListPayments',
    httpMethod: 'get',
    route: '/resumo',
    paramsSchema: PayListPaymentsParamsSchema,
    responseSchema: PayListPaymentsResponseSchema,
  }),
  body({
    method: 'payConfigWebhook',
    httpMethod: 'put',
    route: '/webhook',
    bodySchema: PayWebhookBodySchema,
    responseSchema: PayConfigWebhookResponseSchema,
  }),
  params({
    method: 'payListWebhook',
    httpMethod: 'get',
    route: '/webhook',
    paramsSchema: PayListWebhookParamsSchema,
    responseSchema: PayListWebhookResponseSchema,
  }),
  body({
    method: 'payDeleteWebhook',
    httpMethod: 'delete',
    route: '/webhook',
    bodySchema: PayDeleteWebhookBodySchema,
    responseKind: 'void',
  }),
] as const;
