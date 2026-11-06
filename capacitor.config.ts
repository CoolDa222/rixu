import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.local.worklife",
  appName: "日序",
  webDir: "dist",
  server: {
    androidScheme: "http",
  },
  android: {
    allowMixedContent: true,
  },
};

export default config;
