# Diagnóstico — Extensão "Registro de Atividade" (Manifest V3)

> **Fase 0 — Auditoria de leitura. Nenhum arquivo da extensão foi alterado.**
> Objetivo do autor: registrar eventos ao longo do dia e **reduzir** frequência/quantidade
> ao longo do tempo, com 100% dos dados **locais e privados** (sem rede, sem telemetria).
>
> Escopo lido: `manifest.json`, `background.js`, `popup.html`, `popup.js`, `index.html`,
> `script.js` (~775 linhas). Ignorado: `flatpickr-master/` (terceiros vendorizado).

---

## 1. Mapa da arquitetura atual

### 1.1 Componentes

| Componente | Papel | Estado em memória | Persistência |
|---|---|---|---|
| `background.js` (service worker) | Loga instalação; tem listener de clique **morto** (ver 2-f) | — | — |
| `popup.html` + `popup.js` | Registro rápido (quantidade + hora) | Nenhum estado persistente; lê/grava direto no storage a cada clique | Escreve **só** `registros` |
| `index.html` + `script.js` | Página completa: tabelas, calendário, ranking, notas, export/import | `registros[]`, `resumoDiario{}`, `ultimoRegistro`, `selectedDate` (variáveis globais de módulo) | Escreve `registros` **e** `resumoDiario` |
| `chrome.storage.local` | Banco de dados de fato | — | Chaves: `registros` (string JSON), `resumoDiario` (string JSON) |

### 1.2 Fluxo de dados — do clique à persistência

**Caminho A — Popup (`popup.js`):**
```
clique "Registrar"
  → registrarPopup()                                  (popup.js:15)
  → valida quantidade (parseFloat, vírgula→ponto)     (popup.js:21-27)
  → monta registro {data,hora,quantidade,timestamp,tempoDesdeUltimo:"-"}  (popup.js:39-45)
  → storage.get(["registros"])                        (popup.js:48)   ← LÊ
  → JSON.parse → push → JSON.stringify
  → storage.set({registros})                          (popup.js:51)   ← ESCREVE (só registros!)
  → mostra "Salvo - hh:mm"
```
O popup **não toca em `resumoDiario`** e **não recalcula o resumo**. O resumo do dia só é
reconstruído quando a página `index.html` é (re)aberta e roda `carregarDados()`.

**Caminho B — Página completa (`script.js`):**
```
clique "Registrar" / Enter
  → registrarEvento()                                 (script.js:220)
  → valida quantidade
  → baseDate = selectedDate (não "hoje"!) + hora       (script.js:235-245)
  → registros.push(reg)  (em memória)                  (script.js:254)
  → updateSummaryForDay(reg.data)  (recomputa resumo)  (script.js:255)
  → atualizarTabelas / atualizarResumoTable / atualizarCalendario  (render)
  → salvarDados()                                      (script.js:262) ← ESCREVE registros + resumoDiario
```

**Inicialização da página:**
```
carregarDados()                                        (script.js:731,757)
  → storage.get(["registros","resumoDiario"])                        ← LÊ
  → JSON.parse
  → PARA CADA registro: r.data = formatDate(new Date(r.timestamp))    (script.js:739-744) ← reescreve data!
  → reconstrói resumoDiario via updateSummaryForDay para cada dia
  → render inicial
```

### 1.3 Quem lê / quem escreve `chrome.storage.local`

| Chave | Lê | Escreve |
|---|---|---|
| `registros` | `popup.js:48`, `script.js:732` | `popup.js:51`, `script.js:725` (`salvarDados`) |
| `resumoDiario` | `script.js:732` | `script.js:727` (`salvarDados`) — **nunca pelo popup** |

**Ninguém escuta `chrome.storage.onChanged`** (grep confirmou: 0 ocorrências). As duas telas
têm visões independentes do estado e não se sincronizam enquanto abertas.

### 1.4 Onde mora o estado

Todo o estado vivo da página está em **variáveis globais de módulo** em `script.js:62-65`
(`registros`, `resumoDiario`, `ultimoRegistro`, `selectedDate`). Não há camada de acesso a
dados, nem cópia imutável, nem controle de concorrência. O storage é a única fonte durável, e
é sobrescrito por inteiro (`set` de string JSON completa) a cada operação.

---

## 2. Bugs e riscos de perda de dados

Legenda de severidade: **Crítico** (perda de dados silenciosa / feature quebrada) ·
**Alto** · **Médio** · **Baixo**.

### Verificação das hipóteses levantadas

#### (a) Condição de corrida popup × página aberta — **CONFIRMADO — Crítico**
- **Arquivos/linhas:** `popup.js:48-51`, `script.js:254-262`, `script.js:724-729`; ausência de
  `onChanged` em `script.js`.
- **Causa raiz:** `index.html` carrega `registros` para memória uma única vez (`carregarDados`),
  não escuta `chrome.storage.onChanged`, e todo `salvarDados()` faz
  `set({registros: JSON.stringify(registros)})` com o array **inteiro** da memória. O popup, em
  paralelo, adiciona um registro direto no storage. Como a página não sabe dessa mudança, a
  próxima escrita da página (registrar/editar/apagar) sobrescreve o storage com a versão antiga
  em memória — **o registro feito pelo popup é perdido**.
- **Cenário de reprodução:** (1) abrir `index.html`; (2) sem fechar, abrir o popup e registrar
  "3"; (3) voltar à página e registrar qualquer coisa (ou editar/apagar). O "3" do popup
  desaparece do storage no próximo `salvarDados()`.
- **Agravante:** o popup grava **apenas `registros`**, deixando `resumoDiario` desatualizado até
  o próximo `carregarDados()`. Enquanto isso, a página pode regravar `resumoDiario` antigo.
- **Impacto:** perda silenciosa de eventos — justamente o dado sensível que deve ser preservado.
- **Correção proposta:** (i) `index.html` deve registrar `chrome.storage.onChanged` e re-hidratar
  o estado quando `registros`/`resumoDiario` mudarem; (ii) padronizar toda escrita por uma única
  função de merge (append idempotente por id) em vez de sobrescrever o array inteiro; (iii) idealmente
  o popup delega a gravação ao mesmo módulo de dados (ver Dívida técnica, camada de dados).

#### (b) Ranking "Menor Quantidade" exclui dias de consumo zero — **CONFIRMADO — Alto**
- **Arquivo/linha:** `script.js:79` (`if (r.numeroRegistros > 0)`), replicado em `:105` e `:127`.
- **Causa raiz:** o filtro `numeroRegistros > 0` remove do ranking qualquer dia sem registros.
  Além disso, `updateSummaryForDay` (`script.js:167-175`) **apaga** do `resumoDiario` os dias sem
  registros (a menos que tenham notas). Ou seja, o **melhor resultado possível para o objetivo do
  autor — um dia de consumo zero — é duplamente invisível**: não entra no ranking e nem sequer
  existe como linha de resumo.
- **Cenário de reprodução:** passar um dia inteiro sem registrar nada. Esse dia não aparece no
  ranking de "Menor Quantidade" nem no Resumo Diário; o troféu vai para o menor dia **com** consumo.
- **Impacto:** a métrica premia o "menos pior dia com consumo" e ignora o sucesso real (zero).
  Desalinhamento direto com a meta de redução; desincentivo motivacional.
- **Correção proposta:** materializar dias de calendário sem registro como zero explícito e
  incluí-los no ranking (com desempate por data). Requer decidir a janela de dias "elegíveis"
  (p.ex. dias desde o primeiro registro até hoje) para não inflar com dias futuros/pré-histórico.

#### (c) `importCSV()` substitui a base inteira sem confirmação/merge/dedup e perde notas+resumo — **CONFIRMADO — Crítico**
- **Arquivo/linha:** `script.js:678-719`, em especial `registros = imported` (`:707`) e
  `resumoDiario = {}` (`:708`).
- **Causa raiz:** a importação (1) **não pede confirmação**; (2) faz **replace total** de
  `registros`; (3) **zera `resumoDiario`** (perdendo qualquer nota/estado que dependesse dele);
  (4) não deduplica nem faz merge com o que já existe; (5) o **export** (`script.js:650-662`) só
  grava `Data,Hora,Quantidade,TempoDesdeUltimo` — **não inclui notas nem resumo**. Logo, um
  ciclo export→import **destrói notas** e qualquer informação não contida nas 4 colunas.
- **Cenário de reprodução:** exportar backup, importar de volta (ou importar um CSV parcial) → toda
  a base atual é substituída pelo conteúdo do arquivo; notas somem; registros que não estavam no
  arquivo somem.
- **Impacto:** perda catastrófica e silenciosa de dados sensíveis com um clique acidental no
  botão "Importar".
- **Correção proposta:** (i) confirmação explícita com aviso; (ii) modo **merge** com deduplicação
  por chave estável (id/timestamp); (iii) formato de backup que inclua **notas e todo o modelo**
  (preferir JSON completo a CSV de 4 colunas, ou CSV multi-seção); (iv) backup automático do estado
  atual antes de importar (rollback).

#### (d) Export via data URI + `encodeURI`, CSV sem escape — **CONFIRMADO — Alto**
- **Arquivo/linha:** `script.js:651-660` (`"data:text/csv;...," + encodeURI(csv)`), montagem sem
  escape em `:653`.
- **Causa raiz:** (1) `data:` URI tem limites práticos de tamanho em vários navegadores — uma base
  longitudinal de meses/anos pode **truncar ou falhar**; (2) `encodeURI` não é o encoder correto
  para conteúdo CSV e não escapa **vírgulas** nem **quebras de linha**; qualquer campo com vírgula
  quebra o número de colunas. Hoje o risco é menor porque os campos são numéricos/datas, mas o
  **import** parte de `split(",")` (`:685`), então qualquer vírgula futura (ex.: notas no backup)
  corromperia o parse.
- **Cenário de reprodução:** base grande (milhares de registros) → download vazio/truncado; ou
  incluir qualquer texto com vírgula → colunas desalinhadas na reimportação.
- **Impacto:** backup não confiável — falsa sensação de segurança sobre dados que só existem localmente.
- **Correção proposta:** gerar `Blob` + `URL.createObjectURL` (sem limite de data URI) e usar um
  serializador CSV com escape RFC 4180 (aspas, duplicação de aspas) — ou migrar backup para JSON.

#### (e) Permissões excessivas no manifest — **CONFIRMADO — Médio (privacidade)**
- **Arquivo/linha:** `manifest.json:15` (`activeTab`) e `:17-19` (`host_permissions: <all_urls>`).
- **Causa raiz:** nenhum código lê conteúdo de página, injeta content script ou usa `activeTab`.
  A extensão só usa `storage` e `chrome.tabs.create`. Grep não encontra `executeScript`,
  `content_scripts`, `tabs.query`, `scripting`, nem acesso a DOM de páginas.
- **Impacto:** pede acesso a **todas as URLs** sem necessidade — aumenta superfície de risco,
  gera aviso assustador na instalação e contradiz a promessa de privacidade. `<all_urls>` também
  dificulta eventual publicação/aprovação.
- **Correção proposta:** remover `host_permissions: <all_urls>` e `activeTab`. Manter apenas
  `storage`. `chrome.tabs.create` com URL própria da extensão não requer permissão de host.

#### (f) `chrome.action.onClicked` em `background.js` é código morto — **CONFIRMADO — Baixo**
- **Arquivo/linha:** `background.js:7-10`; conflita com `manifest.json:7` (`default_popup`).
- **Causa raiz:** quando existe `default_popup`, o clique no ícone **abre o popup** e o evento
  `chrome.action.onClicked` **nunca dispara**. O listener que abriria `index.html` é inalcançável.
- **Impacto:** nenhum funcional (o popup tem o botão "Ir para a página de registros"); apenas
  confusão de manutenção e falsa impressão de que o ícone abre a página.
- **Correção proposta:** remover o listener morto (ou remover `default_popup` se a intenção for
  abrir a página direto — decisão de UX). Baixa prioridade.

#### (g) `carregarDados()` reescreve `r.data` a partir do timestamp a cada carregamento — **CONFIRMADO — Médio**
- **Arquivo/linha:** `script.js:739-744` (`r.data = formatDate(new Date(ts))`).
- **Causa raiz:** a cada load, a string `data` é **derivada** do `timestamp`. Se o `timestamp` e a
  string de data divergirem — por edição manual de hora que cruza a meia-noite, por importação, ou
  por diferença de fuso/DST entre a máquina que gravou e a que lê — o dia ao qual o registro
  pertence **muda sozinho** no próximo carregamento, e o resumo é recomputado sobre a nova data.
- **Interação com `editarHora`:** `editarHora` (`:613-635`) recalcula `timestamp` a partir de
  `reg.data` + nova hora (mantém o dia). Isoladamente é consistente. O risco aparece quando o
  `timestamp` de origem representa outro dia (import, ajuste de fuso) — a fonte de verdade oscila
  entre "string de data" e "timestamp" dependendo do caminho de código.
- **Impacto:** registros migram de dia silenciosamente; métricas diárias e rankings mudam entre
  sessões sem ação do usuário.
- **Correção proposta:** definir **uma única fonte de verdade** para o dia (ver Modelo de dados,
  §4): armazenar a data lógica do evento como campo canônico (ISO `YYYY-MM-DD` com fuso fixado) e
  derivar exibição a partir dela; nunca re-derivar o dia do timestamp em cada load.

#### (h) Notas inseridas via `innerHTML` sem sanitização — **REFUTADO (com ressalva) — Baixo**
- **Evidência:** as notas do usuário são gravadas/lidas **apenas em `textarea.value`**
  (`carregarNotas`, `script.js:576-579`). Não há nenhum caminho que injete `notes` via `innerHTML`
  (grep confirma: `.notes` aparece só em `:168`, `:192`, `:578`, nenhum dentro de template de
  `innerHTML`). Como `textarea.value` trata o conteúdo como texto puro, **não há XSS pela nota**.
- **Ressalva (risco latente real):** o restante da UI é construída por **concatenação de string em
  `innerHTML`** com dados do modelo (`atualizarTabelas` `:328-344`, `atualizarResumoTable`
  `:402-412`, calendário `:467-472`). Hoje os campos interpolados são numéricos/datas formatadas,
  então a superfície é estreita — mas o **padrão** é perigoso: se qualquer campo textual do
  usuário passar a ser renderizado por `innerHTML` (p.ex. exibir notas na tabela, ou um campo de
  "contexto" — ver §4), vira XSS armazenado imediatamente.
- **Correção proposta:** adotar `textContent`/`createElement` ou um sanitizador antes de qualquer
  renderização de texto do usuário via `innerHTML`. Tratar como dívida preventiva antes de expandir
  o modelo.

#### (i) `tempoDesdeUltimo` persistido sempre como "-" e recalculado na exibição — **CONFIRMADO — Baixo**
- **Arquivo/linha:** criado como `"-"` em `popup.js:44`, `script.js:252`, `importCSV` `:704`;
  recalculado só para render em `atualizarTabelas` (`:290`, `rDiaAsc[i].tempoDesdeUltimo = diff`).
- **Causa raiz:** é um campo **derivado** guardado no modelo persistido, mas nunca é derivado no
  momento de salvar — fica "-" no storage. Pior: `atualizarTabelas` **muta** o valor em memória
  (atribui o `diff`) sem persistir, criando estado inconsistente entre memória e storage.
- **Impacto:** campo morto que polui o modelo, engana o export (coluna sempre "-" ou valor
  inconsistente) e induz a erro quem lê o CSV.
- **Correção proposta:** remover o campo do modelo persistido e calcular sempre na apresentação
  (é 100% derivável da ordenação por timestamp). Ajustar export para não emiti-lo (ou emitir
  derivado no momento da exportação).

### Bugs adicionais encontrados (fora das hipóteses)

#### (j) Botão "Salvar Anotações" não tem handler — notas **nunca são gravadas** — **Crítico**
- **Arquivo/linha:** `index.html:304` (`<button id="salvarNotasBtn">`), `index.html:303`
  (`textarea#dailyNotes`), `index.html:305` (`#saveFeedback`). Grep confirma: **nenhum**
  `addEventListener` para `salvarNotasBtn` em `script.js`, e **nenhuma** escrita em
  `resumoDiario[...].notes`.
- **Causa raiz:** o fluxo de escrita das notas simplesmente **não existe**. `carregarNotas` só
  **lê** `resumoDiario[dateStr].notes` para dentro do textarea; como nada nunca escreve esse
  campo, ele é **sempre vazio**. O feedback "Salvo!" (`#saveFeedback`) nunca é acionado.
- **Cenário de reprodução:** escrever uma anotação, clicar "Salvar Anotações", trocar de dia e
  voltar → a nota sumiu (nunca foi salva).
- **Impacto:** a feature de anotações é **inteiramente não-funcional**; toda a lógica de preservar
  notas em `updateSummaryForDay` (`:168`, `:192`) é inalcançável na prática. É também a razão de a
  hipótese (c) sobre "perder notas" ser hoje teórica — **não há nota alguma para perder** porque
  nunca se salva uma.
- **Correção proposta:** adicionar listener em `salvarNotasBtn` que grava
  `resumoDiario[selectedDate].notes` e chama `salvarDados()` + feedback; garantir que
  `updateSummaryForDay` preserve a nota (já preserva) e que import/export incluam notas.

#### (k) Índices de linha frágeis por `registros.indexOf(reg)` — **Médio**
- **Arquivo/linha:** `script.js:319` (`registros.indexOf(reg)` como `data-index`), consumido em
  `deletarRegistro`/`editar*` via `parseInt(idx)` (`:764-772`, `:584-635`).
- **Causa raiz:** a identidade do registro é a **posição no array**, não um id estável. Se dois
  registros forem idênticos por valor (mesmo objeto? não — objetos distintos, `indexOf` acha o
  primeiro por referência, ok), mas o modelo depende de reordenações e re-render para manter os
  índices coerentes. Sem `id` estável, edição/exclusão é posicional e quebra se o array for
  reordenado por outro caminho (ex.: import, futura sincronização).
- **Impacto:** risco de editar/apagar o registro errado após operações concorrentes (ver hipótese
  a). Baixa robustez para o CRUD de um dado sensível.
- **Correção proposta:** dar a cada registro um `id` único (UUID/crypto.randomUUID) e endereçar
  o CRUD por `id`.

#### (l) `parseInt` de hora sem validação de faixa — **Baixo**
- **Arquivo/linha:** `popup.js:35`, `script.js:244`, `editarHora:627`, `importCSV:696`.
- **Causa raiz:** `parseInt(partes[0])`/`partes[1]` sem validar 0–23 / 0–59 nem `NaN` da hora.
  "99:99" ou "abc" produz `setHours(NaN,...)` → `timestamp` `NaN` (parcialmente contornado só em
  `carregarDados` com fallback `Date.now()`, `:741`, o que **muda a data do registro**).
- **Impacto:** registro com hora inválida vira timestamp corrompido e, no load seguinte, é
  relocado para "agora" — perda de fidelidade temporal.
- **Correção proposta:** validar faixa e `NaN` na entrada; rejeitar com mensagem em vez de gravar.

---

## 3. Dívida técnica

- **Monólito sem camadas.** `script.js` (~775 linhas) mistura, no mesmo arquivo e escopo global,
  acesso a dados, regras de negócio (rankings, resumo), renderização (`innerHTML`), e binding de
  eventos. Não há separação model / view / storage.
- **Estado global mutável.** `registros`, `resumoDiario`, `ultimoRegistro`, `selectedDate`
  (`script.js:62-65`) são globais de módulo mutados por muitas funções — difícil de raciocinar e
  fonte direta da condição de corrida (2-a).
- **Ausência de camada de dados.** Cada componente serializa/parseia JSON à mão e sobrescreve o
  storage inteiro. Não há repositório único, nem merge, nem migração de esquema, nem versionamento
  do formato.
- **HTML por concatenação de string.** Toda a UI dinâmica é `innerHTML +=` com template strings
  (`:328`, `:402`, `:467`), acumulando risco de XSS (2-h) e reflow custoso (`+=` em loop refaz o
  parse do DOM a cada iteração).
- **Duplicação popup × página.** `formatDate`/`formatTime` e a lógica de montar um registro estão
  duplicadas em `popup.js` e `script.js`, já divergindo em comportamento (popup não atualiza resumo).
- **Sem testes.** Nenhum teste unitário/integração para funções puras altamente testáveis
  (`updateSummaryForDay`, rankings, `getIntervalFromPreviousDay`, parsing de data).
- **Sem build/tooling.** Sem bundler, lint, type-check ou minificação; scripts soltos carregados
  por `<script src>`. Dificulta refatorar com segurança.
- **Flatpickr vendorizado por inteiro.** `flatpickr-master/` = **1,3 MB, 123 arquivos** de
  código-fonte de terceiros (repo inteiro: `src/`, testes, configs de build) **não usado em
  runtime** — a página só carrega `flatpickr.min.js`/`.min.css` da raiz. Peso morto no pacote,
  aumenta superfície de auditoria/segurança e o tamanho da extensão. **Remover a pasta**; manter
  só os dois arquivos minificados (idealmente com versão pinada e checada).

---

## 4. Falhas do modelo de dados para análise longitudinal

O objetivo é uma série temporal comparável consigo mesma por meses. O modelo atual não sustenta isso.

1. **"Quantidade" adimensional.** O campo `quantidade` é um número puro (`script.js:227`) sem
   **unidade**, sem **tipo de evento** e sem **concentração/intensidade**. Uma série de 12 meses
   não é auto-comparável se a convenção de anotação mudou (ex.: mesmo "3" significando coisas
   diferentes). *Correção:* tornar o esquema explícito — `{tipo, quantidade, unidade}` e, se
   aplicável, `concentração`, com validação e valor canônico por tipo.

2. **Data como string `DD/MM/AAAA` é chave primária.** Usada como chave de `resumoDiario`, como
   filtro (`r.data === dateStr`) e ordenada por parse (`parseDateFromDDMMYYYY`). Consequências:
   ordenação lexicográfica quebrada (`"02/01/2025" < "10/12/2024"` textualmente), dependência de
   fuso ao converter para `Date` local, e agregação por semana/mês trabalhosa. *Correção:* chave
   canônica ISO `YYYY-MM-DD` (ordenável lexicograficamente) + timestamp com fuso fixado; string
   PT-BR apenas na apresentação.

3. **Fronteira do dia fixada à meia-noite.** O dia é definido pelo `Date` local (00:00–24:00).
   Eventos da madrugada são atribuídos ao **dia seguinte**, e uma mesma "sessão" que cruza a
   meia-noite é **partida em dois dias**, distorcendo total diário, contagem, "maior intervalo
   intra" e todos os rankings. `updateSummaryForDay` inclusive usa `fimDia = 00:00 do dia seguinte`
   (`script.js:183`) como âncora do intervalo — reforçando a fronteira rígida. *Correção:*
   fronteira de dia configurável (ex.: "dia lógico começa às 04:00") aplicada de forma consistente
   em resumo, rankings e intervalos.

4. **Sem registro de contexto.** O modelo só conta *quanto* e *quando*; não há **gatilho, local,
   companhia, estado emocional, sono, atividade**. Esse é justamente o eixo que permite
   **intervenção** (identificar padrões e agir), não só medição. Sem ele, a série vira um placar
   sem alavanca de mudança. *Correção:* campos de contexto opcionais e estruturados (enum +
   texto livre sanitizado), pensados para agregação posterior (ex.: "consumo por gatilho").

---

## 5. Backlog priorizado (impacto × esforço)

Esforço: **P** (baixo, ~horas) · **M** (médio, ~1 dia) · **G** (alto, refatoração).
⭐ = *quick win* (alto impacto, baixo esforço).

| # | Item | Origem | Impacto | Esforço | Quadrante |
|---|---|---|---|---|---|
| 1 ⭐ | Corrigir botão "Salvar Anotações" (adicionar handler + persistir notas) | 2-j | Alto | P | **Quick win** |
| 2 ⭐ | Confirmação + backup automático antes de `importCSV` (evita apagar tudo) | 2-c | Alto | P | **Quick win** |
| 3 ⭐ | Remover `host_permissions:<all_urls>` e `activeTab` do manifest | 2-e | Médio-Alto | P | **Quick win** |
| 4 ⭐ | Remover pasta `flatpickr-master/` (1,3 MB não usada) | §3 | Médio | P | **Quick win** |
| 5 ⭐ | Remover listener morto `action.onClicked` em background | 2-f | Baixo | P | **Quick win** |
| 6 | Escutar `chrome.storage.onChanged` na página + escrita por merge (fim da corrida popup×página) | 2-a | Alto | M | Fazer |
| 7 | Export/Import robusto: `Blob`+`createObjectURL`, escape CSV ou backup JSON completo (com notas) | 2-c,2-d | Alto | M | Fazer |
| 8 | Incluir dias de consumo zero no ranking "Menor Quantidade" (materializar zeros) | 2-b | Alto | M | Fazer |
| 9 | `id` estável por registro; CRUD por id em vez de índice de array | 2-k | Médio | M | Fazer |
| 10 | Remover campo morto `tempoDesdeUltimo` do modelo; derivar só na exibição | 2-i | Baixo | P | Fazer |
| 11 | Validar faixa/`NaN` de hora na entrada (popup, página, import) | 2-l | Médio | P | Fazer |
| 12 | Data canônica ISO + fuso fixado; parar de re-derivar `r.data` do timestamp | 2-g,§4.2 | Alto | G | Projeto |
| 13 | Fronteira de dia lógico configurável (madrugada) aplicada a resumo e rankings | §4.3 | Alto | G | Projeto |
| 14 | Esquema de evento com tipo/unidade/concentração + contexto (gatilho, humor, sono, local) | §4.1,§4.4 | Alto | G | Projeto |
| 15 | Extrair camada de dados + testes das funções puras; substituir `innerHTML` por DOM seguro | §3,2-h | Médio | G | Projeto |

**Sequência sugerida:** itens 1–5 (quick wins, blindam contra perda de dados e cortam gordura sem
tocar no esquema) → 6–11 (robustez do fluxo e do backup) → 12–15 (evolução do modelo longitudinal,
com migração de dados versionada).

---

## Encerramento

Os pontos mais graves são **perda silenciosa de dados**: a corrida popup×página (2-a), o
`importCSV` destrutivo (2-c) e — achado extra — o **botão de notas que nunca salva** (2-j). As
hipóteses (a), (b), (c), (d), (e), (f), (g), (i) foram **confirmadas com evidência**; a hipótese
(h) foi **refutada** no caminho literal (notas vão para `textarea.value`, não `innerHTML`), embora
o padrão geral de `innerHTML` por concatenação seja uma dívida preventiva real.

**Antes de iniciar a Fase 1, quais itens do backlog (1–15) você aprova?**
Minha recomendação é começar pelos *quick wins* **1, 2, 3, 4 e 5** (baixo esforço, alto impacto,
sem mexer no esquema de dados), e em seguida definir se avançamos para a robustez (6–11) ou já
planejamos a evolução do modelo longitudinal (12–15).
