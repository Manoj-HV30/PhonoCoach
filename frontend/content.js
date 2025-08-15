let selectedText = "";
document.addEventListener("mouseup", () => {
  const selection = window.getSelection().toString().trim();
  if (selection) {
    selectedText = selection;
    chrome.storage.local.set({ selectedText });
  }
});
