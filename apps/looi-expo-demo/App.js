import { useMemo, useState } from "react";
import { Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import {
  LOOI_HEAD_VALUES,
  LOOI_LIGHT_VALUES,
  LOOI_MOVE_VALUES,
  LooiRobot,
  bytesToHex,
  hexToBytes,
} from "@sourcebug/looi-sdk";

function createExpoPreviewTransport(pushLog) {
  return {
    async connect() {
      pushLog("connect(): preview transport ready");
    },
    async disconnect() {
      pushLog("disconnect(): preview transport closed");
    },
    async startNotifications(characteristic, onValue) {
      pushLog(`notify(${characteristic}): subscribed`);
      if (characteristic === "dockNotify") {
        onValue?.({ characteristic, bytes: hexToBytes("05"), hex: "05" });
      }
      if (characteristic === "handshakeData") {
        onValue?.({ characteristic, bytes: hexToBytes("59"), hex: "59" });
      }
    },
    async write(characteristic, payloadHex, options = {}) {
      const bytes = hexToBytes(payloadHex, options.expectedBytes ?? null);
      pushLog(`write(${characteristic}, response=${options.response !== false}): ${bytesToHex(bytes)}`);
    },
  };
}

export default function App() {
  const [logs, setLogs] = useState(["LOOI Expo SDK demo ready."]);
  const [lightOn, setLightOn] = useState(false);
  const [rawCharacteristic, setRawCharacteristic] = useState("fe00");
  const [rawPayload, setRawPayload] = useState("00100000010032030a0001ff00010a3203ff0003");
  const [dockState, setDockState] = useState("unknown");

  const pushLog = (message) => {
    setLogs((current) => [`${new Date().toLocaleTimeString()} ${message}`, ...current].slice(0, 24));
  };

  const robot = useMemo(() => new LooiRobot(createExpoPreviewTransport(pushLog)), []);

  const runAction = async (label, action) => {
    try {
      pushLog(`▶ ${label}`);
      await action();
    } catch (error) {
      pushLog(`✕ ${label}: ${error.message}`);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.hero}>
          <Text style={styles.eyebrow}>SOOPERCHARGE SDK</Text>
          <Text style={styles.title}>LOOI Expo Demo</Text>
          <Text style={styles.lead}>
            这一版 demo 只展示第一版 SDK 的核心能力：移动、头部、灯光、吸附回调和原始写入。
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Session</Text>
          <Text style={styles.caption}>当前吸附状态：{dockState}</Text>
          <View style={styles.grid}>
            <DemoButton
              label="Connect"
              onPress={() => runAction("connect", () => robot.connect({
                onDock: ({ docked, hex }) => {
                  setDockState(docked ? "docked" : "undocked");
                  pushLog(`dock callback: ${docked} (${hex})`);
                },
                onRawNotify: ({ characteristic, hex }) => {
                  pushLog(`raw notify ${characteristic}: ${hex}`);
                },
              }))}
            />
            <DemoButton label="Replay handshake" onPress={() => runAction("handshake", () => robot.handshake({ forceHandshake: true }))} />
            <DemoButton label="Disconnect" onPress={() => runAction("disconnect", () => robot.disconnect())} />
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Move</Text>
          <Text style={styles.caption}>{JSON.stringify(LOOI_MOVE_VALUES)}</Text>
          <View style={styles.grid}>
            <DemoButton label="Forward" onPress={() => runAction("move forward", () => robot.move("forward"))} />
            <DemoButton label="Left loop" onPress={() => runAction("loop left", () => robot.startMoveLoop("left"))} />
            <DemoButton label="Back" onPress={() => runAction("move back", () => robot.move("back"))} />
            <DemoButton label="Right" onPress={() => runAction("move right", () => robot.move("right"))} />
            <DemoButton label="Stop" variant="dark" onPress={() => runAction("stop", () => robot.stop())} />
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Head + Light</Text>
          <Text style={styles.caption}>Head: {JSON.stringify(LOOI_HEAD_VALUES)} Light: {JSON.stringify(LOOI_LIGHT_VALUES)}</Text>
          <View style={styles.grid}>
            <DemoButton label="Head up" onPress={() => runAction("head up", () => robot.setHead("up"))} />
            <DemoButton label="Head center" onPress={() => runAction("head center", () => robot.setHead("center"))} />
            <DemoButton label="Head down" onPress={() => runAction("head down", () => robot.setHead("down"))} />
            <DemoButton
              label={lightOn ? "Light off" : "Light on"}
              onPress={() => runAction("toggle light", async () => {
                await robot.setLight(!lightOn);
                setLightOn(!lightOn);
              })}
            />
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Raw Write</Text>
          <Text style={styles.caption}>仅在需要直接操作 `fe00` / `fed2` / `feda` 这类通道时使用。</Text>
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Characteristic</Text>
            <TextInput style={styles.input} value={rawCharacteristic} onChangeText={setRawCharacteristic} autoCapitalize="none" />
          </View>
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Payload Hex</Text>
            <TextInput style={styles.input} value={rawPayload} onChangeText={setRawPayload} autoCapitalize="none" />
          </View>
          <DemoButton label="Send raw write" onPress={() => runAction("raw write", () => robot.writeRaw(rawCharacteristic, rawPayload, { response: true }))} />
        </View>

        <View style={styles.logCard}>
          <Text style={styles.cardTitle}>Transport log</Text>
          {logs.map((line, index) => (
            <Text key={`${line}-${index}`} style={styles.logLine}>{line}</Text>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function DemoButton({ label, onPress, variant = "accent" }) {
  return (
    <Pressable style={[styles.button, variant === "dark" && styles.darkButton]} onPress={onPress}>
      <Text style={[styles.buttonText, variant === "dark" && styles.darkButtonText]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#efe9de",
  },
  container: {
    padding: 20,
    gap: 16,
  },
  hero: {
    paddingVertical: 12,
  },
  eyebrow: {
    color: "#d4542a",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 2,
    marginBottom: 10,
  },
  title: {
    color: "#16120f",
    fontSize: 42,
    fontWeight: "900",
    letterSpacing: -2,
  },
  lead: {
    color: "#685f54",
    fontSize: 15,
    lineHeight: 23,
    marginTop: 12,
  },
  card: {
    backgroundColor: "#fffaf3",
    borderColor: "rgba(22, 18, 15, 0.12)",
    borderRadius: 24,
    borderWidth: 1,
    padding: 16,
    gap: 12,
  },
  logCard: {
    backgroundColor: "#12100d",
    borderRadius: 24,
    padding: 16,
    gap: 8,
  },
  cardTitle: {
    color: "#16120f",
    fontSize: 18,
    fontWeight: "900",
  },
  caption: {
    color: "#685f54",
    fontSize: 12,
    lineHeight: 18,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  field: {
    gap: 6,
  },
  fieldLabel: {
    color: "#685f54",
    fontSize: 12,
    fontWeight: "700",
  },
  input: {
    backgroundColor: "#ffffff",
    borderColor: "rgba(22, 18, 15, 0.12)",
    borderRadius: 14,
    borderWidth: 1,
    color: "#16120f",
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  button: {
    backgroundColor: "#ffd4af",
    borderColor: "rgba(212, 84, 42, 0.42)",
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  darkButton: {
    backgroundColor: "#16120f",
    borderColor: "#16120f",
  },
  buttonText: {
    color: "#16120f",
    fontWeight: "900",
  },
  darkButtonText: {
    color: "#fffaf3",
  },
  logLine: {
    color: "#f5f1e8",
    fontFamily: "monospace",
    fontSize: 12,
    lineHeight: 18,
  },
});
