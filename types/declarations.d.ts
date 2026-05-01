
// This file helps TypeScript understand plugins even if they aren't fully installed yet
// or if their types are missing.

declare module '@capacitor-firebase/analytics' {
  export class FirebaseAnalytics {
    static setEnabled(options: { enabled: boolean }): Promise<void>;
    static logEvent(options: { name: string; params: any }): Promise<void>;
    static setUserId(options: { userId: string }): Promise<void>;
    static setUserProperty(options: { name: string; value: string }): Promise<void>;
    static setScreenName(options: { screenName: string; screenClassOverride?: string }): Promise<void>;
  }
}

declare module '@capacitor-firebase/crashlytics' {
  export class FirebaseCrashlytics {
    static setEnabled(options: { enabled: boolean }): Promise<void>;
    static recordException(options: { message: string }): Promise<void>;
    static log(options: { message: string }): Promise<void>;
  }
}

declare module '@capacitor-firebase/remote-config' {
  export class FirebaseRemoteConfig {
    static fetchAndActivate(): Promise<void>;
    static getString(options: { key: string }): Promise<{ value: string }>;
    static getBoolean(options: { key: string }): Promise<{ value: boolean }>;
    static getNumber(options: { key: string }): Promise<{ value: number }>;
  }
}

declare module '@capacitor/local-notifications' {
  export interface LocalNotificationSchema {
    id: number;
    title: string;
    body: string;
    schedule?: { at?: Date; repeats?: boolean; every?: 'year'|'month'|'two-weeks'|'week'|'day'|'hour'|'minute'|'second' };
    sound?: string;
    smallIcon?: string;
    channelId?: string;
    actionTypeId?: string;
    extra?: any;
  }
  
  export class LocalNotifications {
    static requestPermissions(): Promise<{ display: 'granted' | 'denied' | 'prompt' }>;
    static createChannel(channel: any): Promise<void>;
    static schedule(options: { notifications: LocalNotificationSchema[] }): Promise<any>;
    static getPending(): Promise<{ notifications: LocalNotificationSchema[] }>;
    static cancel(pending: { notifications: LocalNotificationSchema[] }): Promise<void>;
    static addListener(eventName: string, listenerFunc: (notification: any) => void): Promise<any>;
  }
}
