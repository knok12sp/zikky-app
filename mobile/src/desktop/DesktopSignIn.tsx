import { useState } from "react";
import { Text, View } from "react-native";
import { useSession } from "../session";
import { normalizeServers } from "../api";
import { Action, Field, Label, useTheme } from "../ui";
import { Banner, Card } from "../kit";
import { radius, spacing, type } from "../theme";
import { Icon } from "../icon";

export function DesktopSignIn() {
  const { colors } = useTheme();
  const { login, restoreError } = useSession();
  const [servers, setServers] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  function submit() {
    setBusy(true);
    setError("");
    Promise.resolve()
      .then(() => {
        const addresses = normalizeServers(servers);
        return login({
          server: addresses[0]!,
          alternateServers: addresses.slice(1),
          username,
          password,
        });
      })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setBusy(false));
  }

  return (
    <View
      style={{
        flex: 1,
        width: "100%",
        backgroundColor: colors.bg,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        padding: spacing.xxxl,
        gap: 72,
      }}
    >
      <View style={{ width: 360, gap: spacing.lg }}>
        <View
          style={{
            width: 56,
            height: 56,
            borderRadius: 16,
            backgroundColor: colors.accent,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Icon name="note" size={30} color={colors.onAccent} />
        </View>
        <Text
          style={[type.display, { color: colors.text, letterSpacing: 5 }]}
        >
          ZIKKY
        </Text>
        <Text style={[type.title, { color: colors.text, letterSpacing: -0.8 }]}>
          Your music, on your own terms.
        </Text>
        <Text style={[type.body, { color: colors.muted }]}>
          A quiet desktop player for the library on your Zikky server. Stream
          over your home network or a private connection — nothing is copied to
          this computer.
        </Text>
        <View
          style={{
            height: 1,
            backgroundColor: colors.border,
            marginVertical: spacing.sm,
          }}
        />
        <Text style={[type.micro, { color: colors.faint }]}>
          SERVER LIBRARY · STREAMING · PLAYLISTS
        </Text>
      </View>
      <Card style={{ width: 420, padding: spacing.xxl, gap: spacing.lg }}>
        <View style={{ gap: 4 }}>
          <Text style={[type.heading, { color: colors.text }]}>Connect</Text>
          <Text style={[type.meta, { color: colors.muted }]}>
            Sign in to the server that holds your music.
          </Text>
        </View>
        <Field
          label="Server address"
          value={servers}
          onChange={setServers}
          placeholder="https://music.example.com"
          maxLength={1024}
        />
        <Text style={[type.micro, { color: colors.faint }]}>
          UP TO FOUR ADDRESSES, ONE PER LINE. THE FIRST IS PRIMARY.
        </Text>
        <Field
          label="Username"
          value={username}
          onChange={setUsername}
          maxLength={256}
        />
        <Field
          label="Password"
          value={password}
          onChange={setPassword}
          secret
          maxLength={512}
          onSubmit={submit}
        />
        <Action
          title={busy ? "Testing connection…" : "Connect"}
          variant="primary"
          disabled={busy || !servers.trim() || !username || !password}
          onPress={submit}
        />
        {!!(error || restoreError) && (
          <Banner
            tone="danger"
            title={error || restoreError || "Could not connect"}
          />
        )}
        <Text style={[type.micro, { color: colors.faint }]}>
          Credentials stay in the system keyring when one is available.
          Otherwise they are kept only for this session and never written to
          plain storage.
        </Text>
      </Card>
    </View>
  );
}
