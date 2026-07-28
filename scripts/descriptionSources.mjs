const resourceDocs = {
  cobrancas: {
    subscription: 'contexto/docs/api-cobrancas/assinatura.md',
    carnet: 'contexto/docs/api-cobrancas/carne.md',
    link: 'contexto/docs/api-cobrancas/link-de-pagamento.md',
    card: 'contexto/docs/api-cobrancas/cartao.md',
    notification: 'contexto/docs/api-cobrancas/notificacoes.md',
    billet: 'contexto/docs/api-cobrancas/boleto.md',
  },
  pix: {
    automatic: 'contexto/docs/api-pix/pix-automatico.md',
    batch: 'contexto/docs/api-pix/cobrancas-lote.md',
    dueCharge: 'contexto/docs/api-pix/cobrancas-com-vencimento.md',
    charge: 'contexto/docs/api-pix/cobrancas-imediatas.md',
    split: 'contexto/docs/api-pix/split-de-pagamento-pix.md',
    location: 'contexto/docs/api-pix/payload-locations.md',
    webhook: 'contexto/docs/api-pix/webhooks.md',
    payment: 'contexto/docs/api-pix/envio-pagamento-pix.md',
    management: 'contexto/docs/api-pix/gestao-de-pix.md',
    exclusive: 'contexto/docs/api-pix/endpoints-exclusivos-efi.md',
  },
  'open-finance': {
    config: 'contexto/docs/api-open-finance/configuracoes-de-aplicacao.md',
    participants: 'contexto/docs/api-open-finance/participantes.md',
    schedule: 'contexto/docs/api-open-finance/pagamentos-agendados.md',
    recurrence: 'contexto/docs/api-open-finance/pagamentos-recorrentes.md',
    biometric: 'contexto/docs/api-open-finance/pagamentos-por-biometria.md',
    automatic: 'contexto/docs/api-open-finance/pagamentos-automaticos.md',
    immediate: 'contexto/docs/api-open-finance/pagamentos-imediatos.md',
  },
  'pagamento-contas': {
    payment: 'contexto/docs/api-pagamento-de-contas/pagamentos.md',
    webhook: 'contexto/docs/api-pagamento-de-contas/webhooks.md',
  },
  'abertura-contas': {
    account: 'contexto/docs/api-abertura-de-contas/cadastro-de-conta.md',
    webhook: 'contexto/docs/api-abertura-de-contas/webhook.md',
  },
  extratos: 'contexto/docs/api-extratos/extratos.md',
};

const operationDocs = {
  createOneStepCharge: 'contexto/markdown/charges/billet/billet_one_step.md',
  createCharge: 'contexto/markdown/charges/billet/billet_two_steps_1.md',
  definePayMethod: 'contexto/markdown/charges/billet/billet_two_steps_2.md',
  detailCharge: 'contexto/markdown/charges/billet/billet_id.md',
  listCharges: 'contexto/markdown/charges/billet/billet_list.md',
  updateBillet: 'contexto/markdown/charges/billet/billet_alterar_data_de_vencimento.md',
  sendBilletEmail: 'contexto/markdown/charges/billet/billet_resend_email.md',
  createChargeHistory: 'contexto/markdown/charges/billet/billet_acrecentar_info_historico.md',
  defineBalanceSheetBillet: 'contexto/markdown/charges/billet/billet_balancete.md',
  cardPaymentRetry: 'contexto/markdown/charges/card/retentativa.md',
  refundCard: 'contexto/markdown/charges/card/refund.md',
  getInstallments: 'contexto/markdown/charges/card/installments.md',
  createChargeCard: 'contexto/markdown/charges/card/card_one_step.md',
  createCarnet: 'contexto/markdown/charges/carnet/create_carnet.md',
  detailCarnet: 'contexto/markdown/charges/carnet/carnet_id.md',
  updateCarnetParcel: 'contexto/markdown/charges/carnet/alterar_vencimento_parcela.md',
  cancelCarnetParcel: 'contexto/markdown/charges/carnet/cancelar_parcela.md',
  sendCarnetEmail: 'contexto/markdown/charges/carnet/carnet_resend_email.md',
  sendCarnetParcelEmail: 'contexto/markdown/charges/carnet/parcel_resend_email.md',
  createCarnetHistory: 'contexto/markdown/charges/carnet/carnet_acrecentar_info_historico.md',
  createPlan: 'contexto/markdown/charges/subscriptions/criar_plano.md',
  updatePlan: 'contexto/markdown/charges/subscriptions/editar_nome.md',
  createSubscription: 'contexto/markdown/charges/subscriptions/assinatura_two_steps_1.md',
  defineSubscriptionPayMethod: 'contexto/markdown/charges/subscriptions/assinatura_two_steps_2.md',
  createOneStepSubscription: 'contexto/markdown/charges/subscriptions/assinatura_one_step.md',
  createOneStepSubscriptionLink:
    'contexto/markdown/charges/subscriptions/assinatura_link_one_step.md',
  detailSubscription: 'contexto/markdown/charges/subscriptions/subscription_id.md',
  updateSubscription: 'contexto/markdown/charges/subscriptions/alterar_dados_assinatura.md',
  createSubscriptionHistory:
    'contexto/markdown/charges/subscriptions/assinatura_acrecentar_info_historico.md',
  createOneStepLink: 'contexto/markdown/charges/link/link_one_step.md',
  defineLinkPayMethod: 'contexto/markdown/charges/link/link_two_steps_2.md',
  updateChargeLink: 'contexto/markdown/charges/link/link_alterar_atributos.md',
  getNotification: 'contexto/markdown/charges/notification/notification.md',

  pixCreateImmediateCharge: 'contexto/markdown/pix/cob/Cobranca_imediata.md',
  pixCreateCharge: 'contexto/markdown/pix/cob/Cobranca_imediata_txid.md',
  pixUpdateCharge: 'contexto/markdown/pix/cob/Revisar_cobranca.md',
  pixDetailCharge: 'contexto/markdown/pix/cob/Consultar_cobranca.md',
  pixListCharges: 'contexto/markdown/pix/cob/Listar_cobrancas.md',
  pixCreateDueCharge: 'contexto/markdown/pix/cobv/Cobranca_imediata_cobv.md',
  pixUpdateDueCharge: 'contexto/markdown/pix/cobv/Revisar_cobranca_cobv.md',
  pixDetailDueCharge: 'contexto/markdown/pix/cobv/Consultar_cobranca_cobv.md',
  pixListDueCharges: 'contexto/markdown/pix/cobv/Listar_cobrancas_cobv.md',
  pixCreateDueChargeBatch: 'contexto/markdown/pix/cobv/Criar_cobranca_lote.md',
  pixUpdateDueChargeBatch: 'contexto/markdown/pix/cobv/Revisar_cobranca_lote.md',
  pixDetailDueChargeBatch: 'contexto/markdown/pix/cobv/Consultar_lote_cobv.md',
  pixListDueChargeBatch: 'contexto/markdown/pix/cobv/Listar_lotes_cobv.md',
  pixSend: 'contexto/markdown/pix/payment/Enviar_pix.md',
  pixSendDetail: 'contexto/markdown/pix/payment/Consultar_pix_enviado.md',
  pixSendDetailId: 'contexto/markdown/pix/payment/Consultar_pix_enviado_id.md',
  pixSendList: 'contexto/markdown/pix/payment/Listar_enviados.md',
  pixQrCodeDetail: 'contexto/markdown/pix/payment/Detalhar_qrcode.md',
  pixQrCodePay: 'contexto/markdown/pix/payment/Pagar_qrcode.md',
  pixDetailReceived: 'contexto/markdown/pix/pix/Consultar_pix.md',
  pixReceivedList: 'contexto/markdown/pix/pix/Consultar_recebidos.md',
  pixDevolution: 'contexto/markdown/pix/pix/Solicitar_devolucao.md',
  pixDetailDevolution: 'contexto/markdown/pix/pix/Consultar_devolucao.md',
  pixGenerateQRCode: 'contexto/markdown/pix/location/Gerar_qrcode.md',
  pixLocationList: 'contexto/markdown/pix/location/Consultar_locations.md',
  pixDetailLocation: 'contexto/markdown/pix/location/Recuperar_location.md',
  pixUnlinkTxidLocation: 'contexto/markdown/pix/location/Desvincular_txid.md',
  pixListLocationRecurrenceAutomatic: 'contexto/markdown/pix/location/Consultar_locations_rec.md',
  pixUnlinkLocationRecurrenceAutomatic: 'contexto/markdown/pix/location/Desvincular_idRec.md',
  pixConfigWebhook: 'contexto/markdown/pix/webhooks/Configurar_webhook.md',
  pixDetailWebhook: 'contexto/markdown/pix/webhooks/Consultar_webhook.md',
  pixListWebhook: 'contexto/markdown/pix/webhooks/Listar_webhook.md',
  pixDeleteWebhook: 'contexto/markdown/pix/webhooks/Cancelar_webhook.md',
  pixResendWebhook: 'contexto/markdown/pix/webhooks/Reenviar_webhook.md',
  getAccountBalance: 'contexto/markdown/pix/efi/Buscar_saldo.md',
  updateAccountConfig: 'contexto/markdown/pix/efi/Configurar_conta.md',
  pixGetReceipt: 'contexto/markdown/pix/efi/Obter_comprovante.md',
  medList: 'contexto/markdown/pix/med/Listar_med.md',
  medDefense: 'contexto/markdown/pix/med/criar_defesa.md',
  pixSplitConfig: 'contexto/markdown/pix/split/Configurar_split.md',
  pixSplitConfigId: 'contexto/markdown/pix/split/Configurar_split_id.md',
  pixSplitDetailConfig: 'contexto/markdown/pix/split/Consultar_configuracao.md',
  pixSplitDetailCharge: 'contexto/markdown/pix/split/Consultar_cobranca_split.md',
  pixSplitDetailDueCharge: 'contexto/markdown/pix/split/Consultar_cobranca_split_cobv.md',
  pixSplitLinkCharge: 'contexto/markdown/pix/split/Vincular_cobranca.md',
  pixSplitLinkDueCharge: 'contexto/markdown/pix/split/Vincular_cobranca_cobv.md',
  pixSplitUnlinkCharge: 'contexto/markdown/pix/split/Deletar_vinculo.md',
  pixSplitUnlinkDueCharge: 'contexto/markdown/pix/split/Deletar_vinculo_cobv.md',
  pixCreateRecurrenceAutomatic: 'contexto/markdown/pix/rec/Criar_recorrencia.md',
  pixDetailRecurrenceAutomatic: 'contexto/markdown/pix/rec/Consultar_recorrencia.md',
  pixListRecurrenceAutomatic: 'contexto/markdown/pix/rec/Listar_recorrencias.md',
  pixUpdateRecurrenceAutomatic: 'contexto/markdown/pix/rec/Revisar_recorrencia.md',
  pixCreateRequestRecurrenceAutomatic: 'contexto/markdown/pix/solicRec/Criar_solicitacao.md',
  pixDetailRequestRecurrenceAutomatic: 'contexto/markdown/pix/solicRec/Consultar_solicitacao.md',
  pixUpdateRequestRecurrenceAutomatic: 'contexto/markdown/pix/solicRec/Revisar_solicitacao.md',
  pixCreateAutomaticChargeTxid: 'contexto/markdown/pix/cobr/Criar_cobranca_txid.md',
  pixCreateAutomaticCharge: 'contexto/markdown/pix/cobr/Criar_cobranca_recorrente.md',
  pixUpdateAutomaticCharge: 'contexto/markdown/pix/cobr/Revisar_cobranca_recorrente.md',
  pixDetailAutomaticCharge: 'contexto/markdown/pix/cobr/Consultar_cobranca_recorrente.md',
  pixListAutomaticCharge: 'contexto/markdown/pix/cobr/Listar_cobrancas_recorrentes.md',
  pixRetryRequestAutomatic: 'contexto/markdown/pix/cobr/Solicitar_retentativa.md',

  ofListParticipants:
    'contexto/markdown/open-finance/participantes/recuperar_inst_participantes.md',
  ofConfigUpdate: 'contexto/markdown/open-finance/config-aplicacao/config_urls.md',
  ofConfigDetail: 'contexto/markdown/open-finance/config-aplicacao/config_urls.md',
  ofStartPixPayment: 'contexto/markdown/open-finance/pagamento-imediato/solicitar_iniciacao.md',
  ofListPixPayment: 'contexto/markdown/open-finance/pagamento-imediato/listar_pagamentos.md',
  ofDevolutionPix: 'contexto/markdown/open-finance/pagamento-imediato/devolucao.md',
  ofStartSchedulePixPayment:
    'contexto/markdown/open-finance/pagamento-agendado/solicitar_iniciacao.md',
  ofCancelSchedulePix: 'contexto/markdown/open-finance/pagamento-agendado/cancelar.md',
  ofStartRecurrencyPixPayment:
    'contexto/markdown/open-finance/pagamento-recorrente/solicitar_iniciacao.md',
  ofListRecurrencyPixPayment:
    'contexto/markdown/open-finance/pagamento-recorrente/listar_pagamentos.md',
  ofCancelRecurrencyPix: 'contexto/markdown/open-finance/pagamento-recorrente/cancelar.md',
  ofDevolutionRecurrencyPix: 'contexto/markdown/open-finance/pagamento-recorrente/devolucao.md',
  ofReplaceRecurrencyPixParcel: 'contexto/markdown/open-finance/pagamento-recorrente/substituir.md',
  ofCreateBiometricEnrollment:
    'contexto/markdown/open-finance/pagamento-biometria/criar_vinculo.md',
  ofListBiometricEnrollment:
    'contexto/markdown/open-finance/pagamento-biometria/consultar_vinculo.md',
  ofCreateBiometricPixPayment:
    'contexto/markdown/open-finance/pagamento-biometria/criar_pagamento.md',
  ofListBiometricPixPayment:
    'contexto/markdown/open-finance/pagamento-biometria/consultar_pagamentos.md',
  ofRevokeBiometricEnrollment:
    'contexto/markdown/open-finance/pagamento-biometria/revogar_vinculo.md',
  ofCreateAutomaticEnrollment:
    'contexto/markdown/open-finance/pagamento-automatico/criar_adesao.md',
  ofListAutomaticEnrollment:
    'contexto/markdown/open-finance/pagamento-automatico/consultar_parametros.md',
  ofUpdateAutomaticEnrollment:
    'contexto/markdown/open-finance/pagamento-automatico/editar_adesao.md',
  ofCreateAutomaticPixPayment:
    'contexto/markdown/open-finance/pagamento-automatico/criar_pagamento.md',
  ofListAutomaticPixPayment:
    'contexto/markdown/open-finance/pagamento-automatico/consultar_pagamentos.md',
  ofCancelAutomaticPixPayment:
    'contexto/markdown/open-finance/pagamento-automatico/cancelar_pagamento.md',

  payDetailBarCode: 'contexto/markdown/payments/consultar_cod_barras.md',
  payRequestBarCode: 'contexto/markdown/payments/solicitar_pagamento.md',
  payDetailPayment: 'contexto/markdown/payments/consultar_solicitacao_de_pagamento.md',
  payListPayments: 'contexto/markdown/payments/consultar_resumo_pagamento.md',
  payConfigWebhook: 'contexto/markdown/payments/webhooks/Configurar_webhook.md',
  payListWebhook: 'contexto/markdown/payments/webhooks/Listar_webhook.md',

  createAccount: 'contexto/markdown/abertura_conta/cadastro/Solicitar_abertura_conta.md',
  createAccountCertificate: 'contexto/markdown/abertura_conta/cadastro/Recuperar_certificado.md',
  getAccountCredentials: 'contexto/markdown/abertura_conta/cadastro/Recuperar_credenciais.md',
  accountConfigWebhook: 'contexto/markdown/abertura_conta/webhooks/Configurar_webhook.md',
  accountDeleteWebhook: 'contexto/markdown/abertura_conta/webhooks/Cancelar_webhook.md',
  accountDetailWebhook: 'contexto/markdown/abertura_conta/webhooks/Consultar_webhook.md',
  accountListWebhook: 'contexto/markdown/abertura_conta/webhooks/Listar_webhook.md',

  getStatementFile: 'contexto/markdown/extratos/download_extrato.md',
  createStatementRecurrency: 'contexto/markdown/extratos/criar_recorrencia.md',
  updateStatementRecurrency: 'contexto/markdown/extratos/revisar_recorrencia.md',
  createSftpKey: 'contexto/markdown/extratos/gerar_chave.md',
};

function resourceDocFor(method, api) {
  if (api === 'cobrancas') {
    if (/Subscription|Plan/.test(method)) return resourceDocs.cobrancas.subscription;
    if (/Carnet/.test(method)) return resourceDocs.cobrancas.carnet;
    if (/Link/.test(method)) return resourceDocs.cobrancas.link;
    if (/Card|Installments/.test(method)) return resourceDocs.cobrancas.card;
    if (/Notification/.test(method)) return resourceDocs.cobrancas.notification;
    return resourceDocs.cobrancas.billet;
  }

  if (api === 'pix') {
    if (/Automatic|Recurrence/.test(method)) return resourceDocs.pix.automatic;
    if (/DueChargeBatch/.test(method)) return resourceDocs.pix.batch;
    if (/Split/.test(method)) return resourceDocs.pix.split;
    if (/DueCharge/.test(method)) return resourceDocs.pix.dueCharge;
    if (/Charge/.test(method)) return resourceDocs.pix.charge;
    if (/Location|QRCode/.test(method)) return resourceDocs.pix.location;
    if (/Webhook/.test(method)) return resourceDocs.pix.webhook;
    if (/Send|QrCode/.test(method)) return resourceDocs.pix.payment;
    if (/Received|Devolution/.test(method)) return resourceDocs.pix.management;
    return resourceDocs.pix.exclusive;
  }

  if (api === 'open-finance') {
    if (/Config/.test(method)) return resourceDocs['open-finance'].config;
    if (/Participants/.test(method)) return resourceDocs['open-finance'].participants;
    if (/Schedule/.test(method)) return resourceDocs['open-finance'].schedule;
    if (/Recurrency/.test(method)) return resourceDocs['open-finance'].recurrence;
    if (/Biometric/.test(method)) return resourceDocs['open-finance'].biometric;
    if (/Automatic/.test(method)) return resourceDocs['open-finance'].automatic;
    return resourceDocs['open-finance'].immediate;
  }

  if (api === 'pagamento-contas') {
    return /Webhook/.test(method)
      ? resourceDocs['pagamento-contas'].webhook
      : resourceDocs['pagamento-contas'].payment;
  }

  if (api === 'abertura-contas') {
    return /Webhook/.test(method)
      ? resourceDocs['abertura-contas'].webhook
      : resourceDocs['abertura-contas'].account;
  }

  return resourceDocs[api];
}

export function descriptionSourceFor(method, api) {
  return {
    resourceDoc: resourceDocFor(method, api),
    operationDoc: operationDocs[method],
  };
}
