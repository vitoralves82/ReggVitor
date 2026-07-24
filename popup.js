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

// Valida uma string de hora "HH:MM" na faixa 00:00–23:59.
// Retorna {h, m} se válida, ou null se inválida.
function parseHoraValida(str) {
  let partes = str.split(":");
  if (partes.length < 2) return null;
  let h = parseInt(partes[0], 10);
  let m = parseInt(partes[1], 10);
  if (isNaN(h) || isNaN(m)) return null;
  if (h < 0 || h > 23 || m < 0 || m > 59) return null;
  return { h, m };
}

// Formata número trocando ponto por vírgula (padrão pt-BR)
function formatNumberBR(num) {
  return num.toFixed(1).replace(".", ",");
}

// Foca e seleciona o campo de quantidade
function focarQuantidade() {
  let el = document.getElementById("popupQuantidade");
  el.focus();
  el.select();
}

// Atualiza o resumo do dia atual exibido abaixo do botão
function atualizarResumoHoje() {
  let resumoDiv = document.getElementById("popupResumoHoje");
  let hoje = formatDate(new Date());
  chrome.storage.local.get(["registros"], function(result) {
    let registros = result.registros ? JSON.parse(result.registros) : [];
    let doDia = registros.filter(r => r.data === hoje);
    let total = doDia.reduce((soma, r) => soma + (r.quantidade || 0), 0);
    resumoDiv.textContent = `Hoje: ${doDia.length} registros, total ${formatNumberBR(total)}`;
  });
}

// Função para registrar o evento via popup e exibir mensagem "Salvo - hh:mm"
function registrarPopup() {
  let quantidadeInput = document.getElementById("popupQuantidade");
  let horaInput = document.getElementById("popupHora");
  let statusDiv = document.getElementById("popupStatus");

  // Converte vírgula para ponto
  let quantStr = quantidadeInput.value.replace(",", ".");
  let q = parseFloat(quantStr);
  if (isNaN(q)) {
    statusDiv.textContent = "Quantidade inválida!";
    statusDiv.style.color = "red";
    return;
  }

  // Usa a data atual; se o usuário informar a hora, valida e usa essa hora
  let date = new Date();
  let horaVal = horaInput.value.trim();
  if (horaVal !== "") {
    let hora = parseHoraValida(horaVal);
    if (!hora) {
      statusDiv.textContent = "Hora inválida! Use HH:MM (00:00–23:59).";
      statusDiv.style.color = "red";
      return;
    }
    date.setHours(hora.h, hora.m, 0, 0);
  }

  let registro = {
    data: formatDate(date),
    hora: formatTime(date),
    quantidade: q,
    timestamp: date.getTime()
  };

  // Recupera registros existentes do chrome.storage.local
  chrome.storage.local.get(["registros"], function(result) {
    let registros = result.registros ? JSON.parse(result.registros) : [];
    registros.push(registro);
    chrome.storage.local.set({ registros: JSON.stringify(registros) }, function() {
      // Exibe mensagem de "Salvo - hh:mm"
      statusDiv.textContent = "Salvo - " + formatTime(date);
      statusDiv.style.color = "#4CAF50";
      setTimeout(() => { statusDiv.textContent = ""; }, 2000);
      quantidadeInput.value = "";
      horaInput.value = "";
      // Limpa os campos e volta o foco para a quantidade
      focarQuantidade();
      // Atualiza o contador do dia
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
document.getElementById("popupHora").addEventListener("keyup", function(e){
  if (e.key === "Enter") registrarPopup();
});
document.getElementById("popupGotoBtn").addEventListener("click", abrirPaginaRegistros);

// Ao abrir o popup: foca a quantidade e mostra o resumo do dia
focarQuantidade();
atualizarResumoHoje();
