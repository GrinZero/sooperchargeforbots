import {
  LOOI_CHARACTERISTICS,
  LOOI_DRIVE_VALUES,
  LOOI_HEAD_VALUES,
  LOOI_LIGHT_VALUES,
  LOOI_SERVICE_UUID,
  bytesToHex,
  hexToBytes,
  normalizeHex,
} from "@soopercharge/looi-sdk";


const COMMANDS = [
  {
    name: "吸附触发 028202 第 1 帧",
    charKey: "fe00",
    payload: "0000000002003203020002023203051e02092802",
    desc: "2026-06-24 12:43 最新 HCI：手机吸附后，官方 App 启动 `action:028202` 的第 1 帧。",
    tags: ["fe00", "dock", "sensor", "028202", "frame-1"],
    verified: true,
  },
  {
    name: "吸附触发 028202 第 2 帧",
    charKey: "fe00",
    payload: "01000b5003101e02130002145f0332000235eb02",
    desc: "2026-06-24 12:43 最新 HCI：`action:028202` 第 2 帧。",
    tags: ["fe00", "dock", "sensor", "028202", "frame-2"],
    verified: true,
  },
  {
    name: "吸附触发 028202 第 3 帧",
    charKey: "fe00",
    payload: "020039eb023c00024500024814024f1402520002",
    desc: "2026-06-24 12:43 最新 HCI：`action:028202` 第 3 帧。",
    tags: ["fe00", "dock", "sensor", "028202", "frame-3"],
    verified: true,
  },
  {
    name: "吸附触发 028202 第 4 帧",
    charKey: "fe00",
    payload: "03006c00026e5f0370e10274460375d7027ae102",
    desc: "2026-06-24 12:43 最新 HCI：`action:028202` 第 4 帧。",
    tags: ["fe00", "dock", "sensor", "028202", "frame-4"],
    verified: true,
  },
  {
    name: "吸附触发 028202 第 5 帧",
    charKey: "fe00",
    payload: "04007d0002ff00027d3203ff0003",
    desc: "2026-06-24 12:43 最新 HCI：`action:028202` 第 5 帧，序列收尾。",
    tags: ["fe00", "dock", "sensor", "028202", "frame-5"],
    verified: true,
  },
  {
    name: "吸附触发 清理包 A",
    charKey: "fe00",
    payload: "000001ff0001",
    desc: "2026-06-24 12:43 最新 HCI：`action:028202` 之后的短清理包，样本中出现 2 次。",
    tags: ["fe00", "dock", "sensor", "cleanup"],
    verified: true,
  },
  {
    name: "吸附触发 回正包",
    charKey: "fe00",
    payload: "00030000010032030a0001ff00010a3203ff0003",
    desc: "2026-06-24 12:43 最新 HCI：吸附动作结束后的姿态回正包。",
    tags: ["fe00", "dock", "sensor", "cleanup", "neutral"],
    verified: true,
  },
  { name: "前冲动作脚本", charKey: "fe00", payload: "0e0e57ff050000005999015900050000005b3201", desc: "旧 `fe00` 样本，仍保留为单次动作实验。", tags: ["fe00", "forward", "script"], verified: false },
  { name: "后冲动作脚本", charKey: "fe00", payload: "0a0e42260142ff05000000449901440005000000", desc: "旧 `fe00` 后退样本。", tags: ["fe00", "back", "script"], verified: false },
  { name: "左转动作脚本", charKey: "fe00", payload: "0202640002641e036aeb0271eb0273320379f502", desc: "旧 `fe00` 左转样本。", tags: ["fe00", "left", "script"], verified: true },
  { name: "低头动作脚本", charKey: "fe00", payload: "0404960001ff0001a03c03af3203ff0003", desc: "单次低头动作。", tags: ["fe00", "head", "down"], verified: true },
  { name: "回正姿态脚本", charKey: "fe00", payload: "00100000010032030a0001ff00010a3203ff0003", desc: "旧 `fe00` 中性/回正样本。", tags: ["fe00", "neutral"], verified: true },
  { name: "大灯关闭", charKey: "fed2", payload: "00", desc: "关大灯。", tags: ["fed2", "light", "off"], verified: true },
  { name: "大灯开启", charKey: "fed2", payload: "01", desc: "开大灯。", tags: ["fed2", "light", "on"], verified: true },
];

const DRIVE_PRESETS = {
  forward: { label: "前进", value: LOOI_DRIVE_VALUES.forward },
  left: { label: "左转", value: LOOI_DRIVE_VALUES.left },
  back: { label: "后退", value: LOOI_DRIVE_VALUES.back },
  right: { label: "右转", value: LOOI_DRIVE_VALUES.right },
  stop: { label: "停止", value: LOOI_DRIVE_VALUES.stop },
};

const HEAD_PRESETS = {
  up: { label: "抬头极限", value: LOOI_HEAD_VALUES.up },
  neutral: { label: "头部中位", value: LOOI_HEAD_VALUES.neutral },
  down: { label: "低头极限", value: LOOI_HEAD_VALUES.down },
};

const DRIVE_KEY_MAP = {
  ArrowUp: "forward",
  KeyW: "forward",
  ArrowLeft: "left",
  KeyA: "left",
  ArrowDown: "back",
  KeyS: "back",
  ArrowRight: "right",
  KeyD: "right",
};

const state = {
  device: null,
  server: null,
  chars: {},
  notifyBound: new Set(),
  fed9HintsSeen: new Set(),
  busy: false,
  driveTimer: null,
  driveKey: null,
  activePointerId: null,
  headValue: "87",
  logLines: [],
};

const els = {
  connectBtn: document.querySelector("#connectBtn"),
  handshakeBtn: document.querySelector("#handshakeBtn"),
  sendFe00Btn: document.querySelector("#sendFe00Btn"),
  disconnectBtn: document.querySelector("#disconnectBtn"),
  clearLogBtn: document.querySelector("#clearLogBtn"),
  connState: document.querySelector("#connState"),
  deviceName: document.querySelector("#deviceName"),
  gattState: document.querySelector("#gattState"),
  lastNotify: document.querySelector("#lastNotify"),
  logView: document.querySelector("#logView"),
  recentLogView: document.querySelector("#recentLogView"),
  fedaFirstInput: document.querySelector("#fedaFirstInput"),
  fef0InitInput: document.querySelector("#fef0InitInput"),
  fedaSecondInput: document.querySelector("#fedaSecondInput"),
  fe00Input: document.querySelector("#fe00Input"),
  commandFilterInput: document.querySelector("#commandFilterInput"),
  commandList: document.querySelector("#commandList"),
  driveState: document.querySelector("#driveState"),
  driveHoldHint: document.querySelector("#driveHoldHint"),
  fed0Input: document.querySelector("#fed0Input"),
  fed0StopInput: document.querySelector("#fed0StopInput"),
  fed1Slider: document.querySelector("#fed1Slider"),
  fed1Input: document.querySelector("#fed1Input"),
  headState: document.querySelector("#headState"),
  headUpBtn: document.querySelector("#headUpBtn"),
  headCenterBtn: document.querySelector("#headCenterBtn"),
  headDownBtn: document.querySelector("#headDownBtn"),
  lightOnBtn: document.querySelector("#lightOnBtn"),
  lightOffBtn: document.querySelector("#lightOffBtn"),
  lightState: document.querySelector("#lightState"),
  driveWheel: document.querySelector("#driveWheel"),
  wheelKnob: document.querySelector("#wheelKnob"),
};

const RECENT_LOG_LIMIT = 6;
const DRIVE_MIN_DISTANCE = 26;
const DRIVE_KNOB_MAX_OFFSET_RATIO = 0.26;

function nowLabel() {
  return new Date().toLocaleTimeString("zh-CN", { hour12: false });
}

function log(message) {
  const line = `[${nowLabel()}] ${message}`;
  state.logLines.push(line);
  els.logView.textContent = `${state.logLines.join("\n")}\n`;
  els.recentLogView.textContent = state.logLines.slice(-RECENT_LOG_LIMIT).join("\n");
  els.logView.scrollTop = els.logView.scrollHeight;
  els.recentLogView.scrollTop = els.recentLogView.scrollHeight;
}

function setConnState(text) {
  els.connState.textContent = text;
}

function setGattState(text) {
  els.gattState.textContent = text;
}

function setDriveState(text) {
  els.driveState.textContent = text;
}

function setHeadState(text) {
  els.headState.textContent = text;
}

function setLightState(text) {
  els.lightState.textContent = text;
}

function isConnected() {
  return Boolean(state.server?.connected);
}

function resetState(reason = "idle") {
  stopDriveLoop(true);
  state.server = null;
  state.chars = {};
  state.notifyBound = new Set();
  state.fed9HintsSeen = new Set();
  els.lastNotify.textContent = "-";
  setDriveState("待机");
  setHeadState(`0x${state.headValue}`);
  setLightState("未切换");
  if (reason === "disconnect") {
    setConnState("已断开");
    setGattState("closed");
  } else {
    setConnState("未连接");
    setGattState("-");
  }
  updateButtons();
}

function resetWheelKnob() {
  if (!els.wheelKnob) {
    return;
  }
  els.wheelKnob.style.transform = "translate(-50%, -50%)";
  els.driveWheel?.classList.remove("is-engaged");
}

function emitFed9Hint(hex) {
  let hint = null;
  if (hex === "05") {
    hint = "实验性判定: fed9=05，和官方 App 的“当前已吸附”回调时间点高度重合。";
  } else if (hex === "06") {
    hint = "实验性判定: fed9=06，样本里出现在吸附动作收尾后的阶段切换。";
  } else if (hex === "070000") {
    hint = "实验性判定: fed9=070000，样本里出现在吸附触发动作的短收尾阶段。";
  } else if (hex === "070300") {
    hint = "实验性判定: fed9=070300，样本里出现在吸附触发动作完成后的后续状态。";
  }

  if (!hint || state.fed9HintsSeen.has(hex)) {
    return;
  }

  state.fed9HintsSeen.add(hex);
  log(hint);
}

function updateButtons() {
  const connected = isConnected();
  els.connectBtn.disabled = state.busy;
  els.handshakeBtn.disabled = !connected || state.busy;
  els.sendFe00Btn.disabled = !connected || state.busy;
  els.disconnectBtn.disabled = !connected || state.busy;
  for (const button of document.querySelectorAll("[data-command-index]")) {
    button.disabled = !connected || state.busy;
  }
  for (const button of document.querySelectorAll("[data-drive-key], .head-action, .light-action")) {
    button.disabled = !connected || state.busy;
  }
  els.fed1Slider.disabled = !connected || state.busy;
}

async function writeWithResponse(characteristic, hex, label) {
  const bytes = hexToBytes(hex);
  await characteristic.writeValueWithResponse(bytes);
  log(`写入 ${label}: ${normalizeHex(hex)}`);
}

async function writeWithoutResponse(characteristic, hex, label, expectedBytes = null) {
  const bytes = hexToBytes(hex, expectedBytes);
  await characteristic.writeValueWithoutResponse(bytes);
  log(`直控 ${label}: ${normalizeHex(hex, expectedBytes)}`);
}

async function startNotify(characteristic, label) {
  if (!state.notifyBound.has(label)) {
    characteristic.addEventListener("characteristicvaluechanged", (event) => {
      const value = event.target.value;
      const bytes = new Uint8Array(value.buffer.slice(0));
      const hex = bytesToHex(bytes);
      els.lastNotify.textContent = `${label}: ${hex}`;
      log(`通知 ${label}: ${hex}`);
      if (label === "fed9") {
        emitFed9Hint(hex);
      }
    });
    state.notifyBound.add(label);
  }
  await characteristic.startNotifications();
  log(`已订阅 ${label}`);
}

async function getKnownLooiDevice() {
  if (!navigator.bluetooth.getDevices) {
    return null;
  }
  const devices = await navigator.bluetooth.getDevices();
  return devices.find((device) => device.name === "LOOI Robot") || null;
}

function bindDisconnectListener(device) {
  if (device.__looiDisconnectBound) {
    return;
  }
  device.addEventListener("gattserverdisconnected", () => {
    log("设备断开连接");
    resetState("disconnect");
  });
  device.__looiDisconnectBound = true;
}

async function connectDevice(device) {
  bindDisconnectListener(device);
  state.device = device;
  els.deviceName.textContent = `${device.name || "-"} / ${device.id}`;
  log(`目标设备: ${device.name || "unknown"}`);

  setConnState("连接中");
  setGattState("connecting");

  const server = await device.gatt.connect();
  state.server = server;
  setConnState("已连接");
  setGattState("discovering");
  log("GATT 连接成功");

  const service = await server.getPrimaryService(LOOI_SERVICE_UUID);
  const [fed0, fed1, fed2, fed9, feda, fef0, fe00] = await Promise.all([
    service.getCharacteristic(LOOI_CHARACTERISTICS.fed0),
    service.getCharacteristic(LOOI_CHARACTERISTICS.fed1),
    service.getCharacteristic(LOOI_CHARACTERISTICS.fed2),
    service.getCharacteristic(LOOI_CHARACTERISTICS.fed9),
    service.getCharacteristic(LOOI_CHARACTERISTICS.feda),
    service.getCharacteristic(LOOI_CHARACTERISTICS.fef0),
    service.getCharacteristic(LOOI_CHARACTERISTICS.fe00),
  ]);

  state.chars = { fed0, fed1, fed2, fed9, feda, fef0, fe00 };
  setGattState("ready");
  log("关键 characteristic 已就绪：fed0 / fed1 / fed2 / fed9 / feda / fef0 / fe00");
}

async function discover() {
  if (isConnected()) {
    log("当前已连接，跳过重复连接。");
    return;
  }

  resetState();
  let device = state.device;

  if (!device) {
    device = await getKnownLooiDevice();
    if (device) {
      log("发现已授权设备，直接重连。");
    }
  }

  if (!device) {
    setConnState("请求设备");
    device = await navigator.bluetooth.requestDevice({
      filters: [{ name: "LOOI Robot" }],
      optionalServices: [LOOI_SERVICE_UUID],
    });
    log("已通过设备选择器获取设备授权。");
  }

  await connectDevice(device);
}

async function runHandshake() {
  const { fed9, feda, fef0 } = state.chars;
  if (!fed9 || !feda || !fef0) {
    throw new Error("characteristic 未准备好");
  }

  log("开始执行握手");
  await startNotify(fed9, "fed9");
  await startNotify(fef0, "fef0");
  await writeWithResponse(feda, els.fedaFirstInput.value, "feda(1)");
  await writeWithResponse(fef0, els.fef0InitInput.value, "fef0(init)");
  await writeWithResponse(feda, els.fedaSecondInput.value, "feda(2)");
  log("握手写入完成，等待通知");
}

async function sendFe00() {
  const { fe00 } = state.chars;
  if (!fe00) {
    throw new Error("fe00 未准备好");
  }
  await writeWithResponse(fe00, els.fe00Input.value, "fe00");
}

async function sendCommand(index) {
  const command = COMMANDS[index];
  const characteristic = state.chars[command.charKey];
  if (!characteristic) {
    throw new Error(`${command.charKey} 未准备好`);
  }
  await writeWithResponse(characteristic, command.payload, `${command.charKey}:${command.name}`);
}

function setDriveButtonActive(key, active) {
  const button = document.querySelector(`[data-drive-key="${key}"]`);
  if (button) {
    button.classList.toggle("is-active", active);
  }
}

async function sendDriveValue(hex) {
  const { fed0 } = state.chars;
  if (!fed0) {
    throw new Error("fed0 未准备好");
  }
  await writeWithoutResponse(fed0, hex, "fed0", 2);
}

async function sendHeadValue(hex) {
  const { fed1 } = state.chars;
  if (!fed1) {
    throw new Error("fed1 未准备好");
  }
  await writeWithoutResponse(fed1, hex, "fed1", 1);
}

async function sendHeadlight(hex) {
  const { fed2 } = state.chars;
  if (!fed2) {
    throw new Error("fed2 未准备好");
  }
  await writeWithResponse(fed2, hex, `fed2:${hex === LOOI_LIGHT_VALUES.on ? "on" : "off"}`);
}

function stopDriveLoop(silent = false, options = {}) {
  const { preservePointer = false, preserveKnob = false } = options;
  if (state.driveTimer) {
    clearInterval(state.driveTimer);
    state.driveTimer = null;
  }
  if (state.driveKey) {
    setDriveButtonActive(state.driveKey, false);
  }
  const prev = state.driveKey;
  state.driveKey = null;
  if (!preservePointer) {
    state.activePointerId = null;
  }
  setDriveState("待机");
  els.driveHoldHint.textContent = "在轮盘任意位置按下后拖拽，松手自动补 `0000`。";
  if (!preserveKnob) {
    resetWheelKnob();
  }
  if (!silent && prev && isConnected()) {
    guarded(async () => {
      await sendDriveValue(els.fed0StopInput.value);
      log(`底盘已停: ${DRIVE_PRESETS[prev]?.label || prev}`);
    });
  }
}

function startDriveLoop(key, pointerId = null) {
  if (!isConnected()) {
    log("请先连接并完成握手，再开始底盘直控。");
    return;
  }
  if (state.driveKey === key) {
    return;
  }
  stopDriveLoop(true);
  state.driveKey = key;
  state.activePointerId = pointerId;
  els.fed0Input.value = DRIVE_PRESETS[key].value;
  setDriveButtonActive(key, true);
  setDriveState(DRIVE_PRESETS[key].label);
  els.driveHoldHint.textContent = `持续发送 fed0=${DRIVE_PRESETS[key].value}`;

  guarded(async () => {
    await sendDriveValue(DRIVE_PRESETS[key].value);
  });

  state.driveTimer = window.setInterval(() => {
    if (!isConnected()) {
      stopDriveLoop(true);
      return;
    }
    guarded(async () => {
      await sendDriveValue(DRIVE_PRESETS[key].value);
    });
  }, 110);
}

function moveWheelKnob(clientX, clientY) {
  if (!els.driveWheel || !els.wheelKnob) {
    return;
  }

  const rect = els.driveWheel.getBoundingClientRect();
  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;
  const dx = clientX - centerX;
  const dy = clientY - centerY;
  const maxOffset = rect.width * DRIVE_KNOB_MAX_OFFSET_RATIO;
  const distance = Math.hypot(dx, dy);
  const scale = distance > maxOffset && distance > 0 ? maxOffset / distance : 1;
  const offsetX = dx * scale;
  const offsetY = dy * scale;
  els.wheelKnob.style.transform = `translate(calc(-50% + ${offsetX}px), calc(-50% + ${offsetY}px))`;
  els.driveWheel.classList.add("is-engaged");
}

function getDriveKeyFromPoint(clientX, clientY) {
  if (!els.driveWheel) {
    return null;
  }

  const rect = els.driveWheel.getBoundingClientRect();
  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;
  const dx = clientX - centerX;
  const dy = clientY - centerY;

  if (Math.hypot(dx, dy) < DRIVE_MIN_DISTANCE) {
    return null;
  }

  if (Math.abs(dx) > Math.abs(dy)) {
    return dx > 0 ? "right" : "left";
  }

  return dy > 0 ? "back" : "forward";
}

function updateDriveFromPointer(clientX, clientY, pointerId) {
  moveWheelKnob(clientX, clientY);
  const key = getDriveKeyFromPoint(clientX, clientY);
  if (!key) {
    if (state.driveKey) {
      stopDriveLoop(false, { preservePointer: true, preserveKnob: true });
    }
    return;
  }
  startDriveLoop(key, pointerId);
}

function syncHeadInputs(hex) {
  const clean = normalizeHex(hex, 1);
  state.headValue = clean;
  els.fed1Input.value = clean;
  els.fed1Slider.value = Number.parseInt(clean, 16).toString(10);
  setHeadState(`0x${clean}`);
}

function setHeadButtonActive(key) {
  for (const button of document.querySelectorAll(".head-action")) {
    button.classList.toggle("is-active", button.dataset.headPreset === key);
  }
}

function renderCommands() {
  const needle = els.commandFilterInput.value.trim().toLowerCase();
  const filtered = COMMANDS.map((command, index) => ({ command, index })).filter(({ command }) => {
    if (!needle) {
      return true;
    }
    const haystack = [command.name, command.desc, command.charKey, command.payload, ...command.tags].join(" ").toLowerCase();
    return haystack.includes(needle);
  });

  els.commandList.innerHTML = filtered.map(({ command, index }) => `
    <article class="command-card">
      <div class="command-card-head">
        <div>
          <h3>${command.name}</h3>
          <p class="command-desc">${command.desc}</p>
        </div>
        <div class="command-meta">
          <span>${command.charKey}</span>
          <span>${command.verified ? "已验证" : "待验证"}</span>
          ${command.tags.map((tag) => `<span>${tag}</span>`).join("")}
        </div>
      </div>
      <pre class="command-hex">${command.payload}</pre>
      <div class="command-actions">
        <button data-command-index="${index}">发送</button>
        <button data-copy-index="${index}">复制 Hex</button>
      </div>
    </article>
  `).join("");

  for (const button of els.commandList.querySelectorAll("[data-command-index]")) {
    button.addEventListener("click", () => guarded(() => sendCommand(Number(button.dataset.commandIndex))));
  }

  for (const button of els.commandList.querySelectorAll("[data-copy-index]")) {
    button.addEventListener("click", async () => {
      const command = COMMANDS[Number(button.dataset.copyIndex)];
      await navigator.clipboard.writeText(command.payload);
      log(`已复制 ${command.name}`);
    });
  }

  updateButtons();
}

function disconnect() {
  if (state.device?.gatt?.connected) {
    state.device.gatt.disconnect();
    return;
  }
  resetState("disconnect");
}

function assertCapability() {
  if (!("bluetooth" in navigator)) {
    throw new Error("当前浏览器不支持 Web Bluetooth。请使用 Chrome / Android，并通过 localhost 打开页面。");
  }
  if (!window.isSecureContext) {
    throw new Error("当前页面不是安全上下文。请使用 http://127.0.0.1:<port> 或 http://localhost:<port>。");
  }
}

async function guarded(action) {
  if (state.busy) {
    log("上一个操作还没完成，先等它结束。");
    return;
  }
  state.busy = true;
  updateButtons();
  try {
    assertCapability();
    await action();
  } catch (error) {
    log(`错误: ${error.message}`);
    console.error(error);
  } finally {
    state.busy = false;
    updateButtons();
  }
}

function bindDriveControls() {
  els.driveWheel?.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    els.driveWheel.setPointerCapture?.(event.pointerId);
    state.activePointerId = event.pointerId;
    updateDriveFromPointer(event.clientX, event.clientY, event.pointerId);
  });

  els.driveWheel?.addEventListener("pointermove", (event) => {
    if (state.activePointerId !== event.pointerId) {
      return;
    }
    event.preventDefault();
    updateDriveFromPointer(event.clientX, event.clientY, event.pointerId);
  });

  const handleWheelEnd = (event) => {
    if (state.activePointerId !== event.pointerId) {
      return;
    }
    event.preventDefault();
    stopDriveLoop();
  };

  els.driveWheel?.addEventListener("pointerup", handleWheelEnd);
  els.driveWheel?.addEventListener("pointercancel", handleWheelEnd);

  document.querySelector("#driveStopBtn")?.addEventListener("click", (event) => {
    event.preventDefault();
    stopDriveLoop();
  });

  window.addEventListener("keydown", (event) => {
    const key = DRIVE_KEY_MAP[event.code];
    if (!key) {
      if (event.code === "Space") {
        event.preventDefault();
        stopDriveLoop();
      }
      return;
    }
    event.preventDefault();
    startDriveLoop(key);
  });

  window.addEventListener("keyup", (event) => {
    const key = DRIVE_KEY_MAP[event.code];
    if (!key) {
      return;
    }
    event.preventDefault();
    if (state.driveKey === key) {
      stopDriveLoop();
    }
  });
}

function bindHeadControls() {
  els.fed1Slider.addEventListener("input", () => {
    const hex = Number.parseInt(els.fed1Slider.value, 10).toString(16).padStart(2, "0");
    syncHeadInputs(hex);
    setHeadButtonActive(null);
  });

  els.fed1Slider.addEventListener("change", () => {
    guarded(async () => {
      await sendHeadValue(els.fed1Input.value);
      log(`头部目标更新: 0x${els.fed1Input.value}`);
    });
  });

  els.fed1Input.addEventListener("change", () => {
    syncHeadInputs(els.fed1Input.value);
    guarded(async () => {
      await sendHeadValue(els.fed1Input.value);
      log(`头部目标更新: 0x${els.fed1Input.value}`);
    });
  });

  for (const button of document.querySelectorAll(".head-action")) {
    button.addEventListener("click", () => {
      const preset = button.dataset.headPreset;
      const value = HEAD_PRESETS[preset].value;
      syncHeadInputs(value);
      setHeadButtonActive(preset);
      guarded(async () => {
        await sendHeadValue(value);
        log(`头部预置: ${HEAD_PRESETS[preset].label}`);
      });
    });
  }
}

function bindLightControls() {
  els.lightOnBtn.addEventListener("click", () => guarded(async () => {
    await sendHeadlight(LOOI_LIGHT_VALUES.on);
    setLightState("开启");
  }));

  els.lightOffBtn.addEventListener("click", () => guarded(async () => {
    await sendHeadlight(LOOI_LIGHT_VALUES.off);
    setLightState("关闭");
  }));
}

els.connectBtn.addEventListener("click", () => guarded(discover));
els.handshakeBtn.addEventListener("click", () => guarded(runHandshake));
els.sendFe00Btn.addEventListener("click", () => guarded(sendFe00));
els.disconnectBtn.addEventListener("click", disconnect);
els.clearLogBtn.addEventListener("click", () => {
  state.logLines = [];
  els.logView.textContent = "";
  els.recentLogView.textContent = "";
});
els.commandFilterInput.addEventListener("input", renderCommands);

state.logLines = [
  "LOOI Web Bluetooth 直控实验台已就绪。",
  "建议使用方式：",
  "1. 电脑执行 npm run dev --workspace @soopercharge/looi-web-demo",
  "2. 手机 USB 连电脑后执行 adb reverse tcp:5173 tcp:5173",
  "3. 手机 Chrome 打开 Vite 输出的本地地址，例如 http://127.0.0.1:5173",
  "4. 先连接并执行握手，再测试 fed0 / fed1 / fed2。",
  "",
];
els.logView.textContent = `${state.logLines.join("\n")}\n`;
els.recentLogView.textContent = state.logLines.slice(-RECENT_LOG_LIMIT).join("\n");

syncHeadInputs("87");
renderCommands();
bindDriveControls();
bindHeadControls();
bindLightControls();
resetState();
resetWheelKnob();
