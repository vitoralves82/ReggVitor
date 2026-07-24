"use strict";

// Define EPS
const EPS = 0.001;

// =======================
// Configuração do Flatpickr
// =======================
flatpickr("#horaInput", {
  enableTime: true,
  noCalendar: true,
  dateFormat: "H:i",
  time_24hr: true
});

// =======================
// Funções utilitárias de formatação
// =======================
function formatNumber(num, dec) {
  return num.toFixed(dec).replace(".", ",");
}

function formatDate(date) {
  let y = date.getFullYear();
  let m = String(date.getMonth() + 1).padStart(2, "0");
  let d = String(date.getDate()).padStart(2, "0");
  return `${d}/${m}/${y}`;
}

function formatTime(date) {
  let h = String(date.getHours()).padStart(2, "0");
  let m = String(date.getMinutes()).padStart(2, "0");
  return `${h}:${m}`;
}

function parseDateFromDDMMYYYY(str) {
  let parts = str.split("/");
  if (parts.length !== 3) return null;
  let d = parseInt(parts[0], 10);
  let m = parseInt(parts[1], 10) - 1;
  let y = parseInt(parts[2], 10);
  return new Date(y, m, d);
}

// Valida uma string de hora "HH:MM" na faixa 00:00–23:59.
// Retorna {h, m} se válida, ou null se inválida.
function parseHoraValida(str) {
  let partes = str.split(":");
  if (partes.length < 2) return null;
  let h = parseInt(partes[0], 10);
  let m = parseInt(partes[1], 10);
  if (isNaN(h) || isNaN(m)) return null;
  if (h < 0 || h > 23 || m < 0 || m > 59) return null;
  return { h, m };
}

// Escapa um campo para CSV conforme RFC 4180: se contém vírgula, aspas ou
// quebra de linha, envolve em aspas e duplica as aspas internas.
function escaparCSV(valor) {
  let s = String(valor);
  if (/[",\n\r]/.test(s)) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

function convertMinToHM(min) {
  let m = Math.floor(min);
  let h = Math.floor(m / 60);
  let r = m % 60;
  return h > 0 ? `${h}h${r}min` : `${r}min`;
}

function getWeekDay(dateStr) {
  const date = parseDateFromDDMMYYYY(dateStr);
  if (!date) return "";
  const dias = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
  return dias[date.getDay()];
}

// =======================
// Variáveis globais
// =======================
let registros = [];
let resumoDiario = {};
let ultimoRegistro = null;
let selectedDate = formatDate(new Date());

// =======================
// Funções de Ranking
// =======================

// Retorna a data (00:00) do primeiro registro de toda a base, ou null se vazia.
function getPrimeiroDiaRegistrado() {
  if (registros.length === 0) return null;
  let minTs = registros[0].timestamp;
  registros.forEach(r => { if (r.timestamp < minTs) minTs = r.timestamp; });
  let d = new Date(minTs);
  d.setHours(0, 0, 0, 0);
  return d;
}

// Retorna todos os dias elegíveis do mês corrente: entre o primeiro registro geral
// e hoje (inclusive). Dias sem registro entram como "dia zero" (resumo = null).
// É isso que permite premiar os dias de consumo zero, os melhores para a meta.
function getDiasCandidatosMes() {
  let current = new Date();
  let mes = current.getMonth();
  let ano = current.getFullYear();
  let hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  let primeiro = getPrimeiroDiaRegistrado();
  if (!primeiro) return [];
  let dias = [];
  let ultimoDiaMes = new Date(ano, mes + 1, 0).getDate();
  for (let d = 1; d <= ultimoDiaMes; d++) {
    let dia = new Date(ano, mes, d);
    dia.setHours(0, 0, 0, 0);
    if (dia < primeiro || dia > hoje) continue;
    let dateStr = formatDate(dia);
    dias.push({ date: dateStr, ts: dia.getTime(), resumo: resumoDiario[dateStr] || null });
  }
  return dias;
}

function getRankingForQuantidade() {
  // Inclui dias de consumo ZERO (melhor resultado possível para a meta).
  let ranking = getDiasCandidatosMes().map(dia => {
    let total = (dia.resumo && dia.resumo.numeroRegistros > 0) ? dia.resumo.totalQuantidade : 0;
    return { date: dia.date, value: total, ts: dia.ts };
  });
  ranking.sort((a, b) => {
    if (Math.abs(a.value - b.value) > EPS) return a.value - b.value;
    return b.ts - a.ts; // empate: dia mais recente fica melhor posicionado
  });
  let unique = [];
  ranking.forEach(item => {
    let rounded = parseFloat(item.value.toFixed(1));
    if (unique.length === 0 || parseFloat(unique[unique.length - 1].value.toFixed(1)) !== rounded)
      unique.push(item);
  });
  return unique.slice(0, 3);
}

function getRankingForFrequencia() {
  // Também inclui dias zero: 0 registros é a menor frequência possível.
  let ranking = getDiasCandidatosMes().map(dia => {
    let num = (dia.resumo && dia.resumo.numeroRegistros > 0) ? dia.resumo.numeroRegistros : 0;
    return { date: dia.date, value: num, ts: dia.ts };
  });
  ranking.sort((a, b) => {
    if (a.value !== b.value) return a.value - b.value;
    return b.ts - a.ts; // empate: dia mais recente fica melhor posicionado
  });
  let unique = [];
  ranking.forEach(item => {
    if (unique.length === 0 || item.value !== unique[unique.length - 1].value)
      unique.push(item);
  });
  return unique.slice(0, 3);
}

function getRankingForIntraInterval() {
  let current = new Date();
  let currentMonth = current.getMonth();
  let currentYear = current.getFullYear();
  let ranking = [];
  Object.keys(resumoDiario).forEach(dt => {
    let dateObj = parseDateFromDDMMYYYY(dt);
    if (dateObj.getMonth() === currentMonth && dateObj.getFullYear() === currentYear) {
      let r = resumoDiario[dt];
      if (r.numeroRegistros > 0)
        ranking.push({ date: dt, value: r.maiorIntervaloIntra, ts: dateObj.getTime() });
    }
  });
  ranking.sort((a, b) => {
    if (Math.abs(b.value - a.value) > EPS) return b.value - a.value;
    return a.ts - b.ts;
  });
  let unique = [];
  ranking.forEach(item => {
    if (unique.length === 0 || parseInt(item.value, 10) !== parseInt(unique[unique.length - 1].value, 10))
      unique.push(item);
  });
  return unique.slice(0, 3);
}

function computeMaiorIntervaloTotal() {
  if (registros.length === 0) return { maxHours: 0, date: "N/A" };
  let sorted = registros.slice().sort((a, b) => a.timestamp - b.timestamp);
  let maxDiff = 0, maxDate = "N/A";
  if (sorted.length === 1) {
    maxDiff = (Date.now() - sorted[0].timestamp) / 3600000;
    maxDate = sorted[0].data;
  } else {
    for (let i = 1; i < sorted.length; i++) {
      let diff = (sorted[i].timestamp - sorted[i - 1].timestamp) / 3600000;
      if (diff > maxDiff) {
        maxDiff = diff;
        maxDate = sorted[i].data;
      }
    }
  }
  return { maxHours: maxDiff, date: maxDate };
}

// =======================
// Atualiza o resumo diário para um dia
// =======================
function updateSummaryForDay(dateStr) {
  let recs = registros.filter(r => r.data === dateStr);
  if (recs.length === 0) {
    if (resumoDiario[dateStr] && resumoDiario[dateStr].notes) {
      resumoDiario[dateStr].totalQuantidade = 0;
      resumoDiario[dateStr].numeroRegistros = 0;
      resumoDiario[dateStr].maiorIntervaloIntra = 0;
    } else {
      delete resumoDiario[dateStr];
    }
    return;
  }
  recs.sort((a, b) => a.timestamp - b.timestamp);
  let totalQ = 0;
  recs.forEach(r => totalQ += r.quantidade);
  let maiorInterval = 0;
  if (recs.length === 1) {
    let dObj = parseDateFromDDMMYYYY(dateStr);
    let fimDia = new Date(dObj.getFullYear(), dObj.getMonth(), dObj.getDate() + 1, 0, 0, 0);
    maiorInterval = (fimDia.getTime() - recs[0].timestamp) / 60000;
  } else {
    for (let i = 1; i < recs.length; i++) {
      let diff = (recs[i].timestamp - recs[i - 1].timestamp) / 60000;
      if (diff > maiorInterval) maiorInterval = diff;
    }
  }
  resumoDiario[dateStr] = {
    notes: resumoDiario[dateStr]?.notes || "",
    totalQuantidade: totalQ,
    numeroRegistros: recs.length,
    maiorIntervaloIntra: Math.floor(maiorInterval)
  };
}

// =======================
// Calcula o intervalo do dia anterior
// =======================
function getIntervalFromPreviousDay(dateStr) {
  let current = parseDateFromDDMMYYYY(dateStr);
  if (!current) return null;
  let prev = new Date(current);
  prev.setDate(prev.getDate() - 1);
  let prevStr = formatDate(prev);
  let recsPrev = registros.filter(r => r.data === prevStr).sort((a, b) => b.timestamp - a.timestamp);
  if (recsPrev.length === 0) return null;
  let lastPrev = recsPrev[0];
  let recsCurr = registros.filter(r => r.data === dateStr).sort((a, b) => a.timestamp - b.timestamp);
  if (recsCurr.length === 0) return null;
  let firstCurr = recsCurr[0];
  return Math.floor((firstCurr.timestamp - lastPrev.timestamp) / 60000);
}

// =======================
// Função para registrar um novo evento
// =======================
function registrarEvento() {
  let quantidadeInput = document.getElementById("quantidade");
  let horaInput = document.getElementById("horaInput");
  let statusMessage = document.getElementById("statusMessage");

  // Remove espaços e substitui vírgula por ponto
  let quantStr = quantidadeInput.value.trim().replace(",", ".");
  let q = parseFloat(quantStr);
  if (isNaN(q)) {
    statusMessage.textContent = "Digite uma quantidade válida!";
    return;
  } else {
    statusMessage.textContent = "";
  }
  
  let baseDate = parseDateFromDDMMYYYY(selectedDate);
  if (!baseDate) baseDate = new Date();
  
  let horaVal = horaInput.value.trim();
  if (!horaVal) {
    let now = new Date();
    baseDate.setHours(now.getHours(), now.getMinutes(), 0, 0);
  } else {
    let hora = parseHoraValida(horaVal);
    if (!hora) {
      statusMessage.textContent = "Hora inválida! Use HH:MM (00:00–23:59).";
      return;
    }
    baseDate.setHours(hora.h, hora.m, 0, 0);
  }
  let ts = baseDate.getTime();
  let reg = {
    data: formatDate(baseDate),
    hora: formatTime(baseDate),
    quantidade: q,
    timestamp: ts
  };
  registros.push(reg);
  updateSummaryForDay(reg.data);
  ultimoRegistro = reg;
  quantidadeInput.value = "";
  horaInput.value = "";
  atualizarTabelas();
  atualizarResumoTable();
  atualizarCalendario();
  salvarDados();
  statusMessage.textContent = "Salvo - " + formatTime(baseDate);
  setTimeout(() => { statusMessage.textContent = ""; }, 2000);
  // Volta o foco para a quantidade após registrar
  quantidadeInput.focus();
}

document.getElementById("quantidade").addEventListener("keyup", function(e) {
  if (e.key === "Enter") registrarEvento();
});
document.getElementById("horaInput").addEventListener("keyup", function(e) {
  if (e.key === "Enter") registrarEvento();
});
document.getElementById("registrarBtn").addEventListener("click", registrarEvento);

// =======================
// Atualiza a Tabela de Registros Diários
// =======================
function atualizarTabelas() {
  const tbody = document.querySelector("#registrosTable tbody");
  tbody.innerHTML = "";
  let rDiaAsc = registros.filter(r => r.data === selectedDate).sort((a, b) => a.timestamp - b.timestamp);
  let intervaloAnterior = getIntervalFromPreviousDay(selectedDate);
  let firstTimestamp = rDiaAsc.length ? rDiaAsc[0].timestamp : null;
  let rDia = [...rDiaAsc].reverse();
  
  // Calcula o "tempo desde o último" na hora da renderização, sem persistir no modelo.
  // tempoPorReg é um Map do objeto registro -> minutos desde o registro anterior do dia.
  let maxInterval = 0;
  let tempoPorReg = new Map();
  for (let i = 1; i < rDiaAsc.length; i++) {
    let diff = Math.floor((rDiaAsc[i].timestamp - rDiaAsc[i - 1].timestamp) / 60000);
    if (diff > maxInterval) maxInterval = diff;
    tempoPorReg.set(rDiaAsc[i], diff);
  }
  
  // Determina prêmios para o dia (apenas no primeiro registro)
  let premioQuantidade = "";
  let premioFrequencia = "";
  let premioIntra = "";
  let rankingQ = getRankingForQuantidade();
  let rankingF = getRankingForFrequencia();
  let rankingI = getRankingForIntraInterval();
  
  if (rankingQ.length > 0 && rankingQ[0].date === selectedDate) {
    // Aqui, usamos a ordem dos rankings para definir o ícone correto
    if (rankingQ[0].value !== undefined) premioQuantidade = `<span class="record-icon" title="Troféu Dourado - Menor Quantidade">🏆</span>`;
    if (rankingQ.length >= 2 && rankingQ[1].date === selectedDate) premioQuantidade = `<span class="record-icon" title="Medalha Prata - Menor Quantidade">🥈</span>`;
    if (rankingQ.length >= 3 && rankingQ[2].date === selectedDate) premioQuantidade = `<span class="record-icon" title="Medalha Bronze - Menor Quantidade">🥉</span>`;
  }
  if (rankingF.length > 0 && rankingF[0].date === selectedDate) {
    if (rankingF[0].value !== undefined) premioFrequencia = `<span class="record-icon" title="Troféu Dourado - Menor Frequência">🏆</span>`;
    if (rankingF.length >= 2 && rankingF[1].date === selectedDate) premioFrequencia = `<span class="record-icon" title="Medalha Prata - Menor Frequência">🥈</span>`;
    if (rankingF.length >= 3 && rankingF[2].date === selectedDate) premioFrequencia = `<span class="record-icon" title="Medalha Bronze - Menor Frequência">🥉</span>`;
  }
  if (rankingI.length > 0 && rankingI[0].date === selectedDate) {
    if (rankingI[0].value !== undefined) premioIntra = `<span class="record-icon" title="Troféu Dourado - Maior Intervalo Intra">🏆</span>`;
    if (rankingI.length >= 2 && rankingI[1].date === selectedDate) premioIntra = `<span class="record-icon" title="Medalha Prata - Maior Intervalo Intra">🥈</span>`;
    if (rankingI.length >= 3 && rankingI[2].date === selectedDate) premioIntra = `<span class="record-icon" title="Medalha Bronze - Maior Intervalo Intra">🥉</span>`;
  }
  
  rDia.forEach(reg => {
    let idx = registros.indexOf(reg);
    let tempo = tempoPorReg.has(reg) ? tempoPorReg.get(reg) : "-";
    let tempoStr = String(tempo);
    if (tempo !== "-" && tempo === maxInterval) {
      tempoStr = `<span style="color:red;">${tempo}</span>`;
    }
    let intervaloCell = (reg.timestamp === firstTimestamp && intervaloAnterior !== null)
                        ? convertMinToHM(intervaloAnterior)
                        : "-";
    let weekDay = getWeekDay(reg.data);
    tbody.innerHTML += `
      <tr>
        <td>${reg.data}</td>
        <td>${weekDay}</td>
        <td>
          ${reg.hora} <button class="edit-btn" data-index="${idx}" data-type="hora">🕒</button>
        </td>
        <td>
          ${formatNumber(reg.quantidade, 1)} ${reg.timestamp === firstTimestamp ? premioQuantidade : ""} <button class="edit-btn" data-index="${idx}" data-type="quantidade">🔢</button>
        </td>
        <td>${tempoStr} ${reg.timestamp === firstTimestamp ? premioFrequencia : ""}</td>
        <td>${intervaloCell} ${reg.timestamp === firstTimestamp ? premioIntra : ""}</td>
        <td>
          <button class="delete-btn" data-index="${idx}" title="Excluir Registro">🗑️</button>
        </td>
      </tr>
    `;
  });
  if (rDia.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="empty-hint">Sem registros neste dia.</td></tr>`;
  }
  atualizarSelectedDateDisplay();
  carregarNotas(selectedDate);
}

// =======================
// Atualiza a Tabela de Resumo Diário
// =======================
function atualizarResumoTable() {
  const tbody = document.querySelector("#resumoTable tbody");
  tbody.innerHTML = "";
  let hojeObj = new Date();
  hojeObj.setHours(0, 0, 0, 0);
  let chavesResumo = Object.keys(resumoDiario);
  if (chavesResumo.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="empty-hint">Nenhum resumo ainda. Registre um evento para começar.</td></tr>`;
    return;
  }
  chavesResumo
    .sort((a, b) => {
      let d1 = parseDateFromDDMMYYYY(a);
      let d2 = parseDateFromDDMMYYYY(b);
      return d2 - d1;
    })
    .forEach(dateStr => {
      let dataObj = parseDateFromDDMMYYYY(dateStr);
      let ehPassado = dataObj < hojeObj;
      let r = resumoDiario[dateStr];
      let totalQ = formatNumber(r.totalQuantidade, 1);
      let numReg = r.numeroRegistros;
      let maiorI = r.maiorIntervaloIntra;
      let weekDay = getWeekDay(dateStr);
      let intervaloDia = getIntervalFromPreviousDay(dateStr);
      let intervaloCell = intervaloDia !== null ? convertMinToHM(intervaloDia) : "-";
      
      let iconQ = "", iconF = "", iconI = "";
      let rankingQ = getRankingForQuantidade();
      let rankingF = getRankingForFrequencia();
      let rankingI = getRankingForIntraInterval();
      
      rankingQ.forEach((item, idx) => {
        if (item.date === dateStr) {
          if (idx === 0) iconQ = `<span class="record-icon" title="Troféu Dourado - Menor Quantidade" style="color:#FFD700;">🏆</span>`;
          else if (idx === 1) iconQ = `<span class="record-icon" title="Medalha Prata - Menor Quantidade" style="color:#C0C0C0;">🥈</span>`;
          else if (idx === 2) iconQ = `<span class="record-icon" title="Medalha Bronze - Menor Quantidade" style="color:#CD7F32;">🥉</span>`;
        }
      });
      rankingF.forEach((item, idx) => {
        if (item.date === dateStr) {
          if (idx === 0) iconF = `<span class="record-icon" title="Troféu Dourado - Menor Frequência" style="color:#FFD700;">🏆</span>`;
          else if (idx === 1) iconF = `<span class="record-icon" title="Medalha Prata - Menor Frequência" style="color:#C0C0C0;">🥈</span>`;
          else if (idx === 2) iconF = `<span class="record-icon" title="Medalha Bronze - Menor Frequência" style="color:#CD7F32;">🥉</span>`;
        }
      });
      rankingI.forEach((item, idx) => {
        if (item.date === dateStr) {
          if (idx === 0) iconI = `<span class="record-icon" title="Troféu Dourado - Maior Intervalo Intra" style="color:#FFD700;">🏆</span>`;
          else if (idx === 1) iconI = `<span class="record-icon" title="Medalha Prata - Maior Intervalo Intra" style="color:#C0C0C0;">🥈</span>`;
          else if (idx === 2) iconI = `<span class="record-icon" title="Medalha Bronze - Maior Intervalo Intra" style="color:#CD7F32;">🥉</span>`;
        }
      });
      
      tbody.innerHTML += `
        <tr class="${ehPassado ? "past-day" : ""}">
          <td>${dateStr}</td>
          <td>${weekDay}</td>
          <td>${totalQ} ${iconQ}</td>
          <td>${numReg} ${iconF}</td>
          <td>${maiorI} ${iconI}</td>
          <td>${intervaloCell}</td>
          <td><button class="action-btn" data-date="${dateStr}">🗑️</button></td>
        </tr>
      `;
    });
  
  // Adiciona listener para os botões de deletar dia
  document.querySelectorAll("#resumoTable .action-btn").forEach(btn => {
    btn.addEventListener("click", function() {
      let dateStr = this.getAttribute("data-date");
      deletarDia(dateStr);
    });
  });
}

// =======================
// Atualiza o Calendário
// =======================
function atualizarCalendario() {
  const calDiv = document.getElementById("calendar");
  calDiv.innerHTML = "";
  let hojeObj = new Date();
  hojeObj.setHours(0, 0, 0, 0);
  const ano = hojeObj.getFullYear();
  const mes = hojeObj.getMonth();
  const primeiroDia = new Date(ano, mes, 1);
  const ultimoDia = new Date(ano, mes + 1, 0);
  const meses = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
  document.getElementById("mesAtual").textContent = `Calendário Mensal - ${meses[mes]} ${ano}`;
  const diasSemana = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
  diasSemana.forEach(d => calDiv.innerHTML += `<div class="header">${d}</div>`);
  for (let i = 0; i < primeiroDia.getDay(); i++){
    calDiv.innerHTML += `<div class="cal-empty"></div>`;
  }
  let rankingQ = getRankingForQuantidade();
  let rankingF = getRankingForFrequencia();
  let rankingI = getRankingForIntraInterval();
  let maiorTotalObj = computeMaiorIntervaloTotal();
  let primeiroRegistrado = getPrimeiroDiaRegistrado();
  for (let d = 1; d <= ultimoDia.getDate(); d++){
    let cDate = new Date(ano, mes, d);
    cDate.setHours(0, 0, 0, 0);
    let dateStr = formatDate(cDate);
    let r = resumoDiario[dateStr];
    let temRegistros = !!(r && r.numeroRegistros > 0);

    // Linha de estatísticas (só quando há registros no dia)
    let statsHtml = temRegistros
      ? `<div class="cal-stats">T:${formatNumber(r.totalQuantidade, 1)} · R:${r.numeroRegistros} · I:${r.maiorIntervaloIntra}min</div>`
      : "";

    // Marca verde nos dias sem registro dentro do período de uso (meta atingida)
    let ehDiaZeroElegivel = primeiroRegistrado && cDate >= primeiroRegistrado
      && cDate <= hojeObj && !temRegistros;
    let ehForaPeriodo = !primeiroRegistrado || cDate < primeiroRegistrado || cDate > hojeObj;

    let badges = "";
    if (ehDiaZeroElegivel)
      badges += `<span class="cal-badge zero-check" title="Dia sem registro — meta atingida">✓</span>`;
    if (rankingQ.length > 0 && rankingQ[0].date === dateStr)
      badges += `<span class="cal-badge" title="Troféu Dourado - Menor Quantidade">📉</span>`;
    if (rankingF.length > 0 && rankingF[0].date === dateStr)
      badges += `<span class="cal-badge" title="Troféu Dourado - Menor Frequência">🏅</span>`;
    if (rankingI.length > 0 && rankingI[0].date === dateStr)
      badges += `<span class="cal-badge" title="Troféu Dourado - Maior Intervalo Intra">⏱</span>`;
    if (maiorTotalObj.date === dateStr)
      badges += `<span class="cal-badge" title="Troféu Dourado - Maior Intervalo Total">🏆</span>`;

    let dayDiv = document.createElement("div");
    dayDiv.className = "day-data";
    if (temRegistros) dayDiv.classList.add("has-data");
    if (ehDiaZeroElegivel) dayDiv.classList.add("zero-day");
    if (ehForaPeriodo) dayDiv.classList.add("out-range");
    if (dateStr === selectedDate) dayDiv.classList.add("selected-day");
    if (dateStr === formatDate(hojeObj)) dayDiv.classList.add("today");
    dayDiv.innerHTML = `
      <div class="cal-top">
        <span class="cal-daynum">${d}</span>
        <span class="cal-badges">${badges}</span>
      </div>
      ${statsHtml}
    `;
    dayDiv.dataset.date = dateStr;
    dayDiv.addEventListener("click", () => {
      selectedDate = dateStr;
      atualizarTabelas();
      atualizarCalendario();
    });
    calDiv.appendChild(dayDiv);
  }
  updateChampionDisplay();
  updateTodayHighlight();
}

// =======================
// Atualiza o Ranking e Metas (Dashboard)
// =======================
function updateChampionDisplay() {
  let rankingQ = getRankingForQuantidade();
  let rankingF = getRankingForFrequencia();
  let rankingI = getRankingForIntraInterval();
  let maiorTotal = computeMaiorIntervaloTotal();
  let html = `<h2>Ranking e Metas</h2>
    <div class="ranking-category">
      <h4>Menor Quantidade</h4>
      ${gerarHtmlRanking(rankingQ, "Quantidade")}
    </div>
    <div class="ranking-category">
      <h4>Menor Frequência</h4>
      ${gerarHtmlRanking(rankingF, "Frequência")}
    </div>
    <div class="ranking-category">
      <h4>Maior Intervalo Intra (min)</h4>
      ${gerarHtmlRanking(rankingI, "IntervaloIntra")}
    </div>
    <div class="ranking-category">
      <h4>Maior Intervalo Total (h)</h4>
      <div>${Math.floor(maiorTotal.maxHours)}h ${Math.floor((maiorTotal.maxHours*60)%60)}min (ocorreu em: ${maiorTotal.date})</div>
    </div>`;
  document.getElementById("rankingPanel").innerHTML = html;
}

function gerarHtmlRanking(rankingArray, category) {
  if (rankingArray.length === 0) return `<div>Sem registros</div>`;
  let result = "";
  for (let i = 0; i < rankingArray.length && i < 3; i++) {
    let item = rankingArray[i];
    let icon = "", tooltip = "";
    if (category === "Quantidade") {
      if (i === 0) { icon = "🏆"; tooltip = "Troféu Dourado - Menor Quantidade"; }
      else if (i === 1) { icon = "🥈"; tooltip = "Medalha Prata - Menor Quantidade"; }
      else if (i === 2) { icon = "🥉"; tooltip = "Medalha Bronze - Menor Quantidade"; }
    } else if (category === "Frequência") {
      if (i === 0) { icon = "🏆"; tooltip = "Troféu Dourado - Menor Frequência"; }
      else if (i === 1) { icon = "🥈"; tooltip = "Medalha Prata - Menor Frequência"; }
      else if (i === 2) { icon = "🥉"; tooltip = "Medalha Bronze - Menor Frequência"; }
    } else if (category === "IntervaloIntra") {
      if (i === 0) { icon = "🏆"; tooltip = "Troféu Dourado - Maior Intervalo Intra"; }
      else if (i === 1) { icon = "🥈"; tooltip = "Medalha Prata - Maior Intervalo Intra"; }
      else if (i === 2) { icon = "🥉"; tooltip = "Medalha Bronze - Maior Intervalo Intra"; }
    }
    result += `<div>
         <span class="prize-square ${i === 0 ? "prize-first" : i === 1 ? "prize-second" : "prize-third"}" title="${tooltip}"></span>
         ${item.date} - ${category === "Quantidade" ? formatNumber(item.value, 1) : item.value} ${icon}
      </div>`;
  }
  return result;
}

// =======================
// Atualiza o Destaque do Dia (Topo)
// =======================
function updateTodayHighlight() {
  let hoje = formatDate(new Date());
  let info = resumoDiario[hoje];
  let intervalPrev = getIntervalFromPreviousDay(hoje);
  let intervaloStr = intervalPrev !== null ? convertMinToHM(intervalPrev) : "";
  let rankingQ = getRankingForQuantidade();
  let rankingF = getRankingForFrequencia();
  let rankingI = getRankingForIntraInterval();
  let recQ = rankingQ.length > 0 ? formatNumber(rankingQ[0].value, 1) : "-";
  let recF = rankingF.length > 0 ? rankingF[0].value : "-";
  let recI = rankingI.length > 0 ? convertMinToHM(rankingI[0].value) : "-";
  let content = `Hoje (${hoje}):`;
  if (!info || info.numeroRegistros === 0) {
    content += " Sem registros hoje.";
  } else {
    content += `<br>- Registros: ${info.numeroRegistros} (record: ${recF})`;
    content += `<br>- Quantidade Total: ${formatNumber(info.totalQuantidade, 1)} (record: ${recQ})`;
    content += `<br>- Maior Intervalo Intra: ${convertMinToHM(info.maiorIntervaloIntra)} (record: ${recI})`;
    if (intervaloStr) {
      content += `<br>- Intervalo do dia anterior: ${intervaloStr}`;
    }
  }
  document.getElementById("todayHighlight").innerHTML = content;
}

// =======================
// Atualiza a exibição da data selecionada e carrega as anotações
// =======================
function atualizarSelectedDateDisplay() {
  document.getElementById("selectedDateDisplay").textContent = selectedDate;
  document.getElementById("notesDateDisplay").textContent = selectedDate;
}

function carregarNotas(dateStr) {
  let area = document.getElementById("dailyNotes");
  area.value = (resumoDiario[dateStr] && resumoDiario[dateStr].notes) ? resumoDiario[dateStr].notes : "";
}

// =======================
// Funções de Edição e Deleção (CRUD)
// =======================
function deletarRegistro(index) {
  let reg = registros[index];
  registros.splice(index, 1);
  updateSummaryForDay(reg.data);
  ultimoRegistro = registros.length > 0 ? registros[registros.length - 1] : null;
  atualizarTabelas();
  atualizarResumoTable();
  atualizarCalendario();
  salvarDados();
}

function editarQuantidade(index) {
  let reg = registros[index];
  let novaQStr = prompt("Nova quantidade:", reg.quantidade);
  if (novaQStr === null) return;
  novaQStr = novaQStr.replace(",", ".").trim();
  let novaQ = parseFloat(novaQStr);
  if (isNaN(novaQ)) {
    alert("Quantidade inválida.");
    return;
  }
  reg.quantidade = novaQ;
  updateSummaryForDay(reg.data);
  atualizarTabelas();
  atualizarResumoTable();
  atualizarCalendario();
  salvarDados();
}

function editarHora(index) {
  let reg = registros[index];
  let novaHora = prompt("Nova hora (HH:MM):", reg.hora);
  if (novaHora === null) return;
  let hora = parseHoraValida(novaHora.trim());
  if (!hora) {
    alert("Hora inválida. Use HH:MM (00:00–23:59).");
    return;
  }
  let dObj = parseDateFromDDMMYYYY(reg.data);
  if (!dObj) {
    alert("Data inválida no registro.");
    return;
  }
  dObj.setHours(hora.h, hora.m, 0, 0);
  reg.timestamp = dObj.getTime();
  reg.hora = formatTime(dObj);
  updateSummaryForDay(reg.data);
  atualizarTabelas();
  atualizarResumoTable();
  atualizarCalendario();
  salvarDados();
}

function deletarDia(dateStr) {
  if (!confirm("Tem certeza que deseja apagar todos registros desse dia?")) return;
  registros = registros.filter(r => r.data !== dateStr);
  updateSummaryForDay(dateStr);
  atualizarTabelas();
  atualizarResumoTable();
  atualizarCalendario();
  salvarDados();
}

// =======================
// Exportação e Importação (JSON completo / CSV)
// =======================

// Baixa um arquivo usando Blob + URL.createObjectURL (sem limite de data URI).
function baixarArquivo(nomeArquivo, conteudo, mime) {
  let blob = new Blob([conteudo], { type: mime });
  let url = URL.createObjectURL(blob);
  let link = document.createElement("a");
  link.href = url;
  link.download = nomeArquivo;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

// Monta o backup completo: registros + resumoDiario (com as anotações).
function montarBackupCompleto() {
  return JSON.stringify({
    versao: 1,
    exportadoEm: new Date().toISOString(),
    registros: registros,
    resumoDiario: resumoDiario
  }, null, 2);
}

// Exportar JSON (backup completo, inclui anotações)
document.getElementById("exportarJsonBtn").addEventListener("click", () => {
  baixarArquivo("backup_registros.json", montarBackupCompleto(), "application/json");
});

// Exportar CSV (com escape RFC 4180)
document.getElementById("exportarBtn").addEventListener("click", () => {
  let linhas = ["Data,Hora,Quantidade"];
  registros.forEach(reg => {
    linhas.push([reg.data, reg.hora, reg.quantidade].map(escaparCSV).join(","));
  });
  baixarArquivo("backup_registros.csv", linhas.join("\n"), "text/csv;charset=utf-8");
});

document.getElementById("importarBtn").addEventListener("click", () => {
  document.getElementById("fileInput").click();
});

document.getElementById("fileInput").addEventListener("change", function(e) {
  let f = e.target.files[0];
  if (!f) return;
  let reader = new FileReader();
  reader.onload = function(ev) {
    importarArquivo(ev.target.result, f.name);
    document.getElementById("fileInput").value = "";
  };
  reader.readAsText(f);
});

// Importação: aceita JSON (backup completo) ou CSV. Substitui a base atual,
// mas antes confirma e baixa um backup automático de segurança.
function importarArquivo(content, nomeArquivo) {
  if (!confirm("Importar vai SUBSTITUIR toda a base atual (registros e anotações).\n\nUm backup automático do estado atual será baixado antes. Deseja continuar?")) {
    return;
  }
  // Rede de segurança: backup completo do estado atual antes de substituir
  baixarArquivo("backup_antes_de_importar.json", montarBackupCompleto(), "application/json");

  let ehJson = /\.json$/i.test(nomeArquivo) || content.trim().startsWith("{");
  if (ehJson) {
    importarJSON(content);
  } else {
    importarCSV(content);
  }
}

function importarJSON(content) {
  let dados;
  try {
    dados = JSON.parse(content);
  } catch (err) {
    alert("Arquivo JSON inválido.");
    return;
  }
  let novos = Array.isArray(dados.registros) ? dados.registros : [];
  registros = novos.map(r => {
    let ts = parseInt(r.timestamp, 10);
    if (isNaN(ts)) ts = Date.now();
    let dObj = new Date(ts);
    return {
      data: formatDate(dObj),
      hora: formatTime(dObj),
      quantidade: parseFloat(r.quantidade) || 0,
      timestamp: ts
    };
  });
  resumoDiario = (dados.resumoDiario && typeof dados.resumoDiario === "object") ? dados.resumoDiario : {};
  finalizarImportacao();
}

// Parser CSV mínimo que respeita campos entre aspas (vírgulas e aspas escapadas).
function parseLinhaCSV(line) {
  let campos = [];
  let atual = "";
  let dentroAspas = false;
  for (let i = 0; i < line.length; i++) {
    let c = line[i];
    if (dentroAspas) {
      if (c === '"') {
        if (line[i + 1] === '"') { atual += '"'; i++; }
        else dentroAspas = false;
      } else {
        atual += c;
      }
    } else {
      if (c === '"') dentroAspas = true;
      else if (c === ",") { campos.push(atual); atual = ""; }
      else atual += c;
    }
  }
  campos.push(atual);
  return campos;
}

function importarCSV(content) {
  let lines = content.split(/\r?\n/);
  lines.shift(); // Remove o cabeçalho
  let imported = [];
  lines.forEach(line => {
    line = line.trim();
    if (!line) return;
    let parts = parseLinhaCSV(line);
    if (parts.length < 3) return;
    let dtStr = parts[0].trim();
    let horaStr = parts[1].trim();
    let q = parseFloat(parts[2].trim());
    let dtParts = dtStr.split("/");
    if (dtParts.length !== 3) return;
    let [d, m, y] = dtParts.map(x => parseInt(x, 10));
    let hora = parseHoraValida(horaStr);
    if (!hora) return;
    let dt = new Date(y, m - 1, d, hora.h, hora.m, 0);
    imported.push({
      data: formatDate(dt),
      hora: formatTime(dt),
      quantidade: isNaN(q) ? 0 : q,
      timestamp: dt.getTime()
    });
  });
  registros = imported;
  resumoDiario = {}; // CSV não carrega anotações; a base recomeça
  finalizarImportacao();
}

function finalizarImportacao() {
  let uniqueDates = new Set();
  registros.forEach(r => uniqueDates.add(r.data));
  uniqueDates.forEach(d => updateSummaryForDay(d));
  ultimoRegistro = registros.length > 0 ? registros[registros.length - 1] : null;
  atualizarTabelas();
  atualizarResumoTable();
  atualizarCalendario();
  atualizarSelectedDateDisplay();
  salvarDados();
}

// =======================
// Armazenamento com chrome.storage.local
// =======================
// Guarda a última string escrita por esta página, para distinguir a própria
// gravação de uma gravação vinda de outra origem (ex.: o popup) no onChanged.
let ultimoRegistrosJSON = null;
let ultimoResumoJSON = null;

function salvarDados() {
  ultimoRegistrosJSON = JSON.stringify(registros);
  ultimoResumoJSON = JSON.stringify(resumoDiario);
  chrome.storage.local.set({
    registros: ultimoRegistrosJSON,
    resumoDiario: ultimoResumoJSON
  });
}

// Sincroniza a página quando o storage muda por outra origem (o popup grava
// direto e não conhece o estado em memória desta página). Sem isto, o registro
// feito pelo popup só apareceria após recarregar a página.
chrome.storage.onChanged.addListener(function(changes, areaName) {
  if (areaName !== "local") return;
  let regMudou = changes.registros && changes.registros.newValue !== ultimoRegistrosJSON;
  let resMudou = changes.resumoDiario && changes.resumoDiario.newValue !== ultimoResumoJSON;
  if (!regMudou && !resMudou) return; // ignora a própria gravação desta página

  if (regMudou) {
    let novos = changes.registros.newValue;
    registros = novos ? JSON.parse(novos) : [];
    registros.forEach(r => {
      let ts = parseInt(r.timestamp, 10);
      if (isNaN(ts)) ts = Date.now();
      r.data = formatDate(new Date(ts));
      r.timestamp = ts;
    });
  }
  if (resMudou) {
    let nv = changes.resumoDiario.newValue;
    resumoDiario = nv ? JSON.parse(nv) : {};
  }
  // Recalcula o resumo dos dias afetados (preservando notas) e re-renderiza
  let dias = new Set(Object.keys(resumoDiario));
  registros.forEach(r => dias.add(r.data));
  dias.forEach(d => updateSummaryForDay(d));
  ultimoRegistro = registros.length > 0 ? registros[registros.length - 1] : null;
  atualizarTabelas();
  atualizarResumoTable();
  atualizarCalendario();
  // Persiste o resumo recalculado (o popup só grava "registros")
  salvarDados();
});

// =======================
// Salvar anotações do dia selecionado
// =======================
document.getElementById("salvarNotasBtn").addEventListener("click", function() {
  let texto = document.getElementById("dailyNotes").value;
  // Cria a entrada do dia se ainda não existir (dia sem registros, só com nota)
  if (!resumoDiario[selectedDate]) {
    resumoDiario[selectedDate] = {
      notes: "",
      totalQuantidade: 0,
      numeroRegistros: 0,
      maiorIntervaloIntra: 0
    };
  }
  resumoDiario[selectedDate].notes = texto;
  salvarDados();
  let fb = document.getElementById("saveFeedback");
  fb.style.display = "block";
  setTimeout(() => { fb.style.display = "none"; }, 2000);
});

function carregarDados() {
  chrome.storage.local.get(["registros", "resumoDiario"], function(result) {
    if (result.registros) {
      registros = JSON.parse(result.registros);
    }
    if (result.resumoDiario) {
      resumoDiario = JSON.parse(result.resumoDiario);
    }
    registros.forEach(r => {
      let ts = parseInt(r.timestamp, 10);
      if (isNaN(ts)) ts = Date.now();
      r.data = formatDate(new Date(ts));
      r.timestamp = ts;
    });
    let uniqueDates = new Set();
    registros.forEach(r => uniqueDates.add(r.data));
    uniqueDates.forEach(d => updateSummaryForDay(d));
    ultimoRegistro = registros.length > 0 ? registros[registros.length - 1] : null;
    atualizarTabelas();
    atualizarResumoTable();
    atualizarCalendario();
    atualizarSelectedDateDisplay();
  });
}

// Inicia o carregamento dos dados
carregarDados();

// Foca o campo de quantidade ao abrir a página
document.getElementById("quantidade").focus();

// =======================
// Event delegation para botões de edição e deleção (gerados dinamicamente)
// =======================
document.addEventListener("click", function(e) {
  if (e.target.classList.contains("delete-btn")) {
    let idx = e.target.getAttribute("data-index");
    deletarRegistro(parseInt(idx, 10));
  } else if (e.target.classList.contains("edit-btn")) {
    let idx = e.target.getAttribute("data-index");
    let type = e.target.getAttribute("data-type");
    if (type === "quantidade") {
      editarQuantidade(parseInt(idx, 10));
    } else if (type === "hora") {
      editarHora(parseInt(idx, 10));
    }
  }
});
