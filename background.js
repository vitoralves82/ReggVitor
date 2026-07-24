console.log("Background script carregado.");

chrome.runtime.onInstalled.addListener(() => {
    console.log("Extensão instalada com sucesso.");
});
