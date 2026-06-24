# @soopercharge/looi-sdk

Experimental SDK surface for turning the currently confirmed LOOI BLE signals into reusable app primitives.

The package intentionally separates protocol logic from BLE implementation:

- `LooiRobot` owns handshake, drive, head, light and `fe00` helper methods.
- `WebBluetoothLooiTransport` is a browser adapter for Chrome/Web Bluetooth.
- React Native apps can provide the same small transport interface with libraries such as `react-native-ble-plx` without changing app-level robot code.

## Current protocol surface

| Feature | Characteristic | Write type | Payload |
| --- | --- | --- | --- |
| Handshake notify | `fed9`, `fef0` | notify | subscribe before init writes |
| Handshake init | `feda`, `fef0`, `feda` | with response | `03`, dynamic `Ayyyy mm dd HH MM SS`, `8101` |
| Drive | `fed0` | without response | 2-byte directional values |
| Head pitch | `fed1` | without response | 1-byte target value |
| Headlight | `fed2` | with response | `01` on, `00` off |
| Script/action frames | `fe00` | with response | variable captured action frames |

## Browser example

```js
import { LooiRobot, WebBluetoothLooiTransport } from "@soopercharge/looi-sdk";

const robot = new LooiRobot(new WebBluetoothLooiTransport());

await robot.connect();
await robot.handshake({
  onFed9: ({ hex }) => console.log("fed9", hex),
});

robot.startDriveLoop("forward");
setTimeout(() => robot.stopDriveLoop(), 800);

await robot.setHeadPreset("neutral");
await robot.setLight(true);
```

## React Native adapter shape

```js
const transport = {
  async connect() {
    // Scan, connect, discover service/characteristics, cache handles.
  },
  async disconnect() {
    // Close the platform BLE connection.
  },
  async startNotifications(characteristicKey, onValue) {
    // Subscribe to fed9/fef0 and call onValue({ characteristic, bytes, hex }).
  },
  async write(characteristicKey, payloadHex, { response, expectedBytes }) {
    // Validate/encode payloadHex and write to the cached characteristic.
  },
};

const robot = new LooiRobot(transport);
```

## Status

This is an alpha SDK boundary, not a stable npm release yet. The exported constants are based on current HCI findings and should stay easy to revise while `fed0` vector semantics and `fed1` calibration are still being mapped.
