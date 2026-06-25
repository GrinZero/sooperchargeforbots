# LOOI Browser Pilot

浏览器版 LOOI Agent 壳应用，基于 `@sourcebug/looi-sdk` 和 Web Bluetooth。

当前版本重点不是做纯控制台，而是先把产品形态跑起来：

- 机器人面部主屏与表情状态机
- 高层 LOOI tools 封装
- 语音输入入口（Web Speech API）
- 可配置的 `answer` / MCP bridge URL
- Markdown 流式渲染
- bad-answer 时的抱歉表情与动作联动

## 当前能力

- 真正连接 LOOI：通过 `WebBluetoothLooiTransport`
- 高层控制：
  - 移动
  - 头部
  - 灯光
  - 高层情绪动作 tool
- Agent runtime：
  - 文本提问
  - 语音转文本
  - 调 Answer Bridge
  - JSON / plain text / SSE 风格流式返回处理
- UI：
  - LOOI 风格 face screen
  - 回答区支持 Markdown 和图片

## 运行

```bash
pnpm install
pnpm --filter @sourcebug/looi-web-demo dev
```

默认页面会尝试把回答发送到：

```text
http://localhost:8787/answer
```

在正式 `answer` 接口还没接入前，页面会自动 fallback 到本地 mock stream。

## 期望的 Answer Bridge 入参

```json
{
  "prompt": "用户问题",
  "hint": "product-knowledge",
  "channel": "web-looi-agent",
  "capabilities": {
    "markdown": true,
    "image": true,
    "streamed": true
  }
}
```

## 说明

- 摄像头和声源定位目前是浏览器能力探测与接入边界，不是完整朝向控制方案。
- `fed0` 的底盘编码仍沿用当前已验证的候选值，后续还需要继续标定。
