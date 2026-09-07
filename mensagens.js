/* =========================================================================
   mensagens.js — banco de frases de encorajamento
   Calibrado pelo perfil: evidência, precisão, tom de par (não de palestrante).
   Restrições duras: máx. 20 palavras, sem exclamação, sem travessão no meio
   da frase, sem chavão, sem emoji, sem pergunta retórica, sem comparação
   com outras pessoas, sem promessa de resultado.
   Arquétipos: A decomposição · B evidência · C custo · D identidade
               E permissão · F sentido
   ========================================================================= */
(function (raiz) {
  "use strict";

  var BANCO = {
    /* ---- sem histórico: A, D ---- */
    sem_dados: [
      "Comece pelo registro de agora. Esta semana será a linha de base para reduzir com direção até zero.",
      "Sem histórico ainda. Sete dias revelam o primeiro padrão que pode ser reduzido.",
      "O primeiro registro liga o instrumento. A direção já está definida: menos, com destino a zero.",
      "Medir mostra onde começar. Depois, uma situação automática será removida por vez.",
      "Registre sete dias antes de apertar a meta. A redução precisa de uma linha de base honesta.",
      "A base ainda não existe. Construí-la é o primeiro trecho da rota até zero.",
      "Hoje basta registrar e alongar o próximo intervalo quando puder.",
      "Sem número, tudo vira memória seletiva. Comece pelo dado e escolha o primeiro ponto de redução."
    ],

    /* ---- poucos dias: A, D ---- */
    poucos_dados: [
      "Poucos dias registrados, mas a rota já começou. Agora procure o primeiro intervalo que pode crescer.",
      "Ainda sem comparação válida. Continue registrando e reduza apenas uma situação automática por vez.",
      "Cada dia registrado reduz o erro da próxima estimativa.",
      "Você já passou da etapa que costuma ser abandonada: começar a medir.",
      "Amostra pequena distorce. Duas semanas completas resolvem isso.",
      "Registro incompleto ainda é registro. Vale mais que memória.",
      "Dado insuficiente para conclusão, suficiente para escolher uma redução pequena e observável.",
      "A curva ainda é ruído. Em alguns dias ela vira sinal.",
      "Nesta fase, registre e escolha o primeiro intervalo que pode ser alongado. A redução começa específica.",
      "A leitura fica confiável por acúmulo. A direção continua sendo redução sustentável até zero."
    ],

    /* ---- alta forte (delta >= 15): C, A ---- */
    alta_forte: [
      "Subiu. O ajuste mais barato agora é mexer em um horário só.",
      "Alta registrada. Corte o escopo, não a meta.",
      "Semana pesada acontece. O custo de ignorar é maior que o de olhar.",
      "Você já tem o número. Ter o número é metade do ajuste.",
      "Um pico não redefine a trajetória. Adiar o ajuste redefine.",
      "Ataque o dia de maior peso, não todos os dias de uma vez.",
      "Menos ambição por dia, mais continuidade. Isso costuma render mais.",
      "O gráfico subiu e você continuou registrando. Esse é o comportamento certo.",
      "Cada semana adiada aumenta o esforço da próxima. Escolha uma alavanca hoje.",
      "Alta clara, causa provavelmente localizada. Procure o dia, não a semana inteira."
    ],

    /* ---- alta moderada (3 a 15): A, C ---- */
    alta: [
      "Alta pequena. Um único ajuste de horário costuma dar conta.",
      "Escolha uma alavanca e ignore as outras nesta semana.",
      "Diferença ainda perto do ruído semanal. Vale acompanhar, não reagir em excesso.",
      "Meia hora a mais no primeiro intervalo já muda a média do dia.",
      "Ajuste cedo custa menos que ajuste depois de duas semanas de alta.",
      "O número subiu um pouco. O método continua válido.",
      "Mexer em uma variável por vez preserva a leitura.",
      "Ainda dá para fechar a semana no patamar anterior.",
      "Alta modesta é o momento mais barato de corrigir.",
      "Não precisa de plano novo. Precisa do mesmo plano aplicado a um dia só."
    ],

    /* ---- estável: D, A ---- */
    estavel: [
      "Patamar estável. Estabilidade é a base que permite mexer em uma coisa só.",
      "Sem variação relevante. Bom momento para testar um ajuste isolado.",
      "Constância não é estagnação. É controle.",
      "Você mantém o registro mesmo sem queda visível. Isso é método, não sorte.",
      "Platô é onde o processo aparece. Escolha a próxima variável.",
      "O número não mudou. Mudou o fato de existir número.",
      "Estável já é melhor que oscilante. Oscilação esconde causa.",
      "Sem novidade na média. Continue e o próximo degrau aparece.",
      "Regularidade primeiro, redução depois. Essa ordem economiza esforço.",
      "Você está agindo como quem administra um processo, não como quem torce por ele."
    ],

    /* ---- queda moderada: B, D ---- */
    queda: [
      "Queda registrada. Repita o que funcionou; esta é a direção até zero.",
      "O padrão está mudando na direção definida: menos agora, eliminação como destino.",
      "Menos que a semana anterior. Sustente o método antes de apertar o próximo degrau.",
      "A redução aparece nos dados, não só na percepção.",
      "Você está agindo como alguém que já resolveu isso antes.",
      "A curva desceu sem esforço heroico. Esse tipo de queda dura mais.",
      "Semana mais leve que a anterior. Repetir custa menos que recomeçar.",
      "O número caiu porque o comportamento mudou antes dele.",
      "Resultado dentro do esperado pelo seu próprio ritmo. Mantenha o ritmo.",
      "Progresso pequeno e verificável vale mais que meta grande e vaga."
    ],

    /* ---- queda forte (<= -15): B, F ---- */
    queda_forte: [
      "Queda expressiva. O trabalho já está feito, agora é não interromper.",
      "Diferença grande em relação à semana anterior. Mantenha o mesmo processo.",
      "Esse resultado é replicável. Foi método, não circunstância.",
      "O que você construiu esta semana continua valendo depois que o esforço for esquecido.",
      "Redução forte. O risco agora é concluir cedo demais que acabou.",
      "Você tem prova de que consegue repetir. Use ela na próxima semana difícil.",
      "Trajetória boa. Reduzir a ambição da próxima semana protege o resultado.",
      "Queda desse tamanho costuma vir de uma mudança pequena e mantida.",
      "Isso agora faz parte do que você é capaz de repetir.",
      "O número está bom. O que importa é o processo que produziu o número."
    ],

    /* ---- sequência longa: B, D (aceita {streak}) ---- */
    sequencia: [
      "{streak} dias seguidos dentro da linha. O padrão já existe.",
      "Sequência de {streak} dias. Agora é manutenção, não construção.",
      "{streak} dias consecutivos. Isso é evidência, não tentativa.",
      "Você repetiu {streak} vezes. Repetição é o que transforma decisão em rotina.",
      "A sequência de {streak} dias existe porque o método existe.",
      "{streak} dias sem interromper. A parte cara já foi paga.",
      "Sequência ativa há {streak} dias. Só não interrompa por distração."
    ],

    /* ---- dia sem registro: D, E ---- */
    dia_limpo: [
      "Nenhum registro hoje. A linha em branco é o dado mais forte do dia.",
      "Dia limpo até agora. Não precisa de comentário, só de continuidade.",
      "Zero hoje. Zero não pede celebração, pede repetição.",
      "Sem registro neste dia. Isso conta tanto quanto os dias cheios.",
      "Dia em branco registrado. É assim que a média desce.",
      "Nada anotado aqui. O silêncio também é informação."
    ],

    /* ---- dia pesado / fadiga: E ---- */
    dia_pesado: [
      "Hoje pesou mais que o normal. Amanhã recomeça no mínimo viável.",
      "Um dia acima da média não apaga a semana. Retome no menor esforço possível.",
      "Dia carregado. Consistência vale mais que intensidade.",
      "Você registrou mesmo num dia ruim. Isso preserva a leitura do conjunto.",
      "Cansaço é sinal de carga, não de erro de rota.",
      "Hoje o mínimo já conta. Amanhã volta ao padrão.",
      "Dia fora da curva acontece. Fora da curva não é fora do processo."
    ],

    /* ---- popup: curtas, contexto do dia ---- */
    popup_neutro: [
      "Registrado. Agora proteja o próximo intervalo; reduzir começa criando espaço.",
      "Anotado sem julgamento. A próxima direção é simples: esperar um pouco mais.",
      "Salvo. Um intervalo maior vale mais que tentar compensar depois.",
      "O dado ficou registrado. A ação agora é adiar a próxima decisão.",
      "Cada registro revela o padrão que você vai desmontar até zero.",
      "Dado agora, escolha menor na próxima vez.",
      "Registro concluído. Continue reduzindo uma situação automática por vez.",
      "Feito. O próximo passo não é perfeito; é um pouco mais distante."
    ],
    popup_limpo: [
      "Nada registrado hoje. Proteja este espaço; é assim que a eliminação começa a virar rotina.",
      "Zero até agora. Não precisa forçar nada, apenas não interrompa o que já está funcionando.",
      "Dia limpo em curso. Reconheça o que ajudou e repita sem transformar isso em cobrança.",
      "Sem registro hoje. O painel espera; a direção já está certa."
    ],
    popup_intervalo: [
      "{gap} desde o último registro. Alongue mais um pouco; cada intervalo maior reduz o automático.",
      "Último registro há {gap}. Sustentar este espaço aproxima o próximo degrau de redução.",
      "{gap} de intervalo. Proteja o que já ganhou antes da próxima decisão.",
      "Faz {gap}. Adiar mais um pouco mantém a direção até zero."
    ]
  };

  /* Histórico curto para evitar repetição imediata */
  var CHAVE_HIST = "msgHist";
  function lerHist() {
    try { return JSON.parse(localStorage.getItem(CHAVE_HIST) || "[]"); } catch (e) { return []; }
  }
  function gravarHist(h) {
    try { localStorage.setItem(CHAVE_HIST, JSON.stringify(h.slice(-14))); } catch (e) {}
  }

  function interpolar(txt, vars) {
    return String(txt).replace(/\{(\w+)\}/g, function (m, k) {
      return vars && vars[k] !== undefined && vars[k] !== null ? String(vars[k]) : "";
    });
  }

  /* escolher("queda", {streak: 8}) */
  function escolher(contexto, vars) {
    var lista = BANCO[contexto] || BANCO.popup_neutro;
    var hist = lerHist();
    var livres = lista.filter(function (f) { return hist.indexOf(f) === -1; });
    if (!livres.length) livres = lista;
    var f = livres[Math.floor(Math.random() * livres.length)];
    hist.push(f); gravarHist(hist);
    return interpolar(f, vars);
  }

  /* Escolhe o contexto a partir do estado e delega. Ordem de prioridade
     segue a tabela do perfil: estado detectado manda no arquétipo. */
  function paraEstado(est) {
    est = est || {};
    var vars = { streak: est.streak, gap: est.gap };
    if (est.semDados) return escolher("sem_dados", vars);
    if (est.poucosDados) return escolher("poucos_dados", vars);
    if (est.diaPesado) return escolher("dia_pesado", vars);
    if (est.streak >= 5 && Math.random() < 0.45) return escolher("sequencia", vars);
    var d = est.delta;
    if (d === null || d === undefined) return escolher("poucos_dados", vars);
    if (d >= 15) return escolher("alta_forte", vars);
    if (d >= 3) return escolher("alta", vars);
    if (d > -3) return escolher("estavel", vars);
    if (d > -15) return escolher("queda", vars);
    return escolher("queda_forte", vars);
  }

  raiz.MSGS = { banco: BANCO, escolher: escolher, paraEstado: paraEstado };
})(typeof window !== "undefined" ? window : this);
