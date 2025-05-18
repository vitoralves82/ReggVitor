console.log("Background script carregado.");

chrome.runtime.onInstalled.addListener(() => {
    console.log("Extensão instalada com sucesso.");
});

chrome.action.onClicked.addListener((tab) => {
    console.log("Ícone da extensão clicado, abrindo index.html...");
    chrome.tabs.create({ url: chrome.runtime.getURL("index.html") });
});
