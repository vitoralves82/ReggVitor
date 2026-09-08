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
    window.__tom = cfg.tom || "frases";
    if (window.__tom === "numeros") {
      let m = document.getElementById("popupMsg");
      if (m) m.textContent = "";
    }
    let escolha = cfg.tema || "dark";
    if (escolha === "light" || escolha === "dark") {
      document.documentElement.setAttribute("data-theme", escolha);
    } else {
      document.documentElement.removeAttribute("data-theme");
    }
  });
}

// Renderiza os chips de valor: o primeiro é o último valor registrado,
// os demais são os recentes em ordem crescente.
function renderChips(registros) {
  let container = document.getElementById("popupChips");
  let inputEl = document.getElementById("popupQuantidade");
  container.innerHTML = "";
  let ult = registros.length ? registros[registros.length - 1].quantidade : 1;
  let outros = [];
  for (let i = registros.length - 2; i >= 0 && outros.length < 5; i--) {
    let v = registros[i].quantidade;
    if (Math.abs(v - ult) < 0.001) continue;
    if (!outros.some(x => Math.abs(x - v) < 0.001)) outros.push(v);
  }
  outros.sort((a, b) => a - b);
  [ult].concat(outros).forEach((v, idx) => {
    let b = document.createElement("button");
    b.type = "button";
    b.tabIndex = -1; // atalho de clique; não interrompe o Tab até a hora
    b.className = "chip" + (idx === 0 ? " chip-default" : "");
    if (idx === 0) b.title = "Último valor registrado";
    b.textContent = formatChip(v);
    b.addEventListener("click", () => { inputEl.value = formatChip(v); inputEl.select(); });
    container.appendChild(b);
  });
  // campo já vem preenchido com o último valor registrado
  if (!inputEl.value.trim()) inputEl.value = formatChip(ult);
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
  return window.RA_DIA.chaveLogica(ts);
}

// Tipos de dia corrigidos à mão e configuração do painel (meta, janela)
let tiposDia = {};
let cfgPainel = {};

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

// Barra discreta: onde o dia está em relação à linha do MESMO tipo de dia.
// Um sábado medido contra a média de todos os dias apareceria quase sempre
// "acima", e uma terça quase sempre "abaixo": o aviso pararia de orientar.
function pintarPace(ref) {
  let box = document.getElementById("pace");
  if (!box) return;
  if (!ref || !ref.base) { box.hidden = true; return; }
  box.hidden = false;
  let alvoDia = ref.base;
  let razao = alvoDia > 0 ? ref.total / alvoDia : 0;
  let cor = razao > 1 ? "var(--danger)" : (razao >= 0.85 ? "var(--warn)" : "var(--accent-strong)");
  let fill = document.getElementById("paceFill");
  fill.style.width = (Math.max(0, Math.min(1, razao)) * 100).toFixed(0) + "%";
  fill.style.background = cor;

  // Com poucos dias daquele tipo a mediana ainda é ruído: a referência cai
  // para a média dos últimos dias completos e o texto avisa.
  let nome = ref.generica ? "média diária" : "linha de " + ref.rotulo;
  let valor = " (" + formatNumberBR(alvoDia) + " g)";
  let dif = ref.total - alvoDia;
  let txt;
  if (dif > 0.05) {
    txt = '<b style="color:' + cor + '">' + formatNumberBR(dif) + ' g acima</b> da ' + nome + valor;
  } else if (dif >= -0.05) {
    txt = '<b style="color:' + cor + '">na ' + nome + '</b>' + valor;
  } else {
    txt = '<b style="color:' + cor + '">restam ' + formatNumberBR(-dif) + ' g</b> até a ' + nome + valor;
  }
  document.getElementById("paceTxt").innerHTML = txt;

  // O detalhe fica no title: o popup precisa caber em uma linha
  let det = ref.generica
    ? "Média dos últimos " + ref.diasCompletos + " dias completos. Faltam " +
      window.RA_DIA.MIN_AMOSTRA + " " + ref.plural + " completos para a linha específica."
    : "Mediana de " + ref.amostra + " " + ref.plural + " completos.";
  if (ref.alvoMeta && cfgPainel.meta > 0 && formatNumberBR(ref.alvoMeta) !== formatNumberBR(alvoDia)) {
    det += " Alvo com a meta de −" + Math.round(cfgPainel.meta) + "%/mês: " + formatNumberBR(ref.alvoMeta) + " g.";
  }
  box.title = det;
}

// Chips do tipo de dia: o padrão vem do dia da semana e erra em feriado,
// folga no meio da semana ou escritório fora de terça e quinta. Como é o
// tipo que escolhe a linha, corrigi-lo aqui muda a leitura na hora.
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
    b.title = "Comparar hoje com a mediana dos seus " + window.RA_DIA.PLURAIS[t];
    b.addEventListener("click", function () {
      tiposDia[k] = t;
      chrome.storage.local.set({ tiposDia: JSON.stringify(tiposDia) }, function () {
        atualizarResumoHoje();
      });
    });
    box.appendChild(b);
  });
}

function atualizarResumoHoje() {
  let hoje = chaveLogicaPopup(Date.now());
  chrome.storage.local.get(["registros", "tiposDia", "config"], function(result) {
    let registros = result.registros ? JSON.parse(result.registros) : [];
    try { tiposDia = result.tiposDia ? JSON.parse(result.tiposDia) : {}; } catch (e) { tiposDia = {}; }
    try { cfgPainel = result.config ? JSON.parse(result.config) : {}; } catch (e) { cfgPainel = {}; }
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

    // Referência do dia: a linha do mesmo tipo de dia, calculada em dia.js
    // com a mesma regra do painel (hoje fora da conta, dias sem registro
    // valendo 0 g e mediana no lugar da média).
    let ref = window.RA_DIA.referenciaDoDia(registros, tiposDia, cfgPainel, hoje);
    let alvoDia = ref.base;
    pintarPace(ref);
    renderTiposDia(registros);

    // Frase de contexto (banco em mensagens.js), escolhida pela distância até a média
    let msgEl = document.getElementById("popupMsg");
    if (msgEl && window.MSGS && window.__tom !== "numeros") {
      let vars = {
        gap: gapTxt,
        tipo: ref.generica ? "dia" : ref.rotulo,
        plural: ref.generica ? "dias" : ref.plural
      };
      let ctx = "popup_neutro";
      if (!registros.length) ctx = "sem_dados";
      else if (!doDia.length) ctx = "popup_limpo";
      else if (alvoDia) {
        let razao = total / alvoDia;
        vars.resta = formatNumberBR(Math.max(0, alvoDia - total));
        vars.excesso = formatNumberBR(Math.max(0, total - alvoDia));
        vars.alvo = formatNumberBR(alvoDia);
        ctx = razao > 1 ? "popup_acima" : (razao >= 0.85 ? "popup_perto" : (razao >= 0.5 ? "popup_meio" : "popup_folga"));
      }
      if (registros.length && doDia.length && gapTxt && (Date.now() - ultimoTs) >= 3 * 3600000 && Math.random() < 0.3) {
        ctx = "popup_intervalo";
      }
      msgEl.textContent = window.MSGS.escolher(ctx, vars);
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

/* ------------------------------ backup CSV ------------------------------ */
// Mesma regra da página completa, vinda de dia.js: uma cópia só da definição
function nomeTipoDia(k, tipos) {
  return window.RA_DIA.NOMES[window.RA_DIA.tipoDe(k, tipos)];
}
function csvEsc(v) {
  let s = String(v == null ? "" : v);
  return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}
function flash(msg, cor) {
  let st = document.getElementById("popupStatus");
  st.textContent = msg;
  st.style.color = cor || "var(--accent-strong)";
  setTimeout(() => { st.textContent = ""; }, 2500);
}
function exportarCsvPopup() {
  chrome.storage.local.get(["registros", "tiposDia"], function (res) {
    let regs = [];
    try { regs = res.registros ? JSON.parse(res.registros) : []; } catch (e) { regs = []; }
    let tipos = {};
    try { tipos = res.tiposDia ? JSON.parse(res.tiposDia) : {}; } catch (e) { tipos = {}; }
    if (!regs.length) { flash("Nada para exportar", "var(--danger)"); return; }
    let linhas = ["Data,Hora,Quantidade,Motivo,Nota,TipoDia"];
    regs.slice()
      .sort((a, b) => parseInt(a.timestamp, 10) - parseInt(b.timestamp, 10))
      .forEach(function (r) {
        let ts = parseInt(r.timestamp, 10);
        let d = new Date(ts);
        linhas.push([
          r.data || formatDate(d), r.hora || formatTime(d), r.quantidade,
          r.gatilho || "", r.nota || "", nomeTipoDia(chaveLogicaPopup(ts), tipos)
        ].map(csvEsc).join(","));
      });
    let url = URL.createObjectURL(new Blob([linhas.join("\n")], { type: "text/csv;charset=utf-8" }));
    let a = document.createElement("a");
    a.href = url; a.download = "backup_registros.csv";
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    flash(regs.length + " registros exportados");
  });
}
// O seletor de arquivo fecharia o popup, então a importação abre na página completa
function importarCsvPopup() {
  chrome.tabs.create({ url: chrome.runtime.getURL("index.html#importar") });
}

document.getElementById("popupRegistrarBtn").addEventListener("click", registrarPopup);
document.getElementById("popupQuantidade").addEventListener("keyup", function(e){
  if (e.key === "Enter") registrarPopup();
});
document.getElementById("popupMM").addEventListener("keyup", function(e){
  if (e.key === "Enter") registrarPopup();
});
document.getElementById("popupGotoBtn").addEventListener("click", abrirPaginaRegistros);
document.getElementById("btnExpCsv").addEventListener("click", exportarCsvPopup);
document.getElementById("btnImpCsv").addEventListener("click", importarCsvPopup);
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
