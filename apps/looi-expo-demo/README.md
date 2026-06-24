# LOOI Expo Demo

Expo / React Native consumer demo for `@soopercharge/looi-sdk`.

The app intentionally starts with a **preview transport** so it can run in Expo Go without native BLE setup. The UI still exercises the real SDK client surface:

- `connect()`
- `handshake()`
- `drive(direction)`
- `stop()`
- `setHeadPreset(preset)`
- `setLight(enabled)`

To turn this into real robot control, replace `createExpoPreviewTransport()` in `App.js` with a native BLE transport that implements the SDK transport contract. A future adapter can use `react-native-ble-plx`, Expo Modules, or another BLE bridge.

## Run

```bash
pnpm install
pnpm --filter @soopercharge/looi-expo-demo dev
```

Then open the project in Expo Go or a development build.
