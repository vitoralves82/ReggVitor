# Registro de Atividade

> English version: [README.md](README.md)

Extensão local do Chrome para registrar, entender padrões e conduzir uma
redução progressiva até zero. Tudo fica em `chrome.storage.local`: nada sai
do navegador.

## Como instalar

1. Baixe ou clone esta pasta.
2. `chrome://extensions` → modo desenvolvedor → carregar sem compactação, ou
   recarregar a extensão se ela já estiver instalada.
3. Seus dados continuam onde estavam: o painel lê a mesma chave `registros`.
   Para levar a base a outro perfil, use Exportar e Importar.

Substitua sempre os arquivos na **mesma pasta** já carregada. Uma pasta nova
vira outra extensão, com outro ID, e o `chrome.storage.local` é por ID.

## Ideias centrais

| Conceito | Como funciona |
|---|---|
| Dia lógico | Começa às **04h**: a madrugada pertence ao dia anterior |
| Tipo de dia | Home office, escritório ou dia off. Padrão pelo dia da semana, corrigível à mão |
| Linha do tipo | Mediana dos dias completos daquele tipo. É a régua de comparação |
| Alvo do dia | Linha do tipo multiplicada pelo fator da meta de redução |
| Recordes | De todo o histórico, sem reinício mensal |

Comparar um sábado com a média de todos os dias mistura populações
diferentes: quase todo dia off apareceria como acima da média e quase todo
dia útil como abaixo. Por isso cada dia é medido contra o próprio tipo.

## Estrutura de dados

Registro: `{ data, hora, quantidade, timestamp, gatilho, nota }`, com
`gatilho` e `nota` opcionais. Outras chaves do storage:

- `tiposDia` — `{ "2026-09-05": "off", ... }`, apenas os dias corrigidos à
  mão. O padrão vem do dia da semana: sábado e domingo são off, terça e
  quinta são escritório, o resto é home office.
- `config` — janela, meta de redução, médias móveis, tema e tom das frases.

## Registro rápido

O popup mostra o total de hoje, os últimos 7 dias e o intervalo desde o
último registro. A barra e a frase logo abaixo comparam o dia com a **linha
do mesmo tipo de dia**, e o texto diz qual linha está sendo usada.

Regras da comparação:

- A referência é a **mediana** dos dias completos daquele tipo, não a média:
  um único dia atípico não desloca a régua do dia seguinte.
- O dia de hoje nunca entra na própria referência, porque ainda está aberto.
- Dias sem nenhum registro entram como 0 g. São eles que puxam a linha para
  baixo.
- Com menos de 3 dias completos daquele tipo, a amostra ainda é ruído: a
  comparação cai para a média diária dos dias completos recentes e o texto
  avisa o que falta.
- Passar o mouse na barra mostra o tamanho da amostra e o alvo do dia
  conforme a meta de redução.

Os botões "Hoje é" classificam o dia direto no popup e a comparação é
refeita na hora. Isso importa porque o padrão vem apenas do dia da semana e
erra em feriado, folga no meio da semana ou escritório fora do dia habitual.
A escolha é gravada em `tiposDia`, a mesma chave do painel, que se atualiza
sozinho quando está aberto.

## Arquivos

| Arquivo | Papel |
|---|---|
| `dia.js` | Dia lógico, tipo de dia, linha de cada tipo e fator da meta. Compartilhado pelo painel e pelo popup, para as duas telas usarem a mesma régua |
| `script.js` | Painel completo: agregação, gráficos, calendário e rota de redução |
| `popup.js` | Registro rápido: entrada, cartões do dia e comparação com a linha do tipo de dia |
| `mensagens.js` | Banco de frases de direção, escolhidas pelo estado do dia |

## Fora da extensão

Abrindo `index.html` direto no navegador, um espelho em `localStorage`
substitui o `chrome.storage`, útil para testar sem instalar.
