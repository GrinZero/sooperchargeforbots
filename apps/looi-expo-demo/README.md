# LOOI Expo Demo

这个 demo 对齐当前第一版 SDK 的 4 类核心能力：

- `connect({ onDock, onRawNotify })`
- `move(direction)` / `startMoveLoop(direction)` / `stop()`
- `setHead(direction)`
- `setLight(enabled)`
- `writeRaw(characteristic, payloadHex)`

它仍然使用 preview transport，所以可以直接在 Expo Go 里跑界面。真正接机器人时，把 `App.js` 里的 `createExpoPreviewTransport()` 替换成原生 BLE adapter 即可。

## Run

```bash
pnpm install
pnpm --filter @sourcebug/looi-expo-demo dev
```
