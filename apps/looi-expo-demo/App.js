import { useMemo, useState } from "react";
import { Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";
import {
  LOOI_DRIVE_VALUES,
  LOOI_HEAD_VALUES,
  LOOI_LIGHT_VALUES,
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
      onValue?.({ characteristic, bytes: hexToBytes("59"), hex: "59" });
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
            This Expo app is the React Native consumer for @sourcebug/looi-sdk. It uses a preview
            transport so the UI can run in Expo Go; swap the transport with a native BLE adapter for real robot control.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Session</Text>
          <View style={styles.grid}>
            <DemoButton label="Connect" onPress={() => runAction("connect", () => robot.connect())} />
            <DemoButton label="Handshake" onPress={() => runAction("handshake", () => robot.handshake())} />
            <DemoButton label="Disconnect" onPress={() => runAction("disconnect", () => robot.disconnect())} />
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Drive via fed0</Text>
          <Text style={styles.caption}>SDK values: {JSON.stringify(LOOI_DRIVE_VALUES)}</Text>
          <View style={styles.grid}>
            <DemoButton label="Forward" onPress={() => runAction("drive forward", () => robot.drive("forward"))} />
            <DemoButton label="Left" onPress={() => runAction("drive left", () => robot.drive("left"))} />
            <DemoButton label="Back" onPress={() => runAction("drive back", () => robot.drive("back"))} />
            <DemoButton label="Right" onPress={() => runAction("drive right", () => robot.drive("right"))} />
            <DemoButton label="Stop" variant="dark" onPress={() => runAction("stop", () => robot.stop())} />
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Head + light</Text>
          <Text style={styles.caption}>Head presets: {JSON.stringify(LOOI_HEAD_VALUES)}</Text>
          <View style={styles.grid}>
            <DemoButton label="Head up" onPress={() => runAction("head up", () => robot.setHeadPreset("up"))} />
            <DemoButton label="Neutral" onPress={() => runAction("head neutral", () => robot.setHeadPreset("neutral"))} />
            <DemoButton label="Head down" onPress={() => runAction("head down", () => robot.setHeadPreset("down"))} />
            <DemoButton
              label={lightOn ? `Light off (${LOOI_LIGHT_VALUES.off})` : `Light on (${LOOI_LIGHT_VALUES.on})`}
              onPress={() => runAction("toggle light", async () => {
                await robot.setLight(!lightOn);
                setLightOn(!lightOn);
              })}
            />
          </View>
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
