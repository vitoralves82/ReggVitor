"use strict";

/* =========================================================================
   dia.js — regras de dia lógico e de tipo de dia, compartilhadas
   pelo painel (index.html) e pelo registro rápido (popup.html).

   Existe para que as duas telas respondam a mesma pergunta do mesmo jeito:
   "este dia está acima ou abaixo da linha do MESMO tipo de dia?".
   Comparar um sábado com a média de todos os dias mistura populações
   diferentes e produz um alerta que não orienta nada.

   Regras:
   - O dia lógico começa às 04:00 (madrugada pertence ao dia anterior).
   - O tipo do dia vem de tiposDia (correção manual) ou do dia da semana.
   - A linha de referência é a MEDIANA dos dias completos do mesmo tipo.
     Mediana e não média porque um único dia atípico desloca a média e
     faria a régua do dia seguinte mentir.
   - O dia de hoje nunca entra na própria linha: ainda está aberto.
   ========================================================================= */
(function (raiz) {
  "use strict";

  var H0 = 4;                 // hora de virada do dia lógico
  var MIN_AMOSTRA = 3;        // dias completos do tipo para a linha ser específica

  var NOMES = { home: "Home office", office: "Escritório", off: "Dia off" };
  var ORDEM = ["home", "office", "off"];

  function pad2(v) { return String(v).padStart(2, "0"); }

  function chaveLogica(ts) {
    var d = new Date(ts - H0 * 3600000);
    return d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate());
  }
  function chaveDe(d) { return d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate()); }
  function chaveParaData(k) { var p = k.split("-").map(Number); return new Date(p[0], p[1] - 1, p[2]); }
  function hoje() { return chaveLogica(Date.now()); }

  /* Padrão pelo dia da semana quando não há correção manual. */
  function tipoPadrao(k) {
    var wd = chaveParaData(k).getDay();
    if (wd === 0 || wd === 6) return "off";
    return (wd === 2 || wd === 4) ? "office" : "home";
  }
  function tipoDe(k, tipos) {
    if (tipos && tipos[k] && NOMES[tipos[k]]) return tipos[k];
    return tipoPadrao(k);
  }

  function mediana(a) {
    if (!a.length) return 0;
    var s = a.slice().sort(function (x, y) { return x - y; });
    var i = Math.floor(s.length / 2);
    return s.length % 2 ? s[i] : (s[i - 1] + s[i]) / 2;
  }

  /* Série contínua de dias lógicos do primeiro registro até hoje.
     Dias sem registro entram com 0 g: eles são a informação mais
     importante da série e não podem sumir do denominador. */
  function serieDias(registros, tipos) {
    var porDia = {};
    (registros || []).forEach(function (r) {
      var ts = parseInt(r.timestamp != null ? r.timestamp : r.ts, 10);
      if (isNaN(ts)) return;
      var q = parseFloat(r.quantidade != null ? r.quantidade : r.q) || 0;
      var k = chaveLogica(ts);
      if (!porDia[k]) porDia[k] = { n: 0, g: 0 };
      porDia[k].n++;
      porDia[k].g += q;
    });
    var chaves = Object.keys(porDia);
    if (!chaves.length) return [];
    chaves.sort();
    var k1 = hoje();
    var dias = [];
    /* Registro com data futura (edição manual) não pode truncar a série. */
    var ultima = chaves[chaves.length - 1];
    var fim = chaveParaData(ultima > k1 ? ultima : k1);
    for (var d = chaveParaData(chaves[0]); d <= fim; d.setDate(d.getDate() + 1)) {
      var k = chaveDe(d);
      var v = porDia[k] || { n: 0, g: 0 };
      dias.push({ chave: k, n: v.n, g: v.g, tipo: tipoDe(k, tipos), completo: k !== k1 });
    }
    return dias;
  }

  /* Linha de referência de um dia: mediana dos dias completos do mesmo tipo.
     Com menos de MIN_AMOSTRA dias daquele tipo a mediana ainda é ruído, e
     nesse caso vale mais a linha geral, sinalizada por generica = true. */
  function linhaDoDia(registros, tipos, chave) {
    var k = chave || hoje();
    var dias = serieDias(registros, tipos);
    var completos = dias.filter(function (d) { return d.completo && d.chave !== k; });
    var tipo = tipoDe(k, tipos);
    var doTipo = completos.filter(function (d) { return d.tipo === tipo; });
    var alvo = dias.filter(function (d) { return d.chave === k; })[0];

    var res = {
      chave: k,
      tipo: tipo,
      nome: NOMES[tipo],
      total: alvo ? alvo.g : 0,
      n: alvo ? alvo.n : 0,
      base: null,
      amostra: 0,
      generica: false,
      diasCompletos: completos.length
    };
    if (doTipo.length >= MIN_AMOSTRA) {
      res.base = mediana(doTipo.map(function (d) { return d.g; }));
      res.amostra = doTipo.length;
    } else if (completos.length >= MIN_AMOSTRA) {
      res.base = mediana(completos.map(function (d) { return d.g; }));
      res.amostra = completos.length;
      res.generica = true;
    }
    return res;
  }

  raiz.RA_DIA = {
    H0: H0,
    MIN_AMOSTRA: MIN_AMOSTRA,
    NOMES: NOMES,
    ORDEM: ORDEM,
    pad2: pad2,
    chaveLogica: chaveLogica,
    chaveDe: chaveDe,
    chaveParaData: chaveParaData,
    hoje: hoje,
    tipoPadrao: tipoPadrao,
    tipoDe: tipoDe,
    mediana: mediana,
    serieDias: serieDias,
    linhaDoDia: linhaDoDia
  };
})(typeof window !== "undefined" ? window : this);
