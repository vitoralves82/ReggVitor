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
  
  // Usa a data atual; se o usuário informar a hora, usa essa hora
  let date = new Date();
  let horaVal = horaInput.value.trim();
  if (horaVal !== "") {
    let partes = horaVal.split(":");
    if (partes.length >= 2) {
      date.setHours(parseInt(partes[0]), parseInt(partes[1]), 0, 0);
    }
  }
  
  let registro = {
    data: formatDate(date),
    hora: formatTime(date),
    quantidade: q,
    timestamp: date.getTime(),
    tempoDesdeUltimo: "-"
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
