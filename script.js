/* ======================================================
   CONFIGURAÇÃO — edite estes valores conforme seu grupo
   ====================================================== */
const CONFIG = {
  // Cole aqui a URL do Web App depois de publicar o Google Apps Script
  // (Extensões > Apps Script > Implantar > Nova implantação > Web app)
  APPS_SCRIPT_URL: "https://script.google.com/macros/s/AKfycbzyFLK8BuaKgzKlM-vo-idZWctEdt7N-2yvqMbWYsML6BBefmOKrQqa51ahoKoTspUg/exec",

  VALOR_SINAL: 20.0, // valor fixo cobrado na hora do pedido, em reais
  CHAVE_PIX: "778f0c26-9e28-4a5d-8ee4-f0ad8cde6c96",
  TIPO_CHAVE_PIX: "aleatória", // e-mail, celular, cpf, aleatória...
};

/* ====================================================== */

/* ---------- Formulário 1: pedido inicial + sinal ---------- */

const form = document.getElementById("form-pedido");
const inputNome = document.getElementById("nome");
const inputSenhaGrupo = document.getElementById("senhaGrupo");
const inputNumero = document.getElementById("numero");
const inputTipoCamisa = document.getElementById("tipoCamisa");
const inputNomeCamisa = document.getElementById("nomeCamisa");
const previewNumero = document.getElementById("preview-numero");
const previewNome = document.getElementById("preview-nome");
const previewTipo = document.getElementById("preview-tipo");
const mensagemStatus = document.getElementById("mensagem-status");
const btnEnviar = document.getElementById("btn-enviar");

document.getElementById("valor-sinal").textContent =
  "R$ " + CONFIG.VALOR_SINAL.toFixed(2).replace(".", ",");
document.getElementById("chave-pix").textContent = CONFIG.CHAVE_PIX;
document.getElementById("tipo-chave").textContent = CONFIG.TIPO_CHAVE_PIX;

/* se a pessoa já tem pedido salvo, preenche pra edição */

async function carregarPedidoExistente(nome) {
  try {
    const resp = await fetch(
      `${CONFIG.APPS_SCRIPT_URL}?action=pedido&nome=${encodeURIComponent(nome)}`
    );
    const dados = await resp.json();

    if (dados.encontrado) {
      inputTipoCamisa.value = dados.tipo || "";
      document.getElementById("tamanho").value = dados.tamanho || "";
      inputNumero.value = dados.numero || "";
      inputNomeCamisa.value = dados.nomeCamisa || "";
      document.getElementById("jaPaguei").checked = dados.sinalPago === "SIM";
      mensagemStatus.textContent =
        "Você já tem um pedido salvo — os campos foram preenchidos. Ajuste se precisar e reenvie.";
      mensagemStatus.className = "mensagem-status";
    }
  } catch (erro) {
    console.error("Falha ao buscar pedido existente:", erro);
  }
  atualizarPreview();
}

inputNome.addEventListener("blur", () => {
  if (inputNome.value.trim()) carregarPedidoExistente(inputNome.value.trim());
});

/* crachá / preview ao vivo */

function atualizarPreview() {
  previewNumero.textContent = inputNumero.value
    ? String(inputNumero.value).padStart(2, "0")
    : "00";
  previewNome.textContent = (inputNomeCamisa.value || "SEU NOME").toUpperCase();
  previewTipo.textContent = inputTipoCamisa.value === "Goleiro" ? "Goleiro" : "";
}

inputNumero.addEventListener("input", atualizarPreview);
inputNomeCamisa.addEventListener("input", atualizarPreview);
inputTipoCamisa.addEventListener("change", atualizarPreview);

/* utilitário: arquivo -> base64 */

function arquivoParaBase64(arquivo) {
  return new Promise((resolve, reject) => {
    const leitor = new FileReader();
    leitor.onload = () => resolve(leitor.result.split(",")[1]);
    leitor.onerror = () => reject(new Error("Falha ao ler o comprovante"));
    leitor.readAsDataURL(arquivo);
  });
}

/* envio do pedido inicial */

form.addEventListener("submit", async (evento) => {
  evento.preventDefault();

  if (CONFIG.APPS_SCRIPT_URL.includes("COLE_AQUI")) {
    mensagemStatus.textContent =
      "O site ainda não foi conectado à planilha (APPS_SCRIPT_URL em script.js).";
    mensagemStatus.className = "mensagem-status erro";
    return;
  }

  btnEnviar.disabled = true;
  mensagemStatus.textContent = "Enviando...";
  mensagemStatus.className = "mensagem-status";

  try {
    const arquivoComprovante = document.getElementById("comprovante").files[0];
    const comprovanteBase64 = arquivoComprovante
      ? await arquivoParaBase64(arquivoComprovante)
      : null;

    const payload = {
      etapa: "pedido",
      nome: inputNome.value.trim(),
      senhaGrupo: inputSenhaGrupo.value,
      tipoCamisa: inputTipoCamisa.value,
      tamanho: document.getElementById("tamanho").value,
      numero: inputNumero.value,
      nomeCamisa: inputNomeCamisa.value,
      pago: document.getElementById("jaPaguei").checked ? "SIM" : "NAO",
      comprovanteBase64: comprovanteBase64,
      comprovanteNome: arquivoComprovante ? arquivoComprovante.name : null,
    };

    const resultado = await enviarParaBackend(payload);

    if (resultado.success) {
      mensagemStatus.textContent = "Escalação confirmada! Sinal salvo na planilha.";
      mensagemStatus.className = "mensagem-status sucesso";
    } else {
      mensagemStatus.textContent = resultado.message || "Não foi possível salvar o pedido.";
      mensagemStatus.className = "mensagem-status erro";
    }
  } catch (erro) {
    mensagemStatus.textContent = "Erro de conexão. Tenta de novo em instantes.";
    mensagemStatus.className = "mensagem-status erro";
    console.error(erro);
  } finally {
    btnEnviar.disabled = false;
  }
});

/* ---------- Formulário 2: pagamento final (restante) ---------- */

const formRestante = document.getElementById("form-restante");
const inputNomeRestante = document.getElementById("nomeRestante");
const inputSenhaRestante = document.getElementById("senhaGrupoRestante");
const statusValorRestante = document.getElementById("status-valor-restante");
const mensagemStatusRestante = document.getElementById("mensagem-status-restante");
const btnEnviarRestante = document.getElementById("btn-enviar-restante");

document.getElementById("chave-pix-2").textContent = CONFIG.CHAVE_PIX;
document.getElementById("tipo-chave-2").textContent = CONFIG.TIPO_CHAVE_PIX;

async function carregarValorRestante() {
  try {
    const resp = await fetch(`${CONFIG.APPS_SCRIPT_URL}?action=valorRestante`);
    const dados = await resp.json();

    if (dados.valor === null || dados.valor === undefined) {
      statusValorRestante.textContent =
        "O valor final ainda não foi divulgado. Fique de olho no grupo e volte aqui quando avisarmos.";
      btnEnviarRestante.disabled = true;
    } else {
      statusValorRestante.textContent =
        "Valor do restante: R$ " + Number(dados.valor).toFixed(2).replace(".", ",");
      btnEnviarRestante.disabled = false;
    }
  } catch (erro) {
    statusValorRestante.textContent = "Não consegui consultar o valor agora. Recarregue a página.";
    console.error("Falha ao buscar valor restante:", erro);
  }
}

formRestante.addEventListener("submit", async (evento) => {
  evento.preventDefault();

  if (CONFIG.APPS_SCRIPT_URL.includes("COLE_AQUI")) {
    mensagemStatusRestante.textContent =
      "O site ainda não foi conectado à planilha (APPS_SCRIPT_URL em script.js).";
    mensagemStatusRestante.className = "mensagem-status erro";
    return;
  }

  btnEnviarRestante.disabled = true;
  mensagemStatusRestante.textContent = "Enviando...";
  mensagemStatusRestante.className = "mensagem-status";

  try {
    const arquivoComprovante = document.getElementById("comprovanteRestante").files[0];
    const comprovanteBase64 = arquivoComprovante
      ? await arquivoParaBase64(arquivoComprovante)
      : null;

    const payload = {
      etapa: "restante",
      nome: inputNomeRestante.value.trim(),
      senhaGrupo: inputSenhaRestante.value,
      comprovanteBase64: comprovanteBase64,
      comprovanteNome: arquivoComprovante ? arquivoComprovante.name : null,
    };

    const resultado = await enviarParaBackend(payload);

    if (resultado.success) {
      mensagemStatusRestante.textContent = "Pagamento final confirmado! Obrigado.";
      mensagemStatusRestante.className = "mensagem-status sucesso";
    } else {
      mensagemStatusRestante.textContent =
        resultado.message || "Não foi possível confirmar o pagamento.";
      mensagemStatusRestante.className = "mensagem-status erro";
    }
  } catch (erro) {
    mensagemStatusRestante.textContent = "Erro de conexão. Tenta de novo em instantes.";
    mensagemStatusRestante.className = "mensagem-status erro";
    console.error(erro);
  } finally {
    btnEnviarRestante.disabled = false;
  }
});

/* ---------- utilitário compartilhado: envio ao Apps Script ---------- */

async function enviarParaBackend(payload) {
  // Content-Type text/plain evita o preflight CORS que o Apps Script não trata bem
  const resposta = await fetch(CONFIG.APPS_SCRIPT_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify(payload),
  });
  return resposta.json();
}

carregarValorRestante();
