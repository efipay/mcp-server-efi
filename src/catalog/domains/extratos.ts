import {
  CreateSftpKeyResponseSchema,
  CreateStatementRecurrencyBodySchema,
  CreateStatementRecurrencyResponseSchema,
  GetStatementFileParamsSchema,
  GetStatementFileResponseSchema,
  ListStatementFilesResponseSchema,
  ListStatementRecurrencesResponseSchema,
  UpdateStatementRecurrencyBodySchema,
  UpdateStatementRecurrencyParamsSchema,
  UpdateStatementRecurrencyResponseSchema,
} from 'sdk-node-apis-efi';
import { createDomainBuilders } from '../types.js';

const { noInput, body, params, paramsBody } = createDomainBuilders('extratos');

export const EXTRATOS_DEFINITIONS = [
  noInput({
    method: 'listStatementFiles',
    httpMethod: 'get',
    route: '/extrato-cnab/arquivos',
    responseSchema: ListStatementFilesResponseSchema,
  }),
  params({
    method: 'getStatementFile',
    httpMethod: 'get',
    route: '/extrato-cnab/download/:nome_arquivo',
    paramsSchema: GetStatementFileParamsSchema,
    responseSchema: GetStatementFileResponseSchema,
  }),
  noInput({
    method: 'listStatementRecurrences',
    httpMethod: 'get',
    route: '/extrato-cnab/agendamentos',
    responseSchema: ListStatementRecurrencesResponseSchema,
  }),
  body({
    method: 'createStatementRecurrency',
    httpMethod: 'post',
    route: '/extrato-cnab/agendar',
    bodySchema: CreateStatementRecurrencyBodySchema,
    responseSchema: CreateStatementRecurrencyResponseSchema,
  }),
  paramsBody({
    method: 'updateStatementRecurrency',
    httpMethod: 'patch',
    route: '/extrato-cnab/agendar/:identificador',
    paramsSchema: UpdateStatementRecurrencyParamsSchema,
    bodySchema: UpdateStatementRecurrencyBodySchema,
    responseSchema: UpdateStatementRecurrencyResponseSchema,
  }),
  noInput({
    method: 'createSftpKey',
    httpMethod: 'post',
    route: '/extrato-cnab/gerar-chaves',
    responseSchema: CreateSftpKeyResponseSchema,
  }),
] as const;
