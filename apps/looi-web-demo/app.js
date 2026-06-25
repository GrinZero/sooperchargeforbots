import { LooiRobot, WebBluetoothLooiTransport } from "@sourcebug/looi-sdk";

const els = {
  connectBtn: document.querySelector("#connectBtn"),
  replayHandshakeBtn: document.querySelector("#replayHandshakeBtn"),
  disconnectBtn: document.querySelector("#disconnectBtn"),
  clearLogBtn: document.querySelector("#clearLogBtn"),
  connState: document.querySelector("#connState"),
  deviceName: document.querySelector("#deviceName"),
  dockState: document.querySelector("#dockState"),
  lastNotify: document.querySelector("#lastNotify"),
  expressionState: document.querySelector("#expressionState"),
  micCapability: document.querySelector("#micCapability"),
  cameraCapability: document.querySelector("#cameraCapability"),
  directionCapability: document.querySelector("#directionCapability"),
  agentState: document.querySelector("#agentState"),
  promptInput: document.querySelector("#promptInput"),
  listenBtn: document.querySelector("#listenBtn"),
  stopListenBtn: document.querySelector("#stopListenBtn"),
  askBtn: document.querySelector("#askBtn"),
  simulateBadBtn: document.querySelector("#simulateBadBtn"),
  answerEndpointInput: document.querySelector("#answerEndpointInput"),
  knowledgeHintInput: document.querySelector("#knowledgeHintInput"),
  clearAnswerBtn: document.querySelector("#clearAnswerBtn"),
  answerQuality: document.querySelector("#answerQuality"),
  answerSource: document.querySelector("#answerSource"),
  answerView: document.querySelector("#answerView"),
  faceFrame: document.querySelector("#faceFrame"),
  faceLabel: document.querySelector("#faceLabel"),
  faceStatus: document.querySelector("#faceStatus"),
  baseLight: document.querySelector("#baseLight"),
  lightToggleBtn: document.querySelector("#lightToggleBtn"),
  logView: document.querySelector("#logView"),
};

const robot = new LooiRobot(new WebBluetoothLooiTransport());
const moveButtons = [...document.querySelectorAll("[data-move]")];
const headButtons = [...document.querySelectorAll("[data-head]")];
const toolButtons = [...document.querySelectorAll("[data-tool]")];
const logLines = [];

const state = {
  connected: false,
  docked: false,
  lightOn: false,
  currentFace: "idle",
  recognition: null,
  listening: false,
  lastTranscript: "",
};

const FACE_PRESETS = {
  idle: { label: "Idle", status: "waiting for dock" },
  listening: { label: "Listening", status: "capturing voice input" },
  thinking: { label: "Thinking", status: "planning tool usage" },
  searching: { label: "Searching", status: "asking answer bridge / MCP" },
  speaking: { label: "Speaking", status: "streaming markdown response" },
  happy: { label: "Happy", status: "answer completed successfully" },
  apology: { label: "Apology", status: "knowledge not found, fallback engaged" },
};

async function safelyControlRobot(label, action) {
  if (!state.connected) {
    log(`skip ${label}: robot is not connected`);
    return;
  }
  await action();
}

function log(message) {
  const line = `[${new Date().toLocaleTimeString("zh-CN", { hour12: false })}] ${message}`;
  logLines.unshift(line);
  els.logView.textContent = `${logLines.slice(0, 80).join("\n")}\n`;
}

function setConnState(value) {
  els.connState.textContent = value;
}

function setAgentState(value) {
  els.agentState.textContent = value;
}

function setDockState(value) {
  els.dockState.textContent = value;
}

function setLastNotify(value) {
  els.lastNotify.textContent = value;
}

function setFace(face, extraStatus = "") {
  const preset = FACE_PRESETS[face] ?? FACE_PRESETS.idle;
  state.currentFace = face;
  els.faceFrame.dataset.face = face;
  els.faceLabel.textContent = preset.label;
  els.faceStatus.textContent = extraStatus || preset.status;
  els.expressionState.textContent = face;
}

function setBaseLight(on) {
  els.baseLight.style.opacity = on ? "1" : "0.66";
  els.baseLight.style.setProperty("--light-fill-scale", on ? "1" : "0.35");
  state.lightOn = on;
}

function setCapability(target, value) {
  target.textContent = value;
}

async function runAction(label, action) {
  try {
    log(`▶ ${label}`);
    await action();
  } catch (error) {
    log(`✕ ${label}: ${error.message}`);
    throw error;
  }
}

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function renderInline(markdown) {
  let html = escapeHtml(markdown);
  html = html.replace(/`([^`]+)`/g, "<code>$1</code>");
  html = html.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/\*([^*]+)\*/g, "<em>$1</em>");
  html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img alt="$1" src="$2">');
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer">$1</a>');
  return html;
}

function renderMarkdown(markdown) {
  const blocks = markdown.split(/\n{2,}/).map((block) => block.trim()).filter(Boolean);
  return blocks.map((block) => {
    if (block.startsWith("```") && block.endsWith("```")) {
      const code = block.replace(/^```[a-zA-Z0-9_-]*\n?/, "").replace(/\n?```$/, "");
      return `<pre><code>${escapeHtml(code)}</code></pre>`;
    }
    if (/^###\s+/.test(block)) {
      return `<h3>${renderInline(block.replace(/^###\s+/, ""))}</h3>`;
    }
    if (/^##\s+/.test(block)) {
      return `<h2>${renderInline(block.replace(/^##\s+/, ""))}</h2>`;
    }
    if (/^#\s+/.test(block)) {
      return `<h1>${renderInline(block.replace(/^#\s+/, ""))}</h1>`;
    }
    if (/^[-*]\s+/m.test(block)) {
      const items = block.split("\n").map((line) => line.replace(/^[-*]\s+/, "").trim()).filter(Boolean);
      return `<ul>${items.map((item) => `<li>${renderInline(item)}</li>`).join("")}</ul>`;
    }
    return `<p>${renderInline(block).replace(/\n/g, "<br>")}</p>`;
  }).join("");
}

function pushAnswer(markdown, { quality = "good", source = "mock stream" } = {}) {
  els.answerView.innerHTML = renderMarkdown(markdown);
  els.answerQuality.textContent = `quality: ${quality}`;
  els.answerSource.textContent = `source: ${source}`;
}

function appendAnswerChunk(chunk) {
  const previous = els.answerView.dataset.markdown || "";
  const next = `${previous}${chunk}`;
  els.answerView.dataset.markdown = next;
  els.answerView.innerHTML = renderMarkdown(next);
}

function clearAnswer() {
  els.answerView.dataset.markdown = "";
  els.answerView.innerHTML = "";
  els.answerQuality.textContent = "quality: pending";
}

async function probeCapabilities() {
  setCapability(els.micCapability, navigator.mediaDevices?.getUserMedia ? "available" : "unsupported");
  setCapability(els.cameraCapability, navigator.mediaDevices?.getUserMedia ? "available" : "unsupported");
  setCapability(
    els.directionCapability,
    "browser hook only",
  );
}

async function requestCameraProbe() {
  if (!navigator.mediaDevices?.getUserMedia) {
    setCapability(els.cameraCapability, "unsupported");
    return;
  }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    stream.getTracks().forEach((track) => track.stop());
    setCapability(els.cameraCapability, "granted");
  } catch (error) {
    setCapability(els.cameraCapability, `blocked`);
    log(`camera probe failed: ${error.message}`);
  }
}

async function requestMicrophoneProbe() {
  if (!navigator.mediaDevices?.getUserMedia) {
    setCapability(els.micCapability, "unsupported");
    return;
  }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach((track) => track.stop());
    setCapability(els.micCapability, "granted");
  } catch (error) {
    setCapability(els.micCapability, "blocked");
    log(`microphone probe failed: ${error.message}`);
  }
}

function detectBadAnswer(markdown) {
  const normalized = markdown.toLowerCase();
  return [
    "没找到",
    "未找到",
    "找不到",
    "not found",
    "no result",
    "no relevant",
    "cannot answer",
  ].some((pattern) => normalized.includes(pattern));
}

async function performEmotionRoutine(face) {
  if (face === "apology") {
    await looiTools.apology();
    return;
  }
  if (face === "happy") {
    await looiTools.celebrate();
    return;
  }
  if (face === "thinking") {
    await looiTools.thinking();
  }
}

const looiTools = {
  async greet() {
    setFace("happy", "welcoming user");
    await safelyControlRobot("greet", async () => {
      await robot.setHead("center");
      await robot.setLight(true);
    });
    setBaseLight(true);
  },
  async focusUser() {
    setFace("listening", "orienting toward user");
    await safelyControlRobot("focus user", () => robot.setHead("up"));
  },
  async thinking() {
    setFace("thinking", "planning next robot action");
    await safelyControlRobot("thinking", () => robot.setHead("center"));
  },
  async celebrate() {
    setFace("happy", "answer landed well");
    await safelyControlRobot("celebrate", async () => {
      await robot.setLight(true);
      await robot.move("forward");
      await robot.stop();
    });
    setBaseLight(true);
  },
  async apology() {
    setFace("apology", "answer quality too weak");
    await safelyControlRobot("apology", async () => {
      await robot.setHead("down");
      await robot.setLight(false);
    });
    setBaseLight(false);
  },
  async reset() {
    setFace("idle", state.docked ? "ready on dock" : "ready");
    await safelyControlRobot("reset", async () => {
      await robot.setHead("center");
      await robot.stop();
    });
  },
};

async function fetchAnswerStream({ prompt, endpoint, hint }) {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json,text/event-stream,text/plain",
    },
    body: JSON.stringify({
      prompt,
      hint,
      channel: "web-looi-agent",
      capabilities: {
        markdown: true,
        image: true,
        streamed: true,
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`Answer bridge returned ${response.status}`);
  }

  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    const payload = await response.json();
    return {
      markdown: payload.markdown || payload.answer || "",
      source: payload.source || "answer bridge",
      quality: payload.quality || (detectBadAnswer(payload.markdown || payload.answer || "") ? "bad" : "good"),
    };
  }

  if (!response.body) {
    return {
      markdown: await response.text(),
      source: "answer bridge",
      quality: "unknown",
    };
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let markdown = "";
  let sseBuffer = "";

  for (;;) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    const chunk = decoder.decode(value, { stream: true });
    if (contentType.includes("text/event-stream")) {
      sseBuffer += chunk;
      const frames = sseBuffer.split("\n\n");
      sseBuffer = frames.pop() || "";
      for (const frame of frames) {
        const dataLines = frame
          .split("\n")
          .filter((line) => line.startsWith("data:"))
          .map((line) => line.slice(5).trimStart());
        if (!dataLines.length) {
          continue;
        }
        const payload = dataLines.join("\n");
        if (payload === "[DONE]") {
          continue;
        }
        markdown += payload;
        appendAnswerChunk(payload);
      }
      continue;
    }
    markdown += chunk;
    appendAnswerChunk(chunk);
  }

  return {
    markdown,
    source: "answer bridge stream",
    quality: detectBadAnswer(markdown) ? "bad" : "good",
  };
}

async function runAgentQuery(prompt) {
  const trimmed = prompt.trim();
  if (!trimmed) {
    throw new Error("Prompt is empty.");
  }

  clearAnswer();
  setAgentState("thinking");
  setFace("thinking");
  await performEmotionRoutine("thinking");

  const endpoint = els.answerEndpointInput.value.trim();
  const hint = els.knowledgeHintInput.value.trim();
  const canUseRemote = /^https?:\/\//.test(endpoint);

  try {
    setAgentState("searching");
    setFace("searching", "calling answer bridge");
    let result;
    if (canUseRemote) {
      result = await fetchAnswerStream({ prompt: trimmed, endpoint, hint });
    } else {
      throw new Error("Bridge URL is invalid.");
    }

    els.answerView.dataset.markdown = result.markdown;
    els.answerQuality.textContent = `quality: ${result.quality}`;
    els.answerSource.textContent = `source: ${result.source}`;

    if (!els.answerView.innerHTML.trim()) {
      pushAnswer(result.markdown, result);
    }

    if (result.quality === "bad" || detectBadAnswer(result.markdown)) {
      setAgentState("fallback");
      await performEmotionRoutine("apology");
      return;
    }

    setFace("speaking", "streaming markdown to screen");
    setAgentState("responding");
    await performEmotionRoutine("happy");
    setAgentState("done");
  } catch (error) {
    log(`answer bridge failed, using mock stream: ${error.message}`);
    setAgentState("mocking");
    setFace("searching", "bridge unavailable, using local mock");

    const mockMarkdown = [
      "# 产品知识回答",
      "",
      `已收到问题：**${trimmed}**`,
      "",
      "- 当前浏览器版会优先调用可配置的 Answer Bridge",
      "- 如果返回 Markdown 中含图片，例如：![LOOI](https://dummyimage.com/720x400/0b1422/7fa1f7&text=LOOI+Answer) 也会直接渲染",
      "- 当回答质量较差时，会切换到抱歉表情并触发低头/关灯动作",
      "",
      "## 建议接入协议",
      "",
      "```json",
      JSON.stringify({
        prompt: trimmed,
        hint: els.knowledgeHintInput.value.trim(),
        expects: ["markdown", "image", "stream"],
      }, null, 2),
      "```",
    ].join("\n");

    const chunks = mockMarkdown.match(/.{1,70}(\s|$)/g) ?? [mockMarkdown];
    for (const chunk of chunks) {
      appendAnswerChunk(chunk);
      await new Promise((resolve) => setTimeout(resolve, 80));
    }

    els.answerView.dataset.markdown = mockMarkdown;
    els.answerQuality.textContent = "quality: mock-good";
    els.answerSource.textContent = "source: local mock";
    setFace("speaking", "rendering fallback markdown");
    await performEmotionRoutine("happy");
    setAgentState("done");
  }
}

function setupSpeechRecognition() {
  const SpeechRecognition = globalThis.SpeechRecognition || globalThis.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    log("SpeechRecognition is unavailable in this browser.");
    return null;
  }

  const recognition = new SpeechRecognition();
  recognition.lang = "zh-CN";
  recognition.continuous = false;
  recognition.interimResults = true;

  recognition.addEventListener("start", () => {
    state.listening = true;
    setAgentState("listening");
    setFace("listening");
    log("speech recognition started");
  });

  recognition.addEventListener("result", (event) => {
    const transcript = Array.from(event.results)
      .map((result) => result[0]?.transcript || "")
      .join("");
    state.lastTranscript = transcript;
    els.promptInput.value = transcript;
  });

  recognition.addEventListener("end", () => {
    state.listening = false;
    setAgentState("standby");
    if (state.currentFace === "listening") {
      setFace("idle", state.docked ? "ready on dock" : "ready");
    }
    log("speech recognition ended");
  });

  recognition.addEventListener("error", (event) => {
    log(`speech recognition error: ${event.error}`);
    setAgentState("speech-error");
    setFace("apology", "speech input failed");
  });

  return recognition;
}

els.connectBtn.addEventListener("click", () => {
  void runAction("connect", async () => {
    setConnState("connecting");
    await robot.connect({
      onDock: ({ docked, hex }) => {
        state.docked = docked;
        setDockState(docked ? "docked" : "undocked");
        setLastNotify(`dock=${hex}`);
        els.faceFrame.classList.toggle("docked", docked);
        setFace(state.currentFace === "idle" ? "idle" : state.currentFace, docked ? "ready on dock" : "off dock");
        log(`dock callback: ${docked} (${hex})`);
      },
      onRawNotify: ({ characteristic, hex }) => {
        setLastNotify(`${characteristic}=${hex}`);
        log(`raw notify ${characteristic}: ${hex}`);
      },
    });
    state.connected = true;
    setConnState("connected");
    els.deviceName.textContent = robot.transport.device?.name ?? "LOOI Robot";
    setFace("idle", "connection established");
    await requestMicrophoneProbe();
    await requestCameraProbe();
  });
});

els.replayHandshakeBtn.addEventListener("click", () => {
  void runAction("replay handshake", async () => {
    await robot.handshake({ forceHandshake: true });
    setFace("thinking", "handshake replayed");
  });
});

els.disconnectBtn.addEventListener("click", () => {
  void runAction("disconnect", async () => {
    await robot.disconnect();
    state.connected = false;
    setConnState("disconnected");
    els.deviceName.textContent = "-";
    setFace("idle", "waiting for reconnect");
  });
});

els.clearLogBtn.addEventListener("click", () => {
  logLines.length = 0;
  els.logView.textContent = "";
});

els.clearAnswerBtn.addEventListener("click", () => {
  clearAnswer();
  els.answerSource.textContent = "source: cleared";
});

els.askBtn.addEventListener("click", () => {
  void runAction("ask answer bridge", () => runAgentQuery(els.promptInput.value));
});

els.simulateBadBtn.addEventListener("click", () => {
  void runAction("simulate bad answer", async () => {
    const markdown = [
      "# 抱歉",
      "",
      "没找到和这个问题相关的产品知识。",
      "",
      "- 建议补充关键词",
      "- 或稍后接入正式 answer / MCP bridge",
    ].join("\n");
    pushAnswer(markdown, { quality: "bad", source: "local simulation" });
    setAgentState("fallback");
    await performEmotionRoutine("apology");
  });
});

els.listenBtn.addEventListener("click", () => {
  void runAction("start listening", async () => {
    if (!state.recognition) {
      state.recognition = setupSpeechRecognition();
    }
    if (!state.recognition) {
      throw new Error("SpeechRecognition is unavailable.");
    }
    await requestMicrophoneProbe();
    state.recognition.start();
  });
});

els.stopListenBtn.addEventListener("click", () => {
  void runAction("stop listening", async () => {
    state.recognition?.stop();
    setFace("idle", "listening stopped");
  });
});

els.lightToggleBtn.addEventListener("click", () => {
  void runAction("toggle light", async () => {
    const next = !state.lightOn;
    await safelyControlRobot("toggle light", () => robot.setLight(next));
    setBaseLight(next);
    log(`light ${next ? "on" : "off"}`);
  });
});

moveButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const direction = button.dataset.move;
    void runAction(`move ${direction}`, async () => {
      await safelyControlRobot(`move ${direction}`, () => robot.move(direction));
      setFace("listening", `manual move ${direction}`);
    });
  });
});

headButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const direction = button.dataset.head;
    void runAction(`head ${direction}`, async () => {
      await safelyControlRobot(`head ${direction}`, () => robot.setHead(direction));
      setFace("thinking", `head ${direction}`);
    });
  });
});

document.querySelector("#stopBtn").addEventListener("click", () => {
  void runAction("stop", async () => {
    await safelyControlRobot("stop", () => robot.stop());
    setFace("idle", "motion stopped");
  });
});

toolButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const tool = button.dataset.tool;
    void runAction(`tool ${tool}`, async () => {
      if (tool === "focus-user") {
        await looiTools.focusUser();
        return;
      }
      const method = {
        greet: looiTools.greet,
        thinking: looiTools.thinking,
        celebrate: looiTools.celebrate,
        apology: looiTools.apology,
        reset: looiTools.reset,
      }[tool];
      if (!method) {
        throw new Error(`Unknown tool: ${tool}`);
      }
      await method();
    });
  });
});

probeCapabilities();
clearAnswer();
setBaseLight(false);
setFace("idle", "browser pilot ready");
pushAnswer([
  "# Browser Pilot Ready",
  "",
  "- 这里已经有 Web Bluetooth 接口",
  "- 语音输入优先走 Web Speech API",
  "- `Answer Bridge URL` 预留给后续的 answer / MCP 接口",
  "- bad answer 会切换到抱歉表情和低头动作",
].join("\n"), { quality: "bootstrap", source: "local bootstrap" });
log("LOOI browser pilot ready.");
