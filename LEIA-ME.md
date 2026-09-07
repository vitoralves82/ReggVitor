# Registro de Atividade — painel v2.1

> English version: [README.md](README.md)

Painel local para registrar, entender padrões e conduzir uma redução progressiva
até zero. A versão 2.1 reúne a versão mais recente usada no Chrome com melhorias
de contraste, orientação prática e progressão.

## Como instalar

1. Baixe ou clone esta pasta.
2. `chrome://extensions` → recarregar a extensão.
3. Seus dados **já estão lá**: o painel lê a mesma chave `registros` do
   `chrome.storage.local`. Não é preciso importar nada.
   (Se quiser levar a base para outro perfil: Backup → Importar (mesclar).)

Nada foi removido do storage. A chave antiga `resumoDiario` não é mais usada —
o resumo é derivado dos registros a cada render, então não existe mais o risco de
resumo dessincronizado. Pode apagá-la depois, se quiser.

## O que mudou nos conceitos

| Antes | Agora |
|---|---|
| Rankings e troféus por mês (reiniciavam) | Recordes de todo o histórico, que não reiniciam |
| "Maior intervalo intra" premiava dia com **1** registro (media até a meia-noite) | Intervalo médio real entre usos, comparado com as 2 semanas anteriores |
| Dia lógico = meia-noite (madrugada virava dia seguinte) | **Dia lógico começa às 04h** |
| Médias globais (2 g de terça e 12 g de sábado no mesmo balde) | Tudo comparado com a **mediana do mesmo tipo de dia** (home office / escritório / dia off) |
| `T:2,4 · R:5 · I:144min` no calendário | Heatmap relativo à sua linha + tipo de dia + nº de registros |
| Importar substituía a base inteira | Importar **mescla** e deduplica; nada é apagado |

## Estrutura de dados

Registro: `{ data, hora, quantidade, timestamp, gatilho, nota }` — `gatilho` e
`nota` são opcionais. Chaves adicionais no storage:

- `tiposDia` — `{ "2026-07-25": "off", ... }`, só os dias que você corrigiu à mão.
  O padrão vem do dia da semana (sáb/dom = off, ter/qui = escritório, resto = home office).
- `config` — janela, meta %/mês e tema.

## Como ler o painel

1. Compare a média de 7 dias com a semana anterior e com a trajetória da meta.
2. Encontre onde o consumo se concentra: tipo de dia, horário e motivo.
3. Teste uma única alavanca por 7 dias e veja se a média respondeu.

A **Rota de redução** usa a primeira semana completa como linha de base e mostra
os marcos de 10%, 25%, 50%, 75% e uma semana em zero. Ela indica direção, não um
diagnóstico clínico.

## Registro rápido

O popup mostra o total de hoje, os últimos 7 dias e o intervalo desde o último
registro. A mensagem abaixo dos cartões sempre propõe uma direção simples:
proteger ou alongar o próximo intervalo, sem compensações bruscas.

Abaixo dos cartões, a barra e a frase comparam o dia com a **linha do mesmo
tipo de dia**, não com uma média única de todos os dias. Um sábado é comparado
com a mediana dos seus dias off, uma terça no escritório com a mediana dos dias
de escritório. Misturar populações diferentes produz um alerta que não orienta
nada: quase todo dia off apareceria como "acima da média" e quase todo dia útil
como "abaixo".

Regras da comparação:

- A referência é a **mediana** dos dias completos daquele tipo, não a média:
  um único dia atípico não desloca a régua do dia seguinte.
- O dia de hoje nunca entra na própria referência, porque ainda está aberto.
- Dias sem nenhum registro entram na conta como 0 g. São eles que puxam a
  linha para baixo.
- Com menos de 3 dias completos daquele tipo, a amostra ainda é ruído: a frase
  cai para a média diária geral e avisa que faltam dias para comparar.

Os três botões "Hoje é" classificam o dia direto no popup (home office,
escritório, dia off) e a comparação é refeita na hora. Isso importa porque o
padrão vem apenas do dia da semana (sábado e domingo = off, terça e quinta =
escritório, resto = home office) e erra em feriado, folga no meio da semana ou
escritório fora do dia habitual. A classificação é gravada em `tiposDia`, a
mesma chave usada pelo painel, que se atualiza sozinho quando está aberto.

O tema selecionado na página completa também é aplicado ao popup.

## Arquivos

| Arquivo | Papel |
|---|---|
| `dia.js` | Dia lógico (04h), tipo de dia e a linha (mediana) de cada tipo. Compartilhado pelo painel e pelo popup, para as duas telas usarem a mesma régua. |
| `script.js` | Painel completo: agregação, gráficos, calendário e rota de redução. |
| `popup.js` | Registro rápido: entrada, cartões do dia e comparação com a linha do tipo de dia. |
| `mensagens.js` | Banco de frases de direção, escolhidas pelo estado do dia. |

## Fora da extensão

Abrindo `index.html` direto no navegador, um espelho em `localStorage` substitui
o `chrome.storage` — útil para testar sem instalar.
