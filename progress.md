# 进度记录

## 当前结论

本轮已确认：浏览器方案可以作为当前主实现路径，`apps/looi-web-demo` 已从基础 SDK demo 升级为浏览器版 LOOI Agent shell。

原因：

- `packages/looi-sdk` 已具备可用的 Web Bluetooth 适配层
- 浏览器更容易先跑通 Agent UI、语音输入、Markdown 回答流和表情状态机
- 用户已接受“如果这一款不行，换成其他能在浏览器跑的也可以”

## 已验证完成

### SDK / BLE 基础

- 最小 BLE 握手链路已坐实，并已在 Web Bluetooth 中可复现：
  - 订阅 `fed9`
  - 订阅 `fef0`
  - 写 `feda = 03`
  - 写 `fef0 = ASCII 时间串`
  - 写 `feda = 8101`
- 已确认高频直控通道：
  - `fed0` = 底盘连续控制
  - `fed1` = 头部连续控制
  - `fed2` = 大灯开关

### 浏览器应用

- `apps/looi-web-demo` 已重构为产品态浏览器壳，而不是原始控制面板
- 已完成：
  - LOOI 风格 face screen
  - 可切换表情状态机：`idle / listening / thinking / searching / speaking / happy / apology`
  - 高层 LOOI tools：`greet / focus-user / thinking / celebrate / apology / reset`
  - 文本提问与语音输入入口
  - `answer` bridge URL 配置
  - Markdown 回答渲染
  - 图片 Markdown 渲染
  - JSON / plain text / SSE 风格流式返回处理
  - bad-answer 判定后切换“抱歉”表情并执行低头 / 关灯联动
  - 摄像头 / 麦克风 / 声源定位 capability 状态展示

### 校验

- `pnpm --filter @sourcebug/looi-web-demo check` 已通过
- `pnpm --filter @sourcebug/looi-web-demo build` 已通过

## 当前风险 / 未完成

- `answer` 正式接口仍未提供，因此当前仍保留本地 mock fallback 路径
- 浏览器端“声源定位”目前只是 capability hook，不是完整可用的真实朝向系统
- `fed0` 的 2 字节编码语义仍未完全形式化，当前仍使用已验证候选值：
  - 前：`7707`
  - 左：`047a`
  - 后：`86fc`
  - 右：`0082`
  - 停：`0000`
- Expo App 主线尚未完成；当前是明确转向浏览器方案推进产品验证

## 下一步

1. 接正式 `answer` / MCP bridge
2. 根据 bridge 返回协议补强图片块、引用块和更细的流式事件格式
3. 把“声源定位 -> 头部朝向 / 主动转向用户”从占位能力接成真实控制链路
4. 视需要决定是否回填一个更轻的 Expo 壳，仅作为浏览器版方案的补充
