/**
 * Native Haptic Feedback Service
 * Uses a custom `NativeHaptics` Android plugin for highly reliable raw Vibrator API access.
 * Falls back to `@capacitor/haptics` for iOS, and `navigator.vibrate` for Web.
 */

import { Capacitor, registerPlugin } from '@capacitor/core';
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';

export interface NativeHapticsPlugin {
  vibrate(options: { style: 'light' | 'medium' | 'heavy' | 'success' | 'warning' | 'error' | 'dhikr_change' }): Promise<void>;
}

const NativeHaptics = registerPlugin<NativeHapticsPlugin>('NativeHaptics');
const isNative = Capacitor.isNativePlatform();

/** Light tap — used for each dhikr/tasbih count press */
export async function hapticTap() {
  if (isNative) {
    try {
      await NativeHaptics.vibrate({ style: 'light' });
    } catch {
      Haptics.impact({ style: ImpactStyle.Light }).catch(() => {});
    }
  } else if (navigator.vibrate) {
    navigator.vibrate(8);
  }
}

/** Medium tap — used for button presses, selections, resets */
export async function hapticMedium() {
  if (isNative) {
    try {
      await NativeHaptics.vibrate({ style: 'medium' });
    } catch {
      Haptics.impact({ style: ImpactStyle.Medium }).catch(() => {});
    }
  } else if (navigator.vibrate) {
    navigator.vibrate(20);
  }
}

/** Heavy tap — used for important actions */
export async function hapticHeavy() {
  if (isNative) {
    try {
      await NativeHaptics.vibrate({ style: 'heavy' });
    } catch {
      Haptics.impact({ style: ImpactStyle.Heavy }).catch(() => {});
    }
  } else if (navigator.vibrate) {
    navigator.vibrate(40);
  }
}

/** Success pattern — used when completing a dhikr/tasbih target */
export async function hapticSuccess() {
  if (isNative) {
    try {
      await NativeHaptics.vibrate({ style: 'success' });
    } catch {
      Haptics.notification({ type: NotificationType.Success }).catch(() => {});
    }
  } else if (navigator.vibrate) {
    navigator.vibrate([40, 30, 40]);
  }
}

/** Warning pattern — used for confirmations, alerts */
export async function hapticWarning() {
  if (isNative) {
    try {
      await NativeHaptics.vibrate({ style: 'warning' });
    } catch {
      Haptics.notification({ type: NotificationType.Warning }).catch(() => {});
    }
  } else if (navigator.vibrate) {
    navigator.vibrate([50, 50, 50]);
  }
}

/** Error pattern — used for wrong answers, errors */
export async function hapticError() {
  if (isNative) {
    try {
      await NativeHaptics.vibrate({ style: 'error' });
    } catch {
      Haptics.notification({ type: NotificationType.Error }).catch(() => {});
    }
  } else if (navigator.vibrate) {
    navigator.vibrate([50, 100, 50]);
  }
}

/** Elegant transition double pulse — used when switching to a different dhikr */
export async function hapticDhikrChange() {
  if (isNative) {
    try {
      await NativeHaptics.vibrate({ style: 'dhikr_change' });
    } catch {
      Haptics.notification({ type: NotificationType.Warning }).catch(() => {});
    }
  } else if (navigator.vibrate) {
    navigator.vibrate([60, 80, 60]);
  }
}

