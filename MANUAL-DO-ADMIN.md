# Fulerão FC — Manual de quem administra os pedidos

Este manual é pra quem vai cuidar do dia a dia: conferir quem pagou, ver os
pedidos e fechar o valor final da camisa. Não precisa saber programar nem
mexer em GitHub pra nada disso — é tudo dentro da planilha do Google Sheets.

## Onde está tudo

Você vai trabalhar direto na **planilha do Google Sheets** do projeto (peça
o link pra quem criou o site, se ainda não tiver acesso). Ela tem duas
abas que importam pra você:

- **Pedidos** — uma linha por pessoa, atualizada automaticamente sempre que
  alguém preenche o site.
- **Config** — só uma célula que você mesmo preenche quando o valor final
  da camisa for definido.

## O que cada coluna da aba "Pedidos" quer dizer

| Coluna | O que é |
|---|---|
| Nome | Nome que a pessoa digitou no site |
| Tipo | Linha ou Goleiro |
| Tamanho | P, M, G, GG ou XG |
| Numero | Número que vai na camisa |
| NomeCamisa | Nome/apelido que vai estampado nas costas |
| SinalPago | SIM ou NAO — se o sinal de R$ 20 foi pago |
| ComprovanteSinalLink | Link que abre o print/foto do comprovante do sinal |
| RestantePago | SIM ou NAO — se o restante foi pago |
| ComprovanteRestanteLink | Link do comprovante do restante |
| DataHoraPedido | Quando a pessoa enviou ou atualizou o pedido |
| ValorRestantePago | O valor exato que estava valendo quando essa pessoa pagou o restante (protege o histórico caso você corrija o valor depois) |
| DataHoraRestante | Quando a pessoa confirmou o pagamento do restante |

## Como conferir se alguém pagou

1. Abra a planilha, aba **Pedidos**.
2. Procure o nome da pessoa (Ctrl+F funciona normal, igual em qualquer
   planilha).
3. Olhe a coluna `SinalPago` (ou `RestantePago`, dependendo da etapa).
   `SIM` quer dizer que a pessoa marcou o checkbox de "já paguei" no site.
4. Pra conferir de verdade se o comprovante bate, clique no link da coluna
   `ComprovanteSinalLink` (ou `ComprovanteRestanteLink`) — ele abre a
   imagem que a pessoa anexou, direto do Google Drive.

⚠️ O `SIM` sozinho não prova que a pessoa realmente pagou — é só ela
confirmando que pagou. A prova de verdade é o comprovante. Sempre que
tiver dúvida, abra o link e confere se o valor, a chave e a data batem.

## Como fechar o valor final da camisa (o "restante")

Quando a produção informar o preço final:

1. Vá na aba **Config** da planilha.
2. Na célula **B1**, digite o valor (só o número, ex: `40`).
3. Pronto. A partir desse momento, a seção "Pagamento final" do site passa
   a mostrar esse valor pra todo mundo e libera o envio do comprovante —
   você não precisa avisar ninguém pelo site, só precisa avisar a galera
   no grupo (WhatsApp, por exemplo) que já pode pagar.

Se precisar corrigir esse valor depois (por exemplo, errou de digitar), é
só sobrescrever a mesma célula com o valor certo.

## Somando quanto já entrou (sem fórmula nenhuma, se preferir)

Se não quiser mexer com fórmulas, dá pra só contar visualmente: filtre a
coluna `SinalPago` clicando na seta do cabeçalho > filtrar por `SIM`, e
veja quantas linhas aparecem. Multiplique pela taxa do sinal (R$ 20) e
pronto, esse é o total arrecadado até ali. Pro restante, some manualmente
a coluna `ValorRestantePago` das linhas onde `RestantePago = SIM` — não
multiplique pelo valor da aba `Config`, porque se você corrigiu esse valor
no meio do caminho, algumas pessoas podem ter pago um valor diferente do
atual, e a coluna `ValorRestantePago` guarda o que cada uma pagou de fato.

Se quiser algo automático, peça pra quem monta o site adicionar uma aba de
resumo com fórmulas — é rápido de fazer.

## Quem ainda não pagou

Use o mesmo filtro de cabeçalho da coluna `SinalPago` (ou `RestantePago`),
mas escolhendo `NAO` em vez de `SIM`. Aparecem só quem falta.

## O "código do grupo"

O site pede um código antes de aceitar qualquer pedido, pra ninguém de
fora conseguir mandar um pedido aleatório. Esse código só existe dentro do
código do site (não fica na planilha), então:

- Pergunte pra quem configurou o site (Rapha) qual é o código atual, pra
  poder repassar pro grupo.
- Se precisar trocar o código (por exemplo, se vazou pra alguém de fora),
  quem tem que mexer é o Rapha, não dá pra fazer isso pela planilha.

## Se alguém errou o pedido (tamanho, número, nome)

A pessoa mesma pode corrigir: ela volta no site, digita o nome dela de
novo, os campos aparecem preenchidos automaticamente, ela corrige o que
precisar e reenvia. Isso **atualiza** a linha dela na planilha, não cria
uma linha duplicada. Você não precisa editar nada manualmente.

Se preferir editar você mesmo direto na planilha (por exemplo, corrigindo
uma letra errada no nome), pode editar a célula normalmente — só não mexa
nas colunas `SinalPago`, `RestantePago`, `ValorRestantePago`,
`DataHoraRestante` e nos links de comprovante, porque essas são
preenchidas pelo sistema.

## Dúvidas técnicas

Qualquer coisa que fuja disso aqui (o site não carrega, dá erro estranho,
precisa mudar o código do grupo, mudar o valor do sinal, etc.), o contato é
quem configurou o site.
