import { ExpoConfig } from "expo/config";

// HTTP is opt-in at build time. Set ZIKKY_HTTP_HOSTS to a comma-separated list
// of bare hostnames or IP addresses that your server uses over plain HTTP.
// HTTPS servers need no entry here.
const httpHosts = (process.env.ZIKKY_HTTP_HOSTS ?? "")
  .split(",")
  .map((host: string) => host.trim())
  .filter(Boolean);

const config: ExpoConfig = {
  name: "Zikky",
  slug: "zikky",
  scheme: "zikky",
  icon: "./assets/icon.png",
  version: "0.6.0",
  orientation: "portrait",
  userInterfaceStyle: "automatic",
  ios: {
    bundleIdentifier: "app.zikky.music",
    buildNumber: "6",
    supportsTablet: true,
    infoPlist: {
      NSLocalNetworkUsageDescription:
        "Connect to your personal music server on your home network.",
      NSAppTransportSecurity: {
        NSExceptionDomains: Object.fromEntries(
          httpHosts.map((host: string) => [
            host,
            {
              NSExceptionAllowsInsecureHTTPLoads: true,
              NSIncludesSubdomains: false,
            },
          ]),
        ),
      },
    },
  },
  android: {
    package: "app.zikky.music",
    versionCode: 6,
    permissions: ["android.permission.INTERNET"],
    blockedPermissions: ["android.permission.RECORD_AUDIO"],
    adaptiveIcon: {
      foregroundImage: "./assets/icon.png",
      backgroundColor: "#101914",
    },
  },
  plugins: [
    "expo-router",
    [
      "expo-audio",
      {
        enableBackgroundPlayback: true,
        enableBackgroundRecording: false,
        microphonePermission: false,
      },
    ],
    "expo-secure-store",
    "expo-sqlite",
    "expo-asset",
    "expo-sharing",
    "./plugins/with-private-http.cjs",
    "./plugins/with-unsigned-release.cjs",
  ],
  experiments: { typedRoutes: true },
};
export default config;
