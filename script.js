"use strict";

/* =========================================================================
   Registro de Atividade — painel analítico
   Regras centrais:
   - Dia lógico começa às 04:00 (madrugada pertence ao dia anterior).
   - Toda comparação é "como com como": cada dia é avaliado contra a mediana
     histórica do SEU tipo de dia (home office / escritório / dia off).
   - Nenhum ranking mensal, nenhum troféu que reinicia.
   ========================================================================= */

/* Dia lógico, tipo de dia e as réguas derivadas moram em dia.js, para o
   painel e o registro rápido compararem exatamente a mesma coisa. */
var H0 = window.RA_DIA.H0;

/* Fora da extensão (abrindo o arquivo direto no navegador) não existe
   chrome.storage; um espelho em localStorage mantém a página funcional. */
if (typeof chrome === "undefined" || !chrome.storage || !chrome.storage.local) {
  window.chrome = window.chrome || {};
  chrome.storage = {
    local: {
      get: function (chaves, cb) {
        var out = {};
        (Array.isArray(chaves) ? chaves : [chaves]).forEach(function (k) {
          var v = localStorage.getItem("ra_" + k);
          if (v !== null) out[k] = v;
        });
        cb(out);
      },
      set: function (obj, cb) {
        Object.keys(obj).forEach(function (k) { localStorage.setItem("ra_" + k, obj[k]); });
        if (cb) cb();
      }
    },
    onChanged: { addListener: function () {} }
  };
}

var TIPOS = {
  home:   { nome: window.RA_DIA.NOMES.home,   cor: "var(--blue)",   classe: "b-home" },
  office: { nome: window.RA_DIA.NOMES.office, cor: "var(--violet)", classe: "b-office" },
  off:    { nome: window.RA_DIA.NOMES.off,    cor: "var(--warn)",   classe: "b-off" }
};
var GAT = ["", "tédio", "ansiedade", "social", "ritual", "hábito", "lazer"];
var DIAS_SEM = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
var MESES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
var MES3 = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

/* ------------------------------- formato ------------------------------- */
function n1(v) { return (Math.round(v * 10) / 10).toFixed(1).replace(".", ","); }
function n0(v) { return String(Math.round(v)); }
function hm(min) {
  var m = Math.max(0, Math.round(min)), h = Math.floor(m / 60);
  return h > 0 ? h + "h" + String(m % 60).padStart(2, "0") : m + "min";
}
function mediana(a) { return window.RA_DIA.mediana(a); }
function media(a) { return a.length ? a.reduce(function (s, v) { return s + v; }, 0) / a.length : 0; }
function pad2(v) { return String(v).padStart(2, "0"); }
function hFmt(h) {
  var hh = Math.floor(h) % 24, mi = Math.round((h % 1) * 60);
  if (mi === 60) { mi = 0; hh = (hh + 1) % 24; }
  return pad2(hh) + "h" + pad2(mi);
}
function mesLogico(ts) { var d = new Date(ts - H0 * 3600000); return d.getFullYear() + "-" + pad2(d.getMonth() + 1); }
/* Faixa horária: 0 = antes das 09h · 1 = jornada 09h–18h · 2 = após 18h
   (00h–04h conta como continuação da noite, igual ao dia lógico) */
function bandaHora(ts) {
  var h = new Date(ts).getHours();
  if (h < H0) return 2;
  if (h < 9) return 0;
  if (h < 18) return 1;
  return 2;
}
function el(tag, cls, txt) {
  var e = document.createElement(tag);
  if (cls) e.className = cls;
  if (txt !== undefined && txt !== null) e.textContent = txt;
  return e;
}
function q(sel) { return document.querySelector(sel); }

/* ------------------------------- estado ------------------------------- */
var S = {
  regs: [],            // {id, ts, q, gatilho}
  tipos: {},           // "AAAA-MM-DD" -> "home"|"office"|"off"
  compras: [],         // {id, ts, tipo, tipoNome, q, valor, nota}
  saidas: [],          // {id, ts, tipo, q, motivo, nota} — baixa sem fumar
  tiposCompra: { A: "A", B: "B", C: "C" },
  tipoCompraSel: "A",
  tipoSaidaSel: "A",
  cfg: { janela: 90, meta: 10, tema: "dark", mm: 7, mmPrinc: 20, metaFin: 1000000, modo: "analitico", pal: "verde", tom: "frases", base0: "" },
  sel: null,
  filtroHora: "todos",
  mostrarMedia: true,
  evoGran: "dia",
  mesOffset: 0,
  escritaPropria: null
};
var MOTIVOS = ["manteiga", "presente", "descarte / pontas", "extra\u00e7\u00e3o", "outro"];

/* ------------------------------ tooltip ------------------------------ */
var _tipN = null;
function tipN() { if (!_tipN) _tipN = q("#tip"); return _tipN; }
function comTip(node, html) {
  node.__tipHtml = html;
  if (node.__tipOn) return;
  node.__tipOn = true;
  node.addEventListener("mousemove", function (e) {
    var t = tipN(); if (!t) return;
    t.innerHTML = node.__tipHtml; t.classList.add("on");
    var x = Math.min(window.innerWidth - t.offsetWidth - 10, Math.max(8, e.clientX + 14));
    var y = e.clientY - t.offsetHeight - 12;
    if (y < 8) y = e.clientY + 18;
    t.style.left = x + "px"; t.style.top = y + "px";
  });
  node.addEventListener("mouseleave", function () { var t = tipN(); if (t) t.classList.remove("on"); });
}
function rs(v) { return "R$ " + (Math.round(v * 100) / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function rs0(v) { return "R$ " + Math.round(v).toLocaleString("pt-BR"); }

/* ------------------------- dia lógico (04h) ------------------------- */
function chaveLogica(ts) { return window.RA_DIA.chaveLogica(ts); }
function chaveDe(d) { return window.RA_DIA.chaveDe(d); }
function chaveParaData(k) { return window.RA_DIA.chaveParaData(k); }
function tipoDe(k) { return window.RA_DIA.tipoDe(k, S.tipos); }
/* Datas sempre em formato brasileiro com o mês em três letras: 26/Ago/2026.
   rotuloCurto omite o ano (eixos e faixas de semana), dataBR o mantém. */
function rotuloCurto(k) { var d = chaveParaData(k); return pad2(d.getDate()) + "/" + MES3[d.getMonth()]; }
function dataBR(ts) { var d = new Date(ts); return pad2(d.getDate()) + "/" + MES3[d.getMonth()] + "/" + d.getFullYear(); }
function parseBR(txt) {
  var p = String(txt).trim().split(/[\/\-.\s]+/);
  if (p.length < 2) return null;
  var dia = parseInt(p[0], 10);
  var mi = /^\d+$/.test(p[1]) ? parseInt(p[1], 10) - 1
    : MES3.findIndex(function (m) { return m.toLowerCase() === p[1].slice(0, 3).toLowerCase(); });
  var ano = p[2] === undefined ? new Date().getFullYear() : parseInt(p[2], 10);
  if (ano < 100) ano += 2000;
  if (!dia || dia > 31 || mi < 0 || mi > 11 || !ano) return null;
  return { dia: dia, mi: mi, ano: ano };
}
function rotuloLongo(k) { var d = chaveParaData(k); return DIAS_SEM[d.getDay()] + ", " + pad2(d.getDate()) + "/" + MES3[d.getMonth()] + "/" + d.getFullYear(); }
function hoje() { return chaveLogica(Date.now()); }

/* ------------------------------ storage ------------------------------ */
function normalizar(arr) {
  return arr.map(function (r, i) {
    var ts = parseInt(r.timestamp, 10);
    if (isNaN(ts)) ts = Date.now();
    return { id: r.id || (String(ts) + "-" + i), ts: ts, q: parseFloat(r.quantidade != null ? r.quantidade : r.q) || 0, gatilho: r.gatilho || "", nota: r.nota || "" };
  }).sort(function (a, b) { return a.ts - b.ts; });
}
function serializar() {
  return S.regs.map(function (r) {
    var d = new Date(r.ts);
    return {
      data: pad2(d.getDate()) + "/" + pad2(d.getMonth() + 1) + "/" + d.getFullYear(),
      hora: pad2(d.getHours()) + ":" + pad2(d.getMinutes()),
      quantidade: r.q, timestamp: r.ts, gatilho: r.gatilho || "", nota: r.nota || ""
    };
  });
}
function salvar() {
  var json = JSON.stringify(serializar());
  S.escritaPropria = json;
  chrome.storage.local.set({ registros: json, tiposDia: JSON.stringify(S.tipos), config: JSON.stringify(S.cfg) });
}
function salvarConfig() { chrome.storage.local.set({ config: JSON.stringify(S.cfg) }); }
function salvarCompras() { chrome.storage.local.set({ compras: JSON.stringify(S.compras), tiposCompra: JSON.stringify(S.tiposCompra), saidas: JSON.stringify(S.saidas) }); }

function carregar() {
  chrome.storage.local.get(["registros", "tiposDia", "config", "compras", "tiposCompra", "saidas"], function (res) {
    try { S.regs = res.registros ? normalizar(JSON.parse(res.registros)) : []; } catch (e) { S.regs = []; }
    try { if (res.tiposDia) S.tipos = JSON.parse(res.tiposDia); } catch (e) {}
    try { if (res.config) S.cfg = Object.assign(S.cfg, JSON.parse(res.config)); } catch (e) {}
    try { S.compras = res.compras ? JSON.parse(res.compras) : []; } catch (e) { S.compras = []; }
    try { S.saidas = res.saidas ? JSON.parse(res.saidas) : []; } catch (e) { S.saidas = []; }
    try { if (res.tiposCompra) S.tiposCompra = Object.assign({ A: "A", B: "B", C: "C" }, JSON.parse(res.tiposCompra)); } catch (e) {}
    aplicarConfigUI();
    renderChips();
    renderTiposCompraBar();
    render();
  });
}

/* O popup grava direto em "registros" e não conhece o estado desta página.
   Sem este listener, o registro feito pelo popup seria sobrescrito na próxima
   gravação daqui (o bug crítico da versão anterior). */
if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.onChanged) {
  chrome.storage.onChanged.addListener(function (ch, area) {
    if (area !== "local") return;
    if (ch.registros && ch.registros.newValue === S.escritaPropria) return; // gravação desta página
    var mudou = false;
    if (ch.registros) {
      try { S.regs = ch.registros.newValue ? normalizar(JSON.parse(ch.registros.newValue)) : []; mudou = true; } catch (e) {}
    }
    /* O popup também classifica o dia (home office / escritório / off), e é a
       classificação que define contra qual linha o dia é medido. */
    if (ch.tiposDia) {
      try { S.tipos = ch.tiposDia.newValue ? JSON.parse(ch.tiposDia.newValue) : {}; mudou = true; } catch (e) {}
    }
    if (mudou) render();
  });
}

/* ============================== agregação ============================== */
function construir() {
  var porDia = {};
  S.regs.forEach(function (r) {
    var k = chaveLogica(r.ts);
    if (!porDia[k]) porDia[k] = [];
    porDia[k].push(r);
  });
  var dias = [];
  if (S.regs.length) {
    var ini = chaveParaData(chaveLogica(S.regs[0].ts));
    var fim = chaveParaData(hoje());
    for (var d = new Date(ini); d <= fim; d.setDate(d.getDate() + 1)) {
      var k = chaveDe(d);
      var rs = (porDia[k] || []).slice().sort(function (a, b) { return a.ts - b.ts; });
      var gaps = [];
      for (var i = 1; i < rs.length; i++) gaps.push((rs[i].ts - rs[i - 1].ts) / 60000);
      var hPrim = null;
      if (rs.length) {
        var dt = new Date(rs[0].ts);
        hPrim = dt.getHours() + dt.getMinutes() / 60;
        if (hPrim < H0) hPrim += 24;
      }
      dias.push({
        chave: k, regs: rs, n: rs.length,
        g: rs.reduce(function (s, r) { return s + r.q; }, 0),
        gaps: gaps, gapMed: gaps.length ? media(gaps) : null,
        hPrim: hPrim, tipo: tipoDe(k), completo: k !== hoje()
      });
    }
  }
  var mapa = {};
  dias.forEach(function (d) { mapa[d.chave] = d; });
  return { dias: dias, mapa: mapa };
}
function somaG(arr) { return arr.reduce(function (s, d) { return s + d.g; }, 0); }

function analisar() {
  var b = construir(), dias = b.dias;
  var janela = S.cfg.janela;
  var jan = dias.slice(Math.max(0, dias.length - janela));
  var completos = dias.filter(function (d) { return d.completo; });

  var u7 = completos.slice(-7), a7 = completos.slice(-14, -7);
  var s7 = somaG(u7), sa7 = somaG(a7);
  var temComp = u7.length === 7 && a7.length === 7;
  var delta = (temComp && sa7 > 0) ? (s7 - sa7) / sa7 * 100 : null;

  /* Duas médias móveis: a PRINCIPAL (20 dias por padrão) é a que define o
     patamar e o alvo de cada dia — um dia isolado não a move. A CURTA fica
     só como leitura de curto prazo no gráfico. */
  var mmP = Math.max(2, S.cfg.mmPrinc || 20);
  var mmC = Math.max(0, S.cfg.mm === undefined ? 7 : S.cfg.mm);
  function rollDe(w) {
    return dias.map(function (d, i) {
      var s = dias.slice(Math.max(0, i - (w - 1)), i + 1);
      return somaG(s) / s.length;
    });
  }
  var roll = rollDe(mmP);
  var rollCurto = mmC > 0 ? rollDe(mmC) : null;

  var baseTipo = window.RA_DIA.baseTipoDe(completos);

  function gapsDe(arr) { var a = []; arr.forEach(function (d) { a = a.concat(d.gaps); }); return a; }
  var g14 = gapsDe(completos.slice(-14)), g14a = gapsDe(completos.slice(-28, -14));
  var gapAtual = g14.length ? media(g14) : null;
  var gapAnt = g14a.length ? media(g14a) : null;

  // tendência sobre a média móvel (últimos 28 dias)
  var jIni = Math.max(0, dias.length - 28);
  var serieT = dias.slice(jIni).map(function (d, i) { return { x: i, y: roll[jIni + i] }; });
  var slope = 0;
  if (serieT.length >= 4) {
    var n = serieT.length, sx = 0, sy = 0, sxx = 0, sxy = 0;
    serieT.forEach(function (s) { sx += s.x; sy += s.y; sxx += s.x * s.x; sxy += s.x * s.y; });
    var den = n * sxx - sx * sx;
    slope = den !== 0 ? (n * sxy - sx * sy) / den : 0;
  }
  var rollAtual = roll.length ? roll[roll.length - 1] : 0;
  var proj28 = Math.max(0, rollAtual + slope * 28);

  /* Alvo da média principal hoje e o fator que ele impõe sobre cada tipo de
     dia: é isso que dá o "alvo do dia" no calendário. */
  var meta = window.RA_DIA.ratioMetaDe(dias, completos, S.cfg, roll);
  var alvoPrinc = meta.alvoPrinc, medGlobal = meta.medGlobal, ratioMeta = meta.ratioMeta;

  /* Um dia sem registro tem g = 0 e passaria em qualquer comparação "na sua
     linha" — isso premiaria esquecer de anotar. Só dia com registro conta. */
  function naLinha(d) {
    return d.n > 0 && baseTipo[d.tipo] > 0 && d.g <= baseTipo[d.tipo] + 0.001;
  }

  // sequência na própria linha
  var streak = 0;
  for (var i = completos.length - 1; i >= 0; i--) {
    if (naLinha(completos[i])) streak++; else break;
  }
  var melhor = 0, cur = 0;
  completos.forEach(function (d) {
    if (naLinha(d)) { cur++; if (cur > melhor) melhor = cur; } else cur = 0;
  });

  return {
    dias: dias, mapa: b.mapa, jan: jan, completos: completos, roll: roll,
    rollCurto: rollCurto, mmP: mmP, mmC: mmC,
    s7: s7, sa7: sa7, temComp: temComp, delta: delta, baseTipo: baseTipo,
    gapAtual: gapAtual, gapAnt: gapAnt, slope: slope, rollAtual: rollAtual, proj28: proj28,
    alvoPrinc: alvoPrinc, ratioMeta: ratioMeta, medGlobal: medGlobal,
    streak: streak, melhor: melhor, temSerie: serieT.length >= 4
  };
}

/* =============================== render =============================== */
function corDelta(delta) {
  if (delta === null) return "var(--muted)";
  return delta <= -3 ? "var(--accent-2)" : (delta >= 3 ? "var(--danger)" : "var(--text)");
}
function G(txt) { return txt; } // valores sensíveis recebem classe .hide no DOM

/* A frase só muda quando o contexto muda: render() roda a cada edição e a
   troca a cada tecla seria ruído visual. */
var _frases = {};
function frase(chave, gerar) {
  if (!_frases[chave]) _frases[chave] = gerar();
  return _frases[chave];
}

function render() {
  var A = analisar();
  var sel = S.sel || hoje();
  if (!A.mapa[sel] && A.dias.length) sel = hoje();
  S.sel = sel;

  q("#janelaBadge").textContent = A.jan.length ? "últimos " + A.jan.length + " dias · dia lógico 04h→04h" : "sem dados";

  renderVeredito(A);
  renderMetaSemana(A);
  renderPatamares(A);
  renderKpis(A);
  renderGrafico(A);
  renderTipos(A);
  renderGatilhos(A);
  renderHoras(A);
  renderFaixas(A);
  renderAlavancas(A);
  renderCalendario(A, sel);
  renderSemanas(A);
  renderSequencia(A);
  renderMarcos(A);
  renderDia(A, sel);
  renderEstoque(A);
  ligarInfos(A);
}

/* ------------------------------ veredito ------------------------------ */
function renderVeredito(A) {
  var d = A.delta, pct = S.cfg.meta, l1, l2;
  var jan = A.jan;
  var alvoHoje = jan.length ? A.roll[A.dias.length - jan.length] * Math.pow(1 - pct / 100, jan.length / 30) : 0;
  /* Quanto cabe HOJE para a média móvel fechar no alvo: o alvo é a média da
     janela inteira, então o que sobra é alvo x mm menos os mm-1 dias anteriores. */
  var mmD = A.mmP;
  var antes = A.dias.slice(Math.max(0, A.dias.length - mmD), A.dias.length - 1);
  var hojeG = A.dias.length ? A.dias[A.dias.length - 1].g : 0;
  var cabeHoje = alvoHoje * Math.min(mmD, antes.length + 1) - somaG(antes);
  var restaHoje = cabeHoje - hojeG;
  function frasePermitido(alvoRef) {
    var cabe = alvoRef * Math.min(mmD, antes.length + 1) - somaG(antes);
    var resta = cabe - hojeG;
    if (resta >= 0.05) return "hoje ainda cabem " + n1(resta) + " g para a média fechar em " + n1(alvoRef) + " g/dia";
    if (cabe <= 0.05) return "para a média voltar a " + n1(alvoRef) + " g/dia, hoje precisaria ser zero";
    return "hoje já passou " + n1(-resta) + " g do que cabia (" + n1(cabe) + " g) para a média ficar em " + n1(alvoRef) + " g/dia";
  }
  var offShare = 0, tOffDias = 0;
  var gJan = somaG(jan) || 1;
  jan.forEach(function (x) { if (x.tipo === "off") { offShare += x.g; tOffDias++; } });
  offShare = offShare / gJan * 100;

  var hj = hoje();
  var dHoje = A.mapa[hj];
  var medDia = A.completos.length ? mediana(A.completos.map(function (x) { return x.g; })) : 0;
  var estado = {
    semDados: !A.dias.length,
    poucosDados: A.dias.length > 0 && d === null,
    diaPesado: !!(dHoje && medDia > 0 && dHoje.g > medDia * 1.5),
    streak: A.streak,
    delta: d
  };

  if (!A.dias.length) {
    l1 = "Nenhum registro ainda.";
  } else if (d === null) {
    l1 = "Faltam duas semanas completas para comparar. Você já tem " + A.completos.length + " dia(s) completo(s).";
  } else if (d >= 15) {
    l1 = "Alta de " + n0(d) + "% em relação aos 7 dias anteriores. " + n0(offShare) + "% do total está nos dias off.";
  } else if (d >= 3) {
    l1 = "Alta de " + n0(d) + "%. Média de " + A.mmP + " dias em " + n1(A.rollAtual) + " g/dia" +
      (pct > 0 ? "; " + frasePermitido(alvoHoje) : "") + ".";
  } else if (d > -3) {
    l1 = "Estável em relação aos 7 dias anteriores. Patamar de " + n1(A.rollAtual) + " g/dia.";
  } else if (d > -15) {
    l1 = "Queda de " + n0(-d) + "%. Sequência atual: " + A.streak + " dias na sua própria linha.";
  } else {
    l1 = "Queda de " + n0(-d) + "%. Projeção de 4 semanas: " + n1(A.proj28) + " g/dia.";
  }
  l2 = (typeof MSGS !== "undefined" && comFrases()) ? frase("v:" + [estado.semDados, estado.poucosDados, estado.diaPesado, estado.streak >= 5, d === null ? "n" : Math.round(d / 6)].join("|"), function () { return MSGS.paraEstado(estado); }) : "";
  q("#vL1").textContent = l1;
  q("#vL2").textContent = l2;
  q("#vL2").style.display = l2 ? "" : "none";
  var vd = q("#vDelta");
  vd.textContent = d === null ? "—" : (d > 0 ? "+" : "") + n0(d) + "%";
  vd.style.color = corDelta(d);
  var card = q("#vCard");
  card.className = "card verdict" + (d === null ? "" :
    (d <= -10 ? " st-good" : d <= -3 ? " st-ok" : d >= 12 ? " st-bad" : d >= 3 ? " st-up" : ""));
}

/* -------------------------------- KPIs -------------------------------- */
function renderKpis(A) {
  var pct = S.cfg.meta;
  var jan = A.jan, gJan = somaG(jan) || 1;
  var offDias = jan.filter(function (d) { return d.tipo === "off"; });
  var offShare = somaG(offDias) / gJan * 100;
  var medOff = mediana(offDias.map(function (d) { return d.g; }));

  var projTxt = "—", projNota = "Precisa de mais dias para projetar.";
  if (A.temSerie) {
    projTxt = n1(A.proj28 * 7);
    if (A.slope < -0.0005) {
      var diasMeta = pct > 0 ? Math.round((A.rollAtual * (pct / 100)) / -A.slope) : null;
      projNota = (diasMeta !== null ? "Nesse ritmo, −" + n0(pct) + "% em " + diasMeta + " dias (meta: 30). " : "") + "Em 4 semanas: " + n1(A.proj28) + " g/dia.";
    } else if (A.slope > 0.0005) {
      projNota = "A inclinação é de subida. Nesse ritmo você não chega à meta — chega ao dobro.";
    } else {
      projNota = "Inclinação zero. Nesse ritmo você chega exatamente onde já está.";
    }
  }

  var kpis = [
    { rot: "Últimos 7 dias", v: A.temComp ? n1(A.s7) : "—", u: "g", cor: corDelta(A.delta), sensivel: true,
      n: A.temComp ? "Antes: " + n1(A.sa7) + " g · média " + n1(A.s7 / 7) + " g/dia" : "Faltam " + Math.max(0, 14 - A.completos.length) + " dias completos para a comparação." },
    { rot: "Peso dos dias off", v: offDias.length ? n0(offShare) + "%" : "—", u: "do total", cor: "var(--warn)", sensivel: false,
      n: offDias.length ? offDias.length + " dias carregam essa fatia. Mediana " + n1(medOff) + " g." : "Sem dias off na janela." },
    { rot: "Intervalo médio entre usos", v: A.gapAtual === null ? "—" : hm(A.gapAtual), u: "", sensivel: false,
      cor: (A.gapAnt !== null && A.gapAtual > A.gapAnt) ? "var(--accent-2)" : "var(--text)",
      n: A.gapAnt === null ? "Sem período anterior para comparar." : (A.gapAtual > A.gapAnt ? "+" : "") + n0(A.gapAtual - A.gapAnt) + " min vs. as 2 semanas anteriores." },
    { rot: "Projeção (4 semanas)", v: projTxt, u: "g/semana", sensivel: true,
      cor: A.slope < -0.0005 ? "var(--accent-2)" : (A.slope > 0.0005 ? "var(--danger)" : "var(--muted)"), n: projNota }
  ];

  var wrap = q("#kpis"); wrap.innerHTML = "";
  kpis.forEach(function (k) {
    var c = el("div", "card kpi");
    c.appendChild(el("div", "lbl", k.rot));
    var line = el("div");
    line.style.cssText = "display:flex;align-items:baseline;gap:6px;flex-wrap:wrap";
    var v = el("span", "v" + (k.sensivel ? " hide" : ""), k.v);
    v.style.color = k.cor;
    line.appendChild(v);
    if (k.u) line.appendChild(el("span", "u", k.u));
    c.appendChild(line);
    c.appendChild(el("div", "n", k.n));
    wrap.appendChild(c);
  });
}

/* ------------------------------- gráfico ------------------------------- */
/* Agrega a janela em dias, semanas ou meses. A barra é sempre o total do
   período; a linha da média móvel é convertida para a mesma unidade
   (média diária x dias do período), senão barra e linha não se comparam. */
/* Catmull-Rom -> Bézier: a média móvel vira uma curva, não uma serra. */
function pathSuave(pts) {
  if (!pts.length) return "";
  if (pts.length < 3) return "M" + pts.map(function (p) { return p[0].toFixed(2) + "," + p[1].toFixed(2); }).join(" L");
  var d = "M" + pts[0][0].toFixed(2) + "," + pts[0][1].toFixed(2), t = 0.2;
  for (var i = 0; i < pts.length - 1; i++) {
    var p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
    var c1x = p1[0] + (p2[0] - p0[0]) * t, c1y = p1[1] + (p2[1] - p0[1]) * t;
    var c2x = p2[0] - (p3[0] - p1[0]) * t, c2y = p2[1] - (p3[1] - p1[1]) * t;
    d += " C" + c1x.toFixed(2) + "," + c1y.toFixed(2) + " " + c2x.toFixed(2) + "," + c2y.toFixed(2) +
      " " + p2[0].toFixed(2) + "," + p2[1].toFixed(2);
  }
  return d;
}
/* Ponto de partida: a régua dos patamares e da economia. */
function pontoPartida(A) {
  var manual = parseFloat(String(S.cfg.base0 || "").replace(",", "."));
  if (!isNaN(manual) && manual > 0) return { v: manual, auto: false };
  var v = A.completos.length >= 7 ? somaG(A.completos.slice(0, 7)) / 7
    : (A.completos.length ? mediana(A.completos.map(function (d) { return d.g; })) : 0);
  return { v: v, auto: true };
}
function textoPontoPartida(A) {
  var pp = pontoPartida(A);
  return "<b>Ponto de partida: " + n1(pp.v) + " g/dia</b><div class='t2'>" +
    (pp.auto
      ? "Automático: a média dos 7 primeiros dias completos do seu histórico."
      : "Valor fixado por você nas configurações (o automático seria outro).") +
    "<br>É a régua de tudo: os degraus dos patamares são −15% sobre ele, a economia em R$ mede o quanto você está abaixo dele e as barras de compra ficam verdes quando o período fica dentro da meta.<br>Para mudar: engrenagem → Ponto de partida (vazio = automático).</div>";
}
function ligarInfos(A) {
  ["#ifoPat", "#ifoMil", "#ifoCfgBase"].forEach(function (sel) {
    var n = q(sel); if (n) comTip(n, textoPontoPartida(A));
  });
}

function bucketsEvo(A) {
  var jan = A.jan, off0 = A.dias.length - jan.length, g = S.evoGran;
  if (g === "dia") {
    return jan.map(function (d, i) {
      return { rot: rotuloCurto(d.chave), dias: [d], idx: off0 + i, dOff: i, tipo: d.tipo, chave: d.chave };
    });
  }
  var out = [], mapa = {};
  jan.forEach(function (d, i) {
    var k = g === "semana" ? inicioSemanaKey(d.chave) : d.chave.slice(0, 7);
    if (!mapa[k]) {
      mapa[k] = {
        key: k, dias: [],
        rot: g === "semana" ? rotuloCurto(k) : MES3[parseInt(k.slice(5, 7), 10) - 1] + "/" + k.slice(2, 4)
      };
      out.push(mapa[k]);
    }
    mapa[k].dias.push(d);
    mapa[k].idx = off0 + i;
    mapa[k].dOff = i;
  });
  return out;
}
function renderGrafico(A) {
  var jan = A.jan, pct = S.cfg.meta, mm = A.mmP, mmc = A.mmC;
  var evo = q("#evoSub");
  if (evo) evo.textContent = "média de " + mm + " dias vs. trajetória da meta";

  var podeSem = jan.length >= 14, podeMes = jan.length >= 45;
  if (S.evoGran === "semana" && !podeSem) S.evoGran = "dia";
  if (S.evoGran === "mes" && !podeMes) S.evoGran = podeSem ? "semana" : "dia";
  var g = S.evoGran;
  Array.prototype.forEach.call(document.querySelectorAll("#evoGran .btn"), function (b) {
    var ok = b.dataset.e === "dia" || (b.dataset.e === "semana" ? podeSem : podeMes);
    b.disabled = !ok;
    b.style.opacity = ok ? "" : ".4";
    b.style.cursor = ok ? "" : "not-allowed";
    b.title = ok ? "" : "precisa de " + (b.dataset.e === "semana" ? "14" : "45") + " dias na janela";
    b.classList.toggle("on", b.dataset.e === g);
  });
  q("#evoModoNota").textContent = g === "dia"
    ? "cada barra é um dia · a linha grossa é a média de " + mm + " dias"
    : "cada barra é " + (g === "semana" ? "uma semana" : "um mês") + " · a linha grossa é a média de " + mm + " dias somada no mesmo período";

  var bars = q("#bars"), xax = q("#xax"), xmes = q("#xmes");
  bars.innerHTML = ""; xax.innerHTML = ""; xmes.innerHTML = "";
  if (!jan.length) {
    q("#lineMedia").setAttribute("d", "");
    q("#lineMediaCurta").setAttribute("d", "");
    q("#lineMeta").setAttribute("points", "");
    q("#yMax").textContent = "—"; q("#yMid").textContent = "—";
    q("#chartAmostra").textContent = "Sem dias na janela selecionada.";
    return;
  }
  var bs = bucketsEvo(A);
  var vals = bs.map(function (b) { return somaG(b.dias); });
  var escala = Math.max(1, Math.ceil(Math.max.apply(null, vals)));
  q("#yMax").textContent = n1(escala) + " g";
  q("#yMid").textContent = n1(escala / 2) + " g";
  var passo = Math.max(1, Math.ceil(bs.length / (g === "dia" ? 12 : 16)));

  bs.forEach(function (b, i) {
    var v = vals[i], nReg = 0, zerados = 0;
    b.dias.forEach(function (d) { nReg += d.n; if (d.n === 0) zerados++; });
    var col = el("div", "col " + (g === "dia" ? (v === 0 ? "b-zero" : TIPOS[b.tipo].classe) : ""));
    var bar = el("i");
    bar.style.height = (v === 0 ? 2 : Math.max(1, v / escala * 100)) + "%";
    if (g !== "dia") bar.style.background = v === 0 ? "var(--bar-zero)" : "var(--band-2)";
    col.appendChild(bar);
    var ant = i > 0 ? vals[i - 1] : null;
    var dPct = (ant !== null && ant > 0) ? (v - ant) / ant * 100 : null;
    if (g === "dia") {
      comTip(col, "<b>" + n1(v) + " g</b> · " + nReg + (nReg === 1 ? " registro" : " registros") +
        "<div class='t2'>" + rotuloLongo(b.chave) + " · " + TIPOS[b.tipo].nome +
        "<br>média de " + mm + " dias aí: " + n1(A.roll[b.idx]) + " g/dia" +
        (b.dias[0].gapMed !== null ? "<br>intervalo médio: " + hm(b.dias[0].gapMed) : "") + "</div>");
    } else {
      comTip(col, "<b>" + n1(v) + " g</b> em " + b.dias.length + (b.dias.length === 1 ? " dia" : " dias") +
        "<div class='t2'>" + (g === "semana" ? "semana de " + rotuloCurto(b.key) + " a " + rotuloCurto(keyMais(b.key, 6)) : MESES[parseInt(b.key.slice(5, 7), 10) - 1] + " de " + b.key.slice(0, 4)) +
        "<br>" + n1(v / b.dias.length) + " g/dia · " + nReg + " registros" +
        (dPct !== null ? "<br>" + (dPct > 0 ? "+" : "") + n0(dPct) + "% vs. o período anterior" : "") + "</div>");
    }
    bars.appendChild(col);
    if (g === "dia") {
      xax.appendChild(el("div", null, i % passo === 0 ? b.rot : ""));
      var mAtual = b.chave.slice(0, 7);
      var mAnt = i === 0 ? "" : bs[i - 1].chave.slice(0, 7);
      xmes.appendChild(el("div", null, mAtual !== mAnt ? MES3[parseInt(b.chave.slice(5, 7), 10) - 1] : ""));
    } else {
      xax.appendChild(el("div", null, (bs.length - 1 - i) % passo === 0 ? b.rot : ""));
    }
  });

  var comReg = jan.filter(function (d) { return d.n > 0; }).length;
  q("#chartAmostra").textContent = jan.length + " dias na janela (" + rotuloCurto(jan[0].chave) + " → " +
    rotuloCurto(jan[jan.length - 1].chave) + ") · " + comReg + " com registro" +
    (g === "dia" ? "." : " · agrupados em " + bs.length + (g === "semana" ? " semanas." : " meses."));

  var off0 = A.dias.length - jan.length;
  function px(i) { return bs.length <= 1 ? 50 : (i + 0.5) / bs.length * 100; }
  function py(v) { return 100 - Math.max(0, Math.min(1, v / escala)) * 100; }
  q("#lineMedia").setAttribute("d", pathSuave(bs.map(function (b, i) {
    return [px(i), py(A.roll[b.idx] * b.dias.length)];
  })));
  q("#lineMediaCurta").setAttribute("d", A.rollCurto ? pathSuave(bs.map(function (b, i) {
    return [px(i), py(A.rollCurto[b.idx] * b.dias.length)];
  })) : "");
  if (pct > 0) {
    var anc = A.roll[off0];
    q("#lineMeta").setAttribute("points", bs.map(function (b, i) {
      return px(i).toFixed(2) + "," + py(anc * Math.pow(1 - pct / 100, b.dOff / 30) * b.dias.length).toFixed(2);
    }).join(" "));
  } else {
    q("#lineMeta").setAttribute("points", "");
  }

  var leg = g === "dia"
    ? [{ c: "var(--blue)", n: "Home office" }, { c: "var(--violet)", n: "Escritório" },
       { c: "var(--warn)", n: "Dia off" }, { c: "var(--linha)", n: "Média de " + mm + " dias" }]
    : [{ c: "var(--band-2)", n: "Total " + (g === "semana" ? "da semana" : "do mês") },
       { c: "var(--linha)", n: "Média de " + mm + " dias (no período)" }];
  if (mmc > 0) leg.push({ c: "var(--linha)", n: "Média curta de " + mmc + " dias", fina: true });
  if (pct > 0) leg.push({ c: "var(--accent-2)", n: "Trajetória −" + n0(pct) + "%/mês" });
  var lw = q("#chartLegend"); lw.innerHTML = "";
  leg.forEach(function (l) {
    var sp = el("span", "i");
    var e = el("em"); e.style.background = l.c;
    if (l.fina) { e.style.opacity = ".5"; e.style.height = "2px"; }
    sp.appendChild(e); sp.appendChild(document.createTextNode(l.n));
    lw.appendChild(sp);
  });
}

/* ---------------------------- resumo por semana ---------------------------- */
function offsetMesDe(k) {
  var hj = chaveParaData(hoje()), d = chaveParaData(k);
  return (d.getFullYear() - hj.getFullYear()) * 12 + (d.getMonth() - hj.getMonth());
}
/* Regra única de elegibilidade de semana, compartilhada pela tabela de
   Semanas e pelo motor de pontos: 7 dias completos e ao menos 5 anotados.
   Sem isso, uma semana esquecida virava recorde. */
function semanaElegivel(ds) {
  if (!ds || ds.length !== 7) return false;
  if (!ds.every(function (d) { return d.completo; })) return false;
  return ds.filter(function (d) { return d.n > 0; }).length >= 5;
}
function renderSemanas(A) {
  var wrap = q("#semanasLista"); if (!wrap) return;
  wrap.innerHTML = "";
  var byW = {}, ordem = [];
  A.dias.forEach(function (d) {
    var k = inicioSemanaKey(d.chave);
    if (!byW[k]) { byW[k] = []; ordem.push(k); }
    byW[k].push(d);
  });
  ordem.sort();
  if (!ordem.length) {
    wrap.appendChild(el("div", "hint", "Sem semanas registradas ainda."));
    q("#semanasNota").textContent = ""; q("#semanasSub").textContent = "";
    return;
  }
  var preco = calcEstoque().preco;
  var hj = hoje();
  var linhas = ordem.map(function (k, i) {
    var ds = byW[k], tot = somaG(ds);
    var antK = ordem[i - 1], ant = antK ? byW[antK] : null;
    var emCursoW = ds.some(function (d) { return d.chave === hj; });
    var elegivel = !emCursoW && semanaElegivel(ds);
    var comparavel = elegivel && ant && semanaElegivel(ant) && somaG(ant) > 0;
    return {
      k: k, tot: tot, nDias: ds.length, gdia: tot / ds.length,
      comReg: ds.filter(function (d) { return d.n > 0; }).length,
      elegivel: elegivel,
      delta: comparavel ? (tot - somaG(ant)) / somaG(ant) * 100 : null,
      emCurso: emCursoW,
      parcial: ds.length < 7
    };
  });
  var fechadas = linhas.filter(function (L) { return L.elegivel; });
  var melhor = fechadas.length ? fechadas.slice().sort(function (a, b) { return a.tot - b.tot; })[0] : null;
  var COLS = "minmax(0,1.15fr) 96px 96px 124px 110px";
  linhas.slice().reverse().slice(0, 14).forEach(function (L) {
    var row = el("div", "tbl-r");
    row.style.gridTemplateColumns = COLS;
    row.style.cursor = "pointer";
    var nm = el("div"); nm.style.cssText = "display:flex;align-items:center;gap:8px;min-width:0";
    var rot = el("span", "mono", rotuloCurto(L.k) + " → " + rotuloCurto(keyMais(L.k, 6)));
    rot.style.cssText = "font-size:12.5px;color:var(--soft)";
    nm.appendChild(rot);
    if (L.emCurso) { var t1 = el("span", "hint", "em curso"); t1.style.color = "var(--blue)"; nm.appendChild(t1); }
    else if (L.parcial) { var t2 = el("span", "hint", L.nDias + " dias"); nm.appendChild(t2); }
    else if (!L.elegivel) { var t0 = el("span", "hint", "não anotada (" + L.comReg + " de 7 dias)"); nm.appendChild(t0); }
    else if (melhor && melhor.k === L.k) { var t3 = el("span", "hint", "★ menor"); t3.style.color = "var(--accent-2)"; nm.appendChild(t3); }
    row.appendChild(nm);
    row.appendChild(el("span", "g hide", n1(L.tot) + " g"));
    row.appendChild(el("span", "g", n1(L.gdia)));
    var dv = el("span", "g", L.delta === null ? (L.emCurso ? "parcial" : "—") : (L.delta > 0 ? "+" : "") + n0(L.delta) + "%");
    dv.style.color = L.delta === null ? "var(--muted-2)" : corDelta(L.delta);
    if (L.delta === null && L.emCurso) dv.style.fontSize = "11.5px";
    row.appendChild(dv);
    row.appendChild(el("span", "g hide", L.elegivel && preco > 0 ? rs(L.tot * preco) : "—"));
    row.addEventListener("click", function () {
      S.sel = L.emCurso ? hj : L.k;
      S.mesOffset = Math.min(0, offsetMesDe(L.k));
      render();
    });
    wrap.appendChild(row);
  });
  q("#semanasSub").textContent = fechadas.length
    ? fechadas.length + " semanas anotadas · clique numa linha para abrir o dia"
    : "resumo de cada semana";
  if (fechadas.length >= 2) {
    var ult4 = fechadas.slice(-4);
    q("#semanasNota").textContent = "Média das últimas " + ult4.length + " semanas anotadas: " +
      n1(media(ult4.map(function (L) { return L.tot; }))) + " g (" +
      n1(media(ult4.map(function (L) { return L.gdia; }))) + " g/dia)" +
      (melhor ? " · menor semana até hoje: " + n1(melhor.tot) + " g em " + rotuloCurto(melhor.k) + "." : ".") +
      (preco > 0 ? " Custo estimado pelo seu preço médio de " + rs(preco) + "/g." : " Registre compras para ver o custo por semana.");
  } else {
    q("#semanasNota").textContent = "Com duas semanas anotadas (5 dos 7 dias registrados) esta tabela passa a comparar uma com a outra.";
  }
}

/* --------------------------- peso por tipo --------------------------- */
function renderTipos(A) {
  var jan = A.jan, gJan = somaG(jan) || 1;
  q("#subTipo").textContent = "mediana por tipo de dia · " + jan.length + " dias";
  var meds = {};
  Object.keys(TIPOS).forEach(function (t) {
    meds[t] = mediana(jan.filter(function (d) { return d.tipo === t; }).map(function (d) { return d.g; }));
  });
  var maxMed = Math.max.apply(null, Object.keys(meds).map(function (t) { return meds[t]; }).concat([0.1]));
  var wrap = q("#porTipo"); wrap.innerHTML = "";
  Object.keys(TIPOS).forEach(function (t) {
    var dd = jan.filter(function (x) { return x.tipo === t; });
    var box = el("div"); box.style.cssText = "display:flex;flex-direction:column;gap:6px";
    var top = el("div"); top.style.cssText = "display:flex;align-items:baseline;justify-content:space-between;gap:10px";
    var nm = el("span"); nm.style.cssText = "display:inline-flex;align-items:center;gap:7px;font-size:13.5px;font-weight:600";
    var dot = el("span", "dot"); dot.style.background = TIPOS[t].cor;
    nm.appendChild(dot); nm.appendChild(document.createTextNode(TIPOS[t].nome));
    var det = el("span", "mono hide", n1(meds[t]) + " g/dia");
    det.style.cssText += ";font-size:13px;color:var(--muted);white-space:nowrap;flex:none";
    top.appendChild(nm); top.appendChild(det);
    var tr = el("div", "track"); var fill = el("i");
    fill.style.width = Math.max(2, meds[t] / maxMed * 100) + "%";
    fill.style.background = TIPOS[t].cor;
    tr.appendChild(fill);
    var sh = el("div", null, n0(somaG(dd) / gJan * 100) + "% do total · " + dd.length + " dias");
    sh.style.cssText = "font-size:11.5px;color:var(--muted)";
    box.appendChild(top); box.appendChild(tr); box.appendChild(sh);
    wrap.appendChild(box);
  });
}

function renderGatilhos(A) {
  var gat = {};
  A.jan.forEach(function (d) {
    d.regs.forEach(function (r) { if (r.gatilho) gat[r.gatilho] = (gat[r.gatilho] || 0) + r.q; });
  });
  var keys = Object.keys(gat).sort(function (x, y) { return gat[y] - gat[x]; });
  var wrap = q("#porGatilho"); wrap.innerHTML = "";
  if (!keys.length) {
    wrap.appendChild(el("div", "hint", "Nenhum registro marcado ainda. Marque o motivo nos registros do dia (abaixo) e este bloco passa a dizer onde atacar."));
    return;
  }
  var max = gat[keys[0]];
  keys.forEach(function (k) {
    var row = el("div", "row-b");
    row.appendChild(el("span", "nm", k));
    var tr = el("div", "track"); var f = el("i");
    f.style.width = (gat[k] / max * 100) + "%"; f.style.background = "var(--accent-3)";
    tr.appendChild(f); row.appendChild(tr);
    row.appendChild(el("span", "vl hide", n1(gat[k]) + " g"));
    wrap.appendChild(row);
  });
}

/* ----------------------------- histograma ----------------------------- */
function renderHoras(A) {
  var f = S.filtroHora;
  var dias = A.jan.filter(function (d) { return f === "todos" || (f === "off" ? d.tipo === "off" : d.tipo !== "off"); });
  q("#subQuando").textContent = "dia começa às 04h · " + dias.length + " dias";
  var bins = new Array(24).fill(0);
  var cnt = new Array(24).fill(0);
  dias.forEach(function (d) {
    d.regs.forEach(function (r) {
      var i = (new Date(r.ts).getHours() - H0 + 24) % 24;
      bins[i] += r.q; cnt[i]++;
    });
  });
  var max = Math.max.apply(null, bins.concat([0.1]));
  var hb = q("#hbars"), hx = q("#hax");
  hb.innerHTML = ""; hx.innerHTML = "";
  var totalG = bins.reduce(function (s, v) { return s + v; }, 0);
  bins.forEach(function (v, i) {
    var hReal = (i + H0) % 24;
    var ratio = v / max;
    var col = el("div", "col " + (ratio > 0.72 ? "hi" : (ratio > 0.42 ? "mid" : "lo")));
    var bar = el("i");
    bar.style.height = (v > 0 ? Math.max(2, ratio * 100) : 0) + "%";
    col.appendChild(bar); hb.appendChild(col);
    comTip(col, "<b>" + pad2(hReal) + "h–" + pad2((hReal + 1) % 24) + "h</b>" +
      "<div class='t2'>" + n1(v) + " g no total · " + cnt[i] + (cnt[i] === 1 ? " registro" : " registros") +
      "<br>" + (totalG > 0 ? n0(v / totalG * 100) + "% de tudo" : "sem registro") +
      (dias.length ? "<br>" + n1(v / dias.length) + " g/dia nesta hora" : "") + "</div>");
    hx.appendChild(el("div", null, i % 3 === 0 ? pad2(hReal) : ""));
  });
  var mediaHora = totalG / 24;
  var lin = q("#hMedia");
  if (lin) {
    if (S.mostrarMedia && totalG > 0) {
      lin.style.display = "block";
      lin.style.bottom = (mediaHora / max * 100).toFixed(2) + "%";
      lin.style.top = "auto";
      q("#hMediaTxt").textContent = "média " + n1(mediaHora) + " g/h";
    } else lin.style.display = "none";
  }
  var tg = q("#togMedia");
  if (tg) tg.classList.toggle("on", S.mostrarMedia);
  var nota = "Sem dados suficientes para desenhar o seu padrão de horário.";
  if (dias.length >= 4) {
    var iMax = 0;
    bins.forEach(function (v, i) { if (v > bins[iMax]) iMax = i; });
    var total = bins.reduce(function (s, v) { return s + v; }, 0) || 1;
    var noite = bins.slice(16).reduce(function (s, v) { return s + v; }, 0);
    nota = "Pico às " + pad2((iMax + H0) % 24) + "h. " + n0(noite / total * 100) + "% de tudo acontece depois das 20h — a janela onde a decisão é mais barata de mudar.";
  }
  q("#notaHoras").textContent = nota;
  Array.prototype.forEach.call(document.querySelectorAll("#filtroHora .btn"), function (b) {
    b.classList.toggle("on", b.dataset.f === f);
  });
}

/* ------------------------------ alavancas ------------------------------ */
function renderAlavancas(A) {
  var jan = A.jan, gJan = somaG(jan) || 1;
  var offDias = jan.filter(function (d) { return d.tipo === "off"; });
  var offShare = somaG(offDias) / gJan * 100;

  var comReg = A.completos.filter(function (d) { return d.n > 0 && d.hPrim !== null; });
  var a2 = { t: "Hora do primeiro registro", num: "—", cor: "var(--muted)",
    d: "Faltam dias com registro para comparar horários de início (preciso de 6).", a: "" };
  if (comReg.length >= 6) {
    // divide a amostra ao meio pelo horário de início: sempre resulta em dois grupos
    var ord = comReg.slice().sort(function (x, y) { return x.hPrim - y.hPrim; });
    var meio = Math.floor(ord.length / 2);
    var gCedo = ord.slice(0, meio), gTarde = ord.slice(ord.length - meio);
    var mCedo = media(gCedo.map(function (d) { return d.g; }));
    var mTarde = media(gTarde.map(function (d) { return d.g; }));
    var corte = ord[ord.length - meio].hPrim;
    var dif = mCedo - mTarde;
    // se os dois valores empatam na 1ª casa decimal mas não são iguais, usa 2 casas para não parecer contraditório
    var casas = (n1(mCedo) === n1(mTarde) && mCedo !== mTarde) ? 2 : 1;
    var fmt = function (v) { return v.toFixed(casas).replace(".", ","); };
    var pequena = Math.abs(dif) < 0.3; // diferença pouco relevante pra virar recomendação
    a2 = {
      t: "Hora do primeiro registro",
      num: (dif > 0 ? "−" : "+") + n1(Math.abs(dif)) + " g/dia",
      cor: pequena ? "var(--muted)" : (dif > 0 ? "var(--accent-2)" : "var(--muted)"),
      d: "Média de " + fmt(mTarde) + " g/dia nos dias em que o primeiro registro foi a partir de " + hFmt(corte) + ", contra " + fmt(mCedo) + " g/dia nos que começaram antes.",
      a: pequena
        ? "Diferença pequena — o horário do primeiro uso não parece ser um fator forte aqui."
        : (dif > 0 ? "Atrasar o primeiro uso vale mais que cortar o último." : "Começar mais tarde não ajudou nesses dias. Olhe o tipo de dia.")
    };
  }

  var comGap = A.completos.filter(function (d) { return d.gapMed !== null; });
  var medGap = mediana(comGap.map(function (d) { return d.gapMed; }));
  var largos = comGap.filter(function (d) { return d.gapMed >= medGap; });
  var curtos = comGap.filter(function (d) { return d.gapMed < medGap; });
  var a3 = { t: "Intervalo entre usos", num: "—", cor: "var(--muted)",
    d: "Sem dias suficientes com dois ou mais registros para comparar.", a: "" };
  if (largos.length >= 3 && curtos.length >= 3) {
    var mL = media(largos.map(function (d) { return d.g; })), mC = media(curtos.map(function (d) { return d.g; }));
    var dif3 = mC - mL;
    a3 = {
      t: "Intervalo entre usos",
      num: (dif3 > 0 ? "−" : "+") + n1(Math.abs(dif3)) + " g",
      cor: dif3 > 0 ? "var(--accent-2)" : "var(--muted)",
      d: "Dias com intervalo médio acima de " + hm(medGap) + " fecham em " + n1(mL) + " g. Abaixo disso: " + n1(mC) + " g.",
      a: dif3 > 0 ? "Esticar o intervalo em ~30 min corta mais que decidir “usar menos”." : "Aqui não há ganho — o intervalo não está te segurando."
    };
  }

  var comDias = A.completos.filter(function (d) { return d.n > 0; });
  var fatias = comDias.map(function (d) {
    var b = [0, 0, 0];
    d.regs.forEach(function (r) { b[bandaHora(r.ts)] += r.q; });
    var tot = b[0] + b[1] + b[2] || 1;
    return { d: d, share: b[1] / tot, gJorn: b[1] };
  });
  var a4 = { t: "Peso dentro da jornada (09h–18h)", num: "—", cor: "var(--muted)",
    d: "Faltam dias com registro para separar os que carregam a jornada dos que não (preciso de 6).", a: "" };
  if (fatias.length >= 6) {
    var ordF = fatias.slice().sort(function (x, y) { return x.share - y.share; });
    var meioF = Math.floor(ordF.length / 2);
    var leves = ordF.slice(0, meioF), pesados = ordF.slice(ordF.length - meioF);
    var mPes = media(pesados.map(function (x) { return x.d.g; }));
    var mLev = media(leves.map(function (x) { return x.d.g; }));
    var corteF = pesados[0].share;
    var dif4 = mPes - mLev;
    var pequena4 = Math.abs(dif4) < 0.3;
    a4 = {
      t: "Peso dentro da jornada (09h–18h)",
      num: (dif4 > 0 ? "−" : "+") + n1(Math.abs(dif4)) + " g/dia",
      cor: pequena4 ? "var(--muted)" : (dif4 > 0 ? "var(--accent-2)" : "var(--muted)"),
      d: "Dias com " + n0(corteF * 100) + "% ou mais do volume entre 09h e 18h fecham em " + n1(mPes) +
        " g (" + pesados.length + " dias). Os que deixam a jornada mais leve: " + n1(mLev) + " g (" + leves.length + " dias).",
      a: pequena4
        ? "Diferença pequena: puxar volume para fora da jornada não muda o total nesses dias."
        : (dif4 > 0
          ? "Empurrar o primeiro uso para depois das 18h é o corte mais direto que você tem."
          : "Aqui a jornada não é o problema — o peso está no volume da noite.")
    };
  }

  var lista = [
    { t: "Concentração", num: n0(offShare) + "%", cor: "var(--warn)",
      d: "do total da janela cabe em " + offDias.length + " dias off — contra " + (jan.length - offDias.length) + " dias úteis somando o resto.",
      a: "Cortar 20% de um dia off vale mais que uma semana útil impecável." },
    a2, a3, a4
  ];
  var wrap = q("#alavancas"); wrap.innerHTML = "";
  lista.forEach(function (l, i) {
    var c = el("div", "lev");
    var top = el("div"); top.style.cssText = "display:flex;align-items:baseline;gap:8px";
    top.appendChild(el("span", "n", pad2(i + 1)));
    top.appendChild(el("span", "t", l.t));
    c.appendChild(top);
    var num = el("div", "num", l.num); num.style.color = l.cor;
    c.appendChild(num);
    c.appendChild(el("div", "d", l.d));
    if (l.a) c.appendChild(el("div", "a", l.a));
    wrap.appendChild(c);
  });
}

/* ------------------------------ calendário ------------------------------ */
function classeEstado(ratio, semRegistro) {
  /* Dia sem registro não é dia bom nem ruim: é dia sem informação. Pintar de
     verde daria crédito por não anotar. */
  if (semRegistro) return "s-none";
  if (ratio === null) return "";
  if (ratio <= 0.6) return "s-good";
  if (ratio <= 0.9) return "s-ok";
  if (ratio <= 1.1) return "s-line";
  if (ratio <= 1.4) return "s-up";
  return "s-bad";
}
function alvoDoDia(A, tipo) {
  var base = A.baseTipo[tipo] || 0;
  return base > 0 ? base * A.ratioMeta : 0;
}
function hintCalendario(A) {
  var h = q("#calHint"); if (!h) return;
  var tipos = Object.keys(TIPOS).filter(function (t) { return A.baseTipo[t] > 0; });
  if (!tipos.length) {
    h.innerHTML = "Cor comparada com a <strong>sua mediana daquele tipo de dia</strong> — aparece quando houver dias completos suficientes.";
    return;
  }
  tipos.sort(function (a, b) { return A.baseTipo[b] - A.baseTipo[a]; });
  var alto = tipos[0], baixo = tipos[tipos.length - 1];
  var ex = "um " + TIPOS[alto].nome.toLowerCase() + " de " + n1(A.baseTipo[alto] * 0.55) + " g fica verde";
  if (baixo !== alto) ex += "; um " + TIPOS[baixo].nome.toLowerCase() + " de " + n1(A.baseTipo[baixo] * 1.45) + " g fica vermelho";
  h.innerHTML = "Cor comparada com a <strong>sua mediana daquele tipo de dia</strong> — " + ex +
    ". Hoje a sua linha é " + tipos.map(function (t) { return TIPOS[t].nome.toLowerCase() + " " + n1(A.baseTipo[t]) + " g"; }).join(" · ") +
    ". Passe o mouse num dia para ver o alvo dele.";
}
function renderCalendario(A, sel) {
  hintCalendario(A);
  var hj = chaveParaData(hoje());
  var mes = new Date(hj.getFullYear(), hj.getMonth() + S.mesOffset, 1);
  q("#tituloMes").textContent = MESES[mes.getMonth()] + " " + mes.getFullYear();
  var cal = q("#cal"); cal.innerHTML = "";
  DIAS_SEM.forEach(function (d) { cal.appendChild(el("div", "hd", d)); });
  for (var i = 0; i < mes.getDay(); i++) cal.appendChild(el("div", "cell blank"));
  var ultimo = new Date(mes.getFullYear(), mes.getMonth() + 1, 0).getDate();
  for (var dn = 1; dn <= ultimo; dn++) {
    var k = chaveDe(new Date(mes.getFullYear(), mes.getMonth(), dn));
    var d = A.mapa[k], tipo = tipoDe(k), dentro = !!d;
    var iDia = dentro ? A.dias.indexOf(d) : -1;
    var ratio = (d && A.baseTipo[tipo] > 0) ? d.g / A.baseTipo[tipo] : null;
    var cls = "cell " + (dentro ? "in " + classeEstado(ratio, d.n === 0) : "out");
    if (k === sel) cls += " sel";
    if (k === hoje()) cls += " hoje";
    var cell = el("div", cls);
    var cw = el("div", "cw");
    cw.appendChild(el("span", "n", String(dn)));
    var tp = el("span", "tp"); tp.style.background = TIPOS[tipo].cor;
    cw.appendChild(tp);
    cell.appendChild(cw);
    cell.appendChild(el("div", "v" + (dentro && d.n > 0 ? " hide" : ""), dentro ? (d.n === 0 ? "0" : n1(d.g)) : ""));
    cell.appendChild(el("div", "s", dentro && d.n > 0 ? d.n + " reg" + (d.gapMed !== null ? " · " + hm(d.gapMed) : "") : (dentro ? "sem registro" : "")));
    if (dentro) {
      cell.dataset.k = k;
      var base = A.baseTipo[tipo] || 0, alvo = alvoDoDia(A, tipo);
      var linhas = [];
      linhas.push("<b>" + (d.n === 0 ? "nada registrado" : n1(d.g) + " g") + "</b>" +
        (d.n > 0 ? " · " + d.n + (d.n === 1 ? " registro" : " registros") : ""));
      var t2 = [rotuloLongo(k) + " · " + TIPOS[tipo].nome];
      if (base > 0) {
        t2.push("Sua linha para " + TIPOS[tipo].nome.toLowerCase() + ": <b>" + n1(base) + " g</b>" +
          (d.n > 0 && ratio !== null ? " → " + (ratio <= 1 ? n0((1 - ratio) * 100) + "% abaixo" : n0((ratio - 1) * 100) + "% acima") : ""));
        if (S.cfg.meta > 0 && alvo > 0) {
          t2.push("Alvo com a meta de −" + n0(S.cfg.meta) + "%/mês: <b>" + n1(alvo) + " g</b>" +
            (d.n > 0 ? (d.g <= alvo + 0.001 ? " — cumprido" : " — " + n1(d.g - alvo) + " g acima") : ""));
        }
      }
      if (A.roll[iDia] !== undefined) t2.push("Média de " + A.mmP + " dias até aqui: <b>" + n1(A.roll[iDia]) + " g/dia</b>");
      if (d.gapMed !== null) t2.push("Intervalo médio entre usos: " + hm(d.gapMed));
      if (d.hPrim !== null) t2.push("Primeiro uso: " + pad2(Math.floor(d.hPrim % 24)) + "h" + pad2(Math.round((d.hPrim % 1) * 60)));
      if (!d.completo) t2.push("Dia em curso — ainda pode mudar.");
      comTip(cell, linhas.join("") + "<div class='t2'>" + t2.join("<br>") + "</div>");
      cell.addEventListener("click", function () { S.sel = this.dataset.k; render(); });
    }
    cal.appendChild(cell);
  }
}

/* --------------------------- sequência / marcos --------------------------- */
function renderSequencia(A) {
  var st = q("#streak");
  st.textContent = String(A.streak);
  st.style.color = A.streak >= 3 ? "var(--accent-2)" : "var(--text)";
  q("#melhorStreak").textContent = A.melhor + " dias";

  var maxGap = 0, maxGapRot = "";
  for (var j = 1; j < S.regs.length; j++) {
    var dif = (S.regs[j].ts - S.regs[j - 1].ts) / 60000;
    if (dif > maxGap) {
      maxGap = dif;
      var d0 = new Date(S.regs[j - 1].ts), d1 = new Date(S.regs[j].ts);
      maxGapRot = pad2(d0.getDate()) + "/" + pad2(d0.getMonth() + 1) + " " + pad2(d0.getHours()) + "h" +
        " → " + pad2(d1.getDate()) + "/" + pad2(d1.getMonth() + 1) + " " + pad2(d1.getHours()) + "h";
    }
  }
  var tardeMax = null, tardeK = "";
  A.completos.forEach(function (d) {
    if (d.tipo !== "off" && d.hPrim !== null && (tardeMax === null || d.hPrim > tardeMax)) { tardeMax = d.hPrim; tardeK = d.chave; }
  });
  var recs = [
    /* A menor semana vive no pódio do card Progresso, alinhada a semanas de
       calendário e com a mesma regra de elegibilidade — não se repete aqui. */
    { k: "Maior tempo sem usar", v: maxGap ? hm(maxGap) + " · " + maxGapRot : "—", s: false },
    { k: "Primeiro uso mais tarde (útil)", v: tardeMax === null ? "—" : pad2(Math.floor(tardeMax % 24)) + "h" + pad2(Math.round((tardeMax % 1) * 60)) + " · " + rotuloCurto(tardeK), s: false },
    { k: "Melhor sequência na linha", v: A.melhor + " dias", s: false }
  ];
  var wrap = q("#recordes"); wrap.innerHTML = "";
  recs.forEach(function (r) {
    var row = el("div", "kv");
    row.appendChild(el("span", "k", r.k));
    row.appendChild(el("span", "v" + (r.s ? " hide" : ""), r.v));
    wrap.appendChild(row);
  });
  var exp = el("div", "hint", "“Maior tempo sem usar” é o maior vão entre dois registros seguidos em todo o histórico — o seu recorde de pausa, com início e fim.");
  exp.style.cssText += ";border-top:1px solid var(--border);padding-top:9px;margin-top:3px";
  wrap.appendChild(exp);
  return { tardeMax: tardeMax };
}

/* ------------------- progresso: pontos, selos e pódio -------------------
   A unidade de conquista é a SEMANA FECHADA (segunda a domingo, 7 dias já
   completos). Todo selo é repetível: rende pontos de novo cada vez que a
   semana o cumpre, e os pontos nunca zeram. Assim descer devagar e manter
   vale mais que um pico isolado — e sempre há algo a ganhar esta semana. */
var SELOS = [
  { id: "queda",   n: "Semana em queda",          pts: 12, d: "total abaixo da semana anterior" },
  { id: "alvo",    n: "Dentro do alvo",           pts: 20, d: "total dentro da fatia semanal da meta" },
  { id: "linha",   n: "Cinco dias na linha",      pts: 15, d: "5 dias ou mais dentro da linha do próprio tipo de dia" },
  { id: "pausa",   n: "Pausa de 4h no dia",       pts: 10, d: "algum intervalo de 4h ou mais entre dois usos do mesmo dia" },
  { id: "tarde",   n: "Três tardes",              pts: 12, d: "3 dias úteis com o primeiro uso depois das 14h" },
  { id: "recorde", n: "Menor semana da história", pts: 50, d: "total mais baixo de todas as semanas fechadas" }
];
var NIVEIS = [
  { p: 0, n: "Observando" }, { p: 120, n: "Ajustando" }, { p: 300, n: "Descendo" },
  { p: 600, n: "Constante" }, { p: 1000, n: "No controle" }, { p: 1600, n: "Referência" },
  { p: 2400, n: "Outro patamar" }
];
/* Selos que, uma vez cumpridos na semana, não podem ser perdidos. */
var LOCKIN = { linha: 1, pausa: 1, tarde: 1 };
function semanaAnteriorK(k) { var d = chaveParaData(k); d.setDate(d.getDate() - 7); return chaveDe(d); }
function statsSemana(A, ds) {
  var naLinha = 0, maxGap = 0, tardes = 0, comReg = 0;
  ds.forEach(function (d) {
    if (d.n > 0) comReg++;
    // dia sem registro nunca conta como "na linha": g = 0 passaria sempre
    if (d.n > 0 && d.completo && A.baseTipo[d.tipo] > 0 && d.g <= A.baseTipo[d.tipo] + 0.001) naLinha++;
    d.gaps.forEach(function (g) { if (g > maxGap) maxGap = g; });
    if (d.tipo !== "off" && d.hPrim !== null && d.hPrim >= 14) tardes++;
  });
  return { tot: somaG(ds), nDias: ds.length, comReg: comReg, naLinha: naLinha, maxGap: maxGap, tardes: tardes };
}
function ganhosDe(st, ant, fator, minAte) {
  return {
    queda: ant !== null && st.tot < ant - 0.001,
    alvo: ant !== null && st.tot <= ant * fator + 0.001,
    linha: st.naLinha >= 5,
    pausa: st.maxGap >= 240,
    tarde: st.tardes >= 3,
    recorde: minAte !== null && st.tot < minAte - 0.001
  };
}
function progresso(A) {
  var pct = S.cfg.meta || 0;
  var fator = pct > 0 ? Math.pow(1 - pct / 100, 7 / 30) : 1;
  var byW = {}, ordem = [];
  A.dias.forEach(function (d) {
    var k = inicioSemanaKey(d.chave);
    if (!byW[k]) { byW[k] = []; ordem.push(k); }
    byW[k].push(d);
  });
  ordem.sort();
  function fechada(k) { return semanaElegivel(byW[k]); }
  var fechadas = ordem.filter(fechada);
  var minAte = null, pontos = 0, serie = 0, hist = [];
  var contagem = {}, ultima = {}, serieSelo = {};
  SELOS.forEach(function (s) { contagem[s.id] = 0; ultima[s.id] = null; serieSelo[s.id] = 0; });

  fechadas.forEach(function (k) {
    var st = statsSemana(A, byW[k]);
    var pk = semanaAnteriorK(k);
    var ant = fechada(pk) ? somaG(byW[pk]) : null;
    var g = ganhosDe(st, ant, fator, minAte);
    var pts = 0;
    SELOS.forEach(function (s) {
      if (g[s.id]) { pts += s.pts; contagem[s.id]++; ultima[s.id] = k; }
    });
    if (g.queda || g.alvo) serie++; else serie = 0;
    var bonus = serie >= 2 ? Math.min(25, (serie - 1) * 5) : 0;
    pts += bonus;
    pontos += pts;
    if (minAte === null || st.tot < minAte) minAte = st.tot;
    hist.push({ k: k, st: st, ant: ant, g: g, pts: pts, bonus: bonus, serie: serie });
  });
  // série atual de cada selo, contando de trás para frente
  SELOS.forEach(function (s) {
    var c = 0;
    for (var i = hist.length - 1; i >= 0; i--) { if (hist[i].g[s.id]) c++; else break; }
    serieSelo[s.id] = c;
  });

  var kCur = inicioSemanaKey(hoje());
  var curDias = byW[kCur] || [];
  var stCur = statsSemana(A, curDias);
  var pkCur = semanaAnteriorK(kCur);
  var antCur = fechada(pkCur) ? somaG(byW[pkCur]) : null;
  var gCur = ganhosDe(stCur, antCur, fator, minAte);
  /* Selos de total (queda, alvo, recorde) só podem PIORAR enquanto a semana
     corre: com 1 dia registrado o total é trivialmente o menor da história.
     Enquanto a semana está aberta eles ficam "em rota", nunca cumpridos.
     Os de contagem (linha, pausa, tarde) travam: ganhos, ganhos. */
  var fechouCur = fechada(kCur);
  var travado = {}, emRota = {};
  SELOS.forEach(function (s) {
    var lock = LOCKIN[s.id] === 1;
    travado[s.id] = gCur[s.id] && (lock || fechouCur);
    emRota[s.id] = gCur[s.id] && !travado[s.id];
  });
  var ptsCur = 0, ptsRota = 0;
  SELOS.forEach(function (s) {
    if (travado[s.id]) ptsCur += s.pts;
    else if (emRota[s.id]) ptsRota += s.pts;
  });

  var nivel = 0;
  for (var i = 0; i < NIVEIS.length; i++) if (pontos >= NIVEIS[i].p) nivel = i;

  return {
    byW: byW, fechadas: fechadas, hist: hist, pontos: pontos, nivel: nivel,
    contagem: contagem, ultima: ultima, serieSelo: serieSelo, serie: serie,
    kCur: kCur, stCur: stCur, antCur: antCur, gCur: gCur, ptsCur: ptsCur,
    travado: travado, emRota: emRota, ptsRota: ptsRota, fechouCur: fechouCur,
    minAte: minAte, fator: fator, alvoCur: antCur !== null ? antCur * fator : null
  };
}

function faltaSelo(id, P, A) {
  var st = P.stCur;
  if (id === "queda") {
    if (P.antCur === null) return "precisa da semana anterior fechada";
    var f = P.antCur - st.tot;
    if (f > 0.05) return "cabem " + n1(f) + " g até empatar com a semana anterior";
    if (f < -0.05) return n1(-f) + " g acima da semana anterior";
    return "empatado com a semana anterior";
  }
  if (id === "alvo") {
    if (P.alvoCur === null) return "precisa da semana anterior fechada";
    var f2 = P.alvoCur - st.tot;
    return (f2 > 0 ? "cabem " + n1(f2) + " g" : n1(-f2) + " g acima") + " do alvo de " + n1(P.alvoCur) + " g";
  }
  if (id === "linha") return st.naLinha + " de 5 dias com registro dentro da linha";
  if (id === "pausa") return st.maxGap > 0 ? "maior pausa até agora: " + hm(st.maxGap) + " de 4h" : "nenhuma pausa longa ainda";
  if (id === "tarde") return st.tardes + " de 3 dias úteis começando após 14h";
  if (id === "recorde") {
    if (P.minAte === null) return "precisa de uma semana fechada antes";
    var f3 = P.minAte - st.tot;
    return f3 > 0.05
      ? "precisa fechar abaixo de " + n1(P.minAte) + " g — restam " + n1(f3) + " g"
      : "o recorde é " + n1(P.minAte) + " g e a semana já passou dele";
  }
  return "";
}

function renderMarcos(A) {
  var P = progresso(A);
  var wrap = q("#xpTopo"); if (!wrap) return;
  wrap.innerHTML = "";

  var nv = NIVEIS[P.nivel], prox = NIVEIS[P.nivel + 1] || null;
  var num = el("div", "num", n0(P.pontos));
  wrap.appendChild(num);
  var col = el("div", "nvl");
  var top = el("div", "t");
  top.appendChild(el("b", null, nv.n + " · nível " + (P.nivel + 1)));
  var rt = el("span", "mono", prox ? n0(prox.p - P.pontos) + " pts para " + prox.n : "nível máximo");
  rt.style.cssText = "color:var(--muted);font-size:11.5px";
  top.appendChild(rt);
  col.appendChild(top);
  var tr = el("div", "track"); var f = el("i");
  var lo = nv.p, hi = prox ? prox.p : nv.p + 1;
  f.style.width = Math.max(2, Math.min(100, (P.pontos - lo) / (hi - lo) * 100)) + "%";
  f.style.background = "var(--accent-2)";
  tr.appendChild(f); col.appendChild(tr);
  var res = el("div", "hint", P.fechadas.length
    ? P.fechadas.length + " semanas anotadas avaliadas · série atual de queda: " + P.serie +
      (P.serie >= 2 ? " (bônus de +" + Math.min(25, (P.serie - 1) * 5) + " pts por semana mantida)" : "")
    : "A primeira semana fechada começa a contar pontos.");
  col.appendChild(res);
  wrap.appendChild(col);

  q("#xpSemBadge").textContent = (P.ptsCur > 0 ? "+" + n0(P.ptsCur) + " pts assegurados" : "nenhum selo assegurado ainda") +
    (P.ptsRota > 0 ? " · +" + n0(P.ptsRota) + " em rota" : "");
  q("#selosSemRot").textContent = rotuloCurto(P.kCur) + " → " + rotuloCurto(keyMais(P.kCur, 6)) +
    " · " + n1(P.stCur.tot) + " g em " + P.stCur.nDias + (P.stCur.nDias === 1 ? " dia" : " dias");

  var sw = q("#selos"); sw.innerHTML = "";
  SELOS.forEach(function (s) {
    var ok = P.travado[s.id], rota = P.emRota[s.id];
    var box = el("div", "slo" + (ok ? " on" : (rota ? " rota" : "")));
    box.appendChild(el("span", "mk", ok ? "✓" : (rota ? "•" : "")));
    var mid = el("div");
    mid.appendChild(el("div", "nm", s.n));
    var det = ok ? s.d + " — assegurado"
      : (rota ? "em rota · " + faltaSelo(s.id, P, A) : faltaSelo(s.id, P, A));
    mid.appendChild(el("div", "d2", det));
    box.appendChild(mid);
    var right = el("div", "rt");
    right.appendChild(el("span", "pt", "+" + s.pts));
    var c = P.contagem[s.id];
    right.appendChild(el("span", "vz", c === 0 ? "nunca" : c + "× · " + rotuloCurto(P.ultima[s.id])));
    box.appendChild(right);
    comTip(box, "<b>" + s.n + " · +" + s.pts + " pts</b><div class='t2'>" + s.d +
      "<br>Conquistado " + c + (c === 1 ? " vez" : " vezes") +
      (c ? ", a última na semana de " + rotuloCurto(P.ultima[s.id]) : " até agora") +
      (P.serieSelo[s.id] >= 2 ? "<br>Série atual: " + P.serieSelo[s.id] + " semanas seguidas" : "") +
      (LOCKIN[s.id] === 1
        ? "<br>Trava assim que a semana cumpre: não dá para perder depois."
        : "<br>Depende do total da semana: só conta quando ela fecha no domingo.") +
      "<br>Repetível: vale os mesmos pontos toda semana que cumprir.</div>");
    sw.appendChild(box);
  });

  renderPodio(A, P);

  q("#xpNota").textContent = "Os selos de contagem (dias na linha, pausa, tardes) travam na hora: cumpridos, são seus. " +
    "Os de total (queda, alvo, recorde) só contam quando a semana fecha no domingo — antes disso são só rota. " +
    "O bônus de constância cresce a cada semana seguida em queda ou no alvo e volta a zero quando a semana sobe, " +
    "então manter um patamar novo rende mais que um mergulho de uma semana.";
}

function renderPodio(A, P) {
  var wrap = q("#podio"); if (!wrap) return;
  wrap.innerHTML = "";
  var semanas = P.fechadas.map(function (k) { return { v: somaG(P.byW[k]), rot: rotuloCurto(k) + "→" + rotuloCurto(keyMais(k, 6)) }; });
  var pausas = [];
  A.dias.forEach(function (d) {
    if (d.gaps.length) pausas.push({ v: Math.max.apply(null, d.gaps), rot: rotuloCurto(d.chave) });
  });
  var offs = A.completos.filter(function (d) { return d.tipo === "off" && d.n > 0; })
    .map(function (d) { return { v: d.g, rot: rotuloCurto(d.chave) }; });
  var tardes = A.completos.filter(function (d) { return d.tipo !== "off" && d.hPrim !== null; })
    .map(function (d) { return { v: d.hPrim, rot: rotuloCurto(d.chave) }; });

  var cats = [
    { t: "Menores semanas", arr: semanas, asc: true, fmt: function (v) { return n1(v) + " g"; }, vazio: "sem semana fechada" },
    { t: "Maiores pausas no dia", arr: pausas, asc: false, fmt: function (v) { return hm(v); }, vazio: "sem pausa registrada" },
    { t: "Menores dias off", arr: offs, asc: true, fmt: function (v) { return n1(v) + " g"; }, vazio: "sem dia off registrado" },
    { t: "Começos mais tarde (dia útil)", arr: tardes, asc: false, fmt: function (v) { return pad2(Math.floor(v % 24)) + "h" + pad2(Math.round((v % 1) * 60)); }, vazio: "sem dado de horário" }
  ];
  cats.forEach(function (c) {
    var box = el("div", "podc");
    box.appendChild(el("div", "ct", c.t));
    var top3 = c.arr.slice().sort(function (a, b) { return c.asc ? a.v - b.v : b.v - a.v; }).slice(0, 3);
    for (var i = 0; i < 3; i++) {
      var r = top3[i];
      var row = el("div", "pod" + (i === 0 ? " p1" : "") + (r ? "" : " vazio"));
      row.appendChild(el("span", "pl2", (i + 1) + "º"));
      row.appendChild(el("span", "pv", r ? c.fmt(r.v) : "—"));
      row.appendChild(el("span", "pd", r ? r.rot : (i === 0 ? c.vazio : "")));
      box.appendChild(row);
    }
    wrap.appendChild(box);
  });
}

/* --------------------------- dia selecionado --------------------------- */
function renderDia(A, sel) {
  var d = A.mapa[sel] || { regs: [], n: 0, g: 0, tipo: tipoDe(sel), gapMed: null };
  q("#diaSelRot").textContent = rotuloLongo(sel);
  var base = A.baseTipo[d.tipo] || 0;
  q("#diaSelResumo").textContent = d.n === 0
    ? "nada registrado"
    : n1(d.g) + " g · " + d.n + " registros · sua linha para " + TIPOS[d.tipo].nome.toLowerCase() + " é " + n1(base) + " g";

  var bt = q("#botoesTipo"); bt.innerHTML = "";
  Object.keys(TIPOS).forEach(function (t) {
    var b = el("button", "btn pill" + (d.tipo === t ? " on" : ""), TIPOS[t].nome);
    b.type = "button";
    if (d.tipo === t) b.style.borderColor = TIPOS[t].cor;
    b.addEventListener("click", function () { S.tipos[sel] = t; salvar(); render(); });
    bt.appendChild(b);
  });

  var wrap = q("#regsDia"); wrap.innerHTML = "";
  if (!d.regs.length) {
    var e = el("div", "hint", (typeof MSGS !== "undefined" && comFrases())
      ? frase("d:" + sel, function () { return MSGS.escolher("dia_limpo"); })
      : "Nenhum registro neste dia.");
    e.style.cssText += ";padding:16px 4px;font-style:italic";
    wrap.appendChild(e);
    return;
  }
  d.regs.slice().reverse().forEach(function (r) {
    var idx = d.regs.indexOf(r);
    var gap = idx > 0 ? (r.ts - d.regs[idx - 1].ts) / 60000 : null;
    var dt = new Date(r.ts);
    var row = el("div", "tbl-r");

    function reordenarESalvar() { S.regs.sort(function (a, b) { return a.ts - b.ts; }); salvar(); render(); }

    var dataWrap = el("div"); dataWrap.style.cssText = "display:flex;align-items:center;gap:2px";
    var diaSel = el("select"); diaSel.className = "mono ed"; diaSel.style.width = "32px";
    for (var dd0 = 1; dd0 <= 31; dd0++) { var od0 = el("option", null, pad2(dd0)); od0.value = dd0; if (dd0 === dt.getDate()) od0.selected = true; diaSel.appendChild(od0); }
    var mesSel = el("select"); mesSel.className = "mono ed"; mesSel.style.width = "32px";
    for (var mn0 = 1; mn0 <= 12; mn0++) { var om0 = el("option", null, pad2(mn0)); om0.value = mn0; if (mn0 === dt.getMonth() + 1) om0.selected = true; mesSel.appendChild(om0); }
    var anoSel = el("select"); anoSel.className = "mono ed"; anoSel.style.width = "48px";
    var anoBase = dt.getFullYear();
    for (var ay0 = anoBase - 2; ay0 <= anoBase + 2; ay0++) { var oy0 = el("option", null, String(ay0)); oy0.value = ay0; if (ay0 === anoBase) oy0.selected = true; anoSel.appendChild(oy0); }
    function aplicarData() {
      var atual = new Date(r.ts);
      r.ts = new Date(parseInt(anoSel.value, 10), parseInt(mesSel.value, 10) - 1, parseInt(diaSel.value, 10), atual.getHours(), atual.getMinutes(), 0, 0).getTime();
      reordenarESalvar();
    }
    diaSel.addEventListener("change", aplicarData);
    mesSel.addEventListener("change", aplicarData);
    anoSel.addEventListener("change", aplicarData);
    dataWrap.appendChild(diaSel);
    dataWrap.appendChild(el("span", "muted", "/"));
    dataWrap.appendChild(mesSel);
    dataWrap.appendChild(el("span", "muted", "/"));
    dataWrap.appendChild(anoSel);
    row.appendChild(dataWrap);

    var horaWrap = el("div"); horaWrap.style.cssText = "display:flex;align-items:center;gap:2px";
    var hSel = el("select"); hSel.className = "mono ed"; hSel.style.width = "34px";
    for (var hh2 = 0; hh2 < 24; hh2++) { var oh = el("option", null, pad2(hh2)); oh.value = hh2; if (hh2 === dt.getHours()) oh.selected = true; hSel.appendChild(oh); }
    var mSel = el("select"); mSel.className = "mono ed"; mSel.style.width = "34px";
    for (var mm2 = 0; mm2 < 60; mm2++) { var om = el("option", null, pad2(mm2)); om.value = mm2; if (mm2 === dt.getMinutes()) om.selected = true; mSel.appendChild(om); }
    function aplicarHora() {
      var atual = new Date(r.ts);
      r.ts = new Date(atual.getFullYear(), atual.getMonth(), atual.getDate(), parseInt(hSel.value, 10), parseInt(mSel.value, 10), 0, 0).getTime();
      reordenarESalvar();
    }
    hSel.addEventListener("change", aplicarHora);
    mSel.addEventListener("change", aplicarHora);
    horaWrap.appendChild(hSel);
    horaWrap.appendChild(el("span", "muted", ":"));
    horaWrap.appendChild(mSel);
    row.appendChild(horaWrap);

    var qtdIn = el("input"); qtdIn.type = "text"; qtdIn.className = "mono ed";
    qtdIn.value = n1(r.q);
    qtdIn.addEventListener("change", function () {
      var v = parseFloat(String(this.value).replace(",", "."));
      if (isNaN(v) || v <= 0) { this.value = n1(r.q); return; }
      r.q = v; salvar(); render();
    });
    row.appendChild(qtdIn);

    row.appendChild(el("span", "g" + (gap !== null && gap < 60 ? " tight" : ""), gap === null ? "—" : hm(gap)));
    var acts = el("div"); acts.style.cssText = "display:flex;align-items:center;gap:10px;min-width:0";
    var sel2 = el("select");
    GAT.forEach(function (g) {
      var o = el("option", null, g === "" ? "—" : g);
      o.value = g; if ((r.gatilho || "") === g) o.selected = true;
      sel2.appendChild(o);
    });
    sel2.style.cssText = "padding:5px 9px;font-size:12.5px;color:var(--soft);background:var(--surface-2);border:1px solid var(--border);border-radius:8px";
    sel2.addEventListener("change", function () {
      r.gatilho = this.value; salvar(); render();
    });
    acts.appendChild(sel2);
    var notaIn = el("input"); notaIn.type = "text"; notaIn.placeholder = "Nota (opcional)";
    notaIn.value = r.nota || "";
    notaIn.style.cssText = "flex:1;min-width:0;padding:5px 9px;font-size:12.5px;color:var(--text);background:var(--surface-2);border:1px solid var(--border);border-radius:8px";
    notaIn.addEventListener("change", function () { r.nota = this.value; salvar(); });
    acts.appendChild(notaIn);
    var del = el("button", "btn link", "apagar");
    del.type = "button";
    del.addEventListener("click", function () {
      S.regs = S.regs.filter(function (x) { return x.id !== r.id; });
      salvar(); render();
    });
    acts.appendChild(del);
    row.appendChild(acts);
    wrap.appendChild(row);
  });
}

/* ------------------------- meta da semana (anel) ------------------------- */
function inicioSemanaKey(k) {
  var d = chaveParaData(k);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); // segunda-feira
  return chaveDe(d);
}
function keyMais(k, n) { var d = chaveParaData(k); d.setDate(d.getDate() + n); return chaveDe(d); }

function renderMetaSemana(A) {
  var pct = S.cfg.meta;
  var iniK = inicioSemanaKey(hoje()), antK = keyMais(iniK, -7);
  var atual = A.dias.filter(function (d) { return d.chave >= iniK; });
  var ant = A.dias.filter(function (d) { return d.chave >= antK && d.chave < iniK; });
  var gAt = somaG(atual), gAnt = somaG(ant);
  var fechados = atual.filter(function (d) { return d.completo; }).length;
  var restantes = Math.max(1, 7 - fechados);
  var fator = pct > 0 ? Math.pow(1 - pct / 100, 7 / 30) : 1;
  var viaAnt = ant.length === 7 && gAnt > 0;
  var alvo = viaAnt ? gAnt * fator
    : (A.completos.length >= 3 ? mediana(A.completos.map(function (d) { return d.g; })) * 7 * fator : null);

  q("#metaSemRot").textContent = rotuloCurto(iniK) + " → " + rotuloCurto(keyMais(iniK, 6));

  var frac = alvo ? gAt / alvo : 0;
  // fração real da semana já decorrida: dias fechados + a parte de hoje (dia lógico começa às 04h)
  var iniHoje = chaveParaData(hoje()).getTime() + H0 * 3600000;
  var fracHoje = Math.max(0.05, Math.min(1, (Date.now() - iniHoje) / 86400000));
  var decorrido = Math.min(7, fechados + fracHoje);
  var esperado = Math.min(1, decorrido / 7);
  var cor = !alvo ? "var(--muted)"
    : (frac > 1 ? "var(--danger)" : (frac > esperado + 0.08 ? "var(--warn)" : "var(--accent-2)"));
  var C = 2 * Math.PI * 54, dash = Math.min(1, frac) * C;
  var ang = esperado * 2 * Math.PI;
  var x1 = (64 + Math.cos(ang) * 44).toFixed(1), y1 = (64 + Math.sin(ang) * 44).toFixed(1);
  var x2 = (64 + Math.cos(ang) * 64).toFixed(1), y2 = (64 + Math.sin(ang) * 64).toFixed(1);
  q("#gauge").innerHTML =
    '<svg viewBox="0 0 128 128">' +
      '<circle cx="64" cy="64" r="54" fill="none" stroke="var(--surface-3)" stroke-width="11"></circle>' +
      '<circle cx="64" cy="64" r="54" fill="none" stroke="' + cor + '" stroke-width="11" stroke-linecap="round" stroke-dasharray="' + dash.toFixed(1) + ' ' + C.toFixed(1) + '"></circle>' +
      '<line x1="' + x1 + '" y1="' + y1 + '" x2="' + x2 + '" y2="' + y2 + '" stroke="var(--text)" stroke-width="2" opacity=".45"></line>' +
    '</svg>' +
    '<div class="ctr"><span class="p" style="color:' + cor + '">' + (alvo ? n0(frac * 100) + "%" : "—") + '</span>' +
    '<span class="l">do alvo</span></div>';

  var det = q("#metaDet"); det.innerHTML = "";
  function kv(k, v, c) {
    var row = el("div", "kv");
    row.appendChild(el("span", "k", k));
    var s = el("span", "v", v);
    if (c) s.style.color = c;
    row.appendChild(s); det.appendChild(row);
  }
  var sobra = alvo === null ? null : alvo - gAt;
  kv("Já registrado", n1(gAt) + " g", "var(--text)");
  kv("Alvo da semana", alvo === null ? "—" : n1(alvo) + " g", "var(--muted)");
  kv("Dias restantes (com hoje)", String(7 - fechados) + " de 7", "var(--muted)");  kv("Ainda cabe", sobra === null ? "—" : (sobra >= 0 ? n1(sobra / restantes) + " g/dia" : "+" + n1(-sobra) + " g acima"),
     sobra !== null && sobra < 0 ? "var(--danger)" : "var(--accent-2)");

  q("#gaugeLeg").innerHTML = "O anel mostra quanto do alvo já foi usado. O traço marca o ritmo esperado a esta altura da semana (" + n0(esperado * 100) + "%).";

  var nota = q("#metaNota"); nota.innerHTML = "";
  var l1, l2 = "";
  if (alvo === null) {
    l1 = "Sem base para o alvo ainda: faltam dias completos no histórico.";
  } else {
    var proj = gAt / esperado;
    l1 = n1(gAt) + " g em " + n1(decorrido) + " dias corridos = " + n1(gAt / decorrido) +
      " g/dia. Nesse ritmo a semana fecha em " + n1(proj) + " g, contra alvo de " + n1(alvo) + " g.";
    var cortePct = (1 - fator) * 100;
    l2 = viaAnt
      ? (pct > 0
        ? "Alvo = semana anterior (" + n1(gAnt) + " g) menos " + n1(cortePct) + "%, que é a fatia semanal da meta de −" + n0(pct) + "%/mês."
        : "Alvo = repetir a semana anterior (" + n1(gAnt) + " g).")
      : "Sem semana anterior completa: o alvo usa a sua mediana diária × 7" + (pct > 0 ? " menos " + n1(cortePct) + "%." : ".");
  }
  nota.appendChild(el("div", null, l1));
  if (l2) {
    var d2 = el("div", null, l2);
    d2.style.cssText = "margin-top:5px;opacity:.82";
    nota.appendChild(d2);
  }
}

/* --------------------------- patamares (degraus) --------------------------- */
function renderPatamares(A) {
  var wrap = q("#patamares"); wrap.innerHTML = "";
  var nota = q("#patNota");
  var comp = A.completos;
  if (comp.length < 7) {
    nota.textContent = "Faltam " + (7 - comp.length) + " dias completos para fixar o ponto de partida.";
    return;
  }
  var base0 = pontoPartida(A).v;               // editável nas configurações
  var atual = A.rollAtual;
  var minRoll = null;
  for (var i = 6; i < A.dias.length; i++) {
    if (!A.dias[i].completo) continue;
    if (minRoll === null || A.roll[i] < minRoll) minRoll = A.roll[i];
  }
  if (minRoll === null) minRoll = atual;

  var degraus = [60, 45, 30, 15, 0].map(function (p) { return { p: p, v: base0 * (1 - p / 100) }; });
  var prox = null;
  for (var j = degraus.length - 1; j >= 0; j--) {
    if (minRoll > degraus[j].v + 0.001) { prox = degraus[j]; break; }
  }
  degraus.forEach(function (s) {
    var feito = minRoll <= s.v + 0.001;
    var aqui = !!prox && prox.p === s.p;
    var row = el("div", "step" + (feito ? " done" : (aqui ? " cur" : "")));
    row.appendChild(el("span", "mk", feito ? "✓" : (aqui ? "›" : "")));
    row.appendChild(el("span", "sn", s.p === 0 ? "Ponto de partida" : "−" + s.p + "% do ponto de partida"));
    var sv = el("span", "sv", n1(s.v) + " g/dia");
    sv.style.color = feito ? "var(--good-fg)" : (aqui ? "var(--text)" : "var(--muted)");
    row.appendChild(sv);
    wrap.appendChild(row);
  });

  var refV, alvoV;
  if (!prox) { refV = base0; alvoV = degraus[0].v; }
  else if (prox.p === 0) { refV = Math.max(atual, base0 * 1.25); alvoV = prox.v; }
  else { refV = base0 * (1 - (prox.p - 15) / 100); alvoV = prox.v; }
  var prog = Math.max(0, Math.min(1, (refV - atual) / Math.max(0.001, refV - alvoV)));
  var tr = el("div", "track"); tr.style.marginTop = "5px";
  var f = el("i");
  f.style.width = (prog * 100).toFixed(0) + "%";
  f.style.background = prox ? "var(--accent-2)" : "var(--good-fg)";
  tr.appendChild(f); wrap.appendChild(tr);

  if (!prox) {
    nota.textContent = "Todos os degraus alcançados. Ponto de partida era " + n1(base0) + " g/dia.";
  } else {
    var nomeDeg = prox.p === 0 ? "o ponto de partida" : "o degrau de −" + prox.p + "%";
    var nomeDegDe = prox.p === 0 ? "do ponto de partida" : "do degrau de −" + prox.p + "%";
    var falta = atual - prox.v;
    nota.textContent = falta > 0.05
      ? "Média móvel agora: " + n1(atual) + " g/dia. Faltam " + n1(falta) + " g/dia para " + nomeDeg + " (" + n1(prox.v) + " g/dia)."
      : "Média móvel agora: " + n1(atual) + " g/dia, já abaixo " + nomeDegDe + " (" + n1(prox.v) + " g/dia). Mantenha esse nível para fixar o degrau.";
  }
}

/* --------------------------- faixa horária --------------------------- */
function renderFaixas(A) {
  var wrap = q("#faixas"); wrap.innerHTML = "";
  q("#subFaixa").textContent = "jornada vs. depois · " + A.jan.length + " dias";
  var cores = ["var(--band-1)", "var(--band-2)", "var(--band-3)"];
  var linhas = [{ id: "todos", nome: "Todos os dias", cor: null }]
    .concat(Object.keys(TIPOS).map(function (t) { return { id: t, nome: TIPOS[t].nome, cor: TIPOS[t].cor }; }));
  var resumo = {};

  linhas.forEach(function (L) {
    var dd = A.jan.filter(function (d) { return L.id === "todos" || d.tipo === L.id; });
    var b = [0, 0, 0];
    dd.forEach(function (d) { d.regs.forEach(function (r) { b[bandaHora(r.ts)] += r.q; }); });
    var tot = b[0] + b[1] + b[2];
    resumo[L.id] = { b: b, tot: tot };

    var box = el("div", "fx");
    var top = el("div", "ft");
    var nm = el("span", "fn");
    if (L.cor) { var dot = el("span", "dot"); dot.style.background = L.cor; nm.appendChild(dot); }
    nm.appendChild(document.createTextNode(L.nome));
    top.appendChild(nm);
    top.appendChild(el("span", "fv", tot > 0 ? n0(b[2] / tot * 100) + "% após 18h" : "sem registro"));
    box.appendChild(top);

    var bar = el("div", "sbar");
    if (tot > 0) {
      b.forEach(function (v, i) {
        if (v <= 0) return;
        var seg = el("i");
        seg.style.width = (v / tot * 100) + "%";
        seg.style.background = cores[i];
        seg.title = ["antes das 09h", "09h–18h", "após 18h"][i] + ": " + n1(v) + " g";
        bar.appendChild(seg);
      });
    }
    box.appendChild(bar);
    var det = el("div", "fv", tot > 0 ? n1(b[0]) + " g · " + n1(b[1]) + " g · " + n1(b[2]) + " g" : "—");
    box.appendChild(det);
    wrap.appendChild(box);
  });

  var esc = resumo.office, off = resumo.off, todos = resumo.todos;
  var nota;
  if (!todos || todos.tot === 0) {
    nota = "Sem registros na janela para separar as faixas.";
  } else if (esc && esc.tot > 0) {
    var pJorn = esc.b[1] / esc.tot * 100;
    nota = "Nos dias de escritório, " + n0(pJorn) + "% do total acontece dentro da jornada e " +
      n0(esc.b[2] / esc.tot * 100) + "% depois das 18h" +
      (off && off.tot > 0 ? ". Nos dias off, a jornada responde por " + n0(off.b[1] / off.tot * 100) + "%." : ".");
  } else {
    nota = "Ainda sem dias marcados como escritório na janela. Marque o tipo de dia nos registros para separar as faixas.";
  }
  q("#notaFaixas").textContent = nota;
}

/* ============================== formulário ============================== */
function popularHoras() {
  var hh = q("#hh"), mm = q("#mm");
  for (var h = 0; h < 24; h++) { var o = el("option", null, pad2(h)); o.value = h; hh.appendChild(o); }
  for (var m = 0; m < 60; m++) { var o2 = el("option", null, pad2(m)); o2.value = m; mm.appendChild(o2); }
  agora();
}
function agora() {
  var d = new Date();
  q("#hh").value = d.getHours();
  q("#mm").value = d.getMinutes();
}
function renderChips() {
  var wrap = q("#chips"); wrap.innerHTML = "";
  // primeiro botão: o último valor registrado. Depois, os outros recentes em ordem crescente.
  var ult = S.regs.length ? S.regs[S.regs.length - 1].q : 1;
  var outros = [];
  for (var i = S.regs.length - 2; i >= 0 && outros.length < 5; i--) {
    var v = S.regs[i].q;
    if (Math.abs(v - ult) < 0.001) continue;
    if (!outros.some(function (x) { return Math.abs(x - v) < 0.001; })) outros.push(v);
  }
  outros.sort(function (a, b) { return a - b; });
  [ult].concat(outros).forEach(function (v, idx) {
    var b = el("button", "chip" + (idx === 0 ? " def" : ""), n1(v));
    b.type = "button"; b.tabIndex = -1;
    if (idx === 0) b.title = "Último valor registrado";
    b.addEventListener("click", function () { q("#qtd").value = n1(v); q("#qtd").select(); });
    wrap.appendChild(b);
  });
  // o campo já vem preenchido com o último valor registrado
  var campo = q("#qtd");
  if (campo && !campo.value.trim()) campo.value = n1(ult);
}
function registrar() {
  var st = q("#status");
  var v = parseFloat(String(q("#qtd").value).replace(",", "."));
  if (isNaN(v) || v <= 0) { st.style.color = "var(--danger)"; st.textContent = "Quantidade inválida."; return; }
  var alvo = S.sel || hoje();
  var base = chaveParaData(alvo);
  var hh = parseInt(q("#hh").value, 10), mm = parseInt(q("#mm").value, 10);
  // hora antes das 04h pertence ao dia lógico anterior -> cai no dia seguinte do calendário
  var dt = new Date(base.getFullYear(), base.getMonth(), base.getDate() + (hh < H0 ? 1 : 0), hh, mm, 0, 0);
  S.regs.push({ id: "r" + dt.getTime() + "-" + Math.random().toString(36).slice(2, 7), ts: dt.getTime(), q: v, gatilho: "", nota: "" });
  S.regs.sort(function (a, b) { return a.ts - b.ts; });
  q("#qtd").value = "";
  salvar(); agora(); renderChips(); render();
  st.style.color = "var(--accent-2)";
  st.textContent = "Registrado — " + pad2(hh) + ":" + pad2(mm);
  setTimeout(function () { st.textContent = ""; }, 2200);
  q("#qtd").select();
}

/* ============================ estoque / compras ============================ */
function dataHoraCurta(ts) {
  var d = new Date(ts);
  return pad2(d.getDate()) + "/" + MES3[d.getMonth()] + "/" + d.getFullYear();
}

function renderTiposCompraBar() {
  var wrap = q("#tiposCompraBar");
  if (wrap) {
    wrap.innerHTML = "";
    ["A", "B", "C"].forEach(function (k) {
      var b = el("button", "chip" + (k === S.tipoCompraSel ? " def" : ""), S.tiposCompra[k]);
      b.type = "button";
      b.addEventListener("click", function () { S.tipoCompraSel = k; renderTiposCompraBar(); });
      wrap.appendChild(b);
    });
    var ren = el("button", "btn pill", "renomear");
    ren.type = "button";
    ren.addEventListener("click", renomearTipoCompra);
    wrap.appendChild(ren);
  }
  var ws = q("#tiposSaidaBar");
  if (ws) {
    ws.innerHTML = "";
    ["A", "B", "C"].forEach(function (k) {
      var b = el("button", "chip" + (k === S.tipoSaidaSel ? " def" : ""), S.tiposCompra[k]);
      b.type = "button";
      b.addEventListener("click", function () { S.tipoSaidaSel = k; renderTiposCompraBar(); });
      ws.appendChild(b);
    });
  }
  var ms = q("#saidaMotivo");
  if (ms && !ms.options.length) {
    MOTIVOS.forEach(function (m) { var o = el("option", null, m); o.value = m; ms.appendChild(o); });
  }
}
function renomearTipoCompra() {
  var k = S.tipoCompraSel;
  var novo = prompt("Nome do tipo " + k + ":", S.tiposCompra[k]);
  if (novo === null) return;
  novo = novo.trim();
  if (!novo) return;
  S.tiposCompra[k] = novo;
  S.compras.forEach(function (c) { if (c.tipo === k) c.tipoNome = novo; });
  salvarCompras();
  renderTiposCompraBar();
  renderEstoque();
}
function precoCompraAtual() {
  var qv = parseFloat(String(q("#compraQtd").value).replace(",", "."));
  var vv = parseFloat(String(q("#compraValor").value).replace(",", "."));
  var out = q("#compraPrecoTxt");
  out.textContent = (!isNaN(qv) && qv > 0 && !isNaN(vv) && vv >= 0) ? rs(vv / qv) : "—";
}
function registrarCompra() {
  var st = q("#compraStatus");
  var qv = parseFloat(String(q("#compraQtd").value).replace(",", "."));
  var vv = parseFloat(String(q("#compraValor").value).replace(",", "."));
  if (isNaN(qv) || qv <= 0) { st.style.color = "var(--danger)"; st.textContent = "Quantidade inválida."; return; }
  if (isNaN(vv) || vv < 0) { st.style.color = "var(--danger)"; st.textContent = "Valor inválido."; return; }
  var dt = new Date();
  S.compras.push({
    id: "c" + dt.getTime() + "-" + Math.random().toString(36).slice(2, 7), ts: dt.getTime(),
    tipo: S.tipoCompraSel, tipoNome: S.tiposCompra[S.tipoCompraSel], q: qv, valor: vv,
    nota: q("#compraNota").value.trim()
  });
  S.compras.sort(function (a, b) { return a.ts - b.ts; });
  q("#compraQtd").value = ""; q("#compraValor").value = ""; q("#compraNota").value = "";
  precoCompraAtual();
  salvarCompras(); renderEstoque();
  st.style.color = "var(--accent-2)";
  st.textContent = "Compra registrada — " + rs(vv / qv) + "/g";
  setTimeout(function () { st.textContent = ""; }, 2600);
}
function registrarSaida() {
  var st = q("#saidaStatus");
  var qv = parseFloat(String(q("#saidaQtd").value).replace(",", "."));
  if (isNaN(qv) || qv <= 0) { st.style.color = "var(--danger)"; st.textContent = "Quantidade inválida."; return; }
  var dt = new Date();
  S.saidas.push({
    id: "s" + dt.getTime() + "-" + Math.random().toString(36).slice(2, 7), ts: dt.getTime(),
    tipo: S.tipoSaidaSel, q: qv, motivo: q("#saidaMotivo").value, nota: q("#saidaNota").value.trim()
  });
  S.saidas.sort(function (a, b) { return a.ts - b.ts; });
  q("#saidaQtd").value = ""; q("#saidaNota").value = "";
  salvarCompras(); renderEstoque();
  st.style.color = "var(--accent-2)";
  st.textContent = "−" + n1(qv) + " g do estoque (" + q("#saidaMotivo").value + ")";
  setTimeout(function () { st.textContent = ""; }, 2600);
}

/* Consumo não tem tipo declarado: é debitado do lote mais antigo (FIFO).
   Saídas sem fumar têm tipo próprio e saem do lote daquele tipo. */
function calcEstoque() {
  var lotes = S.compras.slice().sort(function (a, b) { return a.ts - b.ts; })
    .map(function (c) { return { tipo: c.tipo, rest: c.q }; });
  var deficit = 0;
  function debitar(qtd, tipo) {
    for (var i = 0; i < lotes.length && qtd > 1e-9; i++) {
      if (tipo && lotes[i].tipo !== tipo) continue;
      var t = Math.min(lotes[i].rest, qtd);
      lotes[i].rest -= t; qtd -= t;
    }
    return qtd;
  }
  var saidasTipo = { A: 0, B: 0, C: 0 }, totalSaidas = 0;
  S.saidas.forEach(function (s) {
    saidasTipo[s.tipo] = (saidasTipo[s.tipo] || 0) + s.q;
    totalSaidas += s.q;
  });
  ["A", "B", "C"].forEach(function (t) { if (saidasTipo[t]) deficit += debitar(saidasTipo[t], t); });
  var fumado = 0;
  S.regs.forEach(function (r) { fumado += r.q; });
  deficit += debitar(fumado, null);

  var porTipo = { A: 0, B: 0, C: 0 }, compradoTipo = { A: 0, B: 0, C: 0 }, gastoTipo = { A: 0, B: 0, C: 0 }, ultima = {};
  lotes.forEach(function (l) { porTipo[l.tipo] = (porTipo[l.tipo] || 0) + l.rest; });
  var comprado = 0, gasto = 0;
  S.compras.forEach(function (c) {
    comprado += c.q; gasto += c.valor;
    compradoTipo[c.tipo] = (compradoTipo[c.tipo] || 0) + c.q;
    gastoTipo[c.tipo] = (gastoTipo[c.tipo] || 0) + c.valor;
    if (!ultima[c.tipo] || c.ts > ultima[c.tipo]) ultima[c.tipo] = c.ts;
  });
  return {
    porTipo: porTipo, compradoTipo: compradoTipo, gastoTipo: gastoTipo, ultima: ultima,
    total: comprado - fumado - totalSaidas, deficit: deficit,
    comprado: comprado, gasto: gasto, fumado: fumado, saidas: totalSaidas,
    preco: comprado > 0 ? gasto / comprado : 0
  };
}

function renderEstoque(A) {
  A = A || analisar();
  var e = calcEstoque();
  var mesAtual = mesLogico(Date.now());
  var compradoMes = 0, gastoMes = 0;
  S.compras.forEach(function (c) { if (mesLogico(c.ts) === mesAtual) { compradoMes += c.q; gastoMes += c.valor; } });

  var cor = e.total < 0 ? "var(--danger)" : (e.total < 3 ? "var(--warn)" : "");
  [q("#estoqueAtual"), q("#estoqueAtualKpi")].forEach(function (x) {
    if (x) { x.textContent = n1(e.total) + " g"; x.style.color = cor; }
  });
  var dura = (e.total > 0 && A.rollAtual > 0.01) ? Math.round(e.total / A.rollAtual) : null;
  q("#estoqueSub").textContent = n1(e.comprado) + " g comprados − " + n1(e.fumado) + " g fumados − " +
    n1(e.saidas) + " g de saídas" + (dura !== null ? " · dura ~" + dura + " dias no ritmo atual" : "");
  q("#compradoMesKpi").textContent = n1(compradoMes) + " g";
  q("#compradoMesSub").textContent = compradoMes > 0 ? (rs(gastoMes) + " no total") : "nenhuma compra ainda este mês";
  q("#gastoMesKpi").textContent = rs(gastoMes);
  q("#gastoMesSub").textContent = compradoMes > 0 ? ("média " + rs(gastoMes / compradoMes) + "/g") : "";

  q("#comprasResumo").textContent = S.compras.length
    ? (n1(e.comprado) + " g · " + rs(e.gasto) + " · média " + rs(e.preco) + "/g")
    : "";

  renderCompras();
  renderSaidas();
  renderEstoquePorTipo(e);
  renderMilhao(A, e);
}

function renderEstoquePorTipo(e) {
  var wrap = q("#estoquePorTipo"); if (!wrap) return;
  wrap.innerHTML = "";
  ["A", "B", "C"].forEach(function (t) {
    var box = el("div", "stk");
    var h = el("div", "h");
    h.appendChild(el("span", "nm", S.tiposCompra[t]));
    var pc = e.compradoTipo[t] > 0 ? el("span", "hint", n0(e.compradoTipo[t] / (e.comprado || 1) * 100) + "% das compras") : el("span", "hint", "sem compras");
    h.appendChild(pc);
    box.appendChild(h);
    var v = el("span", "v hide", n1(e.porTipo[t]) + " g");
    v.style.color = e.porTipo[t] <= 0.05 ? "var(--muted)" : (e.porTipo[t] < 2 ? "var(--warn)" : "var(--accent-2)");
    box.appendChild(v);
    box.appendChild(el("div", "n", e.compradoTipo[t] > 0
      ? n1(e.compradoTipo[t]) + " g comprados · " + rs(e.gastoTipo[t] / e.compradoTipo[t]) + "/g"
      : "nada comprado deste tipo"));
    box.appendChild(el("div", "n", e.ultima[t] ? "última compra em " + dataHoraCurta(e.ultima[t]) : "—"));
    wrap.appendChild(box);
  });
  if (e.deficit > 0.05) {
    var av = el("div", "hint", "Faltam " + n1(e.deficit) + " g de compras registradas para cobrir tudo que já saiu — o estoque por tipo é o que sobrou dos lotes conhecidos.");
    av.style.cssText += ";grid-column:1/-1;color:var(--warn)";
    wrap.appendChild(av);
  }
}

function renderCompras() {
  var wrap = q("#comprasLista"); if (!wrap) return;
  wrap.innerHTML = "";
  var ord = S.compras.slice().sort(function (a, b) { return b.ts - a.ts; });
  if (!ord.length) { wrap.appendChild(el("div", "hint", "Nenhuma compra registrada ainda.")); return; }
  var COLS = "118px 92px 74px 92px 70px minmax(0,1fr) 58px";
  ord.forEach(function (c) {
    var row = el("div", "tbl-r");
    row.style.gridTemplateColumns = COLS;

    var dIn = el("input"); dIn.type = "text"; dIn.className = "mono ed"; dIn.value = dataBR(c.ts);
    dIn.placeholder = "26/Ago/2026";
    dIn.style.cssText = "width:100%;min-width:0";
    dIn.addEventListener("change", function () {
      var p = parseBR(this.value);
      if (!p) { this.value = dataBR(c.ts); return; }
      var old = new Date(c.ts);
      c.ts = new Date(p.ano, p.mi, p.dia, old.getHours(), old.getMinutes(), 0, 0).getTime();
      S.compras.sort(function (a, b) { return a.ts - b.ts; });
      salvarCompras(); renderEstoque();
    });
    row.appendChild(dIn);

    var tSel = el("select"); tSel.className = "ed";
    ["A", "B", "C"].forEach(function (k) {
      var o = el("option", null, S.tiposCompra[k]); o.value = k;
      if (c.tipo === k) o.selected = true; tSel.appendChild(o);
    });
    tSel.style.cssText = "width:100%;min-width:0;font-family:var(--sans);text-align:left";
    tSel.addEventListener("change", function () {
      c.tipo = this.value; c.tipoNome = S.tiposCompra[this.value];
      salvarCompras(); renderEstoque();
    });
    row.appendChild(tSel);

    var qIn = el("input"); qIn.type = "text"; qIn.className = "mono ed"; qIn.value = n1(c.q);
    qIn.addEventListener("change", function () {
      var v = parseFloat(String(this.value).replace(",", "."));
      if (isNaN(v) || v <= 0) { this.value = n1(c.q); return; }
      c.q = v; salvarCompras(); renderEstoque();
    });
    row.appendChild(qIn);

    var vIn = el("input"); vIn.type = "text"; vIn.className = "mono ed";
    vIn.value = c.valor.toFixed(2).replace(".", ",");
    vIn.addEventListener("change", function () {
      var v = parseFloat(String(this.value).replace(",", "."));
      if (isNaN(v) || v < 0) { this.value = c.valor.toFixed(2).replace(".", ","); return; }
      c.valor = v; salvarCompras(); renderEstoque();
    });
    row.appendChild(vIn);

    row.appendChild(el("span", "g", rs(c.valor / c.q)));

    var nIn = el("input"); nIn.type = "text"; nIn.className = "ed";
    nIn.placeholder = "comentário"; nIn.value = c.nota || "";
    nIn.style.cssText = "font-family:var(--sans);font-weight:400;width:100%;min-width:0";
    nIn.addEventListener("change", function () { c.nota = this.value; salvarCompras(); });
    row.appendChild(nIn);

    var del = el("button", "btn link", "apagar");
    del.type = "button";
    del.addEventListener("click", function () {
      S.compras = S.compras.filter(function (x) { return x.id !== c.id; });
      salvarCompras(); renderEstoque();
    });
    row.appendChild(del);
    wrap.appendChild(row);
  });
}

function renderSaidas() {
  var wrap = q("#saidasLista"); if (!wrap) return;
  wrap.innerHTML = "";
  var ord = S.saidas.slice().sort(function (a, b) { return b.ts - a.ts; });
  if (!ord.length) {
    wrap.appendChild(el("div", "hint", "Nenhuma saída sem fumar registrada. Manteiga, presente e pontas entram aqui."));
    return;
  }
  var COLS = "118px 92px 74px 108px minmax(0,1fr) 58px";
  ord.forEach(function (s) {
    var row = el("div", "tbl-r");
    row.style.gridTemplateColumns = COLS;

    var dIn = el("input"); dIn.type = "text"; dIn.className = "mono ed"; dIn.value = dataBR(s.ts);
    dIn.placeholder = "26/Ago/2026";
    dIn.style.cssText = "width:100%;min-width:0";
    dIn.addEventListener("change", function () {
      var p = parseBR(this.value);
      if (!p) { this.value = dataBR(s.ts); return; }
      var old = new Date(s.ts);
      s.ts = new Date(p.ano, p.mi, p.dia, old.getHours(), old.getMinutes(), 0, 0).getTime();
      S.saidas.sort(function (a, b) { return a.ts - b.ts; });
      salvarCompras(); renderEstoque();
    });
    row.appendChild(dIn);

    var tSel = el("select"); tSel.className = "ed";
    ["A", "B", "C"].forEach(function (k) {
      var o = el("option", null, S.tiposCompra[k]); o.value = k;
      if (s.tipo === k) o.selected = true; tSel.appendChild(o);
    });
    tSel.style.cssText = "width:100%;min-width:0;font-family:var(--sans);text-align:left";
    tSel.addEventListener("change", function () { s.tipo = this.value; salvarCompras(); renderEstoque(); });
    row.appendChild(tSel);

    var qIn = el("input"); qIn.type = "text"; qIn.className = "mono ed"; qIn.value = "−" + n1(s.q);
    qIn.addEventListener("change", function () {
      var v = Math.abs(parseFloat(String(this.value).replace(",", ".").replace("−", "")));
      if (isNaN(v) || v <= 0) { this.value = "−" + n1(s.q); return; }
      s.q = v; salvarCompras(); renderEstoque();
    });
    qIn.style.color = "var(--danger)";
    row.appendChild(qIn);

    var mSel = el("select"); mSel.className = "ed";
    MOTIVOS.forEach(function (m) {
      var o = el("option", null, m); o.value = m;
      if ((s.motivo || "") === m) o.selected = true; mSel.appendChild(o);
    });
    mSel.style.cssText = "width:100%;min-width:0;font-family:var(--sans);text-align:left;font-size:12px";
    mSel.addEventListener("change", function () { s.motivo = this.value; salvarCompras(); renderEstoque(); });
    row.appendChild(mSel);

    var nIn = el("input"); nIn.type = "text"; nIn.className = "ed";
    nIn.placeholder = "comentário"; nIn.value = s.nota || "";
    nIn.style.cssText = "font-family:var(--sans);font-weight:400;width:100%;min-width:0";
    nIn.addEventListener("change", function () { s.nota = this.value; salvarCompras(); });
    row.appendChild(nIn);

    var del = el("button", "btn link", "apagar");
    del.type = "button";
    del.addEventListener("click", function () {
      S.saidas = S.saidas.filter(function (x) { return x.id !== s.id; });
      salvarCompras(); renderEstoque();
    });
    row.appendChild(del);
    wrap.appendChild(row);
  });
}

/* --------------------------- rumo ao milhão --------------------------- */
function renderMilhao(A, e) {
  var meta = S.cfg.metaFin || 1000000;
  q("#milRot").textContent = "meta de " + rs0(meta) + " · cada grama não fumada é aporte";
  var preco = e.preco;
  var base0 = pontoPartida(A).v;
  var kw = q("#milKpis"); kw.innerHTML = "";
  function kpi(rot, v, n, cor) {
    var c = el("div", "kpi");
    c.appendChild(el("span", "lbl", rot));
    var sv = el("span", "v hide", v);
    sv.style.cssText += ";font-size:20px";
    if (cor) sv.style.color = cor;
    c.appendChild(sv);
    c.appendChild(el("span", "n", n));
    kw.appendChild(c);
  }
  if (!preco || !base0) {
    q("#milValor").textContent = "—";
    q("#milValorSub").textContent = "Preciso de compras registradas (para saber o R$/g) e de 7 dias completos de uso.";
    q("#milPct").textContent = "—";
    q("#milBar").style.width = "0%";
    q("#milNota").textContent = "";
    return;
  }
  var economiaDia = (base0 - A.rollAtual) * preco;
  var economiaMes = economiaDia * 30;
  var acum = 0;
  A.completos.forEach(function (d) { acum += (base0 - d.g) * preco; });
  var im = Math.pow(1.10, 1 / 12) - 1, nMes = 240;
  var futuro = economiaMes > 0 ? economiaMes * ((Math.pow(1 + im, nMes) - 1) / im) : 0;
  var pct = futuro / meta * 100;
  var corte = Date.now() - 365 * 86400000, gastoAno = 0;
  S.compras.forEach(function (c) { if (c.ts >= corte) gastoAno += c.valor; });

  q("#milValor").textContent = (acum >= 0 ? "" : "−") + rs0(Math.abs(acum));
  q("#milValor").style.color = acum >= 0 ? "var(--accent-2)" : "var(--danger)";
  q("#milValorSub").textContent = acum >= 0
    ? "já não gastos desde o seu ponto de partida (" + n1(base0) + " g/dia → " + n1(A.rollAtual) + " g/dia)"
    : "acima do ponto de partida de " + n1(base0) + " g/dia — ainda não virou economia";
  q("#milPct").textContent = pct >= 0.1 ? n1(pct) + "% do alvo" : "—";
  q("#milBar").style.width = Math.max(0, Math.min(100, pct)).toFixed(1) + "%";
  q("#milBar").style.background = pct >= 5 ? "var(--accent-2)" : "var(--accent)";

  kpi("Economia por mês", (economiaMes >= 0 ? "" : "−") + rs(Math.abs(economiaMes)),
    n1(Math.abs(base0 - A.rollAtual)) + " g/dia " + (economiaMes >= 0 ? "abaixo" : "acima") + " do início × " + rs(preco) + "/g",
    economiaMes >= 0 ? "var(--accent-2)" : "var(--danger)");
  kpi("Se investida, em 20 anos", rs0(futuro), "aporte mensal a 10% a.a. — " + (pct >= 0.1 ? n1(pct) + "% da sua meta" : "sem economia para aportar"));
  kpi("Gasto nos últimos 12 meses", rs0(gastoAno), "no ritmo atual: " + rs0(A.rollAtual * 365 * preco) + "/ano");

  var passoG = 0.5;
  var valorPasso = passoG * preco * 30;
  var futuroPasso = valorPasso * ((Math.pow(1 + im, nMes) - 1) / im);
  q("#milNota").textContent = "Cada " + n1(passoG) + " g/dia que você corta a mais vale " + rs(valorPasso) +
    " por mês — " + rs0(futuroPasso) + " em 20 anos a 10% a.a., ou " + n1(futuroPasso / meta * 100) +
    "% do alvo, sem você fazer nada além de não comprar.";
}

/* ============================ backup / import ============================ */
function baixar(nome, conteudo, mime) {
  var url = URL.createObjectURL(new Blob([conteudo], { type: mime }));
  var a = document.createElement("a");
  a.href = url; a.download = nome;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}
function csvEsc(v) {
  var s = String(v);
  return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}
function exportarCsv() {
  var linhas = ["Data,Hora,Quantidade,Motivo,Nota,TipoDia"];
  serializar().forEach(function (r) {
    var k = chaveLogica(r.timestamp);
    linhas.push([r.data, r.hora, r.quantidade, r.gatilho || "", r.nota || "", TIPOS[tipoDe(k)].nome].map(csvEsc).join(","));
  });
  baixar("backup_registros.csv", linhas.join("\n"), "text/csv;charset=utf-8");
}
function parseLinhaCSV(line) {
  var out = [], cur = "", dentro = false;
  for (var i = 0; i < line.length; i++) {
    var c = line[i];
    if (dentro) {
      if (c === '"') { if (line[i + 1] === '"') { cur += '"'; i++; } else dentro = false; }
      else cur += c;
    } else if (c === '"') dentro = true;
    else if (c === ",") { out.push(cur); cur = ""; }
    else cur += c;
  }
  out.push(cur);
  return out;
}
/* Importação é sempre MESCLAGEM com deduplicação por (timestamp, quantidade).
   Nada é apagado — o bug destrutivo da versão anterior não existe aqui. */
function importar(texto, nome) {
  var novos = [], tipos = null;
  var ehJson = /\.json$/i.test(nome) || texto.trim().charAt(0) === "{";
  if (ehJson) {
    var dados;
    try { dados = JSON.parse(texto); } catch (e) { q("#impStatus").textContent = "JSON inválido."; return; }
    novos = Array.isArray(dados.registros) ? dados.registros : [];
    if (dados.tiposDia && typeof dados.tiposDia === "object") tipos = dados.tiposDia;
  } else {
    var linhas = texto.split(/\r?\n/); linhas.shift();
    linhas.forEach(function (l) {
      l = l.trim(); if (!l) return;
      var p = parseLinhaCSV(l);
      if (p.length < 3) return;
      var dp = p[0].trim().split("/"), hp = p[1].trim().split(":");
      if (dp.length !== 3 || hp.length < 2) return;
      var h = parseInt(hp[0], 10), mi = parseInt(hp[1], 10);
      if (isNaN(h) || h < 0 || h > 23 || isNaN(mi) || mi < 0 || mi > 59) return;
      var dt = new Date(parseInt(dp[2], 10), parseInt(dp[1], 10) - 1, parseInt(dp[0], 10), h, mi, 0, 0);
      novos.push({ timestamp: dt.getTime(), quantidade: parseFloat(p[2]) || 0, gatilho: (p[3] || "").trim(), nota: (p[4] || "").trim() });
    });
  }
  if (!novos.length) { q("#impStatus").textContent = "Nenhum registro encontrado no arquivo."; return; }
  if (!confirm("Mesclar " + novos.length + " registro(s) com a sua base atual (" + S.regs.length + ")?\n\nNada será apagado; duplicatas exatas são ignoradas.")) return;

  var vistos = {};
  S.regs.forEach(function (r) { vistos[r.ts + "|" + r.q] = true; });
  var add = 0, dup = 0;
  normalizar(novos).forEach(function (r) {
    var key = r.ts + "|" + r.q;
    if (vistos[key]) { dup++; return; }
    vistos[key] = true; add++;
    S.regs.push(r);
  });
  S.regs.sort(function (a, b) { return a.ts - b.ts; });
  if (tipos) S.tipos = Object.assign({}, tipos, S.tipos);
  salvar(); renderChips(); render();
  q("#impStatus").textContent = add + " adicionados · " + dup + " duplicatas ignoradas.";
  setTimeout(function () { q("#impStatus").textContent = ""; }, 6000);
}

/* ============================== config UI ============================== */
function aplicarTema() {
  var t = S.cfg.tema;
  if (t === "auto") {
    t = (window.matchMedia && window.matchMedia("(prefers-color-scheme: light)").matches) ? "light" : "dark";
  }
  document.documentElement.setAttribute("data-theme", t);
}
if (window.matchMedia) {
  window.matchMedia("(prefers-color-scheme: light)").addEventListener("change", function () {
    if (S.cfg.tema === "auto") aplicarTema();
  });
}
/* Os três controles de feel: modo de leitura, paleta e tom das mensagens. */
function aplicarVisual() {
  document.documentElement.setAttribute("data-pal", S.cfg.pal || "verde");
  document.body.setAttribute("data-modo", S.cfg.modo || "analitico");
  [["#tkModo", S.cfg.modo || "analitico"], ["#tkPal", S.cfg.pal || "verde"], ["#tkTom", S.cfg.tom || "frases"]].forEach(function (par) {
    Array.prototype.forEach.call(document.querySelectorAll(par[0] + " .btn"), function (b) {
      b.classList.toggle("on", b.dataset.v === par[1]);
    });
  });
}
function comFrases() { return (S.cfg.tom || "frases") !== "numeros"; }
function aplicarConfigUI() {
  q("#cfgJanela").value = String(S.cfg.janela);
  q("#cfgMeta").value = String(S.cfg.meta);
  q("#cfgTema").value = S.cfg.tema;
  aplicarVisual();
  q("#cfgMM").value = String(S.cfg.mm === undefined ? 7 : S.cfg.mm);
  q("#cfgMMP").value = String(S.cfg.mmPrinc || 20);
  q("#cfgMetaFin").value = String(S.cfg.metaFin || 1000000);
  q("#cfgBase0").value = S.cfg.base0 || "";
  aplicarTema();
}

/* =============================== eventos =============================== */
q("#registrar").addEventListener("click", registrar);
q("#qtd").addEventListener("keyup", function (e) { if (e.key === "Enter") registrar(); });
q("#mm").addEventListener("keyup", function (e) { if (e.key === "Enter") registrar(); });
q("#agora").addEventListener("click", agora);
q("#mesPrev").addEventListener("click", function () { S.mesOffset--; render(); });
q("#mesNext").addEventListener("click", function () { S.mesOffset = Math.min(0, S.mesOffset + 1); render(); });
q("#filtroHora").addEventListener("click", function (e) {
  if (!e.target.dataset.f) return;
  S.filtroHora = e.target.dataset.f; render();
});
q("#cfgJanela").addEventListener("change", function () { S.cfg.janela = parseInt(this.value, 10); salvarConfig(); render(); });
q("#cfgMeta").addEventListener("change", function () { S.cfg.meta = parseInt(this.value, 10); salvarConfig(); render(); });
q("#cfgTema").addEventListener("change", function () { S.cfg.tema = this.value; salvarConfig(); aplicarTema(); });
q("#cfgMM").addEventListener("change", function () { S.cfg.mm = parseInt(this.value, 10); salvarConfig(); render(); });
q("#cfgMMP").addEventListener("change", function () { S.cfg.mmPrinc = parseInt(this.value, 10); salvarConfig(); render(); });
q("#cfgMetaFin").addEventListener("change", function () { S.cfg.metaFin = parseInt(this.value, 10); salvarConfig(); renderEstoque(); });
q("#cfgBase0").addEventListener("change", function () {
  var v = String(this.value).replace(",", ".").trim();
  var num = parseFloat(v);
  S.cfg.base0 = (v === "" || isNaN(num) || num <= 0) ? "" : n1(num);
  this.value = S.cfg.base0;
  this.placeholder = S.cfg.base0 ? "" : "auto";
  salvarConfig(); render();
});
q("#cfgBtn").addEventListener("click", function (e) { e.stopPropagation(); q("#cfgPop").classList.toggle("on"); });
document.addEventListener("click", function (e) {
  var pop = q("#cfgPop");
  if (pop.classList.contains("on") && !pop.contains(e.target) && e.target !== q("#cfgBtn")) pop.classList.remove("on");
});
q("#evoGran").addEventListener("click", function (e) {
  if (!e.target.dataset.e || e.target.disabled) return;
  S.evoGran = e.target.dataset.e; render();
});
function ligarTweak(sel, chave, depois) {
  q(sel).addEventListener("click", function (e) {
    if (!e.target.dataset.v) return;
    S.cfg[chave] = e.target.dataset.v;
    salvarConfig(); aplicarVisual();
    if (depois) depois();
  });
}
ligarTweak("#tkModo", "modo", function () { render(); });
ligarTweak("#tkPal", "pal");
ligarTweak("#tkTom", "tom", function () { _frases = {}; render(); });
q("#togMedia").addEventListener("click", function () { S.mostrarMedia = !S.mostrarMedia; render(); });
q("#saidaRegistrar").addEventListener("click", registrarSaida);
q("#saidaQtd").addEventListener("keyup", function (e) { if (e.key === "Enter") registrarSaida(); });
q("#compraQtd").addEventListener("input", precoCompraAtual);
q("#compraValor").addEventListener("input", precoCompraAtual);
q("#compraValor").addEventListener("keyup", function (e) { if (e.key === "Enter") registrarCompra(); });
q("#compraRegistrar").addEventListener("click", registrarCompra);
q("#expCsv").addEventListener("click", exportarCsv);
q("#impBtn").addEventListener("click", function () { q("#file").click(); });
q("#file").addEventListener("change", function (e) {
  var f = e.target.files[0];
  if (!f) return;
  var fr = new FileReader();
  fr.onload = function (ev) { importar(ev.target.result, f.name); q("#file").value = ""; };
  fr.readAsText(f);
});

popularHoras();
renderChips();
renderTiposCompraBar();
carregar();
q("#qtd").focus({ preventScroll: true });
/* O popup abre esta página com #importar para usar o seletor de arquivo daqui
   (um diálogo de arquivo aberto dentro do popup fecharia o popup no Chrome). */
if (location.hash === "#importar") {
  history.replaceState(null, "", location.pathname);
  setTimeout(function () { q("#file").click(); }, 350);
}
