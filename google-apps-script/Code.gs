/* ======================================================
   FULERÃO FC — Backend em Google Apps Script
   Cole este código em Extensões > Apps Script na sua planilha
   ====================================================== */

const ABA_PEDIDOS = "Pedidos";
const ABA_CONFIG = "Config";
const ABA_RESERVAS = "Reservas";
const NOME_PASTA_COMPROVANTES = "Fulerao FC - Comprovantes Pix";

// Código pra qualquer pedido. Combine com o grupo inteiro.
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

const CABECALHO_RESERVAS = ["Numero", "Nome", "ValidoAte", "SenhaLiberacao"];

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

  let abaReservas = planilha.getSheetByName(ABA_RESERVAS);
  if (!abaReservas) {
    abaReservas = planilha.insertSheet(ABA_RESERVAS);
    abaReservas.getRange(1, 1, 1, CABECALHO_RESERVAS.length).setValues([CABECALHO_RESERVAS]);
    abaReservas.setFrozenRows(1);
    abaReservas.getRange(2, 1, 1, 4).setValues([[10, "Exemplo Jogador", "2026-08-15", "libera10-2026"]]);
  }

  Logger.log(
    "Planilha configurada. Defina SENHA_GRUPO no Code.gs, preencha a aba " +
    "'Reservas' com quem tem prioridade em cada número (e a senha de " +
    "liberação de cada um), e quando souber o valor final da camisa, " +
    "preencha a célula B1 da aba 'Config'."
  );
}

/* ---------- GET: consultas de status ---------- */

function doGet(e) {
  const acao = e.parameter.action;

  if (acao === "valorRestante") {
    return responderJson({ valor: buscarValorRestante() });
  }

  if (acao === "numeros") {
    return responderJson({ numeros: buscarStatusTodosNumeros() });
  }

  if (acao === "numeroInfo") {
    const numero = Number(e.parameter.numero);
    return responderJson(buscarStatusNumero(numero));
  }

  if (acao === "pedido") {
    const nome = e.parameter.nome || "";
    const linha = buscarLinhaPedido(nome);
    const reserva = buscarReservaPorNome(nome);

    if (!linha) return responderJson({ encontrado: false, reserva: reserva });

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
      reserva: reserva,
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

  // ALTERADO: valida a reserva comparando com corpo.nomeCamisa em vez de corpo.nome
  const statusNumero = verificarNumeroDisponivel(numero, corpo.nomeCamisa);
  if (!statusNumero.livre) {
    if (statusNumero.motivo === "ocupado") {
      return responderJson({
        success: false,
        message: `O número ${numero} já está ocupado por outra pessoa. Escolhe outro.`,
      });
    }
    if (statusNumero.motivo === "reservado") {
      const senhaEsperada = statusNumero.senhaLiberacao;
      const senhaCorreta = senhaEsperada && corpo.senhaLiberacao === senhaEsperada;

      if (!senhaCorreta) {
        return responderJson({
          success: false,
          message:
            `O número ${numero} está reservado para ${statusNumero.nome} até ` +
            `${statusNumero.validoAte}. Pra pegar mesmo assim, informe a senha de ` +
            `liberação desse número específico (peça pro admin, só se essa pessoa ` +
            `abriu mão dele).`,
        });
      }
    }
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
    numero,
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
      novaLinha[7] = dados[i][7]; // preserva RestantePago
      novaLinha[8] = dados[i][8]; // preserva ComprovanteRestanteLink
      novaLinha[10] = dados[i][10]; // preserva ValorRestantePago
      novaLinha[11] = dados[i][11]; // preserva DataHoraRestante
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
      aba.getRange(i + 1, 11).setValue(valorRestante); // ValorRestantePago
      aba.getRange(i + 1, 12).setValue(new Date()); // DataHoraRestante
      return responderJson({ success: true });
    }
  }

  return responderJson({
    success: false,
    message: "Não encontrei um pedido com esse nome. Faça o pedido inicial primeiro.",
  });
}

/* ---------- números: disponibilidade e reservas ---------- */

function buscarStatusTodosNumeros() {
  const ocupados = buscarNumerosOcupados();
  const reservas = buscarReservasValidas();

  const resultado = [];
  for (let n = 0; n <= 99; n++) {
    if (ocupados[n]) {
      resultado.push({ numero: n, status: "ocupado", nome: ocupados[n] });
    } else if (reservas[n]) {
      resultado.push({
        numero: n,
        status: "reservado",
        nome: reservas[n].nome,
        validoAte: reservas[n].validoAte,
      });
    } else {
      resultado.push({ numero: n, status: "livre" });
    }
  }
  return resultado;
}

function buscarStatusNumero(numero) {
  const ocupados = buscarNumerosOcupados();
  if (ocupados[numero]) {
    return { numero: numero, status: "ocupado", nome: ocupados[numero] };
  }

  const reservas = buscarReservasValidas();
  if (reservas[numero]) {
    return {
      numero: numero,
      status: "reservado",
      nome: reservas[numero].nome,
      validoAte: reservas[numero].validoAte,
    };
  }

  return { numero: numero, status: "livre" };
}

function buscarNumerosOcupados() {
  const aba = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(ABA_PEDIDOS);
  const dados = aba.getDataRange().getValues();
  const ocupados = {};

  for (let i = 1; i < dados.length; i++) {
    const numero = dados[i][3];
    if (numero !== "" && numero !== null && numero !== undefined) {
      ocupados[Number(numero)] = dados[i][0];
    }
  }
  return ocupados;
}

function buscarReservasValidas() {
  const aba = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(ABA_RESERVAS);
  const dados = aba.getDataRange().getValues();
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  const reservas = {};
  for (let i = 1; i < dados.length; i++) {
    const numero = dados[i][0];
    const nome = dados[i][1];
    const validoAte = dados[i][2];
    const senhaLiberacao = dados[i][3];
    if (numero === "" || numero === null || !nome || !validoAte) continue;

    const dataValidade = new Date(validoAte);
    if (dataValidade >= hoje) {
      reservas[Number(numero)] = {
        nome: nome,
        validoAte: formatarData(dataValidade),
        senhaLiberacao: String(senhaLiberacao || "").trim(),
      };
    }
  }
  return reservas;
}

function buscarReservaPorNome(nome) {
  if (!nome) return null;
  const aba = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(ABA_RESERVAS);
  const dados = aba.getDataRange().getValues();
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  for (let i = 1; i < dados.length; i++) {
    const numero = dados[i][0];
    const nomeReserva = dados[i][1];
    const validoAte = dados[i][2];
    if (numero === "" || numero === null || !nomeReserva || !validoAte) continue;

    if (normalizarNome(nomeReserva) === normalizarNome(nome)) {
      const dataValidade = new Date(validoAte);
      if (dataValidade >= hoje) {
        return { numero: Number(numero), validoAte: formatarData(dataValidade) };
      }
    }
  }
  return null;
}

function verificarNumeroDisponivel(numero, nomeSolicitante) {
  const ocupados = buscarNumerosOcupados();
  if (ocupados[numero] && normalizarNome(ocupados[numero]) !== normalizarNome(nomeSolicitante)) {
    return { livre: false, motivo: "ocupado", nome: ocupados[numero] };
  }

  const reservas = buscarReservasValidas();
  if (reservas[numero] && normalizarNome(reservas[numero].nome) !== normalizarNome(nomeSolicitante)) {
    return {
      livre: false,
      motivo: "reservado",
      nome: reservas[numero].nome,
      validoAte: reservas[numero].validoAte,
      senhaLiberacao: reservas[numero].senhaLiberacao,
    };
  }

  return { livre: true };
}

function formatarData(data) {
  return Utilities.formatDate(data, Session.getScriptTimeZone(), "dd/MM/yyyy");
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