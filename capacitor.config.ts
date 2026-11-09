import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.jtech.jexa',
  appName: 'JEXA',
  webDir: 'dist',
  backgroundColor: '#05080f',
  server: {
    androidScheme: 'https',
  },
  android: {
    backgroundColor: '#05080f',
    allowMixedContent: true,
  },
};

export default config;
