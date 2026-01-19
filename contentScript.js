function getVideoIdFromUrl() {
  const url = new URL(window.location.href);
  return url.searchParams.get("v");
}

function decodeHtml(text) {
  const textarea = document.createElement("textarea");
  textarea.innerHTML = text;
  return textarea.value;
}

function parseTranscriptXml(xmlText) {
  const parser = new DOMParser();
  const xml = parser.parseFromString(xmlText, "text/xml");
  const texts = Array.from(xml.getElementsByTagName("text"));
  return texts
    .map((node) => decodeHtml(node.textContent || ""))
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractCaptionTrackUrl() {
  const playerResponse = window.ytInitialPlayerResponse;
  const captionTracks =
    playerResponse?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
  if (!captionTracks || captionTracks.length === 0) {
    return null;
  }

  const preferredTrack =
    captionTracks.find((track) => track.languageCode?.startsWith("zh")) ||
    captionTracks.find((track) => track.languageCode?.startsWith("en")) ||
    captionTracks[0];

  return preferredTrack?.baseUrl || null;
}

async function fetchTranscript() {
  const videoId = getVideoIdFromUrl();
  if (!videoId) {
    throw new Error("未能检测到 YouTube 视频 ID。请打开一个视频页面。");
  }

  const captionUrl = extractCaptionTrackUrl();
  if (captionUrl) {
    const response = await fetch(captionUrl);
    if (response.ok) {
      const text = await response.text();
      const transcript = parseTranscriptXml(text);
      if (transcript) {
        return transcript;
      }
    }
  }

  const fallbackUrl = `https://www.youtube.com/api/timedtext?lang=en&v=${videoId}`;
  const fallbackResponse = await fetch(fallbackUrl);
  if (!fallbackResponse.ok) {
    throw new Error("未能获取视频字幕，可能未开启字幕。");
  }
  const fallbackText = await fallbackResponse.text();
  const fallbackTranscript = parseTranscriptXml(fallbackText);
  if (!fallbackTranscript) {
    throw new Error("未能解析视频字幕，请稍后重试。");
  }
  return fallbackTranscript;
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "GET_TRANSCRIPT") {
    const title =
      document.querySelector("h1.title yt-formatted-string")?.textContent ||
      document.title;
    fetchTranscript()
      .then((transcript) =>
        sendResponse({
          ok: true,
          transcript,
          title: title?.trim() || "",
          url: window.location.href,
        })
      )
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }
  return false;
});
