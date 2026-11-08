import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.jtech.jexa',
  appName: 'JEXA',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
};

export default config;
