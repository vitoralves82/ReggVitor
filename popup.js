// Funções de formatação
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

// Formata número trocando ponto por vírgula (padrão pt-BR)
function formatNumberBR(num) {
  return num.toFixed(1).replace(".", ",");
}

// Rótulo curto de um valor para os chips (inteiro sem casas, senão vírgula)
function formatChip(v) {
  let r = Math.round(v * 10) / 10;
  return Number.isInteger(r) ? String(r) : String(r).replace(".", ",");
}

// Popula os selects de hora (00–23) e minuto (00–59)
function popularSelectsHora(hhSel, mmSel) {
  if (hhSel && hhSel.options.length === 0) {
    for (let h = 0; h < 24; h++) {
      let o = document.createElement("option");
      o.value = h; o.textContent = String(h).padStart(2, "0");
      hhSel.appendChild(o);
    }
  }
  if (mmSel && mmSel.options.length === 0) {
    for (let m = 0; m < 60; m++) {
      let o = document.createElement("option");
      o.value = m; o.textContent = String(m).padStart(2, "0");
      mmSel.appendChild(o);
    }
  }
}
function setSelectsHora(hhSel, mmSel, date) {
  if (hhSel) hhSel.value = date.getHours();
  if (mmSel) mmSel.value = date.getMinutes();
}

// Foca e seleciona o campo de quantidade
function focarQuantidade() {
  let el = document.getElementById("popupQuantidade");
  el.focus();
  el.select();
}

// Aplica o tema salvo pelo usuário (mesma preferência da página completa)
function aplicarTemaSalvo() {
  chrome.storage.local.get(["config"], function(result) {
    let cfg = {};
    try { cfg = result.config ? JSON.parse(result.config) : {}; } catch (e) { cfg = {}; }
    let escolha = cfg.tema || "dark";
    if (escolha === "light" || escolha === "dark") {
      document.documentElement.setAttribute("data-theme", escolha);
    } else {
      document.documentElement.removeAttribute("data-theme");
    }
  });
}

// Renderiza os chips de valor (1 é o padrão; demais são os últimos usados)
function renderChips(registros) {
  let container = document.getElementById("popupChips");
  let inputEl = document.getElementById("popupQuantidade");
  container.innerHTML = "";
  let vals = [1];
  for (let i = registros.length - 1; i >= 0 && vals.length < 6; i--) {
    let q = registros[i].quantidade;
    if (!vals.some(v => Math.abs(v - q) < 0.001)) vals.push(q);
  }
  vals.forEach((v, idx) => {
    let b = document.createElement("button");
    b.type = "button";
    b.tabIndex = -1; // atalho de clique; não interrompe o Tab até a hora
    b.className = "chip" + (idx === 0 ? " chip-default" : "");
    b.textContent = formatChip(v);
    b.addEventListener("click", () => { inputEl.value = formatChip(v); inputEl.focus(); });
    container.appendChild(b);
  });
}

// Intervalo legível a partir de milissegundos
function formatGap(ms) {
  let min = Math.floor(ms / 60000);
  if (min < 1) return { v: "agora", u: "", txt: "agora mesmo" };
  if (min < 60) return { v: String(min), u: "min", txt: min + " min" };
  let h = Math.floor(min / 60), m = min % 60;
  if (h < 24) return { v: h + "h" + String(m).padStart(2, "0"), u: "", txt: h + "h" + String(m).padStart(2, "0") };
  let d = Math.floor(h / 24);
  return { v: String(d), u: "d", txt: d + " dia" + (d > 1 ? "s" : "") };
}

// Atualiza o resumo do dia e os chips de valor a partir do storage.
// Usa o mesmo dia lógico da página (começa às 04h), para as duas telas
// contarem a mesma coisa quando há registro de madrugada.
function chaveLogicaPopup(ts) {
  let d = new Date(ts - 4 * 3600000);
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}

let ultimoTs = null; // guardado para o contador de intervalo seguir correndo

function pintarGap() {
  let vEl = document.getElementById("stGap");
  let sEl = document.getElementById("stGapSub");
  if (!ultimoTs) { vEl.textContent = "—"; sEl.textContent = "sem registro"; return null; }
  let g = formatGap(Date.now() - ultimoTs);
  vEl.innerHTML = g.v + (g.u ? '<span class="u">' + g.u + "</span>" : "");
  sEl.textContent = "desde o último";
  return g.txt;
}

function atualizarResumoHoje() {
  let hoje = chaveLogicaPopup(Date.now());
  chrome.storage.local.get(["registros"], function(result) {
    let registros = result.registros ? JSON.parse(result.registros) : [];
    let doDia = registros.filter(r => chaveLogicaPopup(parseInt(r.timestamp, 10)) === hoje);
    let total = doDia.reduce((soma, r) => soma + (r.quantidade || 0), 0);

    // Janela de 7 dias lógicos (inclui hoje)
    let corte = Date.now() - 7 * 86400000;
    let sem = registros.filter(r => parseInt(r.timestamp, 10) >= corte);
    let totalSem = sem.reduce((soma, r) => soma + (r.quantidade || 0), 0);

    document.getElementById("stHoje").innerHTML = formatNumberBR(total) + '<span class="u">g</span>';
    document.getElementById("stHojeSub").textContent = doDia.length + (doDia.length === 1 ? " registro" : " registros");
    document.getElementById("stSem").innerHTML = formatNumberBR(totalSem) + '<span class="u">g</span>';
    document.getElementById("stSemSub").textContent = formatNumberBR(totalSem / 7) + " g/dia";

    let ts = registros.reduce((mx, r) => Math.max(mx, parseInt(r.timestamp, 10) || 0), 0);
    ultimoTs = ts || null;
    let gapTxt = pintarGap();

    // Frase de contexto (banco em mensagens.js)
    let msgEl = document.getElementById("popupMsg");
    if (msgEl && window.MSGS) {
      if (!registros.length) msgEl.textContent = window.MSGS.escolher("sem_dados");
      else if (!doDia.length) msgEl.textContent = window.MSGS.escolher("popup_limpo");
      else if (gapTxt && (Date.now() - ultimoTs) >= 3 * 3600000) msgEl.textContent = window.MSGS.escolher("popup_intervalo", { gap: gapTxt });
      else msgEl.textContent = window.MSGS.escolher("popup_neutro");
    }

    renderChips(registros);
  });
}

// Registra o evento via popup e exibe "Salvo - hh:mm"
function registrarPopup() {
  let quantidadeInput = document.getElementById("popupQuantidade");
  let hhSel = document.getElementById("popupHH");
  let mmSel = document.getElementById("popupMM");
  let statusDiv = document.getElementById("popupStatus");

  let quantStr = quantidadeInput.value.replace(",", ".");
  let q = parseFloat(quantStr);
  if (isNaN(q)) {
    statusDiv.textContent = "Quantidade inválida!";
    statusDiv.style.color = "var(--danger)";
    return;
  }

  // Hora vem dos selects (sempre válida)
  let date = new Date();
  date.setHours(parseInt(hhSel.value, 10), parseInt(mmSel.value, 10), 0, 0);

  let registro = {
    data: formatDate(date),
    hora: formatTime(date),
    quantidade: q,
    timestamp: date.getTime()
  };

  chrome.storage.local.get(["registros"], function(result) {
    let registros = result.registros ? JSON.parse(result.registros) : [];
    registros.push(registro);
    chrome.storage.local.set({ registros: JSON.stringify(registros) }, function() {
      statusDiv.textContent = "Salvo - " + formatTime(date);
      statusDiv.style.color = "var(--accent-strong)";
      setTimeout(() => { statusDiv.textContent = ""; }, 2000);
      quantidadeInput.value = "";
      // Reseta a hora para "agora" e volta o foco para a quantidade
      setSelectsHora(hhSel, mmSel, new Date());
      focarQuantidade();
      atualizarResumoHoje();
    });
  });
}

// Abre a página completa de registros (index.html) em uma nova aba
function abrirPaginaRegistros() {
  chrome.tabs.create({ url: chrome.runtime.getURL("index.html") });
}

document.getElementById("popupRegistrarBtn").addEventListener("click", registrarPopup);
document.getElementById("popupQuantidade").addEventListener("keyup", function(e){
  if (e.key === "Enter") registrarPopup();
});
document.getElementById("popupMM").addEventListener("keyup", function(e){
  if (e.key === "Enter") registrarPopup();
});
document.getElementById("popupGotoBtn").addEventListener("click", abrirPaginaRegistros);
document.getElementById("popupAgoraBtn").addEventListener("click", () => {
  setSelectsHora(document.getElementById("popupHH"), document.getElementById("popupMM"), new Date());
});

// Ao abrir o popup: aplica tema, popula a hora (agora), foca e mostra o resumo
aplicarTemaSalvo();
popularSelectsHora(document.getElementById("popupHH"), document.getElementById("popupMM"));
setSelectsHora(document.getElementById("popupHH"), document.getElementById("popupMM"), new Date());
focarQuantidade();
atualizarResumoHoje();
// O contador de intervalo precisa continuar correndo enquanto o popup fica aberto
setInterval(pintarGap, 30000);
