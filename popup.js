const statusEl = document.getElementById("status");
const transcriptEl = document.getElementById("transcript");
const summaryEl = document.getElementById("summary");
const titleEl = document.getElementById("videoTitle");
const loadBtn = document.getElementById("loadTranscript");
const summarizeBtn = document.getElementById("summarize");
const askBtn = document.getElementById("askChatGPT");

function setStatus(message, isError = false) {
  statusEl.textContent = message;
  statusEl.style.color = isError ? "#c0392b" : "#2c3e50";
}

function updateButtons(hasTranscript) {
  summarizeBtn.disabled = !hasTranscript;
  askBtn.disabled = !hasTranscript;
}

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

async function requestTranscript() {
  setStatus("正在获取字幕...");
  const tab = await getActiveTab();
  if (!tab?.id) {
    setStatus("未找到活动标签页。", true);
    return;
  }

  chrome.tabs.sendMessage(tab.id, { type: "GET_TRANSCRIPT" }, (response) => {
    if (chrome.runtime.lastError) {
      setStatus("无法连接到视频页面，请刷新后重试。", true);
      return;
    }

    if (!response?.ok) {
      setStatus(response?.error || "获取字幕失败。", true);
      return;
    }

    transcriptEl.value = response.transcript;
    titleEl.textContent = response.title || "未知标题";
    summaryEl.value = "";
    updateButtons(true);
    setStatus("字幕已加载。", false);
  });
}

async function requestSummary() {
  const text = transcriptEl.value.trim();
  if (!text) {
    setStatus("请先获取字幕。", true);
    return;
  }

  setStatus("正在生成摘要...");
  chrome.runtime.sendMessage({ type: "SUMMARIZE", text }, (response) => {
    if (!response?.ok) {
      summaryEl.value = response?.fallback || "";
      setStatus(response?.error || "摘要生成失败，已使用本地摘要。", true);
      return;
    }

    summaryEl.value = response.summary;
    setStatus(response.usedFallback ? "已使用本地摘要。" : "摘要生成完成。", false);
  });
}

async function askChatGPT() {
  const transcript = transcriptEl.value.trim();
  const summary = summaryEl.value.trim();
  const title = titleEl.textContent.trim();
  const prompt = `视频标题：${title}\n\n文字记录：\n${transcript}\n\n摘要：\n${summary}\n\n请基于以上内容回答我的问题：`;

  try {
    await navigator.clipboard.writeText(prompt);
    setStatus("已复制提示词到剪贴板，已打开 ChatGPT。", false);
  } catch (error) {
    setStatus("无法写入剪贴板，请手动复制。", true);
  }

  const encodedPrompt = encodeURIComponent(prompt.slice(0, 2000));
  chrome.tabs.create({
    url: `https://chat.openai.com/?q=${encodedPrompt}`,
  });
}

loadBtn.addEventListener("click", requestTranscript);
summarizeBtn.addEventListener("click", requestSummary);
askBtn.addEventListener("click", askChatGPT);

updateButtons(false);
