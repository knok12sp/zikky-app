const { withAppBuildGradle } = require("expo/config-plugins");
module.exports = (config) =>
  withAppBuildGradle(config, (config) => {
    const old =
      "release {\n            // Caution! In production, you need to generate your own keystore file.";
    if (!config.modResults.contents.includes(old))
      throw new Error(
        "Android release signing template changed; review before building.",
      );
    config.modResults.contents = config.modResults.contents.replace(
      /(release \{[\s\S]*?)signingConfig signingConfigs.debug/,
      "$1signingConfig null",
    );
    return config;
  });
