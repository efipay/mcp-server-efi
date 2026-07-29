import type { ToolDefinition } from './types.js';

type JsonSchema = Record<string, unknown>;
type SchemaPurpose = 'entrada' | 'saída';

const FIELD_DESCRIPTIONS: Readonly<Record<string, string>> = {
  params: 'Parâmetros de rota ou consulta exigidos pela operação.',
  body: 'Dados enviados no corpo da operação.',
  idempotency_key:
    'Chave opcional de idempotência. Quando omitida, o servidor gera uma chave para esta chamada.',
  id: 'Identificador do recurso.',
  txid: 'Identificador da cobrança Pix.',
  e2eid: 'Identificador de ponta a ponta da transação Pix.',
  rtrid: 'Identificador da transação no mecanismo de devolução.',
  idenvio: 'Identificador do envio Pix.',
  chave: 'Chave Pix associada à operação.',
  chaves: 'Conjunto de chaves Pix associado à operação.',
  pixcopiaecola: 'Código Pix Copia e Cola que será interpretado.',
  cpf: 'CPF da pessoa, contendo somente dígitos quando exigido pelo contrato.',
  cnpj: 'CNPJ da pessoa jurídica, contendo somente dígitos quando exigido pelo contrato.',
  documento: 'Documento de identificação associado à pessoa ou conta.',
  email: 'Endereço de e-mail usado pela operação.',
  celular: 'Número de telefone celular usado pela operação.',
  phone_number: 'Número de telefone usado pela operação.',
  nome: 'Nome da pessoa ou recurso.',
  name: 'Nome da pessoa ou recurso.',
  nomecompleto: 'Nome completo da pessoa.',
  corporatename: 'Razão social da pessoa jurídica.',
  razaosocial: 'Razão social da pessoa jurídica.',
  descricao: 'Descrição informada para o recurso.',
  description: 'Descrição informada para o recurso.',
  status: 'Estado atual ou estado solicitado para o recurso.',
  tipo: 'Tipo do recurso ou da operação.',
  type: 'Tipo do recurso ou da operação.',
  valor: 'Valor monetário associado à operação.',
  value: 'Valor associado à operação.',
  amount: 'Valor monetário associado à operação.',
  total: 'Valor total associado à operação.',
  percentage: 'Percentual aplicado pela operação.',
  valorperc: 'Percentual aplicado pela operação.',
  datainicial: 'Data inicial do período consultado.',
  datafinal: 'Data final do período consultado.',
  begin_date: 'Data inicial do período consultado.',
  end_date: 'Data final do período consultado.',
  datainicio: 'Data de início da vigência ou consulta.',
  datafim: 'Data de término da vigência ou consulta.',
  datavencimento: 'Data de vencimento.',
  datadevencimento: 'Data de vencimento.',
  dataagendamento: 'Data prevista para execução do pagamento.',
  datapagamento: 'Data em que o pagamento deve ser ou foi realizado.',
  expiracao: 'Prazo de expiração definido para o recurso.',
  expire_at: 'Data e hora de expiração do recurso.',
  page: 'Número da página solicitada.',
  pagina: 'Número da página solicitada.',
  offset: 'Posição inicial dos resultados na paginação.',
  limit: 'Quantidade máxima de resultados retornados.',
  customer: 'Dados do cliente associado à operação.',
  devedor: 'Dados do devedor da cobrança.',
  pagador: 'Dados da pessoa que realizará o pagamento.',
  favorecido: 'Dados do favorecido do pagamento.',
  recebedor: 'Dados do recebedor dos valores.',
  endereco: 'Endereço associado à pessoa ou operação.',
  address: 'Endereço associado à pessoa ou operação.',
  billing_address: 'Endereço de cobrança.',
  logradouro: 'Logradouro do endereço.',
  street: 'Logradouro do endereço.',
  numero: 'Número do endereço, documento ou recurso, conforme o contexto.',
  number: 'Número do endereço, documento ou recurso, conforme o contexto.',
  complemento: 'Complemento do endereço.',
  complement: 'Complemento do endereço.',
  bairro: 'Bairro do endereço.',
  neighborhood: 'Bairro do endereço.',
  cidade: 'Cidade do endereço.',
  city: 'Cidade do endereço.',
  estado: 'Estado ou unidade federativa do endereço.',
  state: 'Estado ou unidade federativa do endereço.',
  uf: 'Sigla da unidade federativa.',
  cep: 'Código postal do endereço.',
  zipcode: 'Código postal do endereço.',
  url: 'Endereço eletrônico usado pela operação.',
  webhook: 'Configuração do webhook associado ao recurso.',
  webhookurl: 'URL que receberá as notificações do webhook.',
  notification_url: 'URL que receberá notificações da operação.',
  redirecturl: 'URL para a qual o usuário será redirecionado.',
  token: 'Token público ou identificador temporário exigido pela operação.',
  metadata: 'Metadados associados ao recurso.',
  configuracao: 'Configuração aplicada ao recurso.',
  configurations: 'Conjunto de configurações aplicado ao recurso.',
  calendario: 'Regras de calendário e vencimento da cobrança.',
  loc: 'Dados da localização vinculada à cobrança Pix.',
  split: 'Regras de divisão dos valores recebidos.',
  repasses: 'Repasses definidos para a divisão de valores.',
  pagamento: 'Dados do pagamento.',
  payment: 'Dados do pagamento.',
  payment_method: 'Meio de pagamento selecionado.',
  credit_card: 'Dados necessários ao pagamento com cartão.',
  banking_billet: 'Dados necessários à cobrança por boleto.',
  installments: 'Quantidade de parcelas do pagamento.',
  parcelas: 'Parcelas associadas ao pagamento.',
  juros: 'Regras de juros aplicadas ao valor.',
  multa: 'Regras de multa aplicadas ao valor.',
  desconto: 'Regras de desconto aplicadas ao valor.',
  discount: 'Regras de desconto aplicadas ao valor.',
  mensagem: 'Mensagem associada à operação.',
  message: 'Mensagem associada à operação.',
  motivo: 'Motivo informado para a operação.',
  justificativa: 'Justificativa informada para a operação.',
};

const OPERATION_OVERRIDES: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  pix_qr_code_detail: {
    'body.pixCopiaECola':
      'Código Pix Copia e Cola cuja carga será obtida e cuja assinatura JWS será verificada.',
  },
  pix_generate_static_qr_code: {
    'body.merchantName': 'Nome do recebedor exibido no QR Code Pix estático.',
    'body.merchantCity': 'Cidade do recebedor exibida no QR Code Pix estático.',
    'body.transactionAmount': 'Valor opcional incorporado ao QR Code Pix estático.',
  },
  pix_get_receipt: {
    'params.txid': 'Identificador da cobrança cujo comprovante será obtido.',
    'params.e2eid': 'Identificador de ponta a ponta do Pix cujo comprovante será obtido.',
    'params.idEnvio': 'Identificador do envio Pix cujo comprovante será obtido.',
    'params.rtrId': 'Identificador da devolução cujo comprovante será obtido.',
  },
};

function isSchema(value: unknown): value is JsonSchema {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizedFieldName(field: string): string {
  return field.replace(/[^a-zA-Z0-9_]/g, '').toLowerCase();
}

function readableFieldName(field: string): string {
  return field
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .trim();
}

function descriptionFor(
  definition: ToolDefinition,
  path: string,
  field: string | undefined,
  purpose: SchemaPurpose,
): string {
  if (!field) {
    return purpose === 'entrada'
      ? `Argumentos aceitos pela tool ${definition.name}.`
      : `Resultado estruturado retornado pela tool ${definition.name}.`;
  }

  const override = OPERATION_OVERRIDES[definition.name]?.[path];
  if (override) return override;

  const common = FIELD_DESCRIPTIONS[normalizedFieldName(field)];
  if (common) return common;

  const readable = readableFieldName(field);
  return `Valor do campo “${readable}” usado na ${purpose} da operação ${definition.title}.`;
}

function decorateNode(
  schema: JsonSchema,
  definition: ToolDefinition,
  purpose: SchemaPurpose,
  path: string,
  field?: string,
  inheritedDescription?: string,
): void {
  if (typeof schema.description !== 'string' || schema.description.trim() === '') {
    schema.description = inheritedDescription ?? descriptionFor(definition, path, field, purpose);
  }

  if (isSchema(schema.properties)) {
    for (const [property, propertySchema] of Object.entries(schema.properties)) {
      if (!isSchema(propertySchema)) continue;
      const propertyPath = path ? `${path}.${property}` : property;
      decorateNode(propertySchema, definition, purpose, propertyPath, property);
    }
  }

  if (isSchema(schema.items)) {
    const itemDescription = field
      ? `Item da coleção informada no campo “${readableFieldName(field)}”.`
      : `Item da coleção usada na ${purpose} da operação ${definition.title}.`;
    decorateNode(schema.items, definition, purpose, `${path}[]`, field, itemDescription);
  }

  for (const keyword of ['anyOf', 'oneOf', 'allOf'] as const) {
    const alternatives = schema[keyword];
    if (!Array.isArray(alternatives)) continue;
    alternatives.forEach((alternative, index) => {
      if (!isSchema(alternative)) return;
      decorateNode(
        alternative,
        definition,
        purpose,
        `${path}.${keyword}[${index}]`,
        field,
        `Alternativa aceita para ${field ? `o campo “${readableFieldName(field)}”` : 'este contrato'}.`,
      );
    });
  }

  if (isSchema(schema.additionalProperties)) {
    decorateNode(
      schema.additionalProperties,
      definition,
      purpose,
      `${path}{}`,
      field,
      `Valor adicional aceito em “${readableFieldName(field ?? 'objeto')}”.`,
    );
  }

  if (isSchema(schema.propertyNames)) {
    decorateNode(
      schema.propertyNames,
      definition,
      purpose,
      `${path}.propertyNames`,
      field,
      `Formato aceito para os nomes das propriedades em “${readableFieldName(field ?? 'objeto')}”.`,
    );
  }

  if (isSchema(schema.not)) {
    decorateNode(
      schema.not,
      definition,
      purpose,
      `${path}.not`,
      field,
      `Formato não permitido para ${field ? `o campo “${readableFieldName(field)}”` : 'este contrato'}.`,
    );
  }
}

export function describePublicSchema(
  schema: JsonSchema,
  definition: ToolDefinition,
  purpose: SchemaPurpose,
): JsonSchema {
  decorateNode(schema, definition, purpose, '', undefined);
  return schema;
}
