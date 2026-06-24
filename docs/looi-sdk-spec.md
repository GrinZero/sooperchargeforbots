# LOOI SDK 初版规格

## 为什么现在可以开 SDK

基于当前仓库里的两份核心结论：

- [docs/looi-ble-findings.md](/Users/bugyaluwang/project/sooperchargeforbots/docs/looi-ble-findings.md:1)
- [docs/looi-direct-control-findings.md](/Users/bugyaluwang/project/sooperchargeforbots/docs/looi-direct-control-findings.md:1)

目前已经具备启动 SDK 的最小条件：

- 握手骨架已稳定到具体特征值和顺序
- 运行期直控通道已从 `fe00` 拆分到 `fed0` / `fed1` / `fed2`
- Web Bluetooth 已能独立复现连接和控制链路

还不具备的部分也很明确：

- `fed0` 的 2 字节编码语义尚未完全形式化
- `fe00` 动作脚本还没有系统化 DSL
- iOS / Safari 不支持 Web Bluetooth，因此 Web SDK 只能覆盖 Chrome 系浏览器

结论：现在适合启动“协议层 + 适配层”结构的 SDK，而不是直接做“所有平台同一套 BLE 实现”。

## 初版目标

消费者包括：

- React Native 应用
- Flutter 应用
- Web App

初版 SDK 应先覆盖以下能力：

1. 发现并连接 `LOOI Robot`
2. 执行最小握手
3. 订阅 `fed9` / `fef0` 通知
4. 发送底盘直控 `fed0`
5. 发送头部俯仰 `fed1`
6. 切换大灯 `fed2`
7. 保留 `fe00` 高层动作包发送能力

## 需求

### User Stories

- 作为 Web / RN / Flutter 客户端开发者，我希望用统一的高层 API 连接机器人，而不是自己处理 GATT 细节。
- 作为上层应用开发者，我希望把“握手”和“直控”分开调用，这样调试和运行时状态更清晰。
- 作为协议维护者，我希望把平台相关 BLE 代码与 LOOI 协议逻辑解耦，避免后续重复逆向和重复修 bug。

### Acceptance Criteria

1. WHEN 上层应用调用 `connect()` THEN SDK SHALL 完成设备选择、GATT 建链和关键 characteristic 准备。
2. WHEN 上层应用调用 `performHandshake()` THEN SDK SHALL 订阅 `fed9` 和 `fef0`，并按已确认顺序写入 `feda -> fef0 -> feda`。
3. WHEN 上层应用调用 `drive()` THEN SDK SHALL 以无响应写入方式发送 `fed0` 2 字节值。
4. WHEN 上层应用调用 `setHeadPosition()` THEN SDK SHALL 以无响应写入方式发送 `fed1` 1 字节值。
5. WHEN 上层应用调用 `setHeadlight(true|false)` THEN SDK SHALL 以有响应写入方式发送 `fed2 = 01|00`。
6. WHEN 机器人返回通知 THEN SDK SHALL 以统一事件格式把 `charKey`、`hex`、`bytes` 交给上层。
7. IF 平台不支持当前 BLE 适配层 THEN SDK SHALL 抛出明确的平台错误，而不是静默失败。
8. IF 后续需要支持 React Native 或 Flutter THEN SDK SHALL 只新增平台 adapter，而不修改协议层 public API。

## 架构

初版建议拆成两层：

### 1. 协议层

职责：

- UUID 与 characteristic 映射
- 十六进制编码 / 解码
- 握手载荷生成
- 直控预置值
- 高层命令 API

这一层不直接依赖 Web Bluetooth、React Native BLE 或 Flutter BLE。

### 2. 传输适配层

职责：

- 设备发现
- 建链 / 断链
- characteristic 查找
- write with response / without response
- notifications

平台实现建议：

- Web: `WebBluetoothLooiAdapter`
- React Native: `ReactNativeLooiAdapter`
- Flutter: `FlutterLooiAdapter`

## 适配层契约

各平台 adapter 需要满足以下最小接口：

```ts
type NotifyEvent = {
  charKey: string;
  hex: string;
  bytes: Uint8Array;
};

interface LooiAdapter {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  isConnected(): boolean;
  getDeviceInfo(): { name: string; id: string | null };
  startNotifications(
    charKey: string,
    onValue: (event: NotifyEvent) => void,
  ): Promise<void>;
  write(
    charKey: string,
    payloadHex: string,
    options?: {
      withResponse?: boolean;
      expectedBytes?: number | null;
    },
  ): Promise<void>;
}
```

这个契约故意保持很薄，原因是：

- React Native 与 Flutter 的 BLE 库能力不完全相同
- 但 LOOI 协议层只需要“连接、写、订阅”三类能力

## API 草案

```ts
const client = new LooiClient({ adapter });

await client.connect();
await client.performHandshake();

await client.drive("7707");
await client.setHeadPosition("87");
await client.setHeadlight(true);
await client.sendFe00("00100000010032030a0001ff00010a3203ff0003");

client.on("notify", (event) => {
  console.log(event.charKey, event.hex);
});
```

## 平台策略

### Web

- 现在就能作为首个参考实现落地
- 限制为 Chrome / Android / secure context

### React Native

- 推荐继续复用同一套协议层 API
- adapter 通过原生 BLE 库实现
- 需要注意后台权限、蓝牙权限、MTU 和 Android / iOS 差异

### Flutter

- 推荐在 Dart 侧复刻同一份 public API
- BLE 实现走 Flutter 插件层
- 协议语义保持一致，不要求与 JS 共用同一份代码

## 实施顺序

1. 在仓库内先沉淀一套 JS 参考 SDK
2. 让现有 Web 实验台切到 SDK API
3. 稳定 public API 后，再分别实现 RN / Flutter adapter
4. 等 `fed0` / `fe00` 语义更完整后，再扩展动作库和状态模型
