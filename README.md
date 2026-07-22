# Fulerão FC — Site de pedido de camisa

Site estático (HTML/CSS/JS) + Google Sheets como banco de dados/planilha de
administração + Google Apps Script como backend. **Custo: R$ 0,00**, dentro
das cotas gratuitas do Google e do GitHub para o tamanho de um grupo de amigos.

Nenhuma dessas contas precisa ser paga: Google Sheets, Google Apps Script,
Google Drive e GitHub Pages têm um nível gratuito mais do que suficiente pra
isso (dezenas de pessoas enviando um formulário algumas vezes durante uma
semana é uma fração mínima da cota diária gratuita do Apps Script).

## Como funciona

1. O site mostra o esboço da camisa, a tabela de medidas e um formulário.
2. Pra enviar, além do nome (texto livre) a pessoa precisa digitar um
   **código do grupo** — uma senha única que você combina com a galera
   (por WhatsApp, por exemplo) e define uma vez no `Code.gs`. Isso é
   validado no servidor, não só na tela, então ninguém de fora do grupo
   consegue enviar mesmo tentando pelo console do navegador.
3. O pagamento é em duas etapas, do jeito que vocês cobram de verdade:
   - **Sinal fixo** (ex: R$ 20) na hora do pedido, junto com tamanho,
     número e nome na camisa — seção 02 do site.
   - **Restante**, com valor variável, cobrado depois quando a produção
     fechar o preço final — seção 03 do site, separada, pra pessoa acessar
     de novo quando vocês avisarem que já dá pra pagar.
4. Cada número de camisa só pode pertencer a uma pessoa por vez. O site
   mostra uma grade com todos os números de 0 a 99, coloridos por status
   (livre, reservado, ocupado), e a pessoa pode clicar num número livre
   pra preencher o campo sozinho. Isso é validado no servidor também, não
   só na tela — ninguém consegue roubar um número já ocupado mesmo
   tentando pelo console do navegador.
5. Existe uma aba `Reservas` na planilha, onde você (o admin) anota quem
   tem prioridade em cada número — seja porque participa ativamente dos
   babas, seja porque já usou aquele número na edição anterior. Enquanto a
   reserva estiver dentro do prazo, só a pessoa reservada consegue pegar
   aquele número livremente; qualquer outra pessoa precisa de uma segunda
   senha (`SENHA_LIBERACAO_RESERVA`) que só você deve entregar se o dono
   abrir mão do número. Depois do prazo, a reserva expira sozinha e o
   número fica livre pra qualquer um.
6. Ao enviar o pedido inicial, os dados vão pro Apps Script, que grava/atualiza
   uma linha na aba `Pedidos` da planilha e sobe o comprovante do Pix pro
   Google Drive, guardando o link na planilha.
7. Se a pessoa já tinha enviado um pedido, ao digitar o nome de novo os
   campos vêm preenchidos e o envio **atualiza** a linha em vez de duplicar.
8. Quando o valor final sair, você preenche **uma célula só** na aba
   `Config` da planilha, e a seção 03 do site passa a aceitar o pagamento
   do restante pra todo mundo.

## Passo 1 — Criar a planilha e o backend

1. Crie uma planilha nova no Google Sheets (ex: "Fulerão FC — Pedidos 2026").
2. Vá em **Extensões > Apps Script**.
3. Apague o conteúdo padrão de `Code.gs` e cole o conteúdo do arquivo
   `google-apps-script/Code.gs` deste projeto.
4. Na barra de funções do editor, selecione `configurarPlanilha` e clique em
   **Executar** (▶). Na primeira vez ele vai pedir autorização — autorize
   com sua própria conta Google. Isso cria a aba `Pedidos` (com o cabeçalho
   certo), a aba `Config` (onde depois você vai colocar o valor do restante)
   e a aba `Reservas` (com uma linha de exemplo).
5. Ainda no `Code.gs`, troque o valor de `SENHA_GRUPO` (perto do topo do
   arquivo) por um código que só o grupo vai saber, tipo `"fulerao10"` ou
   qualquer coisa fácil de repassar no WhatsApp. Troque também
   `SENHA_LIBERACAO_RESERVA` por outro código — esse **não é pra repassar
   pro grupo todo**, é só pra você usar pontualmente quando alguém abrir
   mão de um número reservado que era dele. Salve o arquivo (💾 ou
   `Ctrl+S`).
6. Vá na aba `Reservas` da planilha e apague a linha de exemplo, colocando
   no lugar quem tem prioridade em cada número (veja a seção "Reservas de
   número" mais abaixo).

> **Já tinha configurado a planilha antes desta atualização?** O
> `configurarPlanilha` só cria abas que não existem, então ele não vai
> reescrever o cabeçalho sozinho. Confira se a aba `Pedidos` tem estas 12
> colunas, na ordem: `Nome, Tipo, Tamanho, Numero, NomeCamisa, SinalPago,
> ComprovanteSinalLink, RestantePago, ComprovanteRestanteLink,
> DataHoraPedido, ValorRestantePago, DataHoraRestante`. Se faltar alguma,
> insira colunas manualmente (botão direito na letra da coluna → Inserir
> coluna) até bater com essa ordem. Se não tiver dados reais ainda, é mais
> simples apagar a aba `Pedidos` inteira e rodar `configurarPlanilha` de
> novo — ele recria do zero certinho. Rodar de novo também cria a aba
> `Reservas`, que é nova nesta versão.

## Passo 2 — Publicar o Web App

1. No editor do Apps Script, clique em **Implantar > Nova implantação**.
2. Tipo: **App da Web**.
3. Executar como: **Eu (seu e-mail)**.
4. Quem pode acessar: **Qualquer pessoa**.
5. Clique em **Implantar** e autorize de novo se for pedido.
6. Copie a **URL do app da Web** (termina em `/exec`).

Guarde essa URL, ela é a "porta de entrada" que o site vai usar. Toda vez
que você editar o `Code.gs`, precisa fazer **Gerenciar implantações > editar
(lápis) > Nova versão** pra a mudança valer.

## Passo 3 — Configurar o site

Abra `script.js` e edite o bloco `CONFIG` no topo do arquivo:

```js
const CONFIG = {
  APPS_SCRIPT_URL: "https://script.google.com/macros/s/SEU_ID/exec", // cole a URL do passo 2
  VALOR_SINAL: 20.0,
  CHAVE_PIX: "sua chave pix aqui",
  TIPO_CHAVE_PIX: "e-mail", // ou celular, cpf, aleatória
};
```

Depois:

- Coloque o esboço real da camisa em `assets/camisa.png` (até lá, aparece um
  placeholder indicando onde colocar).
- Se quiser, gere o QR Code Pix estático (o próprio app do seu banco costuma
  ter opção de "gerar QR code sem valor fixo" ou "com valor fixo") e salve a
  imagem como `assets/qr-pix.png`.
- Quando você me mandar a tabela de medidas real, eu troco os valores de
  exemplo na tabela do `index.html` pelos definitivos.

## Passo 4 — Publicar o site (GitHub Pages, grátis)

1. Crie um repositório novo no GitHub (pode ser privado ou público).
2. Suba os arquivos deste projeto (`index.html`, `style.css`, `script.js`,
   pasta `assets/`) pra raiz do repositório.
3. Vá em **Settings > Pages**, em "Source" escolha a branch `main` e a pasta
   `/root`, salve.
4. Em alguns minutos o site fica no ar em algo como
   `https://seu-usuario.github.io/nome-do-repo/`.

Se preferir não usar GitHub, o mesmo funciona com Cloudflare Pages, Netlify
ou Vercel (free tier) arrastando a pasta do projeto — mas GitHub Pages é o
mais direto pra quem já mexe com Git.

## Administração — planilha

A aba `Pedidos` já é a sua planilha de gestão, com colunas separadas pro
sinal e pro restante:

`Nome | Tipo | Tamanho | Numero | NomeCamisa | SinalPago | ComprovanteSinalLink | RestantePago | ComprovanteRestanteLink | DataHoraPedido | ValorRestantePago | DataHoraRestante`

A coluna `Tipo` guarda "Linha" ou "Goleiro", conforme a pessoa escolhe no
site. As colunas `ValorRestantePago` e `DataHoraRestante` registram o valor
exato e o momento em que cada pessoa confirmou o restante — isso importa
porque, se você corrigir o valor na aba `Config` depois que algumas pessoas
já pagaram, cada linha continua com o valor que estava valendo na hora,
sem misturar histórico.

Quando o valor final da camisa for fechado, vá na aba `Config` e preencha a
célula **B1** com o valor (ex: `40`). A partir daí, a seção 03 do site passa
a mostrar esse valor pra todo mundo e aceitar o comprovante do restante —
sem precisar tocar em nenhuma linha da aba `Pedidos`.

Sugestões de abas extras que você pode montar em 2 minutos com fórmulas
nativas do Sheets (não precisa de código):

- **Resumo por tamanho**: `=COUNTIF(Pedidos!C:C; "P")` (repita pra M, G, GG, XG;
  a coluna mudou de B pra C porque agora tem a coluna `Tipo` antes).
- **Quantos goleiros**: `=COUNTIF(Pedidos!B:B; "Goleiro")`.
- **Total do sinal arrecadado**: `=COUNTIF(Pedidos!F:F; "SIM") * 20` (troque
  20 pelo valor do sinal).
- **Total do restante arrecadado**: `=SUMIF(Pedidos!H:H; "SIM"; Pedidos!K:K)`
  (soma o valor que cada um efetivamente pagou, coluna `ValorRestantePago` —
  mais preciso do que multiplicar pelo valor atual da `Config`, caso o
  valor tenha mudado no meio do caminho).
- **Quem falta pagar o sinal**: filtro na coluna `SinalPago` = `NAO`.
- **Quem falta pagar o restante**: filtro na coluna `RestantePago` = `NAO`
  (só faz sentido depois que `Config!B1` estiver preenchido).
- Os links das colunas `ComprovanteSinalLink` e `ComprovanteRestanteLink`
  abrem direto o print/foto que a pessoa enviou, salvos automaticamente
  numa pasta do seu Google Drive chamada "Fulerao FC - Comprovantes Pix".

## Reservas de número

A aba `Reservas` tem 3 colunas: `Numero | Nome | ValidoAte`. Você preenche
manualmente, uma linha por número que tem prioridade definida — as duas
regras do grupo (participação ativa nos babas da TCN, e preferência de
quem já usou aquele número na edição anterior) são critérios seus, o
sistema só aplica o resultado que você decidir.

Exemplo de linha: `10 | Rapha | 2026-08-15` — o número 10 fica reservado
pro Rapha até 15/08/2026. Formato de data: `AAAA-MM-DD` funciona bem no
Sheets independente da configuração regional.

**O que acontece com um número reservado:**

- Se a própria pessoa reservada preencher o pedido com aquele número, ela
  passa direto, sem precisar de senha extra — o site já reconhece que é a
  reserva dela (mesmo nome, ignorando maiúscula/minúscula e espaço).
- Se **outra pessoa** tentar pegar esse número enquanto a reserva estiver
  dentro do prazo, o site pede a `SENHA_LIBERACAO_RESERVA` (a segunda
  senha, diferente do código do grupo). Só entregue essa senha pra alguém
  se o dono do número realmente abriu mão dele.
- Depois da data em `ValidoAte`, a reserva expira sozinha — o número passa
  a aparecer como livre pra qualquer um, sem precisar de senha nenhuma.
- Um número não pode ficar reservado e ocupado ao mesmo tempo: assim que
  alguém confirma um pedido com aquele número, ele passa a contar como
  "ocupado" pra todo mundo, reserva ou não.

A grade de números do site (seção 02) mostra em tempo quase real —
atualiza ao carregar a página, depois de qualquer pedido confirmado, e com
o botão "Atualizar" — quais números estão livres, reservados (com o nome
de quem) ou ocupados. A pessoa pode clicar num número livre pra preencher
o campo sozinho.

## Sobre o controle de acesso

O acesso geral é controlado por um código do grupo (`SENHA_GRUPO` no
`Code.gs`), validado no servidor — então ninguém de fora do grupo consegue
enviar um pedido, mesmo tentando direto pelo console do navegador. Existe
uma segunda senha, `SENHA_LIBERACAO_RESERVA`, só pra destravar um número
reservado de outra pessoa — trate essa como uma senha de uso pontual, não
como algo pra deixar fixado num grupo de WhatsApp.

Como o nome agora é texto livre, o único cuidado é: se alguém digitar o
próprio nome de formas diferentes em pedidos separados (ex: "Rapha" numa
vez e "Raphael" noutra), o sistema entende como duas pessoas diferentes —
o casamento de nomes ignora maiúscula/minúscula e espaços nas pontas, mas
não adivinha apelidos diferentes. Vale combinar com o grupo pra sempre
usar o mesmo nome (isso também é importante pra reserva de número
reconhecer a pessoa certa).

Se um dia quiser trocar qualquer uma das senhas (por exemplo, se vazou), é
só editar a constante correspondente no `Code.gs` e publicar uma nova
versão da implantação (veja o Passo 2).

## Se algo der CORS/erro de conexão

Apps Script às vezes é chato com CORS em POST. Duas checagens rápidas:

1. Abra a URL do `/exec` direto no navegador com `?action=valorRestante` no
   final — se aparecer um JSON tipo `{"valor":null}`, o backend está no ar.
2. O `script.js` já manda o POST com `Content-Type: text/plain` de propósito
   (evita o navegador disparar uma checagem de CORS que o Apps Script não
   responde direito). Não troque esse header.

Se mesmo assim der erro, me avisa o texto exato do erro no console do
navegador (F12 > Console) que eu ajusto.
