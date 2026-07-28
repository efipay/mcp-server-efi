import type { ApiGroup, EfiMethodName, HttpMethod } from './types.js';

interface ToolDescription {
  readonly title: string;
  readonly description: string;
}

/**
 * Descrições destinadas ao consumidor MCP. O catálogo é deliberadamente explícito:
 * o nome do método e seus contratos vêm do SDK, enquanto os textos abaixo sintetizam
 * a finalidade operacional documentada pela Efí sem transportar MDX ou metadados de
 * procedência para `tools/list`.
 */
const TOOL_DESCRIPTIONS = {
  // Cobranças
  sendSubscriptionLinkEmail: {
    title: 'Reenviar link de pagamento da assinatura por e-mail',
    description:
      'Reenvia por e-mail o link de pagamento já associado a uma assinatura. Use quando o cliente precisar receber novamente o acesso ao checkout; a operação não cria outra assinatura.',
  },
  settleCarnet: {
    title: 'Dar baixa manual em um carnê',
    description:
      'Marca manualmente um carnê como pago. Use somente quando o recebimento tiver ocorrido por outro meio e precisar ser refletido na Efí, pois a operação altera o estado financeiro do carnê.',
  },
  sendLinkEmail: {
    title: 'Reenviar link de pagamento por e-mail',
    description:
      'Reenvia por e-mail um link de pagamento já criado para uma cobrança. Use quando o pagador não recebeu ou perdeu a mensagem original; nenhum novo link ou cobrança é criado.',
  },
  createOneStepLink: {
    title: 'Criar cobrança com link de pagamento',
    description:
      'Cria, em uma única etapa, a cobrança e o link que leva o pagador ao checkout hospedado pela Efí. Use quando a aplicação quiser oferecer pagamento sem implementar um checkout próprio.',
  },
  createCharge: {
    title: 'Criar transação de cobrança',
    description:
      'Cria a transação inicial de uma cobrança sem concluir a escolha da forma de pagamento. Use no fluxo em duas etapas, antes de associar boleto, cartão ou link à transação.',
  },
  detailCharge: {
    title: 'Consultar uma cobrança',
    description:
      'Consulta os dados atuais de uma cobrança, incluindo sua forma de pagamento e situação. Use para acompanhar processamento, pagamento ou cancelamento sem modificar a transação.',
  },
  updateChargeMetadata: {
    title: 'Atualizar metadados de uma cobrança',
    description:
      'Atualiza os metadados de integração de uma cobrança existente, como referência própria e URL de notificação quando aceitas pelo contrato. Use para corrigir o vínculo com o sistema integrador.',
  },
  updateBillet: {
    title: 'Atualizar boleto de uma cobrança',
    description:
      'Revisa os dados permitidos de um boleto já associado a uma cobrança. Use para ajustar o boleto enquanto seu estado admitir alteração; a operação modifica a cobrança apresentada ao pagador.',
  },
  definePayMethod: {
    title: 'Definir forma de pagamento de uma cobrança',
    description:
      'Associa uma forma de pagamento e os dados do pagador a uma transação previamente criada. Use para concluir a segunda etapa da cobrança e gerar o instrumento de pagamento correspondente.',
  },
  cancelCharge: {
    title: 'Cancelar uma cobrança',
    description:
      'Cancela uma cobrança existente que ainda possa ser cancelada. Use quando o débito não deve mais ser cobrado; a mudança de estado impede que o fluxo de pagamento prossiga normalmente.',
  },
  createCarnet: {
    title: 'Criar carnê de cobranças',
    description:
      'Cria um carnê com várias parcelas e vencimentos para o mesmo pagador. Use quando a venda exigir cobranças periódicas já definidas em lote; cada parcela poderá ser acompanhada separadamente.',
  },
  detailCarnet: {
    title: 'Consultar um carnê',
    description:
      'Consulta um carnê existente e a situação de suas parcelas. Use para acompanhar vencimentos, pagamentos, baixas e cancelamentos sem realizar qualquer alteração no carnê.',
  },
  updateCarnetParcel: {
    title: 'Atualizar uma parcela de carnê',
    description:
      'Atualiza os dados permitidos de uma parcela específica de carnê. Use quando somente um vencimento precisar de revisão; a alteração afeta a cobrança apresentada para aquela parcela.',
  },
  updateCarnetParcels: {
    title: 'Atualizar parcelas de um carnê',
    description:
      'Atualiza em conjunto os dados permitidos das parcelas de um carnê. Use para aplicar revisões coordenadas a vários vencimentos; as cobranças das parcelas informadas serão modificadas.',
  },
  updateCarnetMetadata: {
    title: 'Atualizar metadados de um carnê',
    description:
      'Atualiza os metadados de integração de um carnê existente. Use para corrigir referências ou informações de notificação sem recriar o carnê nem alterar diretamente o pagamento das parcelas.',
  },
  getNotification: {
    title: 'Consultar uma notificação de cobrança',
    description:
      'Recupera, pelo token recebido no callback, os eventos e dados atualizados associados a uma notificação. Use após a Efí avisar uma mudança para confirmar o estado da transação correspondente.',
  },
  listPlans: {
    title: 'Listar planos de assinatura',
    description:
      'Lista os planos de assinatura cadastrados e seus dados de recorrência. Use para localizar o plano adequado antes de criar uma assinatura ou para consultar a configuração vigente.',
  },
  createPlan: {
    title: 'Criar plano de assinatura',
    description:
      'Cria um plano que define a periodicidade e a quantidade de cobranças recorrentes. Use antes de vincular clientes a assinaturas que deverão seguir a mesma programação.',
  },
  deletePlan: {
    title: 'Excluir plano de assinatura',
    description:
      'Exclui um plano de assinatura existente quando a Efí permitir a remoção. Use apenas se o plano não deve mais receber novas assinaturas, pois a operação remove sua configuração.',
  },
  createSubscription: {
    title: 'Criar assinatura em um plano',
    description:
      'Cria uma assinatura vinculada a um plano já existente, ainda sem concluir a forma de pagamento. Use no fluxo em duas etapas antes de associar os dados de cobrança do assinante.',
  },
  createOneStepSubscription: {
    title: 'Criar assinatura com pagamento em uma etapa',
    description:
      'Cria a assinatura e define sua forma de pagamento em uma única operação. Use quando plano, assinante e dados de pagamento já estiverem disponíveis para iniciar a recorrência.',
  },
  createOneStepSubscriptionLink: {
    title: 'Criar assinatura com link de pagamento',
    description:
      'Cria uma assinatura e seu link de pagamento em uma única etapa. Use para permitir que o assinante conclua a contratação no checkout hospedado pela Efí.',
  },
  detailSubscription: {
    title: 'Consultar uma assinatura',
    description:
      'Consulta os dados e a situação atual de uma assinatura vinculada a um plano. Use para acompanhar cobranças recorrentes, pagamento ou cancelamento sem alterar a assinatura.',
  },
  defineSubscriptionPayMethod: {
    title: 'Definir forma de pagamento da assinatura',
    description:
      'Associa a forma de pagamento e os dados do cliente a uma assinatura previamente criada. Use para concluir a segunda etapa e habilitar as cobranças recorrentes do plano.',
  },
  cancelSubscription: {
    title: 'Cancelar uma assinatura',
    description:
      'Cancela uma assinatura ativa e interrompe seu fluxo normal de cobranças futuras. Use quando o cliente não deve mais permanecer vinculado à recorrência do plano.',
  },
  updateSubscriptionMetadata: {
    title: 'Atualizar metadados de uma assinatura',
    description:
      'Atualiza os metadados de integração de uma assinatura, como referências usadas pelo sistema chamador. Use para corrigir o vínculo externo sem recriar nem cobrar novamente o assinante.',
  },
  getInstallments: {
    title: 'Consultar opções de parcelamento no cartão',
    description:
      'Consulta as opções e valores de parcelamento disponíveis para uma bandeira de cartão. Use antes de apresentar as parcelas ao cliente ou de criar a cobrança por cartão.',
  },
  sendBilletEmail: {
    title: 'Reenviar boleto por e-mail',
    description:
      'Reenvia por e-mail o boleto já gerado para uma cobrança. Use quando o pagador precisar receber novamente o documento; a operação não emite uma cobrança diferente.',
  },
  createChargeHistory: {
    title: 'Adicionar histórico a uma cobrança',
    description:
      'Acrescenta uma descrição ao histórico de uma cobrança existente. Use para registrar uma ocorrência operacional ou observação sem alterar valor, vencimento ou estado de pagamento.',
  },
  sendCarnetEmail: {
    title: 'Reenviar carnê por e-mail',
    description:
      'Reenvia por e-mail um carnê já criado com suas parcelas. Use quando o pagador precisar receber novamente os documentos, sem gerar outro carnê ou novas cobranças.',
  },
  sendCarnetParcelEmail: {
    title: 'Reenviar parcela de carnê por e-mail',
    description:
      'Reenvia por e-mail uma parcela específica de um carnê existente. Use quando apenas aquele documento precisar ser entregue novamente; as demais parcelas permanecem inalteradas.',
  },
  createCarnetHistory: {
    title: 'Adicionar histórico a um carnê',
    description:
      'Acrescenta uma descrição ao histórico de um carnê existente. Use para registrar uma ocorrência operacional sem modificar vencimentos, valores ou situação das parcelas.',
  },
  cancelCarnet: {
    title: 'Cancelar um carnê',
    description:
      'Cancela um carnê existente e as cobranças abrangidas pela operação conforme o estado aceito pela Efí. Use quando o conjunto de parcelas não deve mais ser cobrado.',
  },
  cancelCarnetParcel: {
    title: 'Cancelar uma parcela de carnê',
    description:
      'Cancela uma parcela específica de um carnê sem cancelar necessariamente as demais. Use quando somente aquele vencimento não deve mais ser cobrado do pagador.',
  },
  defineLinkPayMethod: {
    title: 'Associar link de pagamento a uma cobrança',
    description:
      'Cria e associa um link de pagamento a uma transação previamente criada. Use para concluir o fluxo em duas etapas e encaminhar o pagador ao checkout da Efí.',
  },
  updateChargeLink: {
    title: 'Atualizar link de pagamento',
    description:
      'Atualiza os atributos permitidos de um link de pagamento existente. Use quando a experiência ou as opções do checkout precisarem ser revistas sem criar outra cobrança.',
  },
  updatePlan: {
    title: 'Atualizar plano de assinatura',
    description:
      'Atualiza os dados permitidos de um plano de assinatura existente. Use para revisar sua configuração de recorrência; verifique o efeito esperado nas assinaturas vinculadas antes da alteração.',
  },
  updateSubscription: {
    title: 'Atualizar uma assinatura',
    description:
      'Atualiza os dados permitidos de uma assinatura existente. Use para revisar a configuração individual do vínculo com o plano sem criar uma nova assinatura.',
  },
  createSubscriptionHistory: {
    title: 'Adicionar histórico a uma assinatura',
    description:
      'Acrescenta uma descrição ao histórico de uma assinatura. Use para registrar uma ocorrência operacional sem alterar o plano, a forma de pagamento ou seu estado.',
  },
  defineBalanceSheetBillet: {
    title: 'Definir boleto do tipo balancete',
    description:
      'Define que a cobrança previamente criada produzirá um boleto balancete e informa seu conteúdo tabular. Use quando o documento precisar desse layout; a Efí apenas organiza os dados fornecidos.',
  },
  settleCharge: {
    title: 'Dar baixa manual em uma cobrança',
    description:
      'Marca manualmente uma cobrança como paga. Use somente quando o valor tiver sido recebido por outro meio e o estado precisar ser refletido na Efí, pois há efeito financeiro.',
  },
  settleCarnetParcel: {
    title: 'Dar baixa manual em uma parcela de carnê',
    description:
      'Marca manualmente uma parcela específica de carnê como paga. Use quando o recebimento externo daquela parcela precisar ser registrado, pois a operação altera seu estado financeiro.',
  },
  createOneStepCharge: {
    title: 'Criar cobrança em uma etapa',
    description:
      'Cria a transação e sua forma de pagamento em uma única operação. Use quando todos os dados comerciais e do pagador já estiverem disponíveis para emitir a cobrança imediatamente.',
  },
  cardPaymentRetry: {
    title: 'Tentar novamente pagamento com cartão',
    description:
      'Solicita nova tentativa de pagamento por cartão para uma cobrança compatível. Use após uma tentativa não autorizada e com dados válidos; a operação pode efetivar a cobrança do cliente.',
  },
  refundCard: {
    title: 'Estornar pagamento com cartão',
    description:
      'Solicita o estorno total ou parcial de um pagamento realizado com cartão, conforme o contrato do SDK. Use para devolver valores de uma cobrança já paga; a operação movimenta recursos.',
  },
  listCharges: {
    title: 'Listar cobranças',
    description:
      'Lista cobranças conforme os filtros aceitos pela Efí. Use para conciliação, acompanhamento operacional ou localização de transações sem modificar seus estados.',
  },
  createChargeCard: {
    title: 'Criar cobrança por cartão',
    description:
      'Cria e submete uma cobrança por cartão de crédito pela versão atual da rota de cartões. Use quando o token de pagamento e os dados exigidos já estiverem disponíveis; pode cobrar o cliente.',
  },

  // Pix
  pixCreateDueCharge: {
    title: 'Criar cobrança Pix com vencimento',
    description:
      'Cria uma cobrança Pix com vencimento usando um txid definido pelo recebedor. Use quando a cobrança precisar de data de vencimento e das regras financeiras admitidas para cobranças desse tipo.',
  },
  pixUpdateDueCharge: {
    title: 'Revisar cobrança Pix com vencimento',
    description:
      'Revisa os campos permitidos de uma cobrança Pix com vencimento identificada pelo txid. Use para atualizar uma cobrança existente enquanto seu estado admitir mudanças.',
  },
  pixDetailDueCharge: {
    title: 'Consultar cobrança Pix com vencimento',
    description:
      'Consulta pelo txid os dados, a revisão e o estado de uma cobrança Pix com vencimento. Use para acompanhar a cobrança ou obter dados para exibição sem alterá-la.',
  },
  pixListDueCharges: {
    title: 'Listar cobranças Pix com vencimento',
    description:
      'Lista cobranças Pix com vencimento no período e com os filtros informados. Use em rotinas de acompanhamento e conciliação sem modificar as cobranças encontradas.',
  },
  createReport: {
    title: 'Solicitar relatório de conciliação Pix',
    description:
      'Solicita a geração assíncrona de um relatório de conciliação Pix. Use quando precisar consolidar movimentações para conferência; a resposta identifica o processamento a acompanhar.',
  },
  detailReport: {
    title: 'Consultar relatório de conciliação Pix',
    description:
      'Consulta o estado e os dados de um relatório de conciliação solicitado anteriormente. Use para verificar se o processamento terminou e obter as informações disponibilizadas pela Efí.',
  },
  pixCreateCharge: {
    title: 'Criar cobrança Pix imediata com txid',
    description:
      'Cria uma cobrança Pix imediata com txid definido pelo recebedor. Use quando a aplicação precisar controlar o identificador e gerar um pagamento Pix rastreável.',
  },
  pixUpdateCharge: {
    title: 'Revisar cobrança Pix imediata',
    description:
      'Revisa os campos permitidos de uma cobrança Pix imediata identificada pelo txid. Use para atualizar uma cobrança existente enquanto seu estado admitir alteração.',
  },
  pixCreateImmediateCharge: {
    title: 'Criar cobrança Pix imediata sem txid',
    description:
      'Cria uma cobrança Pix imediata e deixa a Efí atribuir o txid. Use quando a aplicação não precisar escolher previamente o identificador da cobrança.',
  },
  pixDetailCharge: {
    title: 'Consultar cobrança Pix imediata',
    description:
      'Consulta pelo txid os dados, a revisão e o estado de uma cobrança Pix imediata. Use para acompanhar pagamento ou remoção sem modificar a cobrança.',
  },
  pixListCharges: {
    title: 'Listar cobranças Pix imediatas',
    description:
      'Lista cobranças Pix imediatas no período e com os filtros informados. Use em rotinas de acompanhamento e conciliação sem alterar os registros retornados.',
  },
  pixDetailReceived: {
    title: 'Consultar Pix recebido',
    description:
      'Consulta um recebimento Pix pelo identificador end-to-end. Use para confirmar valor, horário, pagador e eventuais devoluções de uma transação já recebida.',
  },
  pixReceivedList: {
    title: 'Listar Pix recebidos',
    description:
      'Lista recebimentos Pix conforme período e filtros aceitos. Use para conciliar entradas na conta e acompanhar devoluções sem movimentar valores.',
  },
  pixSend: {
    title: 'Enviar Pix',
    description:
      'Solicita uma transferência Pix para uma chave ou conta favorecida usando um identificador de envio. Use somente após conferir pagador, favorecido e valor; a operação movimenta saldo da conta.',
  },
  pixSendDetail: {
    title: 'Consultar Pix enviado pelo end-to-end ID',
    description:
      'Consulta um Pix enviado usando seu identificador end-to-end. Use para confirmar processamento, favorecido, valor e devoluções sem iniciar nova transferência.',
  },
  pixSendList: {
    title: 'Listar Pix enviados',
    description:
      'Lista transferências Pix enviadas no período e com os filtros informados. Use para acompanhamento e conciliação de saídas sem movimentar valores.',
  },
  pixDevolution: {
    title: 'Solicitar devolução de Pix recebido',
    description:
      'Solicita uma devolução vinculada a um Pix recebido e identifica essa devolução dentro da transação. Use após conferir o recebimento e o valor, pois a operação movimenta saldo.',
  },
  pixDetailDevolution: {
    title: 'Consultar devolução de Pix',
    description:
      'Consulta o estado e os dados de uma devolução já solicitada para um Pix recebido. Use para acompanhar seu processamento sem criar outra devolução ou movimentar valores.',
  },
  pixConfigWebhook: {
    title: 'Configurar webhook de uma chave Pix',
    description:
      'Configura a URL que receberá eventos Pix associados a uma chave. Use depois de preparar o endpoint de callback com os requisitos de segurança; a configuração substitui o destino aplicável.',
  },
  pixDetailWebhook: {
    title: 'Consultar webhook de uma chave Pix',
    description:
      'Consulta a configuração de webhook associada a uma chave Pix. Use para confirmar URL e criação do vínculo antes de depender das notificações, sem alterar a configuração.',
  },
  pixListWebhook: {
    title: 'Listar webhooks Pix',
    description:
      'Lista as configurações de webhook Pix conforme os filtros disponíveis. Use para inventariar destinos de notificação e verificar vínculos sem modificá-los.',
  },
  pixDeleteWebhook: {
    title: 'Remover webhook de uma chave Pix',
    description:
      'Remove a configuração de webhook associada a uma chave Pix. Use quando aquele destino não deve mais receber eventos; a aplicação deixará de receber as notificações correspondentes.',
  },
  pixCreateLocation: {
    title: 'Criar location para payload Pix',
    description:
      'Cria uma location reutilizável para associar uma cobrança a um payload dinâmico. Use antes de gerar o QR Code quando a aplicação precisar administrar essa associação separadamente.',
  },
  pixLocationList: {
    title: 'Listar locations Pix',
    description:
      'Lista locations de payload Pix conforme os filtros informados. Use para localizar associações de cobranças e QR Codes sem modificar seus vínculos.',
  },
  pixDetailLocation: {
    title: 'Consultar location Pix',
    description:
      'Consulta uma location Pix pelo identificador e informa sua associação atual. Use para verificar o vínculo com uma cobrança antes de gerar ou reutilizar o QR Code.',
  },
  pixGenerateQRCode: {
    title: 'Gerar QR Code de uma location Pix',
    description:
      'Gera o Pix Copia e Cola e a imagem do QR Code para uma location existente. Use depois de associar a location à cobrança que o pagador deverá acessar.',
  },
  pixUnlinkTxidLocation: {
    title: 'Desvincular cobrança de uma location Pix',
    description:
      'Remove o vínculo entre uma location e o txid de sua cobrança Pix. Use antes de reutilizar a location ou encerrar a associação; o QR Code deixa de representar aquele vínculo.',
  },
  pixCreateEvp: {
    title: 'Criar chave Pix aleatória',
    description:
      'Registra uma nova chave Pix aleatória na conta autenticada. Use quando a conta precisar de uma EVP para receber pagamentos; a resposta contém a chave criada.',
  },
  pixListEvp: {
    title: 'Listar chaves Pix aleatórias',
    description:
      'Lista somente as chaves Pix do tipo aleatória registradas na conta autenticada. Use para inventariar EVPs disponíveis antes de configurar cobranças ou webhooks.',
  },
  pixDeleteEvp: {
    title: 'Remover chave Pix aleatória',
    description:
      'Remove uma chave Pix aleatória da conta. Use apenas quando ela não deve mais receber pagamentos; a mesma EVP não poderá ser recriada e cobranças ligadas a ela podem deixar de funcionar.',
  },
  getAccountBalance: {
    title: 'Consultar saldo da conta Pix',
    description:
      'Consulta o saldo disponível da conta Efí e, quando solicitado, os valores bloqueados. Use antes de operações de saída ou em conciliações; nenhum saldo é movimentado.',
  },
  updateAccountConfig: {
    title: 'Atualizar configurações da conta Pix',
    description:
      'Cria ou modifica regras de recebimento e notificação Pix da conta ou de chaves específicas. Use para controlar formas aceitas de recebimento; a mudança afeta transações futuras.',
  },
  listAccountConfig: {
    title: 'Consultar configurações da conta Pix',
    description:
      'Retorna as regras Pix definidas para a conta e suas chaves. Use para conferir comportamento de recebimento e notificações antes de alterá-lo.',
  },
  pixSplitDetailCharge: {
    title: 'Consultar split de cobrança Pix imediata',
    description:
      'Consulta a configuração de split vinculada a uma cobrança Pix imediata. Use para verificar como o recebimento será distribuído sem alterar a cobrança ou seus repasses.',
  },
  pixSplitLinkCharge: {
    title: 'Vincular split a cobrança Pix imediata',
    description:
      'Vincula uma configuração de split existente a uma cobrança Pix imediata. Use antes do pagamento para definir a distribuição do valor entre os participantes.',
  },
  pixSplitUnlinkCharge: {
    title: 'Desvincular split de cobrança Pix imediata',
    description:
      'Remove o vínculo de split de uma cobrança Pix imediata. Use quando o recebimento não deve mais seguir aquela distribuição e confira o estado da cobrança antes da mudança.',
  },
  pixSplitDetailDueCharge: {
    title: 'Consultar split de cobrança Pix com vencimento',
    description:
      'Consulta a configuração de split vinculada a uma cobrança Pix com vencimento. Use para verificar a distribuição prevista do recebimento sem alterar seus repasses.',
  },
  pixSplitLinkDueCharge: {
    title: 'Vincular split a cobrança Pix com vencimento',
    description:
      'Vincula uma configuração de split existente a uma cobrança Pix com vencimento. Use antes do pagamento para definir como o valor recebido será distribuído.',
  },
  pixSplitUnlinkDueCharge: {
    title: 'Desvincular split de cobrança Pix com vencimento',
    description:
      'Remove o vínculo de split de uma cobrança Pix com vencimento. Use quando o recebimento não deve mais seguir aquela distribuição e verifique o estado da cobrança antes da mudança.',
  },
  pixSplitConfig: {
    title: 'Criar configuração de split Pix',
    description:
      'Cria uma configuração de split que define participantes e critérios de distribuição. Use antes de vinculá-la a cobranças Pix que devam repartir valores recebidos.',
  },
  pixSplitConfigId: {
    title: 'Criar ou substituir configuração de split Pix',
    description:
      'Cria ou substitui uma configuração de split usando um identificador escolhido. Use quando a aplicação precisar controlar o identificador; vínculos futuros usarão a definição resultante.',
  },
  pixSplitDetailConfig: {
    title: 'Consultar configuração de split Pix',
    description:
      'Consulta participantes e critérios de uma configuração de split Pix. Use para validar a distribuição antes de vinculá-la a uma cobrança ou revisar um vínculo existente.',
  },
  pixSendDetailId: {
    title: 'Consultar Pix enviado pelo identificador de envio',
    description:
      'Consulta uma transferência Pix pelo identificador atribuído pela aplicação no envio. Use para acompanhar processamento, favorecido e valor sem iniciar outra transferência.',
  },
  pixCreateDueChargeBatch: {
    title: 'Criar ou substituir lote de cobranças Pix',
    description:
      'Cria ou substitui um lote de cobranças Pix com vencimento sob um identificador. Use para registrar várias cobranças coordenadas; a operação altera o conteúdo integral do lote.',
  },
  pixUpdateDueChargeBatch: {
    title: 'Revisar cobranças de um lote Pix',
    description:
      'Revisa cobranças específicas dentro de um lote Pix com vencimento. Use para alterar somente os itens informados, preservando as demais cobranças do lote.',
  },
  pixDetailDueChargeBatch: {
    title: 'Consultar lote de cobranças Pix',
    description:
      'Consulta pelo identificador um lote de cobranças Pix com vencimento e seus itens. Use para acompanhar o processamento e as revisões sem modificar o lote.',
  },
  pixListDueChargeBatch: {
    title: 'Listar lotes de cobranças Pix',
    description:
      'Lista lotes de cobranças Pix com vencimento conforme período e filtros aceitos. Use para localizar lotes e acompanhar sua criação sem alterar seus conteúdos.',
  },
  medDefense: {
    title: 'Submeter defesa de infração MED',
    description:
      'Envia uma defesa para uma infração específica do Mecanismo Especial de Devolução. Use para complementar a análise; o envio não substitui o acompanhamento e documentos solicitados por ticket.',
  },
  medList: {
    title: 'Listar infrações MED',
    description:
      'Lista infrações MED abertas nas contas associadas ao documento da conta autenticada. Use para acompanhar contestações e identificar casos que exigem defesa ou tratativa adicional.',
  },
  pixQrCodePay: {
    title: 'Pagar QR Code Pix',
    description:
      'Solicita o pagamento de um QR Code por seu Pix Copia e Cola e um identificador de envio. Use após validar os dados do recebedor e o valor; a operação movimenta saldo da conta.',
  },
  pixResendWebhook: {
    title: 'Reenviar notificações webhook Pix',
    description:
      'Solicita o reenvio de notificações Pix dentro do recorte informado. Use para recuperar callbacks não processados; o endpoint configurado poderá receber novamente eventos já emitidos.',
  },
  pixGetReceipt: {
    title: 'Obter comprovante de transação Pix',
    description:
      'Obtém o comprovante em PDF de uma transação Pix usando um de seus identificadores aceitos. Use para entregar ou arquivar a evidência de uma operação já realizada.',
  },
  pixSendSameOwnership: {
    title: 'Enviar Pix entre contas da mesma titularidade',
    description:
      'Solicita uma transferência Pix exclusivamente para conta da mesma titularidade. Use após conferir origem, destino e valor; a operação movimenta o saldo da conta autenticada.',
  },
  pixKeysBucket: {
    title: 'Consultar baldes de fichas para chaves Pix',
    description:
      'Consulta capacidade, fichas disponíveis e reposição dos baldes usados no gerenciamento de chaves Pix. Use para decidir quando realizar operações de registro de chaves sem consumir uma ficha.',
  },
  pixDetailRecurrenceAutomatic: {
    title: 'Consultar recorrência de Pix Automático',
    description:
      'Consulta uma recorrência de Pix Automático por seu identificador. Use para acompanhar autorização, estado e parâmetros vigentes sem modificar o acordo recorrente.',
  },
  pixUpdateRecurrenceAutomatic: {
    title: 'Revisar recorrência de Pix Automático',
    description:
      'Revisa os campos permitidos de uma recorrência de Pix Automático. Use quando o acordo existente precisar de ajuste e seu estado ainda admitir a alteração.',
  },
  pixListRecurrenceAutomatic: {
    title: 'Listar recorrências de Pix Automático',
    description:
      'Lista recorrências de Pix Automático conforme período e filtros informados. Use para acompanhar autorizações e localizar acordos sem alterar seus estados.',
  },
  pixCreateRecurrenceAutomatic: {
    title: 'Criar recorrência de Pix Automático',
    description:
      'Cria uma recorrência que deverá ser autorizada pelo pagador para cobranças Pix Automático futuras. Use no início da jornada de contratação do acordo recorrente.',
  },
  pixCreateRequestRecurrenceAutomatic: {
    title: 'Criar solicitação de recorrência Pix Automático',
    description:
      'Cria uma solicitação de confirmação de recorrência de Pix Automático. Use na jornada em que a autorização do pagador depende dessa solicitação antes das cobranças recorrentes.',
  },
  pixDetailRequestRecurrenceAutomatic: {
    title: 'Consultar solicitação de recorrência Pix Automático',
    description:
      'Consulta uma solicitação de confirmação de recorrência por seu identificador. Use para acompanhar sua resposta e situação sem modificar a recorrência associada.',
  },
  pixUpdateRequestRecurrenceAutomatic: {
    title: 'Revisar solicitação de recorrência Pix Automático',
    description:
      'Revisa os campos permitidos de uma solicitação de confirmação de recorrência. Use para ajustar a solicitação enquanto seu estado permitir, antes da autorização final.',
  },
  pixCreateAutomaticChargeTxid: {
    title: 'Criar cobrança Pix Automático com txid',
    description:
      'Cria uma cobrança vinculada a uma recorrência de Pix Automático usando txid definido pelo recebedor. Use para programar a cobrança de um acordo recorrente já estabelecido.',
  },
  pixUpdateAutomaticCharge: {
    title: 'Revisar cobrança Pix Automático',
    description:
      'Revisa os campos permitidos de uma cobrança associada a Pix Automático. Use para ajustar a cobrança recorrente enquanto seu estado admitir alteração.',
  },
  pixDetailAutomaticCharge: {
    title: 'Consultar cobrança Pix Automático',
    description:
      'Consulta pelo txid uma cobrança associada a uma recorrência de Pix Automático. Use para acompanhar agenda, tentativas e estado sem alterar a cobrança.',
  },
  pixCreateAutomaticCharge: {
    title: 'Criar cobrança Pix Automático sem txid',
    description:
      'Cria uma cobrança de Pix Automático e deixa a Efí atribuir o txid. Use para cobrar uma recorrência estabelecida quando a aplicação não precisar escolher o identificador.',
  },
  pixListAutomaticCharge: {
    title: 'Listar cobranças Pix Automático',
    description:
      'Lista cobranças associadas a recorrências de Pix Automático conforme os filtros aceitos. Use para acompanhar execuções e conciliar cobranças sem modificá-las.',
  },
  pixRetryRequestAutomatic: {
    title: 'Solicitar retentativa de cobrança Pix Automático',
    description:
      'Solicita uma nova tentativa para uma cobrança de Pix Automático na data identificada. Use quando a cobrança anterior não foi concluída e as condições da recorrência permitirem retentar.',
  },
  pixCreateLocationRecurrenceAutomatic: {
    title: 'Criar location para recorrência Pix Automático',
    description:
      'Cria uma location destinada ao payload de uma recorrência de Pix Automático. Use antes de associar a recorrência e apresentar seu QR Code ao pagador.',
  },
  pixListLocationRecurrenceAutomatic: {
    title: 'Listar locations de recorrência Pix Automático',
    description:
      'Lista locations destinadas a recorrências de Pix Automático. Use para localizar e acompanhar payloads recorrentes sem modificar suas associações.',
  },
  pixDetailLocationRecurrenceAutomatic: {
    title: 'Consultar location de recorrência Pix Automático',
    description:
      'Consulta uma location de recorrência de Pix Automático e sua associação atual. Use para confirmar o vínculo antes de exibir ou reutilizar o payload.',
  },
  pixUnlinkLocationRecurrenceAutomatic: {
    title: 'Desvincular recorrência de uma location Pix',
    description:
      'Remove o vínculo entre uma location e uma recorrência de Pix Automático. Use quando o payload não deve mais representar aquele acordo recorrente.',
  },
  pixConfigWebhookRecurrenceAutomatic: {
    title: 'Configurar webhook de recorrências Pix Automático',
    description:
      'Configura a URL que receberá eventos das recorrências de Pix Automático. Use depois de preparar o callback seguro; a operação define o destino das notificações desse recurso.',
  },
  pixListWebhookRecurrenceAutomatic: {
    title: 'Consultar webhook de recorrências Pix Automático',
    description:
      'Consulta a configuração vigente do webhook de recorrências de Pix Automático. Use para confirmar o destino dos eventos sem alterar a entrega das notificações.',
  },
  pixDeleteWebhookRecurrenceAutomatic: {
    title: 'Remover webhook de recorrências Pix Automático',
    description:
      'Remove a configuração do webhook de recorrências de Pix Automático. Use quando o destino não deve mais receber esses eventos; as notificações correspondentes serão interrompidas.',
  },
  pixConfigWebhookAutomaticCharge: {
    title: 'Configurar webhook de cobranças Pix Automático',
    description:
      'Configura a URL que receberá eventos das cobranças associadas a Pix Automático. Use depois de preparar o callback seguro para acompanhar tentativas e pagamentos recorrentes.',
  },
  pixListWebhookAutomaticCharge: {
    title: 'Consultar webhook de cobranças Pix Automático',
    description:
      'Consulta a configuração vigente do webhook de cobranças Pix Automático. Use para confirmar o destino dos eventos sem alterar a entrega das notificações.',
  },
  pixDeleteWebhookAutomaticCharge: {
    title: 'Remover webhook de cobranças Pix Automático',
    description:
      'Remove a configuração do webhook de cobranças Pix Automático. Use quando o destino não deve mais receber eventos de cobranças e tentativas recorrentes.',
  },
  pixSplitDevolution: {
    title: 'Solicitar devolução de Pix com split',
    description:
      'Solicita a devolução de um Pix recebido que teve distribuição por split. Use após conferir a transação e o valor; a operação movimenta recursos e ajusta os repasses relacionados.',
  },
  pixQrCodeDetail: {
    title: 'Detalhar Pix Copia e Cola',
    description:
      'Decodifica um Pix Copia e Cola, recupera a cobrança dinâmica e verifica a assinatura JWS com o JWKS indicado pelo emissor quando disponível. Use para inspecionar os dados e o estado da verificação; um resultado inválido ou indisponível não autoriza o pagamento.',
  },
  pixGenerateStaticQRCode: {
    title: 'Gerar QR Code Pix estático',
    description:
      'Monta localmente um payload Pix estático e sua imagem a partir dos dados do recebedor. Use para apresentar um QR Code sem criar cobrança ou fazer requisição financeira à Efí.',
  },

  // Open Finance
  ofListParticipants: {
    title: 'Listar instituições participantes do Open Finance',
    description:
      'Lista instituições disponíveis para jornadas de iniciação de pagamento Open Finance. Use para o pagador escolher onde autorizar a operação antes de iniciar um Pix.',
  },
  ofStartPixPayment: {
    title: 'Iniciar pagamento Pix via Open Finance',
    description:
      'Solicita a iniciação de um Pix imediato via Open Finance e produz a jornada de autorização correspondente. Use após definir o pagamento; sua conclusão pode movimentar valores.',
  },
  ofListPixPayment: {
    title: 'Listar pagamentos Pix imediatos do Open Finance',
    description:
      'Lista pagamentos Pix imediatos iniciados via Open Finance conforme período e filtros. Use para acompanhar autorização, conclusão ou falha sem criar novo pagamento.',
  },
  ofConfigUpdate: {
    title: 'Atualizar URLs da aplicação Open Finance',
    description:
      'Configura as URLs usadas nos redirecionamentos e callbacks das jornadas Open Finance. Use antes de iniciar pagamentos e somente com destinos preparados para receber o fluxo.',
  },
  ofConfigDetail: {
    title: 'Consultar configuração da aplicação Open Finance',
    description:
      'Consulta as URLs atualmente configuradas para redirecionamentos e callbacks Open Finance. Use para validar a integração antes de iniciar uma jornada de pagamento.',
  },
  ofDevolutionPix: {
    title: 'Devolver pagamento Pix do Open Finance',
    description:
      'Solicita a devolução de um pagamento Pix imediato iniciado via Open Finance. Use após localizar e conferir o pagamento concluído, pois a operação movimenta valores.',
  },
  ofCancelSchedulePix: {
    title: 'Cancelar pagamento Pix agendado do Open Finance',
    description:
      'Cancela um pagamento Pix agendado iniciado via Open Finance quando seu estado permitir. Use antes da execução para impedir a movimentação prevista.',
  },
  ofListSchedulePixPayment: {
    title: 'Listar pagamentos Pix agendados do Open Finance',
    description:
      'Lista pagamentos Pix agendados via Open Finance conforme período e filtros. Use para acompanhar autorização, agendamento e execução sem alterar os pagamentos.',
  },
  ofStartSchedulePixPayment: {
    title: 'Iniciar pagamento Pix agendado via Open Finance',
    description:
      'Solicita a iniciação de um Pix para data futura via Open Finance e produz sua jornada de autorização. Use quando o pagamento deve ocorrer posteriormente; sua execução movimentará valores.',
  },
  ofDevolutionSchedulePix: {
    title: 'Devolver pagamento Pix agendado do Open Finance',
    description:
      'Solicita a devolução de um pagamento Pix agendado que já foi executado. Use após conferir o pagamento e o valor devolvido, pois a operação movimenta recursos.',
  },
  ofStartRecurrencyPixPayment: {
    title: 'Iniciar pagamento Pix recorrente via Open Finance',
    description:
      'Solicita a iniciação de uma série de pagamentos Pix recorrentes via Open Finance. Use para criar a jornada de autorização de pagamentos programados que poderão movimentar valores.',
  },
  ofListRecurrencyPixPayment: {
    title: 'Listar pagamentos Pix recorrentes do Open Finance',
    description:
      'Lista recorrências e pagamentos Pix iniciados via Open Finance conforme os filtros. Use para acompanhar a série e suas parcelas sem modificar a programação.',
  },
  ofCancelRecurrencyPix: {
    title: 'Cancelar pagamento Pix recorrente do Open Finance',
    description:
      'Cancela uma recorrência Pix iniciada via Open Finance quando seu estado permitir. Use para impedir as execuções futuras da série; pagamentos já concluídos não são uma nova iniciação.',
  },
  ofDevolutionRecurrencyPix: {
    title: 'Devolver parcela Pix recorrente do Open Finance',
    description:
      'Solicita a devolução de um pagamento executado dentro de uma recorrência Open Finance. Use após identificar a parcela e conferir o valor, pois há movimentação de recursos.',
  },
  ofReplaceRecurrencyPixParcel: {
    title: 'Substituir parcela Pix recorrente do Open Finance',
    description:
      'Substitui uma parcela identificada dentro de uma recorrência Pix do Open Finance. Use quando a programação daquela parcela precisar ser revista; a operação altera uma execução financeira futura.',
  },
  ofCreateBiometricEnrollment: {
    title: 'Criar vínculo biométrico Open Finance',
    description:
      'Cria o vínculo de dispositivo ou credencial necessário à jornada de pagamento por biometria. Use durante a adesão do usuário, antes de iniciar pagamentos sem redirecionamento.',
  },
  ofListBiometricEnrollment: {
    title: 'Consultar vínculos biométricos Open Finance',
    description:
      'Lista os vínculos biométricos de um usuário conforme os filtros informados. Use para confirmar se existe vínculo apto antes de iniciar pagamento sem redirecionamento.',
  },
  ofCreateBiometricPixPayment: {
    title: 'Criar pagamento Pix por biometria',
    description:
      'Solicita um pagamento Pix pela jornada biométrica sem redirecionamento. Use somente com vínculo previamente criado e após conferir recebedor e valor; pode movimentar recursos.',
  },
  ofListBiometricPixPayment: {
    title: 'Listar pagamentos Pix por biometria',
    description:
      'Lista pagamentos Pix realizados pela jornada biométrica sem redirecionamento. Use para acompanhar processamento e conciliar operações sem iniciar outro pagamento.',
  },
  ofRevokeBiometricEnrollment: {
    title: 'Revogar vínculo biométrico Open Finance',
    description:
      'Revoga um vínculo usado na jornada de pagamento por biometria. Use quando o dispositivo ou a autorização não deve mais permitir pagamentos sem redirecionamento.',
  },
  ofCreateAutomaticEnrollment: {
    title: 'Criar adesão a pagamento automático Open Finance',
    description:
      'Solicita a criação de uma adesão para pagamentos automáticos via Open Finance. Use antes de iniciar pagamentos dessa modalidade; a adesão deverá seguir sua jornada de autorização.',
  },
  ofListAutomaticEnrollment: {
    title: 'Consultar adesões de pagamento automático',
    description:
      'Consulta os parâmetros e a situação de adesões de pagamento automático Open Finance. Use para verificar a autorização disponível antes de iniciar uma cobrança automática.',
  },
  ofUpdateAutomaticEnrollment: {
    title: 'Atualizar adesão de pagamento automático',
    description:
      'Edita os dados permitidos de uma adesão de pagamento automático Open Finance. Use para revisar a autorização existente; a mudança pode afetar pagamentos automáticos futuros.',
  },
  ofCreateAutomaticPixPayment: {
    title: 'Criar pagamento Pix automático via Open Finance',
    description:
      'Solicita um pagamento Pix apoiado por uma adesão automática previamente autorizada. Use após validar adesão, recebedor e valor; a operação pode movimentar recursos.',
  },
  ofListAutomaticPixPayment: {
    title: 'Listar pagamentos Pix automáticos do Open Finance',
    description:
      'Lista pagamentos Pix realizados por adesões automáticas conforme os filtros aceitos. Use para acompanhar processamento e conciliação sem criar outro pagamento.',
  },
  ofCancelAutomaticPixPayment: {
    title: 'Cancelar pagamento Pix automático do Open Finance',
    description:
      'Solicita o cancelamento de um pagamento Pix automático quando seu estado permitir. Use para impedir uma execução pendente; a adesão deve ser tratada separadamente se também precisar mudar.',
  },

  // Pagamento de contas
  payDetailBarCode: {
    title: 'Detalhar código de barras para pagamento',
    description:
      'Consulta e valida os dados representados por um código de barras antes do pagamento. Use para apresentar beneficiário, vencimento e valor ao usuário sem movimentar saldo.',
  },
  payRequestBarCode: {
    title: 'Solicitar pagamento de código de barras',
    description:
      'Solicita o pagamento de uma conta identificada por código de barras. Use somente depois de consultar e conferir os dados do título, pois a operação pode movimentar saldo.',
  },
  payDetailPayment: {
    title: 'Consultar pagamento de conta',
    description:
      'Consulta uma solicitação de pagamento de conta pelo identificador. Use para acompanhar processamento, confirmação ou falha sem repetir a ordem de pagamento.',
  },
  payListPayments: {
    title: 'Listar pagamentos de contas',
    description:
      'Lista um resumo das solicitações de pagamento conforme os filtros aceitos. Use para acompanhamento e conciliação das saídas sem iniciar novos pagamentos.',
  },
  payConfigWebhook: {
    title: 'Configurar webhook de pagamentos de contas',
    description:
      'Configura a URL que receberá atualizações sobre pagamentos de contas. Use após preparar o endpoint de callback seguro para acompanhar mudanças de estado.',
  },
  payListWebhook: {
    title: 'Consultar webhook de pagamentos de contas',
    description:
      'Consulta a configuração de webhook usada nas notificações de pagamentos de contas. Use para confirmar o destino dos callbacks sem modificar sua entrega.',
  },
  payDeleteWebhook: {
    title: 'Remover webhook de pagamentos de contas',
    description:
      'Remove a configuração de webhook de pagamentos de contas. Use quando o destino não deve mais receber atualizações; a aplicação deixará de receber os callbacks correspondentes.',
  },

  // Abertura de contas
  createAccount: {
    title: 'Solicitar abertura de conta simplificada',
    description:
      'Inicia a abertura de uma conta Efí para o cliente final com os dados e acessos informados. Use no onboarding; o cliente deverá autorizar a integração recebida por mensagem.',
  },
  createAccountCertificate: {
    title: 'Criar certificado de conta simplificada',
    description:
      'Gera o certificado de integração de uma conta simplificada já criada. Use após a conta estar apta; a resposta contém material P12 em base64 e deve ser tratada como segredo.',
  },
  getAccountCredentials: {
    title: 'Obter credenciais de conta simplificada',
    description:
      'Recupera Client ID, Client Secret e dados de integração de uma conta simplificada. Use após a aprovação da conta e proteja a resposta, pois ela contém credenciais sensíveis.',
  },
  accountConfigWebhook: {
    title: 'Configurar webhook de abertura de contas',
    description:
      'Cria ou atualiza uma configuração de webhook para eventos de abertura de contas. Use após preparar o endpoint com a segurança exigida para acompanhar o onboarding.',
  },
  accountDeleteWebhook: {
    title: 'Cancelar webhook de abertura de contas',
    description:
      'Cancela uma configuração de webhook de abertura de contas pelo identificador. Use quando o destino não deve mais receber eventos; os callbacks correspondentes serão interrompidos.',
  },
  accountDetailWebhook: {
    title: 'Consultar webhook de abertura de contas',
    description:
      'Consulta uma configuração de webhook de abertura de contas pelo identificador. Use para confirmar URL e data de criação sem modificar o recebimento de eventos.',
  },
  accountListWebhook: {
    title: 'Listar webhooks de abertura de contas',
    description:
      'Lista configurações de webhook de abertura de contas conforme os filtros aceitos. Use para inventariar destinos de onboarding e localizar uma configuração sem alterá-la.',
  },

  // Extratos
  listStatementFiles: {
    title: 'Listar arquivos de extrato CNAB 240',
    description:
      'Lista os arquivos de extrato CNAB 240 já gerados para a conta. Use para localizar períodos disponíveis para conciliação antes de solicitar o download de um arquivo.',
  },
  getStatementFile: {
    title: 'Baixar arquivo de extrato CNAB 240',
    description:
      'Recupera pelo nome um arquivo de extrato CNAB 240 previamente gerado. Use para importar movimentos em uma rotina de conciliação sem alterar a conta ou o agendamento.',
  },
  listStatementRecurrences: {
    title: 'Listar recorrências de extrato CNAB 240',
    description:
      'Lista os agendamentos recorrentes de geração de extrato CNAB 240 cadastrados na conta. Use para verificar frequência e entrega antes de criar ou revisar uma recorrência.',
  },
  createStatementRecurrency: {
    title: 'Criar recorrência de extrato CNAB 240',
    description:
      'Cria um agendamento recorrente para gerar extratos CNAB 240 e disponibilizá-los conforme a configuração informada. Use para automatizar a conciliação periódica.',
  },
  updateStatementRecurrency: {
    title: 'Revisar recorrência de extrato CNAB 240',
    description:
      'Atualiza uma recorrência de geração de extrato CNAB 240 já cadastrada. Use para ajustar frequência ou entrega; a mudança afeta as próximas gerações do agendamento.',
  },
  createSftpKey: {
    title: 'Gerar chave privada para extratos via SFTP',
    description:
      'Gera a chave privada associada à conta para integração de extratos por SFTP. Use ao configurar essa forma de entrega e proteja a resposta, pois contém uma chave privada sensível.',
  },
} satisfies Record<EfiMethodName, ToolDescription>;

export function describeTool(
  method: EfiMethodName,
  api: ApiGroup,
  httpMethod: HttpMethod,
): ToolDescription {
  // Os parâmetros de domínio e verbo permanecem na interface para o chamador, mas não
  // dirigem inferências textuais: cada método possui uma descrição explícita acima.
  void api;
  void httpMethod;
  return TOOL_DESCRIPTIONS[method];
}
