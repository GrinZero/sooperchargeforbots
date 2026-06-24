# LOOI SDK 封装路线

## 目标

把现在散落在 Web demo和协议文档里的 LOOI 控制信号，收敛成一个面向开发者的 SDK，让消费者可以在 Web 和 React Native 里更容易定制自己的 Agent 应用。

SDK 第一阶段不追求“完整复刻官方 App”，而是先把已经坐实的最小能力封装稳定：

- 连接与握手
- 底盘连续控制
- 头部俯仰控制
- 大灯开关
- 发送已知 `fe00` 动作脚本
- 订阅并向上抛出通知事件

## 分层设计

### 1. Protocol 层

Protocol 层只关心 LOOI 的 BLE 语义，不绑定具体运行时。

应包含：

- UUID 常量
- 握手顺序
- `fed0` 方向候选值
- `fed1` 头部预置值
- `fed2` 灯光值
- 已确认 `fe00` 动作序列
- hex / bytes 工具函数

### 2. Core Client 层

Core Client 提供开发者真正调用的机器人对象，例如：

- `connect()`
- `disconnect()`
- `handshake()`
- `drive(direction)`
- `startDriveLoop(direction)`
- `stop()`
- `setHead(value)`
- `setHeadPreset(preset)`
- `setLight(enabled)`
- `sendFe00(payload)`
- `playFe00Sequence(payloads)`

这一层只依赖一个很薄的 transport 接口。

### 3. Transport 层

Transport 层屏蔽 Web 和 React Native 的 BLE 差异。

统一接口建议为：

```ts
interface LooiTransport {
  connect(): Promise<void>;
  disconnect?(): Promise<void>;
  startNotifications?(characteristic: LooiCharacteristicKey, onValue?: LooiNotifyHandler): Promise<void>;
  write(characteristic: LooiCharacteristicKey, payloadHex: string, options?: LooiWriteOptions): Promise<void>;
}
```

Web 端可以内置 `WebBluetoothLooiTransport`。React Native 端先不硬依赖某一个 BLE 库，而是让 App 用 `react-native-ble-plx`、Expo BLE 或其他方案实现同一个接口。

## 当前 monorepo 结构

已新增 pnpm workspace + Turborepo 管理方式，SDK 和 demo 分开放置：

```text
apps/looi-web-demo/
  package.json
  index.html
  app.js
  styles.css
apps/looi-expo-demo/
  package.json
  app.json
  App.js
  README.md
packages/looi-sdk/
  package.json
  README.md
  src/index.js
```

`apps/looi-web-demo` 是第一个 Web SDK 消费者：它通过 workspace 依赖引入 `@sourcebug/looi-sdk`，复用 SDK 的 UUID、方向/头部/灯光常量和 hex 工具函数。

`apps/looi-expo-demo` 是第一个 Expo / React Native SDK 消费者：它使用同一个 `LooiRobot` client 和一个 preview transport 展示连接、握手、底盘、头部与灯光 API；后续只需要把 preview transport 换成 BLE 原生 adapter。

SDK 包当前导出：

- `LOOI_SERVICE_UUID`
- `LOOI_CHARACTERISTICS`
- `LOOI_HANDSHAKE`
- `LOOI_DRIVE_VALUES`
- `LOOI_HEAD_VALUES`
- `LOOI_LIGHT_VALUES`
- `LOOI_FE00_ACTIONS`
- `normalizeHex()`
- `hexToBytes()`
- `bytesToHex()`
- `createInitTimeHex()`
- `LooiRobot`
- `WebBluetoothLooiTransport`

## 开发者体验目标

Web 使用方式：

```js
import { LooiRobot, WebBluetoothLooiTransport } from "@sourcebug/looi-sdk";

const robot = new LooiRobot(new WebBluetoothLooiTransport());
await robot.connect();
await robot.handshake();
robot.startDriveLoop("forward");
```

React Native 使用方式：

```js
import { LooiRobot } from "@sourcebug/looi-sdk";
import { createBlePlxLooiTransport } from "./looiBlePlxTransport";

const robot = new LooiRobot(createBlePlxLooiTransport());
await robot.connect();
await robot.handshake();
await robot.setLight(true);
```

## 仍待验证的协议问题

- `fed0` 的 2 字节值到底是双电机值、二维向量，还是某种极坐标编码。
- `fed1` 是否可以当成线性俯仰目标值使用，以及中位和安全上下限。
- `fe00` 动作脚本的帧序号、结束标记和时间字段是否可以生成，而不是只回放样本。
- `fed9` 通知值的稳定事件语义，例如吸附、阶段切换、电量或距离。

## 下一步建议

1. 把 Web demo 里的 BLE 操作逐步改为调用 `@sourcebug/looi-sdk`，避免协议逻辑继续散落在 UI 代码里。
2. 把 Expo demo 的 preview transport 替换为 React Native BLE adapter 示例，优先覆盖连接、握手、写入和通知订阅。
3. 给 `fed0` 做更干净的长按采样，再决定 SDK 是否暴露连续二维摇杆 API，例如 `driveVector(x, y)`。
4. 给 `fed9` 建立事件解码器，逐步从 raw hex 变成 `dockChanged`、`batteryChanged` 之类的高层事件。
