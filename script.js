/* ======================================================
   CONFIGURAÇÃO — edite estes valores conforme seu grupo
   ====================================================== */
   const CONFIG = {
    // Cole aqui a URL do Web App depois de publicar o Google Apps Script
    APPS_SCRIPT_URL: "https://script.google.com/macros/s/AKfycbzAWhO2duPVnVJ2YYQQb9Qm25Opja-6q5vE7tODZbFG4ZqXO0Ls9TR-6rUX0o_v5qYn/exec",
  
    VALOR_SINAL: 20.0, // valor fixo cobrado na hora do pedido, em reais
    CHAVE_PIX: "778f0c26-9e28-4a5d-8ee4-f0ad8cde6c96",
    TIPO_CHAVE_PIX: "aleatória",
  };
  
  const TAMANHOS_VALIDOS = ["P", "M", "G", "GG", "XG"];
  const TIPOS_CAMISA_VALIDOS = ["Linha", "Goleiro"];
  const TAMANHO_MAX_ARQUIVO_MB = 8;
  
  /* ====================================================== */
  /* ---------- helpers de validação (usados nos 2 formulários) ---------- */
  
  function mostrarErroCampo(idInput, idErro, mensagem) {
    const campoErro = document.getElementById(idErro);
    const campoInput = document.getElementById(idInput);
    campoErro.textContent = mensagem;
    campoErro.classList.add("visivel");
    campoInput.classList.add("campo-invalido");
  }
  
  function limparErroCampo(idInput, idErro) {
    const campoErro = document.getElementById(idErro);
    const campoInput = document.getElementById(idInput);
    campoErro.textContent = "";
    campoErro.classList.remove("visivel");
    campoInput.classList.remove("campo-invalido");
  }
  
  function limparErros(pares) {
    pares.forEach(([idInput, idErro]) => limparErroCampo(idInput, idErro));
  }
  
  function validarArquivoImagem(arquivo) {
    if (!arquivo) return "Anexe o comprovante (print ou foto).";
    if (!arquivo.type.startsWith("image/")) {
      return "O arquivo precisa ser uma imagem (print ou foto), não outro tipo de arquivo.";
    }
    if (arquivo.size > TAMANHO_MAX_ARQUIVO_MB * 1024 * 1024) {
      return `A imagem está muito grande (máx. ${TAMANHO_MAX_ARQUIVO_MB}MB). Tenta tirar um print menor ou comprimir a foto.`;
    }
    return null;
  }
  
  function focarPrimeiroInvalido(idsCampos) {
    for (const id of idsCampos) {
      const el = document.getElementById(id);
      if (el.classList.contains("campo-invalido")) {
        el.focus();
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        return;
      }
    }
  }
  
  function normalizarNomeCliente(nome) {
    return String(nome || "").trim().toLowerCase();
  }
  
  /* utilitário: arquivo -> base64 */
  
  function arquivoParaBase64(arquivo) {
    return new Promise((resolve, reject) => {
      const leitor = new FileReader();
      leitor.onload = () => resolve(leitor.result.split(",")[1]);
      leitor.onerror = () => reject(new Error("Falha ao ler o comprovante"));
      leitor.readAsDataURL(arquivo);
    });
  }
  
  /* envio ao Apps Script, com tratamento de erro de rede/servidor */
  
  async function enviarParaBackend(payload) {
    let resposta;
    try {
      resposta = await fetch(CONFIG.APPS_SCRIPT_URL, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify(payload),
      });
    } catch (erroDeRede) {
      throw new Error(
        "Não consegui falar com o servidor. Verifica sua internet e tenta de novo."
      );
    }
  
    if (!resposta.ok) {
      throw new Error(
        `O servidor respondeu com um erro (HTTP ${resposta.status}). Tenta de novo em instantes.`
      );
    }
  
    try {
      return await resposta.json();
    } catch (erroDeParse) {
      throw new Error("Resposta inesperada do servidor. Avisa quem administra o site.");
    }
  }
  
  /* ---------- Formulário 1: pedido inicial + sinal ---------- */
  
  const form = document.getElementById("form-pedido");
  const inputNome = document.getElementById("nome");
  const inputSenhaGrupo = document.getElementById("senhaGrupo");
  const inputTipoCamisa = document.getElementById("tipoCamisa");
  const inputTamanho = document.getElementById("tamanho");
  const inputNumero = document.getElementById("numero");
  const inputNomeCamisa = document.getElementById("nomeCamisa");
  const inputComprovante = document.getElementById("comprovante");
  const inputJaPaguei = document.getElementById("jaPaguei");
  const previewNumero = document.getElementById("preview-numero");
  const previewNome = document.getElementById("preview-nome");
  const previewTipo = document.getElementById("preview-tipo");
  const mensagemStatus = document.getElementById("mensagem-status");
  const btnEnviar = document.getElementById("btn-enviar");
  const avisoReservaNome = document.getElementById("aviso-reserva-nome");
  const statusNumeroInfo = document.getElementById("status-numero-info");
  const blocoSenhaLiberacao = document.getElementById("bloco-senha-liberacao");
  const inputSenhaLiberacao = document.getElementById("senhaLiberacao");
  const gradeNumeros = document.getElementById("grade-numeros");
  const btnAtualizarNumeros = document.getElementById("btn-atualizar-numeros");
  
  const CAMPOS_PEDIDO = [
    ["nome", "erro-nome"],
    ["senhaGrupo", "erro-senhaGrupo"],
    ["tipoCamisa", "erro-tipoCamisa"],
    ["tamanho", "erro-tamanho"],
    ["numero", "erro-numero"],
    ["nomeCamisa", "erro-nomeCamisa"],
    ["comprovante", "erro-comprovante"],
    ["jaPaguei", "erro-jaPaguei"],
  ];
  
  document.getElementById("valor-sinal").textContent =
    "R$ " + CONFIG.VALOR_SINAL.toFixed(2).replace(".", ",");
  document.getElementById("chave-pix").textContent = CONFIG.CHAVE_PIX;
  document.getElementById("tipo-chave").textContent = CONFIG.TIPO_CHAVE_PIX;
  
  CAMPOS_PEDIDO.forEach(([idInput, idErro]) => {
    const el = document.getElementById(idInput);
    const evento = el.type === "checkbox" || el.tagName === "SELECT" ? "change" : "input";
    el.addEventListener(evento, () => limparErroCampo(idInput, idErro));
  });
  
  /* ---------- grade de números: carrega, desenha e contabiliza ---------- */
  
  let estadoNumeroAtual = null;
  
  async function carregarGradeNumeros() {
    try {
      const resp = await fetch(`${CONFIG.APPS_SCRIPT_URL}?action=numeros`);
      const dados = await resp.json();
      const numeros = dados.numeros || [];
      desenharGradeNumeros(numeros);
      atualizarContadoresLegenda(numeros);
    } catch (erro) {
      gradeNumeros.innerHTML = `<p class="grade-carregando">Não consegui carregar os números agora. Clica em "Atualizar".</p>`;
      console.error("Falha ao buscar grade de números:", erro);
    }
  }
  
  function atualizarContadoresLegenda(numeros) {
    let livres = 0;
    let reservados = 0;
    let ocupados = 0;
  
    numeros.forEach((item) => {
      if (item.status === "ocupado") ocupados++;
      else if (item.status === "reservado") reservados++;
      else livres++;
    });
  
    const elLivre = document.getElementById("qtd-livres");
    const elReservado = document.getElementById("qtd-reservados");
    const elOcupado = document.getElementById("qtd-ocupados");
  
    if (elLivre) elLivre.textContent = `(${livres})`;
    if (elReservado) elReservado.textContent = `(${reservados})`;
    if (elOcupado) elOcupado.textContent = `(${ocupados})`;
  }
  
  function desenharGradeNumeros(numeros) {
    gradeNumeros.innerHTML = "";
    const numeroSelecionado = inputNumero.value ? Number(inputNumero.value) : null;
  
    numeros.forEach((item) => {
      const celula = document.createElement("button");
      celula.type = "button";
      celula.className = "numero-celula";
      celula.textContent = String(item.numero).padStart(2, "0");
  
      if (item.status === "reservado") {
        celula.classList.add("numero-reservado");
        celula.title = `Reservado para ${item.nome} até ${item.validoAte}`;
      } else if (item.status === "ocupado") {
        celula.classList.add("numero-ocupado");
        celula.title = `Ocupado por ${item.nome}`;
        celula.disabled = true;
      } else {
        celula.title = "Livre";
      }
  
      if (numeroSelecionado === item.numero) {
        celula.classList.add("numero-selecionada");
      }
  
      celula.addEventListener("click", () => {
        inputNumero.value = item.numero;
        atualizarPreview();
        limparErroCampo("numero", "erro-numero");
        consultarStatusNumero(item.numero);
        document
          .querySelectorAll(".numero-celula.numero-selecionada")
          .forEach((el) => el.classList.remove("numero-selecionada"));
        celula.classList.add("numero-selecionada");
      });
  
      gradeNumeros.appendChild(celula);
    });
  }
  
  btnAtualizarNumeros.addEventListener("click", carregarGradeNumeros);
  
  /* consulta o status do número e só exibe a senha se houver um nome digitado que discorde da reserva */
  
  async function consultarStatusNumero(numero) {
    if (numero === "" || numero === null || isNaN(Number(numero))) {
      statusNumeroInfo.textContent = "";
      estadoNumeroAtual = null;
      blocoSenhaLiberacao.classList.add("oculto");
      return;
    }
  
    statusNumeroInfo.textContent = "Consultando...";
    statusNumeroInfo.className = "status-numero-info";
  
    try {
      const resp = await fetch(`${CONFIG.APPS_SCRIPT_URL}?action=numeroInfo&numero=${Number(numero)}`);
      const dados = await resp.json();
      estadoNumeroAtual = dados;
  
      const nomeCamisaDigitado = normalizarNomeCliente(inputNomeCamisa.value);
      const nomeReserva = normalizarNomeCliente(dados.nome);
      
      // Verifica se a pessoa preencheu o nome na camisa e se bate com a reserva
      const temNomeDigitado = nomeCamisaDigitado.length > 0;
      const souEuQueTenhoReserva = dados.status === "reservado" && temNomeDigitado && nomeCamisaDigitado === nomeReserva;
  
      if (dados.status === "ocupado") {
        statusNumeroInfo.textContent = `Ocupado por ${dados.nome}. Escolha outro número.`;
        statusNumeroInfo.className = "status-numero-info status-ocupado";
        blocoSenhaLiberacao.classList.add("oculto");
      } else if (dados.status === "reservado" && souEuQueTenhoReserva) {
        statusNumeroInfo.textContent = `Esse número está reservado pra você (${dados.nome}) até ${dados.validoAte}. Pode seguir!`;
        statusNumeroInfo.className = "status-numero-info status-livre";
        blocoSenhaLiberacao.classList.add("oculto");
      } else if (dados.status === "reservado") {
        statusNumeroInfo.textContent = `Reservado para ${dados.nome} até ${dados.validoAte}.`;
        statusNumeroInfo.className = "status-numero-info status-reservado";
        
        // REGRA AJUSTADA: Só exibe o campo de senha se o usuário já tiver digitado um nome na camisa
        // E esse nome for DIFERENTE do dono da reserva.
        if (temNomeDigitado && nomeCamisaDigitado !== nomeReserva) {
          blocoSenhaLiberacao.classList.remove("oculto");
        } else {
          blocoSenhaLiberacao.classList.add("oculto");
        }
      } else {
        statusNumeroInfo.textContent = "Número livre.";
        statusNumeroInfo.className = "status-numero-info status-livre";
        blocoSenhaLiberacao.classList.add("oculto");
      }
    } catch (erro) {
      statusNumeroInfo.textContent = "Não consegui consultar esse número agora.";
      console.error("Falha ao consultar status do número:", erro);
    }
  }
  
  inputNumero.addEventListener("blur", () => consultarStatusNumero(inputNumero.value));
  
  // Sempre que o usuário alterar o Nome da Camisa, reavalia a necessidade da senha de liberação
  inputNomeCamisa.addEventListener("input", () => {
    if (inputNumero.value) consultarStatusNumero(inputNumero.value);
  });
  
  function mostrarAvisoReserva(reserva) {
    if (reserva) {
      avisoReservaNome.textContent = `Você tem o número ${reserva.numero} reservado até ${reserva.validoAte}!`;
    } else {
      avisoReservaNome.textContent = "";
    }
  }
  
  function validarFormularioPedido() {
    limparErros(CAMPOS_PEDIDO);
    let valido = true;
  
    if (!inputNome.value.trim()) {
      mostrarErroCampo("nome", "erro-nome", "Preencha seu nome.");
      valido = false;
    }
  
    if (!inputSenhaGrupo.value.trim()) {
      mostrarErroCampo("senhaGrupo", "erro-senhaGrupo", "Preencha o código do grupo.");
      valido = false;
    }
  
    if (!TIPOS_CAMISA_VALIDOS.includes(inputTipoCamisa.value)) {
      mostrarErroCampo("tipoCamisa", "erro-tipoCamisa", "Escolha o tipo de camisa.");
      valido = false;
    }
  
    if (!TAMANHOS_VALIDOS.includes(inputTamanho.value)) {
      mostrarErroCampo("tamanho", "erro-tamanho", "Escolha o tamanho.");
      valido = false;
    }
  
    const numero = Number(inputNumero.value);
    if (inputNumero.value === "" || isNaN(numero) || numero < 0 || numero > 99) {
      mostrarErroCampo("numero", "erro-numero", "Informe um número entre 0 e 99.");
      valido = false;
    } else if (estadoNumeroAtual && estadoNumeroAtual.numero === numero) {
      const souEuQueTenhoReserva =
        estadoNumeroAtual.status === "reservado" &&
        normalizarNomeCliente(estadoNumeroAtual.nome) === normalizarNomeCliente(inputNomeCamisa.value);
  
      if (estadoNumeroAtual.status === "ocupado") {
        mostrarErroCampo("numero", "erro-numero", `Esse número já está ocupado por ${estadoNumeroAtual.nome}.`);
        valido = false;
      } else if (estadoNumeroAtual.status === "reservado" && !souEuQueTenhoReserva) {
        if (!inputSenhaLiberacao.value.trim()) {
          mostrarErroCampo(
            "senhaLiberacao",
            "erro-senhaLiberacao",
            "Esse número é reservado de outra pessoa — informe a senha de liberação."
          );
          valido = false;
        }
      }
    }
  
    const erroArquivo = validarArquivoImagem(inputComprovante.files[0]);
    if (erroArquivo) {
      mostrarErroCampo("comprovante", "erro-comprovante", erroArquivo);
      valido = false;
    }
  
    if (!inputJaPaguei.checked) {
      mostrarErroCampo("jaPaguei", "erro-jaPaguei", "Confirme que você já fez o Pix do sinal.");
      valido = false;
    }
  
    return valido;
  }
  
  async function carregarPedidoExistente(nome) {
    try {
      const resp = await fetch(
        `${CONFIG.APPS_SCRIPT_URL}?action=pedido&nome=${encodeURIComponent(nome)}`
      );
      const dados = await resp.json();
  
      if (dados.encontrado) {
        inputTipoCamisa.value = dados.tipo || "";
        inputTamanho.value = dados.tamanho || "";
        inputNumero.value = dados.numero || "";
        inputNomeCamisa.value = dados.nomeCamisa || "";
        inputJaPaguei.checked = dados.sinalPago === "SIM";
        mensagemStatus.textContent =
          "Você já tem um pedido salvo — os campos foram preenchidos. Ajuste se precisar e reenvie.";
        mensagemStatus.className = "mensagem-status";
        if (dados.numero) consultarStatusNumero(dados.numero);
      }
  
      mostrarAvisoReserva(dados.reserva);
    } catch (erro) {
      console.error("Falha ao buscar pedido existente:", erro);
    }
    atualizarPreview();
  }
  
  inputNome.addEventListener("blur", () => {
    if (inputNome.value.trim()) carregarPedidoExistente(inputNome.value.trim());
  });
  
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
  
  form.addEventListener("submit", async (evento) => {
    evento.preventDefault();
  
    if (CONFIG.APPS_SCRIPT_URL.includes("COLE_AQUI")) {
      mensagemStatus.textContent =
        "O site ainda não foi conectado à planilha (APPS_SCRIPT_URL em script.js).";
      mensagemStatus.className = "mensagem-status erro";
      return;
    }
  
    if (!validarFormularioPedido()) {
      mensagemStatus.textContent = "Corrija os campos destacados em vermelho antes de enviar.";
      mensagemStatus.className = "mensagem-status erro";
      focarPrimeiroInvalido(CAMPOS_PEDIDO.map(([idInput]) => idInput));
      return;
    }
  
    btnEnviar.disabled = true;
    mensagemStatus.textContent = "Enviando...";
    mensagemStatus.className = "mensagem-status";
  
    try {
      const arquivoComprovante = inputComprovante.files[0];
      const comprovanteBase64 = await arquivoParaBase64(arquivoComprovante);
  
      const payload = {
        etapa: "pedido",
        nome: inputNome.value.trim(),
        senhaGrupo: inputSenhaGrupo.value,
        tipoCamisa: inputTipoCamisa.value,
        tamanho: inputTamanho.value,
        numero: inputNumero.value,
        nomeCamisa: inputNomeCamisa.value.trim(),
        pago: inputJaPaguei.checked ? "SIM" : "NAO",
        senhaLiberacao: inputSenhaLiberacao.value.trim(),
        comprovanteBase64: comprovanteBase64,
        comprovanteNome: arquivoComprovante.name,
      };
  
      const resultado = await enviarParaBackend(payload);
  
      if (resultado.success) {
        mensagemStatus.textContent = "Escalação confirmada! Sinal salvo na planilha.";
        mensagemStatus.className = "mensagem-status sucesso";
        carregarGradeNumeros();
      } else {
        mensagemStatus.textContent = resultado.message || "Não foi possível salvar o pedido.";
        mensagemStatus.className = "mensagem-status erro";
      }
    } catch (erro) {
      mensagemStatus.textContent = erro.message || "Algo deu errado. Tenta de novo em instantes.";
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
  const inputComprovanteRestante = document.getElementById("comprovanteRestante");
  const inputJaPagueiRestante = document.getElementById("jaPagueiRestante");
  const statusValorRestante = document.getElementById("status-valor-restante");
  const mensagemStatusRestante = document.getElementById("mensagem-status-restante");
  const btnEnviarRestante = document.getElementById("btn-enviar-restante");
  
  const CAMPOS_RESTANTE = [
    ["nomeRestante", "erro-nomeRestante"],
    ["senhaGrupoRestante", "erro-senhaGrupoRestante"],
    ["comprovanteRestante", "erro-comprovanteRestante"],
    ["jaPagueiRestante", "erro-jaPagueiRestante"],
  ];
  
  document.getElementById("chave-pix-2").textContent = CONFIG.CHAVE_PIX;
  document.getElementById("tipo-chave-2").textContent = CONFIG.TIPO_CHAVE_PIX;
  
  CAMPOS_RESTANTE.forEach(([idInput, idErro]) => {
    const el = document.getElementById(idInput);
    const evento = el.type === "checkbox" ? "change" : "input";
    el.addEventListener(evento, () => limparErroCampo(idInput, idErro));
  });
  
  function validarFormularioRestante() {
    limparErros(CAMPOS_RESTANTE);
    let valido = true;
  
    if (!inputNomeRestante.value.trim()) {
      mostrarErroCampo("nomeRestante", "erro-nomeRestante", "Preencha seu nome.");
      valido = false;
    }
  
    if (!inputSenhaRestante.value.trim()) {
      mostrarErroCampo("senhaGrupoRestante", "erro-senhaGrupoRestante", "Preencha o código do grupo.");
      valido = false;
    }
  
    const erroArquivo = validarArquivoImagem(inputComprovanteRestante.files[0]);
    if (erroArquivo) {
      mostrarErroCampo("comprovanteRestante", "erro-comprovanteRestante", erroArquivo);
      valido = false;
    }
  
    if (!inputJaPagueiRestante.checked) {
      mostrarErroCampo(
        "jaPagueiRestante",
        "erro-jaPagueiRestante",
        "Confirme que você já fez o Pix do restante."
      );
      valido = false;
    }
  
    return valido;
  }
  
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
      statusValorRestante.textContent =
        "Não consegui consultar o valor agora. Recarregue a página ou tenta de novo em instantes.";
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
  
    if (!validarFormularioRestante()) {
      mensagemStatusRestante.textContent = "Corrija os campos destacados em vermelho antes de enviar.";
      mensagemStatusRestante.className = "mensagem-status erro";
      focarPrimeiroInvalido(CAMPOS_RESTANTE.map(([idInput]) => idInput));
      return;
    }
  
    btnEnviarRestante.disabled = true;
    mensagemStatusRestante.textContent = "Enviando...";
    mensagemStatusRestante.className = "mensagem-status";
  
    try {
      const arquivoComprovante = inputComprovanteRestante.files[0];
      const comprovanteBase64 = await arquivoParaBase64(arquivoComprovante);
  
      const payload = {
        etapa: "restante",
        nome: inputNomeRestante.value.trim(),
        senhaGrupo: inputSenhaRestante.value,
        comprovanteBase64: comprovanteBase64,
        comprovanteNome: arquivoComprovante.name,
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
      mensagemStatusRestante.textContent =
        erro.message || "Algo deu errado. Tenta de novo em instantes.";
      mensagemStatusRestante.className = "mensagem-status erro";
      console.error(erro);
    } finally {
      btnEnviarRestante.disabled = false;
    }
  });
  
  /* ---------- Função para copiar a chave Pix ---------- */
  
  function copiarChavePix(btnElemento) {
    const chave = CONFIG.CHAVE_PIX;
    
    if (!chave) return;
  
    navigator.clipboard.writeText(chave).then(() => {
      const textoOriginal = btnElemento.textContent;
      btnElemento.textContent = "✓ Copiado!";
      btnElemento.classList.add("copiado");
  
      setTimeout(() => {
        btnElemento.textContent = textoOriginal;
        btnElemento.classList.remove("copiado");
      }, 2000);
    }).catch((erro) => {
      console.error("Erro ao copiar chave Pix:", erro);
      alert("Não foi possível copiar automaticamente. Selecione e copie a chave manualmente.");
    });
  }
  
  document.getElementById("btn-copiar-pix")?.addEventListener("click", function () {
    copiarChavePix(this);
  });
  
  document.getElementById("btn-copiar-pix-2")?.addEventListener("click", function () {
    copiarChavePix(this);
  });
  
  carregarValorRestante();
  carregarGradeNumeros();