# Registro de Atividade — painel v2

Substitui **apenas** `index.html` e `script.js`. `popup.html`, `manifest.json`,
`background.js` e `icon.png` continuam iguais (`popup.js` tem uma linha alterada,
descrita abaixo).

## Como instalar

1. Copie esta pasta por cima da pasta da extensão (ou faça commit no repo).
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

Registro: `{ data, hora, quantidade, timestamp, gatilho }` — `gatilho` é novo e
opcional; o popup preserva o campo. Chaves adicionais no storage:

- `tiposDia` — `{ "2026-07-25": "off", ... }`, só os dias que você corrigiu à mão.
  O padrão vem do dia da semana (sáb/dom = off, ter/qui = escritório, resto = home office).
- `config` — janela, meta %/mês, tema, tom irônico, modo discreto.

## Alterações no popup

Só uma: o contador "Hoje" passou a usar o dia lógico de 04h (e mostra gramas),
para as duas telas não discordarem quando há registro de madrugada.

## Fora da extensão

Abrindo `index.html` direto no navegador, um espelho em `localStorage` substitui
o `chrome.storage` — útil para testar sem instalar.
