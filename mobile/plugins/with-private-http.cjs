const { withAndroidManifest, withDangerousMod } = require("expo/config-plugins");
const fs = require("fs");
const path = require("path");

// Cleartext HTTP is disabled unless the build explicitly opts in with
// ZIKKY_HTTP_HOSTS. HTTPS servers need no configuration.
function httpHosts() {
  return (process.env.ZIKKY_HTTP_HOSTS ?? "")
    .split(",")
    .map((host) => host.trim())
    .filter(Boolean);
}

function validate(host) {
  if (!/^[A-Za-z0-9.:\[\]-]+$/.test(host)) {
    throw new Error(
      `ZIKKY_HTTP_HOSTS contains an invalid host: ${JSON.stringify(host)}. ` +
        "Use bare hostnames or IP addresses, comma-separated.",
    );
  }
  return host;
}

module.exports = (config) => {
  const hosts = httpHosts().map(validate);
  config = withAndroidManifest(config, (config) => {
    const app = config.modResults.manifest.application[0];
    app.$["android:usesCleartextTraffic"] = "false";
    app.$["android:networkSecurityConfig"] = "@xml/network_security_config";
    return config;
  });
  return withDangerousMod(config, [
    "android",
    async (config) => {
      const dir = path.join(
        config.modRequest.platformProjectRoot,
        "app/src/main/res/xml",
      );
      fs.mkdirSync(dir, { recursive: true });
      const domains = hosts
        .map(
          (host) =>
            `<domain includeSubdomains="false">${host}</domain>`,
        )
        .join("");
      fs.writeFileSync(
        path.join(dir, "network_security_config.xml"),
        `<?xml version="1.0" encoding="utf-8"?>
<network-security-config>
 <base-config cleartextTrafficPermitted="false"><trust-anchors><certificates src="system"/></trust-anchors></base-config>${
   domains
     ? `
 <domain-config cleartextTrafficPermitted="true">${domains}</domain-config>`
     : ""
 }
</network-security-config>`,
      );
      return config;
    },
  ]);
};
