
import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.albayan.quran',
  appName: 'البيان',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    // Disable default offline error page - app handles offline mode gracefully
    errorPath: undefined
  },
  plugins: {
    LocalNotifications: {
      smallIcon: "ic_stat_moon",
      iconColor: "#486581",
      sound: "azhan.wav",
    },
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"],
    },
  },
};

export default config;
