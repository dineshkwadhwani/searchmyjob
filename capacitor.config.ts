import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.searchmyjob.app',
  appName: 'SearchMyJob AI',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  }
};

export default config;
