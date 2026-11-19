import { useState } from "react";
import { Text, View, useWindowDimensions } from "react-native";
import { useSession } from "../session";
import { normalizeServers } from "../api";
import { Action, Field, useTheme } from "../ui";
import { Banner } from "../kit";
import { font, radius, spacing, type } from "../theme";
import { Icon } from "../icon";

export function DesktopSignIn() {
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const narrow = width < 980;
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

  const brand = (
    <View style={{ gap: spacing.lg, maxWidth: 460 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <View
          style={{
            width: 7,
            height: 7,
            backgroundColor: busy ? colors.accent : colors.borderStrong,
          }}
        />
        <Text style={[type.micro, { color: colors.faint }]}>
          {busy ? "LINKING" : "STANDBY"}
        </Text>
      </View>
      <Text
        accessibilityRole="header"
        style={{
          fontFamily: font.uiBold,
          fontSize: narrow ? 38 : 56,
          lineHeight: narrow ? 42 : 58,
          letterSpacing: narrow ? 4 : 8,
          color: colors.text,
        }}
      >
        ZIKKY
      </Text>
      <View style={{ height: 1, backgroundColor: colors.border }} />
      <Text style={[type.title, { color: colors.text, maxWidth: 420 }]}>
        Your music, on your own terms.
      </Text>
      <Text style={[type.body, { color: colors.muted, maxWidth: 400 }]}>
        A quiet desktop player for the library on your Zikky server. Stream over
        your home network or a private connection — nothing is copied to this
        computer.
      </Text>
      <Text style={[type.micro, { color: colors.faint, marginTop: spacing.sm }]}>
        SERVER LIBRARY · STREAMING · PLAYLISTS
      </Text>
    </View>
  );

  return (
    <View
      style={{
        flex: 1,
        width: "100%",
        backgroundColor: colors.bg,
        flexDirection: narrow ? "column" : "row",
        alignItems: "center",
        justifyContent: "center",
        padding: narrow ? spacing.xl : 64,
        gap: narrow ? spacing.xxl : 96,
      }}
    >
      {brand}

      <View
        style={{
          width: Math.min(narrow ? 999 : 420, 440),
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: radius.md,
          backgroundColor: colors.surface,
          overflow: "hidden",
        }}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            paddingHorizontal: spacing.lg,
            paddingVertical: spacing.md,
            borderBottomWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.metal,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Icon name="server" size={14} color={colors.muted} />
            <Text style={[type.micro, { color: colors.muted }]}>
              SERVER LINK
            </Text>
          </View>
          <Text style={[type.micro, { color: colors.faint }]}>
            {busy ? "TRYING" : "IDLE"}
          </Text>
        </View>

        <View style={{ padding: spacing.xl, gap: spacing.lg }}>
          <Text style={[type.meta, { color: colors.muted }]}>
            Sign in to the server that holds your music.
          </Text>
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
        </View>

        <View
          style={{
            borderTopWidth: 1,
            borderColor: colors.border,
            paddingHorizontal: spacing.lg,
            paddingVertical: spacing.md,
            backgroundColor: colors.surfaceInset,
          }}
        >
          <Text style={[type.micro, { color: colors.faint, lineHeight: 17 }]}>
            CREDENTIALS STAY IN THE SYSTEM KEYRING WHEN ONE IS AVAILABLE.
            OTHERWISE THEY ARE KEPT ONLY FOR THIS SESSION AND NEVER WRITTEN TO
            PLAIN STORAGE.
          </Text>
        </View>
      </View>
    </View>
  );
}
