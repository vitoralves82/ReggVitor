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
// O dia lógico e o tipo de dia vêm de dia.js, o mesmo módulo usado pelo
// painel: as duas telas precisam contar e comparar a mesma coisa.
function chaveLogicaPopup(ts) {
  return window.RA_DIA.chaveLogica(ts);
}

// Rótulos em minúsculas para caber na frase de comparação
const ROTULO_TIPO = { home: "home office", office: "escritório", off: "dia off" };
const PLURAL_TIPO = { home: "dias de home office", office: "dias de escritório", off: "dias off" };

// Tipos de dia corrigidos à mão (chave tiposDia do storage)
let tiposDia = {};

// Comparação do dia com a linha do MESMO tipo de dia.
// Um sábado comparado com a média de todos os dias produz um alerta inútil:
// a referência precisa ser a mediana dos dias off, dos dias de home office
// ou dos dias de escritório, conforme o dia de hoje.
function pintarLinhaDia(registros) {
  let barra = document.getElementById("popupBarra");
  let linha = document.getElementById("popupLinha");
  if (!barra || !linha) return null;

  let L = window.RA_DIA.linhaDoDia(registros, tiposDia, null);
  let rot = ROTULO_TIPO[L.tipo];
  let fill = barra.querySelector("i");
  barra.className = "barra";
  linha.className = "";

  if (L.base === null) {
    fill.style.width = "0%";
    linha.textContent = registros.length
      ? "Poucos dias completos para uma linha de " + rot + ". Continue registrando."
      : "Sem histórico ainda. A linha de cada tipo de dia aparece com os primeiros dias completos.";
    return L;
  }

  let dif = L.total - L.base;
  let tol = 0.05; // abaixo disso a diferença é ruído de arredondamento
  let razao = L.base > 0 ? L.total / L.base : (L.total > 0 ? 2 : 0);
  let estado = razao <= 1.0001 ? "ok" : (razao <= 1.25 ? "acima" : "muito");

  fill.style.width = Math.round(Math.min(razao, 1) * 100) + "%";
  if (estado !== "ok") barra.className = "barra " + estado;
  linha.className = estado;

  let ref = L.generica
    ? "da sua média diária (" + formatNumberBR(L.base) + " g)"
    : "da sua linha de " + rot + " (" + formatNumberBR(L.base) + " g)";
  let cauda = L.generica
    ? " · ainda sem " + window.RA_DIA.MIN_AMOSTRA + " " + PLURAL_TIPO[L.tipo] + " completos para comparar"
    : "";

  if (Math.abs(dif) <= tol) {
    linha.innerHTML = "<b>na linha</b> " + ref + cauda;
  } else {
    linha.innerHTML = "<b>" + formatNumberBR(Math.abs(dif)) + " g " + (dif > 0 ? "acima" : "abaixo") + "</b> " + ref + cauda;
  }
  return L;
}

// Chips do tipo de dia: a comparação só é honesta se o dia estiver
// classificado. O padrão vem do dia da semana e pode estar errado
// (feriado, folga no meio da semana, escritório fora de terça/quinta).
function renderTiposDia(registros) {
  let box = document.getElementById("popupTipos");
  if (!box) return;
  let k = window.RA_DIA.hoje();
  let atual = window.RA_DIA.tipoDe(k, tiposDia);
  box.innerHTML = "";
  let lab = document.createElement("span");
  lab.className = "lab";
  lab.textContent = "Hoje é";
  box.appendChild(lab);
  window.RA_DIA.ORDEM.forEach(function (t) {
    let b = document.createElement("button");
    b.type = "button";
    b.tabIndex = -1;
    b.className = "tipo-chip" + (t === atual ? " on" : "");
    b.textContent = window.RA_DIA.NOMES[t];
    b.title = "Comparar hoje com a mediana dos seus dias de " + ROTULO_TIPO[t];
    b.addEventListener("click", function () {
      tiposDia[k] = t;
      chrome.storage.local.set({ tiposDia: JSON.stringify(tiposDia) }, function () {
        renderTiposDia(registros);
        pintarLinhaDia(registros);
      });
    });
    box.appendChild(b);
  });
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
  chrome.storage.local.get(["registros", "tiposDia"], function(result) {
    let registros = result.registros ? JSON.parse(result.registros) : [];
    try { tiposDia = result.tiposDia ? JSON.parse(result.tiposDia) : {}; } catch (e) { tiposDia = {}; }
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

    // Comparação com a linha do mesmo tipo de dia e seletor do tipo
    let linha = pintarLinhaDia(registros);
    renderTiposDia(registros);

    // Frase de contexto (banco em mensagens.js)
    let msgEl = document.getElementById("popupMsg");
    if (msgEl && window.MSGS) {
      let pesado = linha && linha.base !== null && linha.total > linha.base + 0.05;
      if (!registros.length) msgEl.textContent = window.MSGS.escolher("sem_dados");
      else if (!doDia.length) msgEl.textContent = window.MSGS.escolher("popup_limpo");
      else if (pesado) msgEl.textContent = window.MSGS.escolher("dia_pesado");
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
