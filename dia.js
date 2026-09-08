"use strict";

/* =========================================================================
   dia.js — dia lógico, tipo de dia e as referências derivadas deles.

   Compartilhado pelo painel (index.html) e pelo registro rápido
   (popup.html) para que as duas telas usem a MESMA régua. Comparar o dia
   de hoje com a média de todos os dias mistura populações diferentes:
   com dias off pesando mais que dias úteis, quase todo dia off aparece
   como "acima da média" e quase todo dia útil como "abaixo", e o aviso
   deixa de orientar qualquer decisão.

   Regras:
   - O dia lógico começa às 04:00 (madrugada pertence ao dia anterior).
   - O tipo do dia vem de tiposDia (correção manual) ou do dia da semana.
   - A linha de um tipo é a MEDIANA dos dias completos daquele tipo.
     Mediana e não média porque um único dia atípico deslocaria a régua
     do dia seguinte.
   - O dia de hoje nunca entra na própria referência: ainda está aberto.
   ========================================================================= */
(function (raiz) {
  "use strict";

  var H0 = 4;                 // hora de virada do dia lógico
  var MIN_AMOSTRA = 3;        // dias completos do tipo para a linha ser específica

  var NOMES = { home: "Home office", office: "Escritório", off: "Dia off" };
  var ROTULOS = { home: "home office", office: "escritório", off: "dia off" };
  var PLURAIS = { home: "dias de home office", office: "dias de escritório", off: "dias off" };
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
  function media(a) { return a.length ? a.reduce(function (s, v) { return s + v; }, 0) / a.length : 0; }

  /* Série contínua de dias lógicos, do primeiro registro até hoje. Dias sem
     registro entram com 0 g: são eles que puxam a linha para baixo e não
     podem sumir do denominador. */
  function serieBase(registros, tipos) {
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
    var chaves = Object.keys(porDia).sort();
    if (!chaves.length) return [];
    var k1 = hoje();
    var ultima = chaves[chaves.length - 1];   // registro com data futura não trunca a série
    var fim = chaveParaData(ultima > k1 ? ultima : k1);
    var dias = [];
    for (var d = chaveParaData(chaves[0]); d <= fim; d.setDate(d.getDate() + 1)) {
      var k = chaveDe(d);
      var v = porDia[k] || { n: 0, g: 0 };
      dias.push({ chave: k, n: v.n, g: v.g, tipo: tipoDe(k, tipos), completo: k !== k1 });
    }
    return dias;
  }

  /* Linha de cada tipo: mediana dos dias completos daquele tipo. */
  function baseTipoDe(completos) {
    var out = {};
    ORDEM.forEach(function (t) {
      out[t] = mediana(completos.filter(function (d) { return d.tipo === t; }).map(function (d) { return d.g; }));
    });
    return out;
  }
  function contaTipo(completos, tipo) {
    return completos.filter(function (d) { return d.tipo === tipo; }).length;
  }

  /* Fator que a meta de redução impõe sobre a linha de cada tipo de dia.
     É o mesmo cálculo do painel: a média móvel principal no início da
     janela é a âncora, a meta é composta ao longo dos meses da janela e o
     resultado vira uma razão sobre a mediana global. */
  function ratioMetaDe(dias, completos, cfg, roll) {
    cfg = cfg || {};
    var janela = cfg.janela || 90;
    var mmP = Math.max(2, cfg.mmPrinc || 20);
    var jan = dias.slice(Math.max(0, dias.length - janela));
    if (!roll) {
      roll = dias.map(function (d, i) {
        var s = dias.slice(Math.max(0, i - (mmP - 1)), i + 1);
        return s.reduce(function (a, x) { return a + x.g; }, 0) / s.length;
      });
    }
    var ancora = jan.length ? roll[dias.length - jan.length] : 0;
    var alvoPrinc = ancora * Math.pow(1 - (cfg.meta || 0) / 100, jan.length / 30);
    var medGlobal = completos.length ? mediana(completos.map(function (d) { return d.g; })) : 0;
    return {
      ratioMeta: (medGlobal > 0 && alvoPrinc > 0) ? Math.min(1, alvoPrinc / medGlobal) : 1,
      alvoPrinc: alvoPrinc,
      medGlobal: medGlobal
    };
  }

  /* Tudo o que o popup precisa para comparar o dia com a régua certa.
     Com menos de MIN_AMOSTRA dias completos daquele tipo a mediana ainda é
     ruído: cai para a média diária dos dias completos recentes e marca
     generica = true, para a frase avisar o que falta. */
  function referenciaDoDia(registros, tipos, cfg, chave) {
    var k = chave || hoje();
    var dias = serieBase(registros, tipos);
    var completos = dias.filter(function (d) { return d.completo && d.chave !== k; });
    var tipo = tipoDe(k, tipos);
    var alvo = null;
    for (var i = 0; i < dias.length; i++) if (dias[i].chave === k) { alvo = dias[i]; break; }

    var baseTipo = baseTipoDe(completos);
    var m = ratioMetaDe(dias, completos, cfg);
    var res = {
      chave: k,
      tipo: tipo,
      nome: NOMES[tipo],
      rotulo: ROTULOS[tipo],
      plural: PLURAIS[tipo],
      total: alvo ? alvo.g : 0,
      n: alvo ? alvo.n : 0,
      base: null,
      alvoMeta: null,
      amostra: contaTipo(completos, tipo),
      generica: false,
      diasCompletos: completos.length,
      ratioMeta: m.ratioMeta
    };
    if (res.amostra >= MIN_AMOSTRA && baseTipo[tipo] > 0) {
      res.base = baseTipo[tipo];
    } else if (completos.length >= MIN_AMOSTRA) {
      var recentes = completos.slice(-7);
      res.base = media(recentes.map(function (d) { return d.g; }));
      res.generica = true;
    }
    if (res.base !== null && res.base > 0) res.alvoMeta = res.base * m.ratioMeta;
    return res;
  }

  raiz.RA_DIA = {
    H0: H0,
    MIN_AMOSTRA: MIN_AMOSTRA,
    NOMES: NOMES,
    ROTULOS: ROTULOS,
    PLURAIS: PLURAIS,
    ORDEM: ORDEM,
    pad2: pad2,
    chaveLogica: chaveLogica,
    chaveDe: chaveDe,
    chaveParaData: chaveParaData,
    hoje: hoje,
    tipoPadrao: tipoPadrao,
    tipoDe: tipoDe,
    mediana: mediana,
    media: media,
    serieBase: serieBase,
    baseTipoDe: baseTipoDe,
    contaTipo: contaTipo,
    ratioMetaDe: ratioMetaDe,
    referenciaDoDia: referenciaDoDia
  };
})(typeof window !== "undefined" ? window : this);
