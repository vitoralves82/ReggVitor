/* =========================================================================
   mensagens.js — banco de frases de encorajamento
   Calibrado pelo perfil: evidência, precisão, tom de par (não de palestrante).
   Restrições duras: máx. 20 palavras, sem exclamação, sem travessão no meio
   da frase, sem chavão, sem emoji, sem pergunta retórica, sem comparação
   com outras pessoas, sem promessa de resultado.
   Arquétipos: A decomposição · B evidência · C custo · D identidade
               E permissão · F sentido
   Rotação: cada contexto percorre quase todo o próprio banco antes de repetir.
   ========================================================================= */
(function (raiz) {
  "use strict";

  var BANCO = {
    /* ---- sem histórico: A, D ---- */
    sem_dados: [
      "Comece pelo registro mais fácil: o de agora. O resto se organiza depois.",
      "Sem histórico ainda. Uma semana de dados já mostra o padrão que você quer mexer.",
      "O primeiro registro não muda nada. Ele só liga o instrumento.",
      "Medir não é compromisso com meta. É compromisso com saber onde você está.",
      "Você lida com dado o dia inteiro. Aqui não precisa ser diferente.",
      "Registre sete dias antes de julgar qualquer coisa. Julgar cedo distorce.",
      "A base ainda não existe. Construir base é a parte mais barata do processo.",
      "Nada aqui exige mudança hoje. Só registro.",
      "O instrumento é simples de propósito. A dificuldade real é a repetição.",
      "Sem número, tudo vira memória seletiva. Comece pelo número.",
      "A tela vazia não é cobrança. É um campo em branco esperando um dado.",
      "Você não precisa de plano antes de ter medição. A ordem é a inversa.",
      "Registrar hoje custa dez segundos. Reconstruir de memória custa a precisão toda.",
      "Antes de decidir qualquer corte, tenha o retrato. Sem retrato não há corte inteligente.",
      "Comece sem meta. Meta sem linha de base é chute com nome bonito.",
      "O painel só fica útil depois de alguns dias. Essa é a única exigência.",
      "Nenhuma linha registrada ainda. A próxima é a mais fácil de todas.",
      "Um dado hoje vale mais que uma estimativa perfeita amanhã.",
      "O objetivo agora é técnico: montar amostra. Nada além disso.",
      "Registro não é confissão. É leitura de instrumento."
    ],

    /* ---- poucos dias: A, D ---- */
    poucos_dados: [
      "Poucos dias registrados, mas o instrumento já está de pé. Essa era a parte difícil.",
      "Ainda sem comparação válida. Continue registrando, a leitura melhora sozinha.",
      "Cada dia registrado reduz o erro da próxima estimativa.",
      "Você já passou da etapa que costuma ser abandonada: começar a medir.",
      "Amostra pequena distorce. Duas semanas completas resolvem isso.",
      "Registro incompleto ainda é registro. Vale mais que memória.",
      "Dado insuficiente para conclusão, suficiente para hábito.",
      "A curva ainda é ruído. Em alguns dias ela vira sinal.",
      "Nesta fase o objetivo não é reduzir nada. É não perder registro.",
      "A leitura fica confiável por acúmulo, não por esforço.",
      "Está cedo para tirar média. Não está cedo para manter a série.",
      "O painel ainda mostra pouco porque a amostra é pequena. Isso se resolve com dias.",
      "Você está construindo a linha de base. Ela só existe uma vez.",
      "Sem duas semanas fechadas, qualquer variação parece maior do que é.",
      "Nada aqui pede disciplina heroica. Pede continuidade banal.",
      "O trabalho desta semana é só um: não deixar buraco na série.",
      "A comparação chega sozinha. Até lá, registre e ignore o número.",
      "Poucos dados, muita informação futura. Essa troca compensa.",
      "Você está na fase mais chata e mais determinante do processo.",
      "Faltam dias, não método. O método já está certo."
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
      "Alta clara, causa provavelmente localizada. Procure o dia, não a semana inteira.",
      "Pico registrado com precisão. Isso é diagnóstico, não sentença.",
      "A alta tem endereço: veja qual tipo de dia carregou o total.",
      "Reduza o problema a uma variável antes de tentar resolver.",
      "Semana fora da curva não apaga a série. Só pede leitura.",
      "O caro aqui não é o pico. É repetir o pico sem perceber.",
      "Você tem duas informações: subiu, e onde subiu. A segunda é a útil.",
      "Não recomece o plano. Aplique o mesmo plano a um dia específico.",
      "Alta desse tamanho geralmente vem de dois ou três dias, não de sete.",
      "O instrumento funcionou: mostrou o que você não queria ver.",
      "Ajuste pequeno e imediato vale mais que reforma completa na semana que vem."
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
      "Não precisa de plano novo. Precisa do mesmo plano aplicado a um dia só.",
      "Variação nessa faixa costuma ser um dia, não uma tendência.",
      "Corrigir agora exige minutos. Corrigir depois exige semana.",
      "A média móvel ainda está no seu controle. Use isso.",
      "Antes de mudar comportamento, olhe qual horário puxou o total.",
      "Subida leve. O risco é tratar como normal por três semanas seguidas.",
      "Um dia de atenção resolve o que uma semana de esforço difuso não resolve.",
      "Você percebeu a alta pelo dado, não pela sensação. Isso é o ponto.",
      "Escolha o alvo mais fácil. Facilidade aqui é estratégia, não preguiça.",
      "O patamar ainda é o seu. Só precisa de um ajuste localizado.",
      "Nada indica perda de controle. Indica um ajuste pendente."
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
      "Você está agindo como quem administra um processo, não como quem torce por ele.",
      "Semana previsível. Previsibilidade é o que torna um teste interpretável.",
      "Nada a corrigir com urgência. Há algo a testar com calma.",
      "O patamar se manteve sem esforço extra. Isso também é resultado.",
      "Com a média parada, qualquer ajuste isolado fica fácil de medir.",
      "Zero variação é um bom lugar para escolher a próxima alavanca.",
      "Estabilidade dá espaço para experimento. Aproveite antes de mudar tudo.",
      "A série está limpa. Séries limpas respondem perguntas.",
      "Sem queda, sem alta. Continua sendo dado bom.",
      "Você está segurando o patamar. Segurar é pré-requisito de descer.",
      "O mesmo número duas semanas seguidas indica processo, não acaso."
    ],

    /* ---- queda moderada: B, D ---- */
    queda: [
      "Queda registrada. Isso não foi sorte, foi repetição.",
      "O padrão está mudando na direção que você definiu.",
      "Menos que a semana anterior. Continue no mesmo método.",
      "A redução aparece nos dados, não só na percepção.",
      "Você está agindo como alguém que já resolveu isso antes.",
      "A curva desceu sem esforço heroico. Esse tipo de queda dura mais.",
      "Semana mais leve que a anterior. Repetir custa menos que recomeçar.",
      "O número caiu porque o comportamento mudou antes dele.",
      "Resultado dentro do esperado pelo seu próprio ritmo. Mantenha o ritmo.",
      "Progresso pequeno e verificável vale mais que meta grande e vaga.",
      "Queda medida, não estimada. A diferença entre as duas é tudo.",
      "Duas semanas comparáveis, uma menor. Isso é evidência de método.",
      "O ajuste que você fez está aparecendo no total. Não mexa em mais nada.",
      "Descer devagar é a forma que se sustenta.",
      "Você tem agora um dado que serve de referência para as próximas semanas.",
      "A redução não pede comemoração. Pede continuidade.",
      "Nada nesse resultado depende de motivação. Depende do que já está montado.",
      "Menor que a anterior, com registro completo. As duas coisas juntas importam.",
      "O processo entregou. Deixe rodar mais uma semana antes de mudar algo.",
      "Queda consistente com o que você vinha fazendo. Sem surpresa, e isso é bom."
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
      "O número está bom. O que importa é o processo que produziu o número.",
      "Resultado forte e medido. Guarde a referência, ela será útil depois.",
      "A queda foi grande o suficiente para não ser ruído. Isso é raro e é seu.",
      "Você mudou o patamar, não só a semana.",
      "O melhor uso desse resultado é não tentar superá-lo imediatamente.",
      "Mantenha as condições que produziram isso antes de introduzir qualquer meta nova.",
      "Semana bem abaixo da anterior, com série completa. Nada aqui é sorte.",
      "Esse é o tipo de dado que sustenta decisão, não só ânimo.",
      "Você tem uma referência nova de possível. Ela não expira.",
      "Grande queda pede consolidação, não aceleração.",
      "O que aconteceu aqui é reproduzível. É por isso que conta."
    ],

    /* ---- sequência longa: B, D (aceita {streak}) ---- */
    sequencia: [
      "{streak} dias seguidos dentro da linha. O padrão já existe.",
      "Sequência de {streak} dias. Agora é manutenção, não construção.",
      "{streak} dias consecutivos. Isso é evidência, não tentativa.",
      "Você repetiu {streak} vezes. Repetição é o que transforma decisão em rotina.",
      "A sequência de {streak} dias existe porque o método existe.",
      "{streak} dias sem interromper. A parte cara já foi paga.",
      "Sequência ativa há {streak} dias. Só não interrompa por distração.",
      "{streak} dias na sua própria linha. A linha é sua, a comparação também.",
      "Manter {streak} dias exigiu menos esforço do que começar. Continue nessa lógica.",
      "{streak} dias de série limpa. Isso muda o custo de continuar.",
      "A cada dia dessa sequência, recomeçar fica mais caro. Use isso a favor.",
      "{streak} dias. O comportamento já não depende de decisão diária.",
      "Sequência de {streak} dias sem heroísmo. É esse tipo que dura.",
      "{streak} registros dentro do esperado. Previsibilidade construída."
    ],

    /* ---- dia sem registro: D, E ---- */
    dia_limpo: [
      "Nenhum registro hoje. A linha em branco é o dado mais forte do dia.",
      "Dia limpo até agora. Não precisa de comentário, só de continuidade.",
      "Zero hoje. Zero não pede celebração, pede repetição.",
      "Sem registro neste dia. Isso conta tanto quanto os dias cheios.",
      "Dia em branco registrado. É assim que a média desce.",
      "Nada anotado aqui. O silêncio também é informação.",
      "Um dia sem linha nenhuma. Some isso à série e pronto.",
      "Vazio por escolha é diferente de vazio por esquecimento. Este é o primeiro.",
      "Nenhuma entrada. O painel não precisa de mais nada hoje.",
      "Dia sem uso registrado. Ele entra na conta exatamente como os outros."
    ],

    /* ---- dia pesado / fadiga: E ---- */
    dia_pesado: [
      "Hoje pesou mais que o normal. Amanhã recomeça no mínimo viável.",
      "Um dia acima da média não apaga a semana. Retome no menor esforço possível.",
      "Dia carregado. Consistência vale mais que intensidade.",
      "Você registrou mesmo num dia ruim. Isso preserva a leitura do conjunto.",
      "Cansaço é sinal de carga, não de erro de rota.",
      "Hoje o mínimo já conta. Amanhã volta ao padrão.",
      "Dia fora da curva acontece. Fora da curva não é fora do processo.",
      "O dado de hoje é alto e é honesto. As duas coisas importam.",
      "Nada a resolver hoje. Amanhã tem informação suficiente para ajustar.",
      "Dia difícil registrado sem maquiagem. Isso mantém o painel confiável.",
      "Acima da sua mediana. Registre e siga, análise fica para depois.",
      "Um dia pesado no meio de uma série boa continua sendo série boa."
    ],

    /* ---- popup: curtas, contexto do dia ---- */
    popup_neutro: [
      "Registrado. Medir já é parte do ajuste.",
      "Anotado. O número de hoje é dado, não julgamento.",
      "Salvo. Continue no mesmo método.",
      "O instrumento está funcionando porque você o alimenta.",
      "Cada registro melhora a qualidade da próxima leitura.",
      "Dado bruto agora, decisão depois.",
      "Você está medindo. Essa é a parte que a maioria pula.",
      "Registro feito. Nada mais é exigido de você neste momento.",
      "Anotado com hora certa. Precisão é o que torna o painel útil.",
      "Mais uma linha na série. A série é o ativo.",
      "Registrado sem drama. É assim que funciona melhor.",
      "Feito. O resto do painel se atualiza sozinho.",
      "Um registro a mais, um ponto cego a menos.",
      "Salvo. A leitura do dia já mudou com isso.",
      "Agora proteja o próximo intervalo; reduzir começa criando espaço.",
      "Anotado. Amanhã esse dado explica alguma coisa."
    ],
    popup_limpo: [
      "Nada registrado hoje. Essa linha em branco vale mais que qualquer marco.",
      "Zero até agora. Repetição é o que constrói a média.",
      "Dia limpo em curso. Continue sem transformar isso em tarefa.",
      "Sem registro hoje. O painel espera, não cobra.",
      "Nenhuma entrada ainda. Nada precisa ser decidido agora.",
      "Dia em branco até aqui. Ele já está contando a seu favor.",
      "Zero registros. O instrumento está pronto se você precisar dele.",
      "Ainda nada hoje. Esse tipo de dia move a média mais que qualquer esforço."
    ],
    /* ---- popup: bem abaixo da média diária (< 50%) ---- */
    popup_folga: [
      "Dia leve até agora. Ainda cabem {resta} g antes de encostar na sua média.",
      "Você está bem abaixo da média diária. Esse tipo de dia é o que move a curva.",
      "Restam {resta} g de folga. Nada aqui exige esforço extra hoje.",
      "Bem longe da média de {alvo} g. O dia já está trabalhando a seu favor.",
      "Metade do orçamento intacta. Dias assim puxam a média para baixo sozinhos.",
      "Distância confortável até {alvo} g. Só não force a barra para compensar.",
      "O número de hoje está baixo por enquanto. Registrar cedo é o que mantém isso visível.",
      "Você está com {resta} g de margem. Margem não precisa ser usada.",
      "Ritmo abaixo do seu padrão. Repetir isso duas vezes já muda a semana.",
      "Folga de {resta} g. O melhor uso dela costuma ser não usá-la.",
      "Hoje está mais leve que a sua média. Vale notar o que está diferente.",
      "Longe do limite de {alvo} g. Esse é o cenário em que a decisão fica barata."
    ],
    /* ---- popup: metade do caminho (50 a 85%) ---- */
    popup_meio: [
      "Metade do caminho até a média. Restam {resta} g antes de igualar {alvo} g.",
      "Você está dentro da faixa normal. A partir daqui cada registro pesa mais.",
      "Faltam {resta} g para a média diária. Ainda dá para fechar abaixo.",
      "Dia dentro do padrão até agora. O intervalo é a variável mais barata daqui em diante.",
      "Restam {resta} g de margem. Alongar o próximo intervalo costuma resolver.",
      "Você está no meio do orçamento de {alvo} g. Nada perdido, nada decidido.",
      "Ritmo parecido com a sua média. Um ajuste pequeno já muda o fechamento.",
      "Sobram {resta} g. Bom momento para escolher deliberadamente o próximo horário.",
      "Meio do dia, meio do orçamento. A conta ainda fecha abaixo.",
      "Você está na faixa média. Fechar abaixo depende do próximo registro, não do dia todo.",
      "Restam {resta} g até {alvo} g. Ainda é uma decisão, não uma consequência.",
      "Dentro do esperado. Daqui para frente vale medir intervalo, não quantidade."
    ],
    /* ---- popup: encostando na média (85 a 100%) ---- */
    popup_perto: [
      "Perto da média: faltam {resta} g para igualar {alvo} g.",
      "Você está encostando no seu padrão diário. O próximo registro decide o dia.",
      "Restam só {resta} g de margem. Segurar o intervalo agora vale mais que qualquer meta.",
      "Quase na média de {alvo} g. Fechar abaixo ainda está ao alcance.",
      "Margem curta: {resta} g. Adiar o próximo em uma hora costuma bastar.",
      "Você está no limite do seu padrão. Nada de grave, só sem folga.",
      "Falta pouco para {alvo} g. O dia ainda pode fechar do lado de baixo.",
      "A margem caiu para {resta} g. É o momento em que o intervalo rende mais.",
      "Está no fio da média. Um registro a menos hoje muda a semana inteira.",
      "Perto do teto do dia. Vale decidir agora, não depois do impulso.",
      "Restam {resta} g. Dado exposto na hora certa é metade do ajuste.",
      "Você chegou ao seu nível médio. Daqui para cima é acréscimo, não rotina."
    ],
    /* ---- popup: acima da média diária ---- */
    popup_acima: [
      "Hoje passou a média diária em {excesso} g. Amanhã a contagem recomeça.",
      "Acima de {alvo} g. Um dia fora da faixa não desfaz a série.",
      "Excesso de {excesso} g em relação ao seu padrão. Registrar isso já é o ajuste.",
      "O dia ficou acima da média. Retome amanhã no menor esforço possível.",
      "Passou {excesso} g do normal. Vale olhar o horário em que a curva subiu.",
      "Dia acima da linha. A média de sete dias absorve isso sem drama.",
      "Você está {excesso} g além de {alvo} g. Interromper agora ainda limita o total.",
      "Acima do padrão. O dado importa mais que a explicação do dia.",
      "Excedeu a média diária. O próximo registro é opcional, não automático.",
      "Hoje pesou mais. Um dia fora não muda o patamar, uma semana sim.",
      "Passou da faixa em {excesso} g. Anote o gatilho enquanto está fresco.",
      "Acima de {alvo} g hoje. Amanhã começa no zero, sem juros."
    ],
    popup_intervalo: [
      "{gap} desde o último registro. Intervalo é a variável mais barata de mexer.",
      "Último registro há {gap}. Alongar o intervalo costuma render mais que cortar quantidade.",
      "{gap} de intervalo. O número já está do seu lado.",
      "Faz {gap}. Adiar mais um pouco custa pouco agora.",
      "{gap} sem registro. Esse espaço é o que aparece na média do dia.",
      "Intervalo de {gap} construído. Ele conta mesmo que o dia termine alto.",
      "{gap} desde o anterior. Cada meia hora aqui pesa no total.",
      "Último uso há {gap}. Você já está acima do seu intervalo médio típico."
    ]
  };

  /* Histórico por contexto: percorre quase todo o banco antes de repetir */
  var CHAVE_HIST = "msgHist2";
  function lerHist() {
    try { return JSON.parse(localStorage.getItem(CHAVE_HIST) || "{}") || {}; } catch (e) { return {}; }
  }
  function gravarHist(h) {
    try { localStorage.setItem(CHAVE_HIST, JSON.stringify(h)); } catch (e) {}
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
    var usados = Array.isArray(hist[contexto]) ? hist[contexto] : [];
    var livres = lista.filter(function (f) { return usados.indexOf(f) === -1; });
    if (!livres.length) { usados = []; livres = lista; }
    var f = livres[Math.floor(Math.random() * livres.length)];
    usados.push(f);
    hist[contexto] = usados.slice(-Math.max(1, lista.length - 3));
    gravarHist(hist);
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
