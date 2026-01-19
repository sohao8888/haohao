const DEFAULT_MODEL = "gpt-4o-mini";

async function getApiKey() {
  const result = await chrome.storage.sync.get(["openaiApiKey", "openaiModel"]);
  return {
    apiKey: result.openaiApiKey || "",
    model: result.openaiModel || DEFAULT_MODEL,
  };
}

function summarizeFallback(text) {
  const sentences = text
    .replace(/\s+/g, " ")
    .split(/(?<=[。！？.!?])\s+/)
    .filter(Boolean);
  if (sentences.length <= 5) {
    return sentences.join(" ");
  }
  const head = sentences.slice(0, 3).join(" ");
  const tail = sentences.slice(-2).join(" ");
  return `${head}\n\n…\n\n${tail}`;
}

async function summarizeWithOpenAI(text) {
  const { apiKey, model } = await getApiKey();
  if (!apiKey) {
    return {
      summary: summarizeFallback(text),
      usedFallback: true,
    };
  }

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: "system",
          content:
            "You are a helpful assistant that summarizes YouTube transcripts in concise Chinese bullet points.",
        },
        {
          role: "user",
          content: `请总结以下文字记录，输出 5 条要点：\n\n${text}`,
        },
      ],
      temperature: 0.3,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI API error: ${response.status} ${errorText}`);
  }

  const data = await response.json();
  const summary = data.choices?.[0]?.message?.content?.trim();
  return {
    summary: summary || summarizeFallback(text),
    usedFallback: false,
  };
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "SUMMARIZE") {
    summarizeWithOpenAI(message.text)
      .then((result) => sendResponse({ ok: true, ...result }))
      .catch((error) =>
        sendResponse({
          ok: false,
          error: error.message,
          fallback: summarizeFallback(message.text),
        })
      );
    return true;
  }

  if (message.type === "GET_SETTINGS") {
    getApiKey().then((result) => sendResponse({ ok: true, ...result }));
    return true;
  }

  return false;
});
