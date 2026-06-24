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
  logView: document.querySelector("#logView"),
  startLoopBtn: document.querySelector("#startLoopBtn"),
  stopBtn: document.querySelector("#stopBtn"),
  lightOnBtn: document.querySelector("#lightOnBtn"),
  lightOffBtn: document.querySelector("#lightOffBtn"),
  sendRawBtn: document.querySelector("#sendRawBtn"),
  rawCharacteristicInput: document.querySelector("#rawCharacteristicInput"),
  rawPayloadInput: document.querySelector("#rawPayloadInput"),
};

const robot = new LooiRobot(new WebBluetoothLooiTransport());
const moveButtons = [...document.querySelectorAll("[data-move]")];
const headButtons = [...document.querySelectorAll("[data-head]")];
const logLines = [];

function log(message) {
  const line = `[${new Date().toLocaleTimeString("zh-CN", { hour12: false })}] ${message}`;
  logLines.push(line);
  els.logView.textContent = `${logLines.join("\n")}\n`;
  els.logView.scrollTop = els.logView.scrollHeight;
}

function setConnState(value) {
  els.connState.textContent = value;
}

function setDockState(value) {
  els.dockState.textContent = value;
}

function setLastNotify(value) {
  els.lastNotify.textContent = value;
}

async function runAction(label, action) {
  try {
    log(`▶ ${label}`);
    await action();
  } catch (error) {
    log(`✕ ${label}: ${error.message}`);
  }
}

els.connectBtn.addEventListener("click", () => {
  void runAction("connect", async () => {
    setConnState("connecting");
    await robot.connect({
      onDock: ({ docked, hex }) => {
        setDockState(docked ? "docked" : "undocked");
        setLastNotify(`dock=${hex}`);
        log(`dock callback: ${docked} (${hex})`);
      },
      onRawNotify: ({ characteristic, hex }) => {
        setLastNotify(`${characteristic}=${hex}`);
        log(`raw notify ${characteristic}: ${hex}`);
      },
    });
    setConnState("connected");
    const transport = robot.transport;
    els.deviceName.textContent = transport.device?.name ?? "LOOI Robot";
  });
});

els.replayHandshakeBtn.addEventListener("click", () => {
  void runAction("replay handshake", () => robot.handshake({ forceHandshake: true }));
});

els.disconnectBtn.addEventListener("click", () => {
  void runAction("disconnect", async () => {
    await robot.disconnect();
    setConnState("disconnected");
  });
});

els.clearLogBtn.addEventListener("click", () => {
  logLines.length = 0;
  els.logView.textContent = "";
});

moveButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const direction = button.dataset.move;
    void runAction(`move ${direction}`, () => robot.move(direction));
  });
});

els.startLoopBtn.addEventListener("click", () => {
  void runAction("start move loop", () => robot.startMoveLoop("left"));
});

els.stopBtn.addEventListener("click", () => {
  void runAction("stop", () => robot.stop());
});

headButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const direction = button.dataset.head;
    void runAction(`head ${direction}`, () => robot.setHead(direction));
  });
});

els.lightOnBtn.addEventListener("click", () => {
  void runAction("light on", () => robot.setLight(true));
});

els.lightOffBtn.addEventListener("click", () => {
  void runAction("light off", () => robot.setLight(false));
});

els.sendRawBtn.addEventListener("click", () => {
  void runAction("raw write", () => robot.writeRaw(els.rawCharacteristicInput.value, els.rawPayloadInput.value, {
    response: true,
  }));
});
