"use strict";

/* =========================================================================
   Registro de Atividade — painel analítico
   Regras centrais:
   - Dia lógico começa às 04:00 (madrugada pertence ao dia anterior).
   - Toda comparação é "como com como": cada dia é avaliado contra a mediana
     histórica do SEU tipo de dia (home office / escritório / dia off).
   - Nenhum ranking mensal, nenhum troféu que reinicia.
   ========================================================================= */

var H0 = 4;

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
  home:   { nome: "Home office", cor: "var(--blue)",   classe: "b-home" },
  office: { nome: "Escritório",  cor: "var(--violet)", classe: "b-office" },
  off:    { nome: "Dia off",     cor: "var(--warn)",   classe: "b-off" }
};
var GAT = ["", "tédio", "ansiedade", "social", "ritual", "hábito"];
var DIAS_SEM = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
var MESES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

/* ------------------------------- formato ------------------------------- */
function n1(v) { return (Math.round(v * 10) / 10).toFixed(1).replace(".", ","); }
function n0(v) { return String(Math.round(v)); }
function hm(min) {
  var m = Math.max(0, Math.round(min)), h = Math.floor(m / 60);
  return h > 0 ? h + "h" + String(m % 60).padStart(2, "0") : m + "min";
}
function mediana(a) {
  if (!a.length) return 0;
  var s = a.slice().sort(function (x, y) { return x - y; });
  var i = Math.floor(s.length / 2);
  return s.length % 2 ? s[i] : (s[i - 1] + s[i]) / 2;
}
function media(a) { return a.length ? a.reduce(function (s, v) { return s + v; }, 0) / a.length : 0; }
function pad2(v) { return String(v).padStart(2, "0"); }
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
  cfg: { janela: 90, meta: 10, tema: "dark", tom: true, discreto: false },
  sel: null,
  filtroHora: "todos",
  mesOffset: 0,
  escritaPropria: null
};

/* ------------------------- dia lógico (04h) ------------------------- */
function chaveLogica(ts) {
  var d = new Date(ts - H0 * 3600000);
  return d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate());
}
function chaveDe(d) { return d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate()); }
function chaveParaData(k) { var p = k.split("-").map(Number); return new Date(p[0], p[1] - 1, p[2]); }
function tipoDe(k) {
  if (S.tipos[k]) return S.tipos[k];
  var wd = chaveParaData(k).getDay();
  if (wd === 0 || wd === 6) return "off";
  return (wd === 2 || wd === 4) ? "office" : "home";
}
function rotuloCurto(k) { var d = chaveParaData(k); return pad2(d.getDate()) + "/" + pad2(d.getMonth() + 1); }
function rotuloLongo(k) { var d = chaveParaData(k); return DIAS_SEM[d.getDay()] + ", " + d.getDate() + " de " + MESES[d.getMonth()].toLowerCase(); }
function hoje() { return chaveLogica(Date.now()); }

/* ------------------------------ storage ------------------------------ */
function normalizar(arr) {
  return arr.map(function (r, i) {
    var ts = parseInt(r.timestamp, 10);
    if (isNaN(ts)) ts = Date.now();
    return { id: r.id || (String(ts) + "-" + i), ts: ts, q: parseFloat(r.quantidade != null ? r.quantidade : r.q) || 0, gatilho: r.gatilho || "" };
  }).sort(function (a, b) { return a.ts - b.ts; });
}
function serializar() {
  return S.regs.map(function (r) {
    var d = new Date(r.ts);
    return {
      data: pad2(d.getDate()) + "/" + pad2(d.getMonth() + 1) + "/" + d.getFullYear(),
      hora: pad2(d.getHours()) + ":" + pad2(d.getMinutes()),
      quantidade: r.q, timestamp: r.ts, gatilho: r.gatilho || ""
    };
  });
}
function salvar() {
  var json = JSON.stringify(serializar());
  S.escritaPropria = json;
  chrome.storage.local.set({ registros: json, tiposDia: JSON.stringify(S.tipos), config: JSON.stringify(S.cfg) });
}
function salvarConfig() { chrome.storage.local.set({ config: JSON.stringify(S.cfg) }); }

function carregar() {
  chrome.storage.local.get(["registros", "tiposDia", "config"], function (res) {
    try { S.regs = res.registros ? normalizar(JSON.parse(res.registros)) : []; } catch (e) { S.regs = []; }
    try { if (res.tiposDia) S.tipos = JSON.parse(res.tiposDia); } catch (e) {}
    try { if (res.config) S.cfg = Object.assign(S.cfg, JSON.parse(res.config)); } catch (e) {}
    aplicarConfigUI();
    renderChips();
    render();
  });
}

/* O popup grava direto em "registros" e não conhece o estado desta página.
   Sem este listener, o registro feito pelo popup seria sobrescrito na próxima
   gravação daqui (o bug crítico da versão anterior). */
if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.onChanged) {
  chrome.storage.onChanged.addListener(function (ch, area) {
    if (area !== "local" || !ch.registros) return;
    if (ch.registros.newValue === S.escritaPropria) return; // gravação desta página
    try { S.regs = ch.registros.newValue ? normalizar(JSON.parse(ch.registros.newValue)) : []; } catch (e) { return; }
    render();
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

  var roll = dias.map(function (d, i) {
    var w = dias.slice(Math.max(0, i - 6), i + 1);
    return somaG(w) / w.length;
  });

  var baseTipo = {};
  Object.keys(TIPOS).forEach(function (t) {
    baseTipo[t] = mediana(completos.filter(function (d) { return d.tipo === t; }).map(function (d) { return d.g; }));
  });

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

  // sequência na própria linha
  var streak = 0;
  for (var i = completos.length - 1; i >= 0; i--) {
    if (completos[i].g <= baseTipo[completos[i].tipo] + 0.001) streak++; else break;
  }
  var melhor = 0, cur = 0;
  completos.forEach(function (d) {
    if (d.g <= baseTipo[d.tipo] + 0.001) { cur++; if (cur > melhor) melhor = cur; } else cur = 0;
  });

  return {
    dias: dias, mapa: b.mapa, jan: jan, completos: completos, roll: roll,
    s7: s7, sa7: sa7, temComp: temComp, delta: delta, baseTipo: baseTipo,
    gapAtual: gapAtual, gapAnt: gapAnt, slope: slope, rollAtual: rollAtual, proj28: proj28,
    streak: streak, melhor: melhor, temSerie: serieT.length >= 4
  };
}

/* =============================== render =============================== */
function corDelta(delta) {
  if (delta === null) return "var(--muted)";
  return delta <= -3 ? "var(--accent-2)" : (delta >= 3 ? "var(--danger)" : "var(--text)");
}
function G(txt) { return txt; } // valores sensíveis recebem classe .hide no DOM

function render() {
  var A = analisar();
  var sel = S.sel || hoje();
  if (!A.mapa[sel] && A.dias.length) sel = hoje();
  S.sel = sel;

  document.body.classList.toggle("discreto", !!S.cfg.discreto);
  q("#janelaBadge").textContent = A.jan.length ? "últimos " + A.jan.length + " dias · dia lógico 04h→04h" : "sem dados";

  renderVeredito(A);
  renderKpis(A);
  renderGrafico(A);
  renderTipos(A);
  renderGatilhos(A);
  renderHoras(A);
  renderAlavancas(A);
  renderCalendario(A, sel);
  renderSequencia(A);
  renderMarcos(A);
  renderDia(A, sel);
}

/* ------------------------------ veredito ------------------------------ */
function renderVeredito(A) {
  var d = A.delta, pct = S.cfg.meta, ironico = S.cfg.tom, l1, l2;
  var jan = A.jan;
  var alvoHoje = jan.length ? A.roll[A.dias.length - jan.length] * Math.pow(1 - pct / 100, jan.length / 30) : 0;
  var offShare = 0, tOffDias = 0;
  var gJan = somaG(jan) || 1;
  jan.forEach(function (x) { if (x.tipo === "off") { offShare += x.g; tOffDias++; } });
  offShare = offShare / gJan * 100;

  if (!A.dias.length) {
    l1 = "Nenhum dado. Um painel vazio é honesto, mas inútil.";
    l2 = "Registre uma semana e este espaço começa a te dizer coisas que você não quer ouvir.";
  } else if (d === null) {
    l1 = "Faltam duas semanas completas para comparar.";
    l2 = "Você tem " + A.completos.length + " dia(s) completo(s). Até lá, olhe as alavancas — elas já funcionam com poucos dias.";
  } else if (d >= 15) {
    l1 = ironico ? "Subiu " + n0(d) + "% em sete dias e você chamou isso de semana normal." : "Alta de " + n0(d) + "% em relação aos 7 dias anteriores.";
    l2 = "Não é falta de força — é falta de plano. " + n0(offShare) + "% do seu total mora nos dias off.";
  } else if (d >= 3) {
    l1 = ironico ? "Mais " + n0(d) + "%. Pequeno o suficiente para ignorar. É sempre assim que começa." : "Alta de " + n0(d) + "%.";
    l2 = "A média móvel está em " + n1(A.rollAtual) + " g/dia" + (pct > 0 ? "; a trajetória da meta pedia " + n1(alvoHoje) + " g/dia hoje." : ".");
  } else if (d > -3) {
    l1 = ironico ? "Estável. “Estável” é a palavra elegante para “nada mudou”." : "Estável em relação aos 7 dias anteriores.";
    l2 = "Mesmo patamar: " + n1(A.rollAtual) + " g/dia. Escolha uma alavanca abaixo e mexa em uma coisa só.";
  } else if (d > -15) {
    l1 = ironico ? n0(-d) + "% menos. Não é heroísmo, é aritmética — e aritmética repete." : "Queda de " + n0(-d) + "%.";
    l2 = "Sequência atual: " + A.streak + " dias na linha. Repetir vale mais que acertar.";
  } else {
    l1 = ironico ? n0(-d) + "% abaixo da semana passada. Guarde este número: você acabou de provar que dá." : "Queda de " + n0(-d) + "%.";
    l2 = "Nesse ritmo a projeção de 4 semanas é " + n1(A.proj28) + " g/dia. O risco agora é comemorar cedo.";
  }
  q("#vL1").textContent = l1;
  q("#vL2").textContent = l2;
  var vd = q("#vDelta");
  vd.textContent = d === null ? "—" : (d > 0 ? "+" : "") + n0(d) + "%";
  vd.style.color = corDelta(d);
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
function renderGrafico(A) {
  var jan = A.jan, pct = S.cfg.meta;
  var bars = q("#bars"), xax = q("#xax");
  bars.innerHTML = ""; xax.innerHTML = "";
  if (!jan.length) {
    q("#lineMedia").setAttribute("points", "");
    q("#lineMeta").setAttribute("points", "");
    q("#yMax").textContent = "—"; q("#yMid").textContent = "—";
    return;
  }
  var escala = Math.max(1, Math.ceil(Math.max.apply(null, jan.map(function (d) { return d.g; }))));
  q("#yMax").textContent = n1(escala);
  q("#yMid").textContent = n1(escala / 2);
  var passo = Math.max(1, Math.ceil(jan.length / 12));

  jan.forEach(function (d, i) {
    var col = el("div", "col " + (d.g === 0 ? "b-zero" : TIPOS[d.tipo].classe));
    col.title = rotuloLongo(d.chave) + " · " + n1(d.g) + " g · " + d.n + " reg · " + TIPOS[d.tipo].nome;
    var bar = el("i");
    bar.style.height = (d.g === 0 ? 2 : Math.max(1, d.g / escala * 100)) + "%";
    col.appendChild(bar);
    bars.appendChild(col);
    xax.appendChild(el("div", null, i % passo === 0 ? rotuloCurto(d.chave) : ""));
  });

  var off0 = A.dias.length - jan.length;
  function px(i) { return jan.length <= 1 ? 50 : (i + 0.5) / jan.length * 100; }
  function py(v) { return 100 - Math.max(0, Math.min(1, v / escala)) * 100; }
  q("#lineMedia").setAttribute("points", jan.map(function (d, i) { return px(i).toFixed(2) + "," + py(A.roll[off0 + i]).toFixed(2); }).join(" "));
  if (pct > 0) {
    var anc = A.roll[off0];
    q("#lineMeta").setAttribute("points", jan.map(function (d, i) { return px(i).toFixed(2) + "," + py(anc * Math.pow(1 - pct / 100, i / 30)).toFixed(2); }).join(" "));
  } else {
    q("#lineMeta").setAttribute("points", "");
  }

  var leg = [
    { c: "var(--blue)", n: "Home office" }, { c: "var(--violet)", n: "Escritório" },
    { c: "var(--warn)", n: "Dia off" }, { c: "var(--line-fg)", n: "Média 7 dias" }
  ];
  if (pct > 0) leg.push({ c: "var(--accent-2)", n: "Trajetória −" + n0(pct) + "%/mês" });
  var lw = q("#chartLegend"); lw.innerHTML = "";
  leg.forEach(function (l) {
    var s = el("span", "i");
    var e = el("em"); e.style.background = l.c;
    s.appendChild(e); s.appendChild(document.createTextNode(l.n));
    lw.appendChild(s);
  });
}

/* --------------------------- peso por tipo --------------------------- */
function renderTipos(A) {
  var jan = A.jan, gJan = somaG(jan) || 1;
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
  var bins = new Array(24).fill(0);
  dias.forEach(function (d) {
    d.regs.forEach(function (r) { bins[(new Date(r.ts).getHours() - H0 + 24) % 24] += r.q; });
  });
  var max = Math.max.apply(null, bins.concat([0.1]));
  var hb = q("#hbars"), hx = q("#hax");
  hb.innerHTML = ""; hx.innerHTML = "";
  bins.forEach(function (v, i) {
    var hReal = (i + H0) % 24;
    var ratio = v / max;
    var col = el("div", "col " + (ratio > 0.72 ? "hi" : (ratio > 0.42 ? "mid" : "lo")));
    col.title = pad2(hReal) + "h — " + n1(v) + " g";
    var bar = el("i");
    bar.style.height = (v > 0 ? Math.max(2, ratio * 100) : 0) + "%";
    col.appendChild(bar); hb.appendChild(col);
    hx.appendChild(el("div", null, i % 3 === 0 ? pad2(hReal) : ""));
  });
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

  var comReg = A.completos.filter(function (d) { return d.n > 0; });
  function bucket(d) { return d.hPrim === null ? null : (d.hPrim < 12 ? 0 : (d.hPrim < 16 ? 1 : (d.hPrim < 20 ? 2 : 3))); }
  var bNomes = ["antes do meio-dia", "entre 12h e 16h", "entre 16h e 20h", "depois das 20h"];
  var bs = [0, 1, 2, 3].map(function (i) {
    var dd = comReg.filter(function (d) { return bucket(d) === i; });
    return { i: i, n: dd.length, m: media(dd.map(function (d) { return d.g; })) };
  }).filter(function (x) { return x.n >= 3; });

  var a2 = { t: "Hora do primeiro registro", num: "—", cor: "var(--muted)",
    d: "Poucos dias para comparar horários de início (preciso de 3+ dias em duas faixas).", a: "" };
  if (bs.length >= 2) {
    var cedo = bs[0], tarde = bs[bs.length - 1], dif = cedo.m - tarde.m;
    a2 = {
      t: "Hora do primeiro registro",
      num: (dif > 0 ? "−" : "+") + n1(Math.abs(dif)) + " g",
      cor: dif > 0 ? "var(--accent-2)" : "var(--muted)",
      d: "Dias que começam " + bNomes[tarde.i] + " terminam em " + n1(tarde.m) + " g. Dias que começam " + bNomes[cedo.i] + ": " + n1(cedo.m) + " g.",
      a: dif > 0 ? "Atrasar o primeiro registro vale mais que cortar o último." : "O horário de início não é o seu fator dominante — olhe o tipo de dia."
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

  var lista = [
    { t: "Concentração", num: n0(offShare) + "%", cor: "var(--warn)",
      d: "do total da janela cabe em " + offDias.length + " dias off — contra " + (jan.length - offDias.length) + " dias úteis somando o resto.",
      a: "Cortar 20% de um dia off vale mais que uma semana útil impecável." },
    a2, a3
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
  if (semRegistro) return "s-good";
  if (ratio === null) return "";
  if (ratio <= 0.6) return "s-good";
  if (ratio <= 0.9) return "s-ok";
  if (ratio <= 1.1) return "s-line";
  if (ratio <= 1.4) return "s-up";
  return "s-bad";
}
function renderCalendario(A, sel) {
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

  var minSem = null, minSemK = "";
  for (var i = 6; i < A.completos.length; i++) {
    var s = somaG(A.completos.slice(i - 6, i + 1));
    if (minSem === null || s < minSem) { minSem = s; minSemK = A.completos[i].chave; }
  }
  var maxGap = 0, maxGapK = "";
  for (var j = 1; j < S.regs.length; j++) {
    var dif = (S.regs[j].ts - S.regs[j - 1].ts) / 60000;
    if (dif > maxGap) { maxGap = dif; maxGapK = chaveLogica(S.regs[j].ts); }
  }
  var tardeMax = null, tardeK = "";
  A.completos.forEach(function (d) {
    if (d.tipo !== "off" && d.hPrim !== null && (tardeMax === null || d.hPrim > tardeMax)) { tardeMax = d.hPrim; tardeK = d.chave; }
  });
  var recs = [
    { k: "Menor semana (7 dias)", v: minSem === null ? "—" : n1(minSem) + " g · " + rotuloCurto(minSemK), s: true },
    { k: "Maior intervalo real", v: maxGap ? hm(maxGap) + " · " + rotuloCurto(maxGapK) : "—", s: false },
    { k: "Primeiro uso mais tarde (útil)", v: tardeMax === null ? "—" : pad2(Math.floor(tardeMax % 24)) + "h" + pad2(Math.round((tardeMax % 1) * 60)) + " · " + rotuloCurto(tardeK), s: false },
    { k: "Melhor sequência na linha", v: A.melhor + " dias", s: false },
    { k: "Dias sem nenhum registro", v: A.completos.filter(function (d) { return d.n === 0; }).length + " de " + A.completos.length, s: false }
  ];
  var wrap = q("#recordes"); wrap.innerHTML = "";
  recs.forEach(function (r) {
    var row = el("div", "kv");
    row.appendChild(el("span", "k", r.k));
    row.appendChild(el("span", "v" + (r.s ? " hide" : ""), r.v));
    wrap.appendChild(row);
  });
  return { tardeMax: tardeMax };
}

function renderMarcos(A) {
  var pct = S.cfg.meta || 10;
  var tardeMax = null;
  A.completos.forEach(function (d) {
    if (d.tipo !== "off" && d.hPrim !== null && (tardeMax === null || d.hPrim > tardeMax)) tardeMax = d.hPrim;
  });
  var alvoOff = A.baseTipo.off * 0.7;
  var lista = [
    { n: "7 dias seguidos na linha", feito: A.streak >= 7, prog: A.streak / 7 },
    { n: "Uma semana " + n0(pct) + "% abaixo da anterior", feito: A.delta !== null && A.delta <= -pct, prog: A.delta === null ? 0 : Math.max(0, -A.delta / pct) },
    { n: "Um dia off abaixo de " + n1(alvoOff) + " g", feito: A.completos.some(function (d) { return d.tipo === "off" && d.n > 0 && d.g <= alvoOff; }), prog: 1 },
    { n: "Primeiro uso depois das 18h num dia útil", feito: tardeMax !== null && tardeMax >= 18, prog: tardeMax === null ? 0 : Math.max(0, (tardeMax - 12) / 6) },
    { n: "Intervalo médio acima de 3h", feito: A.gapAtual !== null && A.gapAtual >= 180, prog: A.gapAtual === null ? 0 : A.gapAtual / 180 }
  ];
  var wrap = q("#marcos"); wrap.innerHTML = "";
  lista.forEach(function (m) {
    var box = el("div", "ms");
    var top = el("div", "kv");
    var nm = el("span", "k", m.n);
    if (m.feito) nm.style.color = "var(--accent-2)";
    top.appendChild(nm);
    var st = el("span", "v", m.feito ? "feito" : n0(Math.min(100, m.prog * 100)) + "%");
    st.style.color = "var(--muted)";
    top.appendChild(st);
    var tr = el("div", "track"); var f = el("i");
    f.style.width = Math.min(100, m.prog * 100) + "%";
    f.style.background = m.feito ? "var(--accent-2)" : "var(--border-strong)";
    tr.appendChild(f);
    box.appendChild(top); box.appendChild(tr);
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
    var e = el("div", "hint", "Nenhum registro neste dia. Essa linha em branco vale mais que qualquer troféu.");
    e.style.cssText += ";padding:16px 4px;font-style:italic";
    wrap.appendChild(e);
    return;
  }
  d.regs.slice().reverse().forEach(function (r) {
    var idx = d.regs.indexOf(r);
    var gap = idx > 0 ? (r.ts - d.regs[idx - 1].ts) / 60000 : null;
    var dt = new Date(r.ts);
    var row = el("div", "tbl-r");
    row.appendChild(el("span", "h", pad2(dt.getHours()) + ":" + pad2(dt.getMinutes())));
    row.appendChild(el("span", "q hide", n1(r.q)));
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
    var edit = el("button", "btn link", "editar");
    edit.type = "button";
    edit.addEventListener("click", function () { abrirEdicao(r.id); });
    acts.appendChild(edit);
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

/* ============================== formulário ============================== */
function popularSelectHora(hh, mm) {
  for (var h = 0; h < 24; h++) { var o = el("option", null, pad2(h)); o.value = h; hh.appendChild(o); }
  for (var m = 0; m < 60; m++) { var o2 = el("option", null, pad2(m)); o2.value = m; mm.appendChild(o2); }
}
function popularHoras() {
  popularSelectHora(q("#hh"), q("#mm"));
  agora();
}
function agora() {
  var d = new Date();
  q("#hh").value = d.getHours();
  q("#mm").value = d.getMinutes();
}
function renderChips() {
  var wrap = q("#chips"); wrap.innerHTML = "";
  var vals = [1];
  for (var i = S.regs.length - 1; i >= 0 && vals.length < 6; i--) {
    var v = S.regs[i].q;
    if (!vals.some(function (x) { return Math.abs(x - v) < 0.001; })) vals.push(v);
  }
  vals.forEach(function (v) {
    var b = el("button", "chip", n1(v));
    b.type = "button"; b.tabIndex = -1;
    b.addEventListener("click", function () { q("#qtd").value = n1(v); q("#qtd").focus(); });
    wrap.appendChild(b);
  });
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
  S.regs.push({ id: "r" + dt.getTime() + "-" + Math.random().toString(36).slice(2, 7), ts: dt.getTime(), q: v, gatilho: "" });
  S.regs.sort(function (a, b) { return a.ts - b.ts; });
  q("#qtd").value = "";
  salvar(); agora(); renderChips(); render();
  st.style.color = "var(--accent-2)";
  st.textContent = "Registrado — " + pad2(hh) + ":" + pad2(mm);
  setTimeout(function () { st.textContent = ""; }, 2200);
  q("#qtd").focus();
}

/* ------------------------- edição de registro existente ------------------------- */
var editId = null;
function abrirEdicao(id) {
  var r = S.regs.find(function (x) { return x.id === id; });
  if (!r) return;
  editId = id;
  var dt = new Date(r.ts);
  var hh = q("#editHH"), mm = q("#editMM");
  hh.innerHTML = ""; mm.innerHTML = "";
  popularSelectHora(hh, mm);
  hh.value = dt.getHours(); mm.value = dt.getMinutes();
  q("#editData").value = dt.getFullYear() + "-" + pad2(dt.getMonth() + 1) + "-" + pad2(dt.getDate());
  q("#editQtd").value = n1(r.q);
  q("#editModal").style.display = "flex";
  q("#editQtd").focus();
  q("#editQtd").select();
}
function fecharEdicao() {
  q("#editModal").style.display = "none";
  editId = null;
}
function salvarEdicao() {
  if (editId === null) return;
  var r = S.regs.find(function (x) { return x.id === editId; });
  if (!r) { fecharEdicao(); return; }
  var v = parseFloat(String(q("#editQtd").value).replace(",", "."));
  if (isNaN(v) || v <= 0) { alert("Quantidade inválida."); return; }
  var partes = q("#editData").value.split("-").map(Number);
  if (partes.length !== 3 || partes.some(isNaN)) { alert("Data inválida."); return; }
  var hh = parseInt(q("#editHH").value, 10), mm = parseInt(q("#editMM").value, 10);
  r.q = v;
  r.ts = new Date(partes[0], partes[1] - 1, partes[2], hh, mm, 0, 0).getTime();
  S.regs.sort(function (a, b) { return a.ts - b.ts; });
  S.sel = chaveLogica(r.ts);
  salvar(); renderChips(); render();
  fecharEdicao();
}
q("#editSaveBtn").addEventListener("click", salvarEdicao);
q("#editCancelBtn").addEventListener("click", fecharEdicao);
q("#editQtd").addEventListener("keyup", function (e) { if (e.key === "Enter") salvarEdicao(); });
q("#editModal").addEventListener("click", function (e) { if (e.target === q("#editModal")) fecharEdicao(); });
document.addEventListener("keydown", function (e) { if (e.key === "Escape" && editId !== null) fecharEdicao(); });

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
function exportarJson() {
  baixar("backup_registros.json", JSON.stringify({
    versao: 2, exportadoEm: new Date().toISOString(),
    diaLogicoInicio: H0, registros: serializar(), tiposDia: S.tipos, config: S.cfg
  }, null, 2), "application/json");
}
function exportarCsv() {
  var linhas = ["Data,Hora,Quantidade,Motivo,TipoDia"];
  serializar().forEach(function (r) {
    var k = chaveLogica(r.timestamp);
    linhas.push([r.data, r.hora, r.quantidade, r.gatilho || "", TIPOS[tipoDe(k)].nome].map(csvEsc).join(","));
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
      novos.push({ timestamp: dt.getTime(), quantidade: parseFloat(p[2]) || 0, gatilho: (p[3] || "").trim() });
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
  if (t === "light" || t === "dark") document.documentElement.setAttribute("data-theme", t);
  else document.documentElement.removeAttribute("data-theme");
}
function aplicarConfigUI() {
  q("#cfgJanela").value = String(S.cfg.janela);
  q("#cfgMeta").value = String(S.cfg.meta);
  q("#cfgTema").value = S.cfg.tema;
  q("#cfgTom").classList.toggle("on", !!S.cfg.tom);
  q("#cfgDiscreto").classList.toggle("on", !!S.cfg.discreto);
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
q("#cfgTom").addEventListener("click", function () { S.cfg.tom = !S.cfg.tom; salvarConfig(); aplicarConfigUI(); render(); });
q("#cfgDiscreto").addEventListener("click", function () { S.cfg.discreto = !S.cfg.discreto; salvarConfig(); aplicarConfigUI(); render(); });
q("#expJson").addEventListener("click", exportarJson);
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
carregar();
q("#qtd").focus({ preventScroll: true });
