/* ======================================================
   FULERÃO FC — Backend em Google Apps Script
   Cole este código em Extensões > Apps Script na sua planilha
   ====================================================== */

const ABA_PEDIDOS = "Pedidos";
const ABA_CONFIG = "Config";
const NOME_PASTA_COMPROVANTES = "Fulerao FC - Comprovantes Pix";

// Troque por um código combinado com o grupo. É a única checagem de acesso.
const SENHA_GRUPO = "fulerao2026";

const TIPOS_CAMISA_VALIDOS = ["Linha", "Goleiro"];
const TAMANHOS_VALIDOS = ["P", "M", "G", "GG", "XG"];

const CABECALHO_PEDIDOS = [
  "Nome",
  "Tipo",
  "Tamanho",
  "Numero",
  "NomeCamisa",
  "SinalPago",
  "ComprovanteSinalLink",
  "RestantePago",
  "ComprovanteRestanteLink",
  "DataHoraPedido",
  "ValorRestantePago",
  "DataHoraRestante",
];

/* ---------- ponto de entrada: configura as abas na primeira vez ---------- */

function configurarPlanilha() {
  const planilha = SpreadsheetApp.getActiveSpreadsheet();

  let abaPedidos = planilha.getSheetByName(ABA_PEDIDOS);
  if (!abaPedidos) {
    abaPedidos = planilha.insertSheet(ABA_PEDIDOS);
    abaPedidos.getRange(1, 1, 1, CABECALHO_PEDIDOS.length).setValues([CABECALHO_PEDIDOS]);
    abaPedidos.setFrozenRows(1);
  }

  let abaConfig = planilha.getSheetByName(ABA_CONFIG);
  if (!abaConfig) {
    abaConfig = planilha.insertSheet(ABA_CONFIG);
    abaConfig.getRange("A1").setValue("ValorRestante (R$)");
    abaConfig.getRange("B1").setValue(""); // preencha quando o valor final sair
    abaConfig.getRange("A1:A1").setFontWeight("bold");
  }

  Logger.log(
    "Planilha configurada. Defina SENHA_GRUPO no Code.gs e, quando souber " +
    "o valor final da camisa, preencha a célula B1 da aba 'Config'."
  );
}

/* ---------- GET: status de um pedido / valor restante atual ---------- */

function doGet(e) {
  const acao = e.parameter.action;

  if (acao === "valorRestante") {
    return responderJson({ valor: buscarValorRestante() });
  }

  if (acao === "pedido") {
    const nome = e.parameter.nome || "";
    const linha = buscarLinhaPedido(nome);

    if (!linha) return responderJson({ encontrado: false });

    return responderJson({
      encontrado: true,
      tipo: linha[1],
      tamanho: linha[2],
      numero: linha[3],
      nomeCamisa: linha[4],
      sinalPago: linha[5],
      restantePago: linha[7],
      valorRestantePago: linha[10],
      valorRestante: buscarValorRestante(),
    });
  }

  return responderJson({ erro: "Ação desconhecida" });
}

/* ---------- POST: cria/atualiza pedido (sinal) ou registra o restante ---------- */

function doPost(e) {
  try {
    const corpo = JSON.parse(e.postData.contents);

    if (corpo.senhaGrupo !== SENHA_GRUPO) {
      return responderJson({
        success: false,
        message: "Código do grupo incorreto. Pergunta pro admin.",
      });
    }

    if (corpo.etapa === "restante") return processarPagamentoRestante(corpo);
    return processarPedidoInicial(corpo);
  } catch (erro) {
    return responderJson({ success: false, message: "Erro no servidor: " + erro.message });
  }
}

function processarPedidoInicial(corpo) {
  if (!corpo.nome || !corpo.tipoCamisa || !corpo.tamanho || !corpo.numero || !corpo.nomeCamisa) {
    return responderJson({ success: false, message: "Preencha todos os campos." });
  }

  if (TIPOS_CAMISA_VALIDOS.indexOf(corpo.tipoCamisa) === -1) {
    return responderJson({ success: false, message: "Tipo de camisa inválido." });
  }

  if (TAMANHOS_VALIDOS.indexOf(corpo.tamanho) === -1) {
    return responderJson({ success: false, message: "Tamanho inválido." });
  }

  const numero = Number(corpo.numero);
  if (isNaN(numero) || numero < 0 || numero > 99) {
    return responderJson({ success: false, message: "Número da camisa inválido (use 0 a 99)." });
  }

  if (!corpo.comprovanteBase64) {
    return responderJson({ success: false, message: "Anexe o comprovante do sinal." });
  }

  const linkComprovante = salvarComprovante(
    corpo.comprovanteBase64,
    corpo.comprovanteNome || "comprovante-sinal.jpg",
    corpo.nome
  );

  const aba = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(ABA_PEDIDOS);
  const dados = aba.getDataRange().getValues();

  const novaLinha = [
    corpo.nome,
    corpo.tipoCamisa,
    corpo.tamanho,
    corpo.numero,
    corpo.nomeCamisa,
    corpo.pago || "NAO", // SinalPago
    linkComprovante || "",
    "NAO", // RestantePago começa sempre em NAO num pedido novo
    "", // ComprovanteRestanteLink
    new Date(), // DataHoraPedido
    "", // ValorRestantePago
    "", // DataHoraRestante
  ];

  for (let i = 1; i < dados.length; i++) {
    if (normalizarNome(dados[i][0]) === normalizarNome(corpo.nome)) {
      novaLinha[0] = dados[i][0]; // mantém grafia original do nome
      // preserva tudo que já é do restante, edição do pedido não mexe nisso
      novaLinha[7] = dados[i][7]; // RestantePago
      novaLinha[8] = dados[i][8]; // ComprovanteRestanteLink
      novaLinha[10] = dados[i][10]; // ValorRestantePago
      novaLinha[11] = dados[i][11]; // DataHoraRestante
      aba.getRange(i + 1, 1, 1, CABECALHO_PEDIDOS.length).setValues([novaLinha]);
      return responderJson({ success: true });
    }
  }

  aba.appendRow(novaLinha);
  return responderJson({ success: true });
}

function processarPagamentoRestante(corpo) {
  if (!corpo.nome) return responderJson({ success: false, message: "Informe seu nome." });

  const aba = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(ABA_PEDIDOS);
  const dados = aba.getDataRange().getValues();

  for (let i = 1; i < dados.length; i++) {
    if (normalizarNome(dados[i][0]) === normalizarNome(corpo.nome)) {
      if (dados[i][5] !== "SIM") {
        return responderJson({
          success: false,
          message: "O sinal desse pedido ainda não está confirmado. Isso é resolvido antes do restante.",
        });
      }

      const valorRestante = buscarValorRestante();
      if (valorRestante === null) {
        return responderJson({
          success: false,
          message: "O valor final ainda não foi divulgado. Aguarde o aviso do grupo.",
        });
      }

      if (!corpo.comprovanteBase64) {
        return responderJson({ success: false, message: "Anexe o comprovante do restante." });
      }

      const link = salvarComprovante(
        corpo.comprovanteBase64,
        corpo.comprovanteNome || "comprovante-restante.jpg",
        corpo.nome
      );

      aba.getRange(i + 1, 8).setValue("SIM"); // RestantePago
      aba.getRange(i + 1, 9).setValue(link); // ComprovanteRestanteLink
      aba.getRange(i + 1, 11).setValue(valorRestante); // ValorRestantePago (valor exato no momento do pagamento)
      aba.getRange(i + 1, 12).setValue(new Date()); // DataHoraRestante
      return responderJson({ success: true });
    }
  }

  return responderJson({
    success: false,
    message: "Não encontrei um pedido com esse nome. Faça o pedido inicial primeiro.",
  });
}

/* ---------- helpers ---------- */

function normalizarNome(nome) {
  return String(nome).trim().toLowerCase();
}

function buscarLinhaPedido(nome) {
  const aba = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(ABA_PEDIDOS);
  const dados = aba.getDataRange().getValues();

  for (let i = 1; i < dados.length; i++) {
    if (normalizarNome(dados[i][0]) === normalizarNome(nome)) return dados[i];
  }
  return null;
}

function buscarValorRestante() {
  const aba = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(ABA_CONFIG);
  const valor = aba.getRange("B1").getValue();
  if (valor === "" || valor === null || isNaN(valor)) return null;
  return Number(valor);
}

function salvarComprovante(base64, nomeArquivo, nomePessoa) {
  const pasta = buscarOuCriarPasta(NOME_PASTA_COMPROVANTES);
  const bytes = Utilities.base64Decode(base64);
  const tipoMime = detectarMimeType(nomeArquivo);
  const blob = Utilities.newBlob(bytes, tipoMime, `${nomePessoa} - ${nomeArquivo}`);
  const arquivo = pasta.createFile(blob);
  arquivo.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return arquivo.getUrl();
}

function buscarOuCriarPasta(nome) {
  const pastas = DriveApp.getFoldersByName(nome);
  if (pastas.hasNext()) return pastas.next();
  return DriveApp.createFolder(nome);
}

function detectarMimeType(nomeArquivo) {
  const ext = nomeArquivo.split(".").pop().toLowerCase();
  if (ext === "png") return MimeType.PNG;
  if (ext === "webp") return "image/webp";
  return MimeType.JPEG;
}

function responderJson(objeto) {
  return ContentService.createTextOutput(JSON.stringify(objeto)).setMimeType(
    ContentService.MimeType.JSON
  );
}