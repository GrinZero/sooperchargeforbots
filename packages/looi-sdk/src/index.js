const DEFAULT_INIT_TIME_HEX = "4132303236203036203234203030203535203432";

export const LOOI_SERVICE_UUID = "000000ff-0000-1000-8000-00805f9b34fb";

export const LOOI_CHARACTERISTICS = Object.freeze({
  fed0: "0000fed0-0000-1000-8000-00805f9b34fb",
  fed1: "0000fed1-0000-1000-8000-00805f9b34fb",
  fed2: "0000fed2-0000-1000-8000-00805f9b34fb",
  fed9: "0000fed9-0000-1000-8000-00805f9b34fb",
  feda: "0000feda-0000-1000-8000-00805f9b34fb",
  fef0: "0000fef0-0000-1000-8000-00805f9b34fb",
  fe00: "0000fe00-0000-1000-8000-00805f9b34fb",
});

export const LOOI_DRIVE_VALUES = Object.freeze({
  forward: "7707",
  left: "047a",
  back: "86fc",
  right: "0082",
  stop: "0000",
});

export const LOOI_HEAD_VALUES = Object.freeze({
  up: "00",
  neutral: "87",
  down: "ff",
});

export const LOOI_LIGHT_VALUES = Object.freeze({
  on: "01",
  off: "00",
});

export const LOOI_HANDSHAKE = Object.freeze({
  notifications: ["fed9", "fef0"],
  writes: [
    { characteristic: "feda", value: "03", response: true },
    { characteristic: "fef0", value: DEFAULT_INIT_TIME_HEX, response: true },
    { characteristic: "feda", value: "8101", response: true },
  ],
});

export const LOOI_FE00_ACTIONS = Object.freeze({
  dockAction028202: Object.freeze([
    "0000000002003203020002023203051e02092802",
    "01000b5003101e02130002145f0332000235eb02",
    "020039eb023c00024500024814024f1402520002",
    "03006c00026e5f0370e10274460375d7027ae102",
    "04007d0002ff00027d3203ff0003",
  ]),
  neutral: "00100000010032030a0001ff00010a3203ff0003",
});

export function normalizeHex(raw, expectedBytes = null) {
  const clean = String(raw).replace(/\s+/g, "").trim().toLowerCase();
  if (!clean || clean.length % 2 !== 0 || /[^0-9a-f]/i.test(clean)) {
    throw new Error(`Invalid hex payload: ${raw}`);
  }
  if (expectedBytes !== null && clean.length !== expectedBytes * 2) {
    throw new Error(`Expected ${expectedBytes} bytes, got ${clean.length / 2}: ${raw}`);
  }
  return clean;
}

export function hexToBytes(raw, expectedBytes = null) {
  const clean = normalizeHex(raw, expectedBytes);
  const bytes = new Uint8Array(clean.length / 2);
  for (let i = 0; i < clean.length; i += 2) {
    bytes[i / 2] = Number.parseInt(clean.slice(i, i + 2), 16);
  }
  return bytes;
}

export function bytesToHex(bytes) {
  return Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join("");
}

export function createInitTimeHex(date = new Date()) {
  const pad = (value) => String(value).padStart(2, "0");
  const ascii = `A${date.getFullYear()} ${pad(date.getMonth() + 1)} ${pad(date.getDate())} ${pad(date.getHours())} ${pad(date.getMinutes())} ${pad(date.getSeconds())}`;
  return Array.from(ascii, (char) => char.charCodeAt(0).toString(16).padStart(2, "0")).join("");
}

export class LooiRobot {
  constructor(transport, options = {}) {
    if (!transport) {
      throw new Error("LooiRobot requires a BLE transport adapter.");
    }
    this.transport = transport;
    this.driveIntervalMs = options.driveIntervalMs ?? 110;
    this.driveTimer = null;
  }

  async connect() {
    await this.transport.connect();
  }

  async disconnect() {
    this.stopDriveLoop({ writeStop: false });
    await this.transport.disconnect?.();
  }

  async handshake(options = {}) {
    await this.transport.startNotifications?.("fed9", options.onFed9);
    await this.transport.startNotifications?.("fef0", options.onFef0);
    await this.transport.write("feda", "03", { response: true, expectedBytes: 1 });
    await this.transport.write("fef0", options.initTimeHex ?? createInitTimeHex(), { response: true, expectedBytes: 20 });
    await this.transport.write("feda", "8101", { response: true, expectedBytes: 2 });
  }

  async drive(direction) {
    const value = LOOI_DRIVE_VALUES[direction];
    if (!value) {
      throw new Error(`Unknown drive direction: ${direction}`);
    }
    await this.transport.write("fed0", value, { response: false, expectedBytes: 2 });
  }

  startDriveLoop(direction) {
    this.stopDriveLoop({ writeStop: false });
    void this.drive(direction);
    this.driveTimer = setInterval(() => {
      void this.drive(direction);
    }, this.driveIntervalMs);
  }

  stopDriveLoop(options = {}) {
    const { writeStop = true } = options;
    if (this.driveTimer) {
      clearInterval(this.driveTimer);
      this.driveTimer = null;
    }
    if (writeStop) {
      void this.stop();
    }
  }

  async stop() {
    await this.transport.write("fed0", LOOI_DRIVE_VALUES.stop, { response: false, expectedBytes: 2 });
  }

  async setHead(value) {
    const hex = typeof value === "number" ? value.toString(16).padStart(2, "0") : value;
    await this.transport.write("fed1", hex, { response: false, expectedBytes: 1 });
  }

  async setHeadPreset(preset) {
    const value = LOOI_HEAD_VALUES[preset];
    if (!value) {
      throw new Error(`Unknown head preset: ${preset}`);
    }
    await this.setHead(value);
  }

  async setLight(enabled) {
    await this.transport.write("fed2", enabled ? LOOI_LIGHT_VALUES.on : LOOI_LIGHT_VALUES.off, { response: true, expectedBytes: 1 });
  }

  async sendFe00(payload) {
    await this.transport.write("fe00", payload, { response: true });
  }

  async playFe00Sequence(payloads, delayMs = 60) {
    for (const payload of payloads) {
      await this.sendFe00(payload);
      if (delayMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
  }
}

export class WebBluetoothLooiTransport {
  constructor(options = {}) {
    this.bluetooth = options.bluetooth ?? globalThis.navigator?.bluetooth;
    this.device = options.device ?? null;
    this.server = null;
    this.service = null;
    this.characteristics = new Map();
  }

  async connect() {
    if (!this.bluetooth) {
      throw new Error("Web Bluetooth is not available in this runtime.");
    }

    if (!this.device) {
      this.device = await this.bluetooth.requestDevice({
        filters: [{ name: "LOOI Robot" }],
        optionalServices: [LOOI_SERVICE_UUID],
      });
    }

    this.server = await this.device.gatt.connect();
    this.service = await this.server.getPrimaryService(LOOI_SERVICE_UUID);
    await Promise.all(Object.entries(LOOI_CHARACTERISTICS).map(async ([key, uuid]) => {
      const characteristic = await this.service.getCharacteristic(uuid);
      this.characteristics.set(key, characteristic);
    }));
  }

  async disconnect() {
    if (this.device?.gatt?.connected) {
      this.device.gatt.disconnect();
    }
  }

  async startNotifications(characteristicKey, onValue) {
    const characteristic = this.getCharacteristic(characteristicKey);
    if (onValue) {
      characteristic.addEventListener("characteristicvaluechanged", (event) => {
        const value = event.target.value;
        const bytes = new Uint8Array(value.buffer.slice(0));
        onValue({ characteristic: characteristicKey, bytes, hex: bytesToHex(bytes) });
      });
    }
    await characteristic.startNotifications();
  }

  async write(characteristicKey, payload, options = {}) {
    const characteristic = this.getCharacteristic(characteristicKey);
    const bytes = hexToBytes(payload, options.expectedBytes ?? null);
    if (options.response === false && characteristic.writeValueWithoutResponse) {
      await characteristic.writeValueWithoutResponse(bytes);
      return;
    }
    await characteristic.writeValueWithResponse(bytes);
  }

  getCharacteristic(characteristicKey) {
    const characteristic = this.characteristics.get(characteristicKey);
    if (!characteristic) {
      throw new Error(`Characteristic is not ready: ${characteristicKey}`);
    }
    return characteristic;
  }
}
