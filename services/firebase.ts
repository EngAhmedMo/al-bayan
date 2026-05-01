
import { FirebaseAnalytics } from '@capacitor-firebase/analytics';
import { FirebaseCrashlytics } from '@capacitor-firebase/crashlytics';
import { FirebaseRemoteConfig } from '@capacitor-firebase/remote-config';
import { Capacitor } from '@capacitor/core';

const isNative = Capacitor.isNativePlatform();

export const FirebaseService = {
  
  /**
   * Initialize all Firebase services
   */
  init: async () => {
    if (!isNative) {
      console.log('Firebase: Web Mode (Mocked)');
      return;
    }
    try {
      // 1. Analytics & Crashlytics
      await FirebaseAnalytics.setEnabled({ enabled: true });
      await FirebaseCrashlytics.setEnabled({ enabled: true });
      
      // 2. Remote Config
      await FirebaseRemoteConfig.fetchAndActivate();
      
      console.log('Firebase Services Initialized');
    } catch (e) {
      console.error('Failed to init Firebase', e);
    }
  },

  /**
   * Get a string value from Remote Config
   * Useful for dynamic banners, messages, or featured content IDs
   */
  getString: async (key: string): Promise<string> => {
    if (!isNative) return '';
    try {
      const { value } = await FirebaseRemoteConfig.getString({ key });
      return value || '';
    } catch (e) {
      console.warn(`Remote Config Error (${key})`, e);
      return '';
    }
  },

  /**
   * Get a boolean value from Remote Config
   * Useful for feature flags (e.g., showing/hiding a section)
   */
  getBoolean: async (key: string): Promise<boolean> => {
    if (!isNative) return false;
    try {
      const { value } = await FirebaseRemoteConfig.getBoolean({ key });
      return value || false;
    } catch (e) {
      return false;
    }
  },

  /**
   * Analytics Wrapper
   */
  logEvent: async (eventName: string, params: Record<string, any> = {}) => {
    if (!isNative) {
      console.log(`[Analytics] ${eventName}`, params);
      return;
    }
    try {
      await FirebaseAnalytics.logEvent({ name: eventName, params });
    } catch (e) {}
  },

  logScreen: async (screenName: string) => {
    if (!isNative) return;
    try {
      await FirebaseAnalytics.logEvent({
        name: 'screen_view',
        params: { firebase_screen: screenName }
      });
    } catch (e) {}
  }
};
