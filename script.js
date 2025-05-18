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
function getRankingForQuantidade() {
  let current = new Date();
  let currentMonth = current.getMonth();
  let currentYear = current.getFullYear();
  let ranking = [];
  Object.keys(resumoDiario).forEach(dt => {
    let dateObj = parseDateFromDDMMYYYY(dt);
    if (dateObj.getMonth() === currentMonth && dateObj.getFullYear() === currentYear) {
      let r = resumoDiario[dt];
      if (r.numeroRegistros > 0)
        ranking.push({ date: dt, value: r.totalQuantidade, ts: dateObj.getTime() });
    }
  });
  ranking.sort((a, b) => {
    if (Math.abs(a.value - b.value) > EPS) return a.value - b.value;
    return a.ts - b.ts;
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
  let current = new Date();
  let currentMonth = current.getMonth();
  let currentYear = current.getFullYear();
  let ranking = [];
  Object.keys(resumoDiario).forEach(dt => {
    let dateObj = parseDateFromDDMMYYYY(dt);
    if (dateObj.getMonth() === currentMonth && dateObj.getFullYear() === currentYear) {
      let r = resumoDiario[dt];
      if (r.numeroRegistros > 0)
        ranking.push({ date: dt, value: r.numeroRegistros, ts: dateObj.getTime() });
    }
  });
  ranking.sort((a, b) => a.value - b.value);
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
    let partes = horaVal.split(":");
    baseDate.setHours(parseInt(partes[0], 10), parseInt(partes[1], 10), 0, 0);
  }
  let ts = baseDate.getTime();
  let reg = {
    data: formatDate(baseDate),
    hora: formatTime(baseDate),
    quantidade: q,
    timestamp: ts,
    tempoDesdeUltimo: "-"
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
  
  let maxInterval = 0;
  for (let i = 1; i < rDiaAsc.length; i++) {
    let diff = Math.floor((rDiaAsc[i].timestamp - rDiaAsc[i - 1].timestamp) / 60000);
    if (diff > maxInterval) maxInterval = diff;
    rDiaAsc[i].tempoDesdeUltimo = diff;
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
    let tempoStr = reg.tempoDesdeUltimo;
    if (tempoStr !== "-" && parseInt(tempoStr, 10) === maxInterval) {
      tempoStr = `<span style="color:red;">${tempoStr}</span>`;
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
  Object.keys(resumoDiario)
    .sort((a, b) => {
      let d1 = parseDateFromDDMMYYYY(a);
      let d2 = parseDateFromDDMMYYYY(b);
      return d2 - d1;
    })
    .forEach(dateStr => {
      let dataObj = parseDateFromDDMMYYYY(dateStr);
      let bg = dataObj < hojeObj ? "#f5f5f5" : "#ffffff";
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
        <tr style="background-color:${bg};">
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
    calDiv.innerHTML += `<div></div>`;
  }
  let rankingQ = getRankingForQuantidade();
  let rankingF = getRankingForFrequencia();
  let rankingI = getRankingForIntraInterval();
  let maiorTotalObj = computeMaiorIntervaloTotal();
  for (let d = 1; d <= ultimoDia.getDate(); d++){
    let cDate = new Date(ano, mes, d);
    let dateStr = formatDate(cDate);
    let r = resumoDiario[dateStr];
    let cellText = (r && r.numeroRegistros > 0)
      ? ` ${d}<br>T:${formatNumber(r.totalQuantidade, 1)} | R:${r.numeroRegistros} | I:${r.maiorIntervaloIntra}min`
      : d;
    let icons = "";
    if (rankingQ.length > 0 && rankingQ[0].date === dateStr)
      icons += `<span style="font-size:24px;" title="Troféu Dourado - Menor Quantidade">📉</span>`;
    if (rankingF.length > 0 && rankingF[0].date === dateStr)
      icons += `<span style="font-size:24px;" title="Troféu Dourado - Menor Frequência">🏅</span>`;
    if (rankingI.length > 0 && rankingI[0].date === dateStr)
      icons += `<span style="font-size:24px;" title="Troféu Dourado - Maior Intervalo Intra">⏱</span>`;
    if (maiorTotalObj.date === dateStr)
      icons += `<span style="font-size:24px;" title="Troféu Dourado - Maior Intervalo Total">🏆</span>`;
    let dayDiv = document.createElement("div");
    dayDiv.className = "day-data";
    if (dateStr === selectedDate) dayDiv.classList.add("selected-day");
    if (dateStr === formatDate(hojeObj)) dayDiv.classList.add("today");
    dayDiv.innerHTML = `
      <div style="position: relative;">
        ${icons ? `<div class="medals" style="position: absolute; top: 2px; right: 2px;">${icons}</div>` : ""}
      </div>
      ${cellText}
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
  let partes = novaHora.split(":");
  if (partes.length < 2) {
    alert("Hora inválida.");
    return;
  }
  let dObj = parseDateFromDDMMYYYY(reg.data);
  if (!dObj) {
    alert("Data inválida no registro.");
    return;
  }
  dObj.setHours(parseInt(partes[0], 10), parseInt(partes[1], 10), 0, 0);
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
// Exportação e Importação de CSV
// =======================
document.getElementById("exportarBtn").addEventListener("click", () => {
  let csv = "data:text/csv;charset=utf-8,Data,Hora,Quantidade,TempoDesdeUltimo\n";
  registros.forEach(reg => {
    csv += `${reg.data},${reg.hora},${reg.quantidade},${reg.tempoDesdeUltimo}\n`;
  });
  let encodedUri = encodeURI(csv);
  let link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", "backup_registros.csv");
  document.body.appendChild(link);
  link.click();
  link.remove();
});

document.getElementById("importarBtn").addEventListener("click", () => {
  document.getElementById("fileInput").click();
});

document.getElementById("fileInput").addEventListener("change", function(e) {
  let f = e.target.files[0];
  if (!f) return;
  let reader = new FileReader();
  reader.onload = function(ev) {
    importCSV(ev.target.result);
  };
  reader.readAsText(f);
});

function importCSV(content) {
  let lines = content.split("\n");
  lines.shift(); // Remove o cabeçalho
  let imported = [];
  lines.forEach(line => {
    line = line.trim();
    if (!line) return;
    let parts = line.split(",");
    if (parts.length < 3) return;
    let dtStr = parts[0].trim();
    let horaStr = parts[1].trim();
    let qStr = parts[2].trim();
    let q = parseFloat(qStr);
    let dtParts = dtStr.split("/");
    if (dtParts.length !== 3) return;
    let [d, m, y] = dtParts.map(x => parseInt(x, 10));
    let horaParts = horaStr.split(":");
    if (horaParts.length < 2) return;
    let [hh, mm] = horaParts.map(x => parseInt(x, 10));
    let dt = new Date(y, m - 1, d, hh, mm, 0);
    let ts = dt.getTime();
    imported.push({
      data: formatDate(dt),
      hora: formatTime(dt),
      quantidade: q,
      timestamp: ts,
      tempoDesdeUltimo: "-"
    });
  });
  registros = imported;
  resumoDiario = {};
  let uniqueDates = new Set();
  registros.forEach(r => uniqueDates.add(r.data));
  uniqueDates.forEach(d => updateSummaryForDay(d));
  ultimoRegistro = registros.length > 0 ? registros[registros.length - 1] : null;
  atualizarTabelas();
  atualizarResumoTable();
  atualizarCalendario();
  atualizarSelectedDateDisplay();
  salvarDados();
  document.getElementById("fileInput").value = "";
}

// =======================
// Armazenamento com chrome.storage.local
// =======================
function salvarDados() {
  chrome.storage.local.set({
    registros: JSON.stringify(registros),
    resumoDiario: JSON.stringify(resumoDiario)
  });
}

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
