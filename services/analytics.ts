
import { FirebaseAnalytics } from '@capacitor-firebase/analytics';
import { FirebaseCrashlytics } from '@capacitor-firebase/crashlytics';
import { Capacitor } from '@capacitor/core';

// Helper to check if we are native to avoid web errors if config is missing
const isNative = Capacitor.isNativePlatform();

export const AnalyticsService = {
  
  /**
   * Initialize Analytics & Crashlytics
   */
  init: async () => {
    if (!isNative) {
      console.log('Analytics: Web Mode (Mocked)');
      return;
    }
    try {
      await FirebaseAnalytics.setEnabled({ enabled: true });
      await FirebaseCrashlytics.setEnabled({ enabled: true });
      console.log('Firebase Analytics & Crashlytics Initialized');
    } catch (e) {
      console.error('Failed to init Firebase', e);
    }
  },

  /**
   * Log which screen the user is viewing
   */
  logScreen: async (screenName: string, screenClass: string = 'MainActivity') => {
    if (!isNative) {
      console.log(`[Analytics] Screen View: ${screenName}`);
      return;
    }
    try {
      await FirebaseAnalytics.logEvent({
        name: 'screen_view',
        params: {
          firebase_screen: screenName,
          firebase_screen_class: screenClass
        }
      });
    } catch (e) {
      console.warn('Analytics Error', e);
    }
  },

  /**
   * Log specific user actions (e.g., Reading a Surah, Playing Radio)
   */
  logEvent: async (eventName: string, params: Record<string, any> = {}) => {
    if (!isNative) {
      console.log(`[Analytics] Event: ${eventName}`, params);
      return;
    }
    try {
      await FirebaseAnalytics.logEvent({
        name: eventName,
        params: params
      });
    } catch (e) {
      console.warn('Analytics Error', e);
    }
  },

  /**
   * Set user properties (e.g., Preferred Reciter, Dark Mode status)
   */
  setUserProperty: async (name: string, value: string) => {
    if (!isNative) return;
    try {
      await FirebaseAnalytics.setUserProperty({
        name,
        value,
      });
    } catch (e) {}
  },

  /**
   * Manually record a non-fatal error to Crashlytics
   */
  recordError: async (error: any, message: string) => {
    if (!isNative) {
      console.error(`[Crashlytics] ${message}`, error);
      return;
    }
    try {
      await FirebaseCrashlytics.recordException({
        message: `${message}: ${JSON.stringify(error)}`
      });
    } catch (e) {}
  }
};
