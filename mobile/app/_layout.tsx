import React, { useEffect, useState } from "react";
import { Stack, usePathname } from "expo-router";
import { Platform, View, Text } from "react-native";
import { useAppFonts } from "../src/fonts";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { SessionProvider, useSession } from "../src/session";
import { PlaybackProvider } from "../src/playback";
import { BookPlaybackProvider } from "../src/book-playback";
import {
  ThemeProvider,
  Page,
  Field,
  Action,
  Label,
  Busy,
  useTheme,
} from "../src/ui";
import { MiniPlayer } from "../src/components";
import { normalizeServers } from "../src/api";
import { Banner } from "../src/kit";
import { radius, spacing, type } from "../src/theme";
import { DesktopApp } from "../src/desktop/DesktopApp";
import { DesktopSignIn } from "../src/desktop/DesktopSignIn";
function Gate() {
  const { session, loading, restoreError, login } = useSession();
  const { colors } = useTheme();
  const pathname = usePathname();
  const [serversText, setServersText] = useState(""),
    [username, setUsername] = useState(""),
    [password, setPassword] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  if (loading)
    return (
      <Page title="Zikky">
        <Busy label="Connecting to your library" />
      </Page>
    );
  if (!session && Platform.OS === "web") return <DesktopSignIn />;
  if (!session)
    return (
      <Page
        title="Zikky"
        subtitle="Your music. Your server. One quiet place to listen."
      >
        <View
          style={{
            borderRadius: radius.sm,
            borderWidth: 1,
            borderColor: colors.borderStrong,
            backgroundColor: colors.surfaceInset,
            padding: spacing.lg,
            gap: spacing.xs,
          }}
        >
          <Text
            style={[type.hero, { color: colors.text, letterSpacing: 7 }]}
          >
            ZIKKY
          </Text>
          <Text style={[type.micro, { color: colors.faint }]}>
            PERSONAL MUSIC PLAYER
          </Text>
          <View
            style={{
              height: 1,
              backgroundColor: colors.border,
              marginVertical: 8,
            }}
          />
          <Text style={[type.meta, { color: colors.muted }]}>
            Connect to your music server over your home network or a private
            remote connection.
          </Text>
        </View>
        <View style={{ gap: spacing.md }}>
          <Label variant="heading">Connect</Label>
          <Field
            label="Server addresses (up to four; first stays primary)"
            value={serversText}
            onChange={setServersText}
            multiline
            placeholder="http://your-server.local:8787"
          />
          <Label muted variant="meta">
            If one route is unreachable, Zikky tries the next. Keep the first
            address unchanged when adding routes so your phone downloads stay
            linked to this account.
          </Label>
          <View style={{ height: 12 }} />
          <Field label="Username" value={username} onChange={setUsername} />
          <View style={{ height: 12 }} />
          <Field
            label="Password"
            value={password}
            onChange={setPassword}
            secret
          />
          <View style={{ height: spacing.xs }} />
          <Action
            title={busy ? "Testing connection…" : "Test connection and sign in"}
            variant="primary"
            disabled={busy || !serversText.trim() || !username || !password}
            onPress={() => {
              setBusy(true);
              setError("");
              Promise.resolve()
                .then(() => {
                  const addresses = normalizeServers(serversText);
                  return login({
                    server: addresses[0]!,
                    alternateServers: addresses.slice(1),
                    username,
                    password,
                  });
                })
                .catch((e) => setError(e.message))
                .finally(() => setBusy(false));
            }}
          />
        </View>
        {!!(error || restoreError) && (
          <Banner
            tone="danger"
            title={error || restoreError || "Could not connect"}
          />
        )}
        <Label muted variant="micro">
          Credentials are stored in your device’s secure storage. Private HTTP
          is allowed only for hosts included in your native build.
        </Label>
      </Page>
    );
  return (
    <PlaybackProvider key={session.scope}>
      {Platform.OS === "web" ? (
        <View style={{ flex: 1, backgroundColor: colors.bg }}>
          <View style={{ display: "none" }} aria-hidden>
            <Stack
              screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: colors.bg },
              }}
            />
          </View>
          <View
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: colors.bg,
            }}
          >
            <DesktopApp />
          </View>
        </View>
      ) : (
        <BookPlaybackProvider>
        <View style={{ flex: 1, backgroundColor: colors.bg }}>
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: colors.bg },
            }}
          />
          {!["/", "/library", "/search", "/books", "/book", "/player", "/queue"].includes(
            pathname,
          ) && <MiniPlayer />}
        </View>
        </BookPlaybackProvider>
      )}
    </PlaybackProvider>
  );
}
export default function Layout() {
  const [fontsLoaded] = useAppFonts();
  useEffect(() => {
    if (Platform.OS !== "web" || typeof document === "undefined") return;
    const style = document.createElement("style");
    style.textContent =
      '[role="button"]:focus-visible, a:focus-visible { outline: 1.5px solid var(--zikky-focus, #E9A13B); outline-offset: 2px; }';
    document.head.appendChild(style);
    return () => style.remove();
  }, []);
  if (!fontsLoaded) return <View style={{ flex: 1 }} />;
  return (
    <SafeAreaProvider style={{ flex: 1, width: "100%" }}>
      <ThemeProvider>
        <View style={{ flex: 1, width: "100%" }}>
          <SessionProvider>
            <Gate />
          </SessionProvider>
        </View>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
