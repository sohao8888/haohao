const apiKeyInput = document.getElementById("apiKey");
const modelInput = document.getElementById("model");
const statusEl = document.getElementById("status");
const saveBtn = document.getElementById("save");

function setStatus(message, isError = false) {
  statusEl.textContent = message;
  statusEl.style.color = isError ? "#c0392b" : "#2c3e50";
}

async function loadSettings() {
  const result = await chrome.storage.sync.get(["openaiApiKey", "openaiModel"]);
  apiKeyInput.value = result.openaiApiKey || "";
  modelInput.value = result.openaiModel || "gpt-4o-mini";
}

async function saveSettings() {
  const openaiApiKey = apiKeyInput.value.trim();
  const openaiModel = modelInput.value.trim() || "gpt-4o-mini";
  await chrome.storage.sync.set({ openaiApiKey, openaiModel });
  setStatus("已保存设置。", false);
}

saveBtn.addEventListener("click", () => {
  saveSettings().catch((error) =>
    setStatus(`保存失败：${error.message}`, true)
  );
});

loadSettings().catch((error) =>
  setStatus(`读取设置失败：${error.message}`, true)
);
