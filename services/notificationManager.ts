import { LocalNotifications } from '@capacitor/local-notifications';
import { Capacitor } from '@capacitor/core';
import { MediaBridge } from './mediaBridge';
import { addNotification, addNotificationWithTimestamp, getStoredAzhan, getStoredAzhanForPrayer, getStoredVolumeForPrayer, getNotificationSettings, hasHifzPlan, getHifzStreak, getSavedLocation, isPerPrayerMuazzinEnabled, getDailyPrayersWithFallback } from './storage';
import { SALAWAT_DEFAULTS } from '../constants/defaults';
import { PrayerData } from '../types';
import { MUAZZINS, getAllMuazzins } from './azhanData';
import { getIslamicEvent, isRamadan, isLastTenOfRamadan, formatHijriDate, gregorianToHijri, getHijriAdjustment } from './islamicCalendar';
import { getMonthPrayerTimes, getCalculationMethod, getMadhab, getHighLatitudeRule, getPrayerAdjustments } from './prayerCalculator';
import { getPlayableAzhanUrl, getAvailableAzhanIds } from './offlineAudio';
import { HifzService } from './HifzService';

// IDs for fixed notifications
const ID_OFFSET_PRAYERS = 10000;
const ID_OFFSET_PRE_PRAYERS = 20000;
const ID_OFFSET_ADHKAR = 30000;
const ID_OFFSET_POST_PRAYER = 40000;
const ID_OFFSET_MISSED_REMINDER = 60000; // New ID range
const ID_FRIDAY = 50001;
const ID_FRIDAY_DUA = 50002;
const ID_QIYAM = 50003;
const ID_SLEEP_ADHKAR = 50004;
const ID_ISLAMIC_EVENT = 50005;
const ID_RAMADAN_IFTAR = 50006;
const ID_RAMADAN_SUHOOR = 50007;
const ID_RAMADAN_LAST_TEN = 50008;
const ID_HIFZ_REMINDER = 50010;
const ID_HIFZ_STREAK = 50011;
const ID_QURAN_READING = 50012;

// IDs of Azhan files confirmed to be in res/raw (bundled)
const BUNDLED_AZHANS = [
  'egy_abdulbasit', 'egy_refat', 'egy_minshawi', 'egy_husary', 'egy_mustafa',
  'egy_ali_mahmoud', 'egy_toubar', 'egy_fashni', 'egy_naqshbandi', 'egy_bahtimi',
  'other_rabeh', 'egy_ibrahim_gabr', 'ksa_suraihi'
];

export const requestNotificationPermission = async () => {
  try {
    if (Capacitor.isNativePlatform()) {
      // 1. Basic Notification Permission (Android 13+)
      // First try standard Capacitor LocalNotifications (standard channel creation)
      const perm = await LocalNotifications.requestPermissions();

      // Also explicit check for POST_NOTIFICATIONS via MediaBridge (if needed)
      await MediaBridge.requestNotificationsPermission();

      if (perm.display === 'granted') {

        // Create a dedicated channel for each bundled Azhan
        for (const id of BUNDLED_AZHANS) {
          const muazzin = MUAZZINS.find(m => m.id === id);
          const name = muazzin ? muazzin.name : id;

          await LocalNotifications.createChannel({
            id: `bayan_azhan_${id}`,
            name: `أذان ${name}`,
            description: 'تنبيهات الصلاة',
            importance: 5,
            visibility: 1,
            sound: `${id}.mp3`,
            vibration: true,
          });
        }

        // Create Silent Channel for Azhan (Visual Only)
        await LocalNotifications.createChannel({
          id: 'bayan_azhan_silent',
          name: 'تنبيهات الصلاة (صامت)',
          description: 'إشعارات وقت الصلاة (الصوت يعمل تلقائياً)',
          importance: 5,
          visibility: 1, // PUBLIC
          sound: undefined,
          vibration: true,
        });

        await LocalNotifications.createChannel({
          id: 'bayan_alerts_v2',
          name: 'تنبيهات البيان',
          description: 'تنبيهات الأذكار والمناسبات',
          importance: 3,
          visibility: 1,
          vibration: true,
        });

        // Pre-prayer channel (softer notification)
        await LocalNotifications.createChannel({
          id: 'bayan_pre_prayer',
          name: 'تذكير قبل الصلاة',
          description: 'تنبيه تحضيري قبل وقت الصلاة',
          importance: 3,
          visibility: 1,
          vibration: true,
        });

        // Missed Prayer Follow-up channel
        await LocalNotifications.createChannel({
          id: 'bayan_missed_prayer',
          name: 'تذكير إتمام الصلاة',
          description: 'تنبيه لمتابعة أداء الصلوات',
          importance: 4,
          visibility: 1,
          vibration: true,
        });
      }
    } else if ('Notification' in window) {
      await Notification.requestPermission();
    }
  } catch (e) {
    console.error("Error requesting permission:", e);
  }
};

export const checkAndRequestExactAlarm = async () => {
  if (!Capacitor.isNativePlatform()) return;
  try {
    const status = await MediaBridge.checkExactAlarmPermission();
    console.log('[NotificationManager] Exact Alarm Status:', status);
    if (!status.canScheduleExactAlarms) {
      await MediaBridge.requestExactAlarmPermission();
    }
  } catch (e) {
    console.warn('[NotificationManager] Failed to check exact alarm permission', e);
  }
};

export const requestBatteryOptimization = async () => {
  if (!Capacitor.isNativePlatform()) return;
  try {
    await MediaBridge.requestBatteryOptimizationBypass();
  } catch (e) {
    console.warn('[NotificationManager] Failed to request battery optimization bypass', e);
  }
};

export const runBackgroundCheckup = async () => {
  if (!Capacitor.isNativePlatform()) return;
  await requestNotificationPermission();
  await checkAndRequestExactAlarm();
  await requestBatteryOptimization();

  // Check Audio Assets Integrity
  try {
    const assets = await MediaBridge.checkSoundAssets();
    if (!assets.allGood) {
      console.warn("⚠️ [NotificationManager] Missing Audio Assets:", assets.missing);
    } else {
      console.log("✅ [NotificationManager] Audio Assets Verified");
    }
  } catch (e) {
    console.warn("Failed to check audio assets", e);
  }
};

const getPrayerMessage = (prayerName: string, isFriday: boolean = false): { title: string, body: string } => {
  // Friday Jumu'ah special message with authentic hadith
  if (isFriday && prayerName === 'الظهر') {
    return {
      title: '🕌 صلاة الجمعة',
      body: 'حان موعد صلاة الجمعة. «من راح في الساعة الأولى فكأنما قرّب بدنة» - متفق عليه'
    };
  }

  switch (prayerName) {
    case 'الفجر':
      return { title: 'صلاة الفجر', body: 'الصلاة خير من النوم.. حان الآن موعد صلاة الفجر' };
    case 'الظهر':
      return { title: 'صلاة الظهر', body: 'حان الآن موعد صلاة الظهر. «أرحنا بها يا بلال»' };
    case 'العصر':
      return { title: 'صلاة العصر', body: 'حافظوا على الصلوات والصلاة الوسطى. حان موعد صلاة العصر' };
    case 'المغرب':
      return { title: 'صلاة المغرب', body: 'اللهم هذا إقبال ليلك وإدبار نهارك فاغفر لي' };
    case 'العشاء':
      return { title: 'صلاة العشاء', body: 'حان الآن موعد صلاة العشاء' };
    default:
      return { title: `حان وقت صلاة ${prayerName}`, body: 'حي على الصلاة، حي على الفلاح' };
  }
};

const getPrePrayerMessage = (prayerName: string, minutes: number, isFriday: boolean = false): { title: string, body: string } => {
  const minutesArabic = minutes === 5 ? 'خمس' : minutes === 10 ? 'عشر' : 'خمس عشرة';

  // Friday Jumu'ah pre-prayer special message
  if (isFriday && prayerName === 'الظهر') {
    return {
      title: '🕌 استعد لصلاة الجمعة',
      body: `بقي ${minutesArabic} دقائق - بكّر للمسجد واغتنم الأجر العظيم`
    };
  }

  switch (prayerName) {
    case 'الفجر':
      return { title: '⏰ استعد لصلاة الفجر', body: `بقي ${minutesArabic} دقائق على صلاة الفجر - استيقظ الآن` };
    case 'المغرب':
      return { title: '⏰ قرب موعد المغرب', body: `بقي ${minutesArabic} دقائق على صلاة المغرب` };
    default:
      return { title: `⏰ قرب موعد صلاة ${prayerName}`, body: `بقي ${minutesArabic} دقائق - استعد للصلاة` };
  }
};

const getPostPrayerMessage = (prayerName: string): { title: string, body: string } => {
  return {
    title: '📿 أذكار ما بعد الصلاة',
    body: `لا تنس أذكار ما بعد صلاة ${prayerName} - سبحان الله ٣٣ والحمد لله ٣٣ والله أكبر ٣٤`
  };
};

// NEW: Follow-up message for missed prayer
const getMissedPrayerMessage = (prayerName: string, isFriday: boolean): { title: string, body: string } => {
  return {
    title: `هل صليت ${isFriday && prayerName === 'الظهر' ? 'الجمعة' : prayerName}؟`,
    body: 'أحب الأعمال إلى الله الصلاة على وقتها. لا تنس توثيق صلاتك في التطبيق للمتابعة.'
  };
};

// 🌙 RAMADAN SPECIAL MESSAGES

const getSuhoorMessage = (): { title: string, body: string } => {
  const messages = [
    { title: '🌙 وقت السحور', body: '«تسحروا فإن في السحور بركة» - متفق عليه' },
    { title: '🌙 استيقظ للسحور', body: 'أكل السحر بركة، فلا تدعوه ولو جرعة ماء' },
    { title: '🍽️ السحور بركة', body: 'فصل ما بين صيامنا وصيام أهل الكتاب أكلة السحر' },
  ];
  return messages[Math.floor(Math.random() * messages.length)];
};

const getIftarMessage = (minutesBefore: number): { title: string, body: string } => {
  const minArabic = minutesBefore === 10 ? 'عشر' : minutesBefore === 15 ? 'خمس عشرة' : String(minutesBefore);
  const messages = [
    { title: '🌅 قرب موعد الإفطار', body: `بقي ${minArabic} دقائق - اللهم لك صمت وعلى رزقك أفطرت` },
    { title: '🌅 استعد للإفطار', body: `بقي ${minArabic} دقائق - للصائم عند فطره دعوة لا ترد` },
    { title: '🍽️ الإفطار قريب', body: `بقي ${minArabic} دقائق - ذهب الظمأ وابتلت العروق` },
  ];
  return messages[Math.floor(Math.random() * messages.length)];
};

const getLastTenNightMessage = (hijriDay: number): { title: string, body: string } => {
  const isOddNight = hijriDay % 2 === 1; // ليلة وتر

  if (isOddNight) {
    // ليالي الوتر - أرجح أوقات ليلة القدر
    const oddMessages = [
      { title: '✨ ليلة قد تكون القدر', body: `ليلة ${hijriDay} - تحرَّها! «خير من ألف شهر»` },
      { title: '🌟 ليلة وتر مباركة', body: `ليلة ${hijriDay} - أكثر من: اللهم إنك عفو تحب العفو فاعف عني` },
      { title: '💎 اغتنم هذه الليلة', body: `ليلة ${hijriDay} - قد تكون ليلة القدر، لا تضيعها!` },
    ];
    return oddMessages[Math.floor(Math.random() * oddMessages.length)];
  } else {
    // ليالي الشفع
    return {
      title: '🌙 ليلة من العشر الأواخر',
      body: `ليلة ${hijriDay} - أكثر من الدعاء والاستغفار وقراءة القرآن`
    };
  }
};

// Progress callback type for UI feedback
export type ScheduleProgressCallback = (progress: number, status: string) => void;

export const scheduleAllNotifications = async (
  ignoredPrayerData?: PrayerData,
  force: boolean = false,
  onProgress?: ScheduleProgressCallback
) => {
  console.log(`[NotificationManager] scheduleAllNotifications called. Force: ${force}`);
  onProgress?.(0, 'جاري تحميل بيانات الصلوات...');

  // ROBUST: Retrieve 30 days of prayers
  const periodPrayers = getMonthPrayerTimes();

  if (!periodPrayers || periodPrayers.length === 0) {
    console.warn('[NotificationManager] No prayer data available, aborting');
    return;
  }

  // 🛡️ CRITICAL FIX: Wipe ALL pending notifications before scheduling new ones
  // This prevents the "Maximum limit of concurrent alarms 500 reached" crash
  if (Capacitor.isNativePlatform()) {
    try {
      // PREVENT INTERRUPTION: Check if Azhan is currently playing
      const state = await MediaBridge.getCurrentAzhanState();
      if (state && state.isPlayingAzhan) {
        console.warn('[NotificationManager] ⚠️ Azhan is currently playing. Skipping full reschedule to prevent interruption.');
        // We stop here. The schedule will be updated next time the app opens or background check runs.
        return;
      }

      console.log('[NotificationManager] 🧹 Wiping all existing alarms before rescheduling...');
      const pending = await LocalNotifications.getPending();
      if (pending.notifications.length > 0) {
        await LocalNotifications.cancel(pending);
      }
      // Also clear native Azhan alarms via MediaBridge
      await MediaBridge.cancelAllScheduledAzhan();
    } catch (e) {
      console.error('[NotificationManager] Warning: Failed to wipe old alarms', e);
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // 🚀 PERFORMANCE: Cache all settings ONCE at the start
  // This prevents 150+ localStorage reads inside the loop
  // ══════════════════════════════════════════════════════════════════════════
  const settings = getNotificationSettings();
  const cachedIsPerPrayer = isPerPrayerMuazzinEnabled();
  const cachedGlobalAzhan = getStoredAzhan();

  // Pre-compute per-prayer settings for all 5 prayers
  const prayerKeys = ['الفجر', 'الظهر', 'العصر', 'المغرب', 'العشاء'];
  const cachedAzhanForPrayer: Record<string, string> = {};
  const cachedVolumeForPrayer: Record<string, number | undefined> = {};

  for (const pName of prayerKeys) {
    cachedAzhanForPrayer[pName] = getStoredAzhanForPrayer(pName);
    cachedVolumeForPrayer[pName] = getStoredVolumeForPrayer(pName);
  }

  onProgress?.(5, 'جاري إلغاء الإشعارات القديمة...');

  try {
    const pending = await LocalNotifications.getPending();
    if (pending.notifications.length > 0) {
      await LocalNotifications.cancel(pending);
    }
    // CLEANUP: Remove old delivered notifications from the system tray
    // @ts-ignore - Methods exist in Capacitor 6 but types might be stale
    const delivered = await LocalNotifications.getDeliveredNotifications();
    if (delivered.notifications.length > 0) {
      // @ts-ignore
      await LocalNotifications.removeDeliveredNotifications({ notifications: delivered.notifications });
    }
  } catch (e) {
    console.warn("[NotificationManager] Could not clear notifications", e);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // 🚨 CRITICAL: Cancel ALL native alarms BEFORE scheduling new ones
  // This prevents the 500 alarm limit overflow crash
  // ══════════════════════════════════════════════════════════════════════════
  if (Capacitor.isNativePlatform()) {
    try {
      const result = await MediaBridge.cancelAllNativeAlarms();
      console.log(`[NotificationManager] 🧹 Cleared previous alarms: Azhan=${result.azhan}, PrePrayer=${result.prePrayer}, Salawat=${result.salawat}, Total=${result.cancelled}`);
    } catch (e) {
      console.warn("[NotificationManager] Could not clear native alarms (first run?)", e);
    }
  }

  const notificationsToSchedule: any[] = [];
  const channelId = `bayan_azhan_silent`;

  // ══════════════════════════════════════════════════════════════════════════
  // 🎯 CRITICAL: ANDROID ALARM BUDGET SYSTEM (SAFE MODE)
  // Android limits total concurrent alarms to 500 per app!
  // ══════════════════════════════════════════════════════════════════════════
  // 
  // Budget Allocation (Safe Target: ~400 alarms, Buffer: 100 checks):
  // ┌─────────────────────────────────────────────────────────────────────────┐
  // │ Azhan (12 days)        : 5 prayers × 12 = 60 alarms                     │
  // │ Pre-Prayer (12 days)   : 5 prayers × 12 = 60 alarms                     │
  // │ Salawat (dynamic)      : MAX 250 alarms (Increased for Sustainability)  │
  // │ Visual (3 days)        : ~40 notifications                              │
  // └─────────────────────────────────────────────────────────────────────────┘
  // TOTAL: ~410 alarms (Safe < 500)
  //
  // Sustainability: Smart Reschedule runs every 3 days to extend this window.
  //
  const ALARM_BUDGET = {
    AZHAN_DAYS: 12,              // Safe 12 days window
    PRE_PRAYER_DAYS: 12,         // Safe 12 days window
    SALAWAT_MAX: 250,            // Increased to cover ~4 days of high density
    VISUAL_DETAILS_DAYS: 3       // Keep visual details short
  };

  const nativeAzhanAlarms: any[] = [];
  const nativePrePrayerAlerts: any[] = []; // For native audio alerts before prayer

  // ══════════════════════════════════════════════════════════════════════════
  // 🧹 RESCUE CLEANUP: Kill "Ghost Alarms" (Range 70000-72000)
  // This removes alarms from the old duplicate logic block.
  // ══════════════════════════════════════════════════════════════════════════
  if (Capacitor.isNativePlatform()) {
    try {
      // Blind cancellation of the "Ghost" range
      await MediaBridge.cancelAlarmRange({ startId: 70000, endId: 72000 });
      console.log("[NotificationManager] 👻 Ghost alarms (70000-72000) purged.");

    } catch (e) {
      console.warn("[NotificationManager] Failed to purge ghost alarms", e);
    }
  }

  // 1. Resolve Available Muazzins for Random Pool once (Smart Pool)
  const allAvailableAzhanIds = await getAvailableAzhanIds();
  const randomPool = allAvailableAzhanIds.filter(id => id !== 'random');

  // Loop through days (use DAYS_TO_SCHEDULE_NATIVE for native alarms limit)
  for (let dayIndex = 0; dayIndex < periodPrayers.length; dayIndex++) {
    const dayData = periodPrayers[dayIndex];
    const timings = dayData.timings;
    const baseDate = dayData.date.object;
    const dayIDOffset = dayIndex * 100; // Separation per day

    // Should we schedule detailed visual notifications for this day?
    const isDetailedDay = dayIndex < ALARM_BUDGET.VISUAL_DETAILS_DAYS;

    // --- 1. Schedule Prayers (Salah) ---
    if (settings.salah.enabled) {
      const prayers = [
        { name: 'الفجر', val: timings.Fajr, id: 1 },
        { name: 'الظهر', val: timings.Dhuhr, id: 2 },
        { name: 'العصر', val: timings.Asr, id: 3 },
        { name: 'المغرب', val: timings.Maghrib, id: 4 },
        { name: 'العشاء', val: timings.Isha, id: 5 },
      ];

      // Detect Friday for special Jumu'ah handling
      const isFriday = baseDate.getDay() === 5;

      for (const p of prayers) {
        const scheduleTime = parseTimeOnDate(p.val, baseDate);

        // Only schedule if time is in the future
        if (scheduleTime > new Date()) {
          const uniqueId = ID_OFFSET_PRAYERS + dayIDOffset + p.id;

          // Pass isFriday for Jumu'ah special messages
          const msg = getPrayerMessage(p.name, isFriday);
          const timestamp = scheduleTime.getTime();

          // --- PRIORITY A: NATIVE AUDIO AZHAN (Batch Collection) ---
          // Schedule for full month (30 days) - 150 alarms within budget
          if (Capacitor.isNativePlatform() && dayIndex < ALARM_BUDGET.AZHAN_DAYS) {
            // 1. Get Preferred Muazzin (Using Cached Values)
            let targetId = cachedAzhanForPrayer[p.name] || cachedGlobalAzhan;
            const originalId = targetId;

            // 2. Random Mode (Smart Pool)
            if (targetId === 'random') {
              targetId = randomPool[Math.floor(Math.random() * randomPool.length)];
              console.log(`[AzhanSchedule] 🔀 Random mode: Selected '${targetId}' from pool`);
            }

            // 3. VALIDATION: Ensure targetId is valid (bundled or custom)
            const { BUNDLED_AZHAN_IDS, isBundledMuazzin } = await import('./azhanData');
            const isValidBundled = isBundledMuazzin(targetId);
            const isCustom = targetId.startsWith('custom_');

            if (!isValidBundled && !isCustom) {
              console.warn(`[AzhanSchedule] ⚠️ Invalid muazzin ID: ${targetId}, skipping`);
              continue; // Skip this prayer's alarm - don't schedule invalid ID
            }

            const muazzinName = getAllMuazzins().find(m => m.id === targetId)?.name || 'البيان';

            // SIMPLIFIED URL RESOLUTION:
            // - Bundled files (res/raw): Kotlin resolves by ID directly. No URL needed!
            // - Custom files (user-uploaded): Need file:// URL for path resolution.
            let azhanUrl = '';

            // Only resolve URL for custom muazzins
            if (isCustom) {
              try {
                const { getPlayableAzhanUrlForNative } = await import('./offlineAudio');
                const resolvedUrl = await getPlayableAzhanUrlForNative(targetId);

                // VALIDATION: If custom file is missing, skip this alarm
                if (!resolvedUrl) {
                  console.warn(`[AzhanSchedule] ⚠️ Custom file missing: ${targetId}, skipping alarm`);
                  continue; // Skip - don't schedule alarm for missing file
                }

                azhanUrl = resolvedUrl;
                console.log(`[AzhanSchedule] 📁 Custom file URL: ${azhanUrl}`);
              } catch (e) {
                console.warn(`[AzhanSchedule] ❌ Failed to resolve custom azhan: ${targetId}`, e);
                continue; // Skip - don't schedule if resolution failed
              }
            }
            // For bundled IDs: azhanUrl stays empty. Kotlin uses muazzinId to find in res/raw.

            // 4. Resolve Volume (Using Cached Values)
            const cachedVolume = cachedVolumeForPrayer[p.name];
            const volume = cachedVolume !== undefined ? cachedVolume : (settings.salah.azhanVolume ?? 80);

            // 📊 Summary log (condensed for performance)
            if (dayIndex === 0) {
              console.log(`[AzhanSchedule] 📿 ${p.name} (${p.val}) → ${targetId} @ ${volume}%`);
            }

            nativeAzhanAlarms.push({
              id: uniqueId,
              time: timestamp,
              muazzinId: targetId,
              muazzinName: muazzinName,
              prayerName: isFriday && p.name === 'الظهر' ? 'الجمعة' : p.name,
              volume: volume,
              azhanUrl: azhanUrl // Empty for bundled, file:// path for custom
            });

          }

          // --- PRIORITY B: VISUAL REMINDERS (Limited Scope) ---
          if (isDetailedDay) {
            // Visual Notification (Redundant if Audio plays, but good fallback for silent mode)
            notificationsToSchedule.push({
              id: uniqueId,
              title: msg.title,
              body: msg.body,
              schedule: { at: scheduleTime },
              channelId: channelId,
              sound: null,
              smallIcon: 'ic_launcher',
              actionTypeId: '',
              extra: { type: 'prayer', name: p.name }
            });

            // Pre-Prayer Notification
            if (settings.salah.preNotification) {
              const preTime = new Date(timestamp - settings.salah.preNotificationMinutes * 60000);
              if (preTime > new Date()) {
                const preMsg = getPrePrayerMessage(p.name, settings.salah.preNotificationMinutes, isFriday);

                // Schedule native audio alert (30 days) - 150 alarms within budget
                if (Capacitor.isNativePlatform() && dayIndex < ALARM_BUDGET.PRE_PRAYER_DAYS) {
                  nativePrePrayerAlerts.push({
                    id: ID_OFFSET_PRE_PRAYERS + dayIDOffset + p.id,
                    time: preTime.getTime(),
                    prayerName: isFriday && p.name === 'الظهر' ? 'الجمعة' : p.name,
                    alertSound: settings.salah.preNotificationSound || 'alert_prayer_reminder', // قراءة الصوت المختار
                    volume: settings.salah.azhanVolume ?? 80
                  });
                }

                // Visual notification (limited to first 3 days)
                notificationsToSchedule.push({
                  id: ID_OFFSET_PRE_PRAYERS + dayIDOffset + p.id,
                  title: preMsg.title,
                  body: preMsg.body,
                  schedule: { at: preTime },
                  channelId: 'bayan_pre_prayer',
                  smallIcon: 'ic_launcher',
                  extra: { type: 'pre_prayer', name: p.name }
                });
              }
            }

            // Post-Prayer Adhkar
            if (settings.adhkar.afterPrayer.enabled) {
              // Post-prayer adhkar: 25 minutes after prayer, except Friday Jumu'ah (75 minutes for khutbah + prayer)
              const postDelayMinutes = (isFriday && p.name === 'الظهر') ? 75 : 25;
              const postTime = new Date(timestamp + postDelayMinutes * 60000);
              if (postTime > new Date()) {
                const displayName = (isFriday && p.name === 'الظهر') ? 'الجمعة' : p.name;
                const postMsg = getPostPrayerMessage(displayName);
                notificationsToSchedule.push({
                  id: ID_OFFSET_POST_PRAYER + dayIDOffset + p.id,
                  title: postMsg.title,
                  body: postMsg.body,
                  schedule: { at: postTime },
                  channelId: 'bayan_alerts_v2',
                  smallIcon: 'ic_launcher',
                  extra: { type: 'post_prayer_adhkar', name: displayName, deepLink: '/tasbih' }
                });
              }
            }
          }
        }
      } // End for (const p of prayers)
    } // End if (settings.salah.enabled)


    // --- 1.5 Friday Kahf Reminder (only on Fridays) ---
    if (baseDate.getDay() === 5 && settings.friday?.kahfReminder?.enabled && isDetailedDay) {
      const kahfTime = settings.friday.kahfReminder.time || '10:00';
      const kahfScheduleTime = parseTimeOnDate(kahfTime, baseDate);

      if (kahfScheduleTime > new Date()) {
        notificationsToSchedule.push({
          id: 50000 + dayIDOffset, // Unique ID for Kahf reminders
          title: '📖 سورة الكهف',
          body: '«من قرأ سورة الكهف في يوم الجمعة أضاء له من النور ما بين الجمعتين»',
          schedule: { at: kahfScheduleTime },
          channelId: 'bayan_alerts_v2',
          smallIcon: 'ic_launcher',
          extra: {
            type: 'kahf_reminder',
            deepLink: '/reader?page=293' // Direct link to start of Surah Kahf (Page 293 in Madani Mushaf)
          }
        });
      }
    }

    // --- 3. Hifz Reminder (Smart & Motivational) ---
    const hifzState = HifzService.loadState();

    // Helper for templates
    const getRandomTemplate = <T>(templates: T[]): T => templates[Math.floor(Math.random() * templates.length)];
    const toArabicDigitsStr = (n: number) => n.toString().replace(/\d/g, d => '٠١٢٣٤٥٦٧٨٩'[parseInt(d)]);

    // 3.1 Memorization Reminders
    if (hifzState.isSetup && hifzState.notificationEnabled && hifzState.notificationTime && hifzState.selectedDays?.includes(baseDate.getDay())) {
      const hifzTime = parseTimeOnDate(hifzState.notificationTime, baseDate);

      if (hifzTime > new Date()) {
        const HIFZ_TEMPLATES = [
          { title: '📖 ورد الحفظ اليومي', body: 'حان وقت وردك! {amount} {unit} في انتظارك ({location})' },
          { title: '🌟 همتك عالية!', body: 'اليوم {amount} {unit} جديدة تنتظرك. ابدأ من {location}' },
          { title: '💎 قرآنك ينتظرك', body: 'لديك {amount} {unit} للحفظ. استمر، أنت بطل!' },
          { title: '🕌 بارك الله في جهدك', body: 'وردك اليومي: {amount} {unit} ({location}). توكل على الله' },
          { title: '✨ وقت الحفظ', body: 'القرآن ربيع القلوب. لديك {amount} {unit} في {location}' },
          { title: '🌙 لا تقطع السلسلة!', body: 'حافظ على استمراريتك: {amount} {unit} من {location}' },
          { title: '📚 ورد اليوم', body: '{amount} {unit} فقط! ابدأ من {location} واجعلها عادة' },
          { title: '🔥 سلسلتك مستمرة!', body: 'استمراريتك: {streak} يوم! لا تكسرها' },
          { title: '🎯 اقتربت من الهدف', body: 'تقدمك رائع! {amount} {unit} جديدة تقربك من الختم' },
        ];

        const template = getRandomTemplate(HIFZ_TEMPLATES);
        const unitLabel = hifzState.planType === 'pages' ? 'صفحات' : 'آيات';
        const location = hifzState.startPoint + hifzState.currentProgress;
        const streak = HifzService.calculateStreak(hifzState);

        const msgTitle = template.title;
        const msgBody = template.body
          .replace('{amount}', toArabicDigitsStr(hifzState.amountPerDay))
          .replace('{unit}', unitLabel)
          .replace('{location}', `صفحة ${toArabicDigitsStr(location)}`)
          .replace('{streak}', toArabicDigitsStr(streak));

        // Use standard alert if today is done
        const finalBody = hifzState.todayRevisionDone && hifzState.lastCompletedDate === HifzService.getTodayString()
          ? 'أحسنت! أتممت وردك اليوم. حافظ على المراجعة.'
          : msgBody;

        notificationsToSchedule.push({
          id: ID_HIFZ_REMINDER + dayIDOffset,
          title: msgTitle,
          body: finalBody,
          schedule: { at: hifzTime },
          channelId: 'bayan_alerts_v2',
          smallIcon: 'ic_launcher',
          extra: { type: 'hifz_reminder', deepLink: '/hifz' }
        });
      }
    }

    // --- 2. Morning/Evening Adhkar (Only for Detailed Days) ---
    if (isDetailedDay) {
      if (settings.adhkar.morning.enabled) {
        const fajrTime = parseTimeOnDate(timings.Fajr, baseDate);
        const morningAdhkarTime = new Date(fajrTime.getTime() + 60 * 60000); // 1 hour after Fajr
        if (morningAdhkarTime > new Date()) {
          notificationsToSchedule.push({
            id: ID_OFFSET_ADHKAR + dayIDOffset + 1,
            title: '🌅 أذكار الصباح',
            body: 'ابدأ يومك بذكر الله: «أصبحنا وأصبح الملك لله»',
            schedule: { at: morningAdhkarTime },
            channelId: 'bayan_alerts_v2',
            smallIcon: 'ic_stat_moon',
            extra: { type: 'morning_adhkar', category: 'morning', deepLink: '/adhkar?category=أذكار%20الصباح' }
          });
        }
      }

      if (settings.adhkar.evening.enabled) {
        const maghribTime = parseTimeOnDate(timings.Maghrib, baseDate);
        const eveningAdhkarTime = new Date(maghribTime.getTime() + 30 * 60000);
        if (eveningAdhkarTime > new Date()) {
          notificationsToSchedule.push({
            id: ID_OFFSET_ADHKAR + dayIDOffset + 2,
            title: '🌆 أذكار المساء',
            body: 'حصّن نفسك: «أمسينا وأمسى الملك لله»',
            schedule: { at: eveningAdhkarTime },
            channelId: 'bayan_alerts_v2',
            smallIcon: 'ic_stat_moon',
            extra: { type: 'evening_adhkar', category: 'evening', deepLink: '/adhkar?category=أذكار%20المساء' }
          });
        }
      }
    }

    // --- 3. Hifz Reminder (Smart & Motivational) ---
    // (Variables reused from above scope if available, or just use vars without redeclaring if same name)
    // Actually, they are scoped to the 'for' loop? No, 'hifzState' is const outside the loop in original file?
    // Wait, let's look at line 533. 
    // Re-reading file structure. I inserted into the loop. 
    // If I inserted at the end of the loop, I need to check if they were declared earlier in the loop.
    // They were declared at line 533 (hifzState).
    // So I should validly use the EXISTING hifzState.

    // 3. HIFZ REMINDERS & REVISION
    // Separated logic to respect 'revisionNotificationEnabled'

    // 3.1 Memorization Reminders (Primary)
    // ID Range: 50010 + dayOffset
    if (hifzState.isSetup && hifzState.notificationEnabled && hifzState.notificationTime && hifzState.selectedDays?.includes(baseDate.getDay())) {
      const hifzTime = parseTimeOnDate(hifzState.notificationTime, baseDate);

      // Only schedule if time is in future
      if (hifzTime > new Date()) {
        const HIFZ_TEMPLATES = [
          { title: '📖 ورد الحفظ اليومي', body: 'حان وقت وردك! {amount} {unit} في انتظارك ({location})' },
          { title: '🌟 همتك عالية!', body: 'اليوم {amount} {unit} جديدة تنتظرك. ابدأ من {location}' },
          { title: '💎 قرآنك ينتظرك', body: 'لديك {amount} {unit} للحفظ. استمر، أنت بطل!' },
          { title: '✨ وقت الحفظ', body: 'القرآن ربيع القلوب. لديك {amount} {unit} في {location}' },
          { title: '🌙 لا تقطع السلسلة!', body: 'حافظ على استمراريتك: {amount} {unit} من {location}' },
          { title: '📚 ورد اليوم', body: '{amount} {unit} فقط! ابدأ من {location} واجعلها عادة' }
        ];

        const template = getRandomTemplate(HIFZ_TEMPLATES);
        const unitLabel = hifzState.planType === 'pages' ? 'صفحات' : 'آيات';
        const location = hifzState.startPoint + hifzState.currentProgress;
        const streak = HifzService.calculateStreak(hifzState);

        const msgTitle = template.title;
        const msgBody = template.body
          .replace('{amount}', toArabicDigitsStr(hifzState.amountPerDay))
          .replace('{unit}', unitLabel)
          .replace('{location}', `صفحة ${toArabicDigitsStr(location)}`)
          .replace('{streak}', toArabicDigitsStr(streak));

        // Logic for "Already Done" message vs "Reminder"
        let finalBody = msgBody;
        if (hifzState.todayRevisionDone && hifzState.lastCompletedDate === HifzService.getTodayString()) {
          // If user disabled revision notifications, just say "Well done" without nagging about revision
          if (hifzState["revisionNotificationEnabled"]) {
            finalBody = 'أحسنت! أتممت وردك اليوم. حافظ على المراجعة.';
          } else {
            finalBody = 'أحسنت! أتممت وردك اليوم. تقبل الله منك.';
          }
        }

        notificationsToSchedule.push({
          id: ID_HIFZ_REMINDER + dayIDOffset,
          title: msgTitle,
          body: finalBody,
          schedule: { at: hifzTime },
          channelId: 'bayan_alerts_v2',
          smallIcon: 'ic_launcher',
          extra: { type: 'hifz_reminder', deepLink: '/hifz' }
        });
      }
    }

    // 3.2 Revision Notifications (Separate ID Range)
    // ID Range: 50050 + dayOffset (Reserved for future strict revision reminders)
    if (hifzState.isSetup && hifzState["revisionNotificationEnabled"] && hifzState.notificationTime && hifzState.selectedDays?.includes(baseDate.getDay())) {
      // Logic to schedule specific Revision reminders can benefit added here.
      // Currently, the "Memorization" reminder covers general daily Hifz work.
      // We ensure the "Memorization" reminder doesn't mention revision if this is off.
      // If we want a SECOND notification just for revision, we would add it here.
      // For now, we leave this empty to respect the "Disable" wish, but the structure is ready.
    }

    // ══════════════════════════════════════════════════════════════════════════
    // 🌙 4. RAMADAN SPECIAL NOTIFICATIONS
    // Only scheduled when current Hijri month is Ramadan (month 9)
    // This ensures ZERO budget consumption outside Ramadan
    // ══════════════════════════════════════════════════════════════════════════
    const hijriDate = gregorianToHijri(baseDate);
    const isRamadanDay = hijriDate.month === 9;

    if (isRamadanDay && isDetailedDay) {

      // 4.1 Suhoor Reminder (Native will handle this now, so we skip JS local scheduling)
      // JS visual scheduling removed because it's now synced to Native for robust execution

      // 4.2 Iftar Reminder (Native will handle this now, so we skip JS local scheduling)
      // JS visual scheduling removed because it's now synced to Native for robust execution

      // 4.3 Last Ten Nights (Native will handle this now, so we skip JS local scheduling)
      // JS visual scheduling removed because it's now synced to Native for robust execution
    }
  }


  onProgress?.(50, 'جاري جدولة الإشعارات...');

  // Schedule all notifications
  if (Capacitor.isNativePlatform()) {
    try {
      // 1. Batch Schedule Native Azhan (High Priority)
      if (nativeAzhanAlarms.length > 0) {
        MediaBridge.scheduleAzhanBatch({ alarms: nativeAzhanAlarms })
          .then(res => console.log(`✅ [Batch] Scheduled ${res.count} Azhans, Failed: ${res.failed}`))
          .catch(e => console.error("❌ [Batch] Failed to schedule Azhans", e));
      }

      // 1.5 Batch Schedule Native Pre-Prayer Audio Alerts
      if (nativePrePrayerAlerts.length > 0) {
        MediaBridge.schedulePrePrayerAlertBatch({ alerts: nativePrePrayerAlerts })
          .then(res => console.log(`✅ [Batch] Scheduled ${res.count} Pre-Prayer Alerts, Failed: ${res.failed}`))
          .catch(e => console.error("❌ [Batch] Failed to schedule Pre-Prayer Alerts", e));
      }

      // 1.6 Schedule Salawat Reminders with Smart Conflict Avoidance
      if (settings.salawat.enabled) {
        const salawatAlerts: any[] = [];
        const salawatNotifications: any[] = [];
        const mode = settings.salawat.mode || SALAWAT_DEFAULTS.MODE;
        const timesPerHour = settings.salawat.timesPerHour || SALAWAT_DEFAULTS.TIMES_PER_HOUR;
        const timesPerDay = settings.salawat.timesPerDay || SALAWAT_DEFAULTS.TIMES_PER_DAY;
        const avoidPrayerTimes = settings.salawat.avoidPrayerTimes ?? true;

        // 🎯 DYNAMIC CONFIGURATION (User Preference)
        const startH = parseInt((settings.salawat.startTime || SALAWAT_DEFAULTS.START_TIME).split(':')[0]);
        const endH = parseInt((settings.salawat.endTime || SALAWAT_DEFAULTS.END_TIME).split(':')[0]);

        // Calculate Active Window Hours (Handle Cross-Day e.g. 22:00 -> 05:00)
        const activeHours = endH >= startH ? (endH - startH) : (24 - startH + endH);

        const BUFFER_MINUTES = 7; // Buffer around prayer times

        // ══════════════════════════════════════════════════════════════════
        // 🎯 DYNAMIC SALAWAT BUDGET CALCULATION
        // Budget: ALARM_BUDGET.SALAWAT_MAX = 250 alarms available
        // Days are calculated dynamically based on user's chosen frequency
        // ══════════════════════════════════════════════════════════════════
        const MAX_SALAWAT_ALARMS = ALARM_BUDGET.SALAWAT_MAX;

        // Calculate estimated alarms per day based on mode
        const alarmsPerDay = mode === 'hourly'
          ? timesPerHour * activeHours
          : timesPerDay;

        // Schedule until budget is reached or max days exceeded
        const MAX_LOOKAHEAD_DAYS = 14;

        console.log(`🔢 Salawat Budget: Max ${MAX_SALAWAT_ALARMS} alarms. Scheduling until full or ${MAX_LOOKAHEAD_DAYS} days reached.`);

        // Schedule for dynamically calculated days
        for (let dayIndex = 0; dayIndex < MAX_LOOKAHEAD_DAYS; dayIndex++) {
          const dayDate = new Date();
          dayDate.setDate(dayDate.getDate() + dayIndex);

          // Get prayer times for this specific day (if available)
          const dayPrayers = periodPrayers[dayIndex]?.timings;

          // Build blocked windows from prayer times
          const blockedWindows: { start: number; end: number }[] = [];

          if (avoidPrayerTimes && dayPrayers) {
            const prayerKeys = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];
            for (const key of prayerKeys) {
              const prayerTimeStr = dayPrayers[key as keyof typeof dayPrayers];
              if (prayerTimeStr) {
                const prayerTime = parseTimeOnDate(prayerTimeStr, dayDate);
                const preNotifMinutes = settings.salah.preNotificationMinutes || 10;

                // Block: PreNotificationTime - BUFFER to PrayerTime + BUFFER
                const windowStart = prayerTime.getTime() - (preNotifMinutes + BUFFER_MINUTES) * 60000;
                const windowEnd = prayerTime.getTime() + BUFFER_MINUTES * 60000;

                blockedWindows.push({ start: windowStart, end: windowEnd });
              }
            }
          }

          // Helper: Check if a time is within any blocked window
          const isTimeBlocked = (timestamp: number): boolean => {
            return blockedWindows.some(w => timestamp >= w.start && timestamp <= w.end);
          };

          // Generate candidate times based on mode
          const candidateTimes: Date[] = [];
          const baseDateStart = new Date(dayDate); // Reset to 00:00 of target day? 
          // Actually dayDate is already 'now + x days'. We should strictly control hours.

          if (mode === 'hourly') {
            // Hourly mode: distribute across each ACTIVE hour
            const intervalMinutes = Math.floor(60 / (timesPerHour + 1)); // e.g. 15min if 3x/hr? No, 60/4=15.

            for (let h = 0; h < activeHours; h++) {
              const hour = (startH + h) % 24;

              for (let i = 0; i < timesPerHour; i++) {
                // Distribute: (i * 60/times) ? Or centered?
                // Simple distribution:
                const minute = Math.floor(i * (60 / timesPerHour));

                const candidateDate = new Date(dayDate);
                candidateDate.setHours(hour, minute, 0, 0);

                // Handle Cross-Day Date Adjustment
                // If start=22, end=5. h=0->22 (Day 0). h=3->01 (Day 1).
                // We need to increment date if hour < startH AND we are in cross-day mode
                if (endH < startH && hour < startH) {
                  candidateDate.setDate(candidateDate.getDate() + 1);
                }

                candidateTimes.push(candidateDate);
              }
            }
          } else {
            // Daily mode: distribute across active window
            const intervalMinutes = Math.floor((activeHours * 60) / (timesPerDay + 1));

            for (let i = 0; i < timesPerDay; i++) {
              const minutesOffset = intervalMinutes * (i + 1);
              const hourOffset = Math.floor(minutesOffset / 60);
              const minuteOffset = minutesOffset % 60;

              const hour = (startH + hourOffset) % 24;
              const candidateDate = new Date(dayDate);
              candidateDate.setHours(hour, minuteOffset, 0, 0);

              // Handle Cross-Day
              if (endH < startH && hour < startH) { // Simplified check sufficient for most cases
                // Correction: If total offset > (24 - startH), we crossed midnight?
                // Safer: Check relative to startH loop.
                // Actually, simpler logic:
                // We start at StartH. We add minutes. 
                // If (StartH_Minutes + Offset) >= 24*60, we are next day.
                // Wait, StartH could be 22. + 3 hours = 01:00 next day.

                // Robust Date Calc:
                const startBase = new Date(dayDate);
                startBase.setHours(startH, 0, 0, 0);
                const actualTime = new Date(startBase.getTime() + minutesOffset * 60000);
                candidateTimes.push(actualTime);
                continue;
              }
              // For daily mode, the 'robust calc' above (resetting based on startH) is cleaner
              // providing we handle the DayIndex correctly (dayDate is already incremented).
              // Let's stick to the Robust Calc for Daily to be safe.
              const startBase = new Date(dayDate);
              startBase.setHours(startH, 0, 0, 0);
              const actualTime = new Date(startBase.getTime() + minutesOffset * 60000);
              candidateTimes.push(actualTime);
            }
          }

          // Filter out blocked times and past times
          const now = new Date();
          let slotIndex = 0;

          for (const candidateTime of candidateTimes) {
            // Skip past times
            if (candidateTime <= now) continue;

            const timestamp = candidateTime.getTime();

            // Skip if within blocked window (prayer time)
            if (isTimeBlocked(timestamp)) {
              // console.log(`🚫 Salawat skipped at ${candidateTime.toLocaleTimeString()} - prayer time conflict`);
              continue;
            }

            // 🛡️ STRICT TIME WINDOW ENFORCEMENT 🛡️
            // Ensure generated time effectively falls within the allowed HOURS of the day
            // (Double check to prevent any edge case logic errors)
            const cHour = candidateTime.getHours();
            const cMin = candidateTime.getMinutes();
            const cTime = cHour * 60 + cMin;
            const sTime = startH * 60;
            const eTime = endH * 60;

            let inWindow = false;
            if (startH <= endH) {
              inWindow = cTime >= sTime && cTime < eTime;
            } else {
              // Cross day: 22:00 -> 05:00
              // Valid if >= 22:00 OR < 05:00
              inWindow = cTime >= sTime || cTime < eTime;
            }

            if (!inWindow) {
              // console.log(`[Salawat] 🛑 Skipped ${candidateTime.toLocaleTimeString()} - Outside Window ${startH}-${endH}`);
              continue;
            }

            const uniqueId = 800000 + (dayIndex * 100) + slotIndex;
            slotIndex++;

            // Check if we've hit the Salawat limit
            if (salawatAlerts.length >= MAX_SALAWAT_ALARMS) {
              console.log(`⚠️ Salawat limit reached (${MAX_SALAWAT_ALARMS}), stopping scheduling`);
              break;
            }

            // Handle Random Selection
            let soundId = settings.salawat.selectedSound || 'salawat_one';
            if (soundId === 'random') {
              const availableSounds = ['salawat_one', 'salawat_two', 'salawat_three', 'salawat_four', 'salawat_five'];
              soundId = availableSounds[Math.floor(Math.random() * availableSounds.length)];
            }

            // Native audio alert
            salawatAlerts.push({
              id: uniqueId,
              time: timestamp,
              soundId: soundId,
              soundEnabled: settings.salawat.soundEnabled,
              volume: settings.salah.azhanVolume ?? 80,
              shouldResume: true // 🎵 SMART RESUME
            });

            // Visual notification (only for first 3 days or ~40 notifs to fit within limit)
            if (salawatNotifications.length < 40) {
              salawatNotifications.push({
                id: uniqueId,
                title: '🤲 صلّ على النبي ﷺ',
                body: 'اللهم صلِّ وسلم على نبينا محمد',
                schedule: { at: candidateTime },
                channelId: 'bayan_alerts_v2',
                smallIcon: 'ic_launcher',
                extra: { type: 'salawat_reminder' }
              });
            }
          }

          // Break outer loop if limit reached
          if (salawatAlerts.length >= MAX_SALAWAT_ALARMS) break;
        }

        // Schedule native Salawat alerts
        if (salawatAlerts.length > 0) {
          MediaBridge.scheduleSalawatAlertBatch({ alerts: salawatAlerts })
            .then(res => console.log(`✅ [Batch] Scheduled ${res.count} Salawat Reminders (${mode} mode), Failed: ${res.failed}`))
            .catch(e => console.error("❌ [Batch] Failed to schedule Salawat Reminders", e));
        }

        // Add visual notifications to the batch
        notificationsToSchedule.push(...salawatNotifications);
        const dailyCount = mode === 'hourly' ? timesPerHour * activeHours : timesPerDay;
        console.log(`🤲 Prepared ${salawatAlerts.length} Salawat reminders (${dailyCount}/day, Window: ${startH}:00-${endH}:00)`);
      }

      // 2. Schedule Detailed Visual Notifications (Limited Scope)
      if (notificationsToSchedule.length > 0) {
        // With 3 days of details, we have ~45 notifications. This fits within the Android 50 limit.
        await LocalNotifications.schedule({ notifications: notificationsToSchedule });
        console.log(`✅ Scheduled ${notificationsToSchedule.length} detailed notifications (Limit 50)`);
        storeScheduledNotifications(notificationsToSchedule);
      }

      // ✅ SUCCESS: Update the timestamp
      localStorage.setItem('last_schedule_check', Date.now().toString());
      console.log('[NotificationManager] 📅 Schedule updated safely. Next Smart Check in 3 days.');
      onProgress?.(90, 'جاري مزامنة البيانات...');

      // 🔄 SYNC TO NATIVE (For Project Eternity / "Infinite Sustainability")
      // This sends all critical calculation data to Native SharedPreferences
      // so the Android Worker can recalculate prayers independently.
      if (Capacitor.isNativePlatform()) {
        const savedLoc = getSavedLocation();
        if (savedLoc) {
          // Construct Pre-Prayer Settings JSON for Native Scheduler
          const prePrayerSettingsForNative = {
            enabled: settings.salah.preNotification,
            minutes: settings.salah.preNotificationMinutes || 15,
            sound: settings.salah.preNotificationSound || 'alert_prayer_reminder'
          };

          await MediaBridge.savePersistenceData({
            lat: savedLoc.lat,
            lng: savedLoc.lng,
            method: getCalculationMethod(),
            madhab: getMadhab(),
            highLatitudeRule: getHighLatitudeRule(),
            adjustmentsJson: JSON.stringify(getPrayerAdjustments()),
            // NEW: Sync Azhan Preferences
            muazzinId: getStoredAzhan(),
            perPrayerSettingsJson: localStorage.getItem('settings_azhan_specific') || '{}',
            isPerPrayerEnabled: isPerPrayerMuazzinEnabled(),
            // NEW: Sync Salawat Preferences (Phase 2)
            salawatSettingsJson: JSON.stringify(settings.salawat || {}),
            // NEW: Sync Pre-Prayer Preferences (Phase 3 - Gap Fix)
            prePrayerSettingsJson: JSON.stringify(prePrayerSettingsForNative),
            // NEW: Sync Ramadan Preferences (Native Ramadan Logic)
            ramadanSettingsJson: JSON.stringify(settings.ramadan || {}),
            // NEW: Sync Hijri Auto-Sync Preferences
            hijriAutoSyncEnabled: localStorage.getItem('hijri_auto_sync_enabled') === 'true',
            hijriManualOverride: localStorage.getItem('hijri_manual_override') === 'true',
            // hijriEffectiveAdjustment: القيمة الفعلية المطبقة (manual أو auto)
            // هذا ما تقرأه Kotlin مباشرةً — المصدر الوحيد للحقيقة
            hijriEffectiveAdjustment: getHijriAdjustment()
          });
          console.log('[NotificationManager] 💾 Synced persistence data to Native Layer (with Pre-Prayer)');

          // 🚀 Activate the Heartbeat
          await MediaBridge.registerSustainabilityWork();
          console.log('[NotificationManager] 💓 Sustainability Worker Registered');
        }
      }

    } catch (e) {
      console.error("Failed to schedule native notifications", e);
    }
  }

  onProgress?.(100, 'تم الحفظ بنجاح ✓');
};

/**
 * 🧠 SMART RESCHEDULE: Ensures notifications never expire.
 * Called on App Launch.
 * If > 3 days have passed since last schedule, runs scheduleAllNotifications(true).
 */
export const tryScheduleWithSafetyCheck = async () => {
  if (!Capacitor.isNativePlatform()) return;

  const lastCheckStr = localStorage.getItem('last_schedule_check');
  const now = Date.now();
  const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;

  if (!lastCheckStr) {
    console.log('[NotificationManager] No previous schedule found. Running initial schedule.');
    await scheduleAllNotifications(undefined, true);
    return;
  }

  const lastCheck = parseInt(lastCheckStr);
  const diff = now - lastCheck;

  // SAFETY: Check if Azhan is playing before attempting any reschedule
  try {
    const state = await MediaBridge.getCurrentAzhanState();
    if (state && state.isPlayingAzhan) {
      console.log('[NotificationManager] ⚠️ Azhan active. Skipping safety schedule check.');
      return;
    }
  } catch (e) { }

  if (diff > THREE_DAYS_MS) {
    console.log(`[NotificationManager] ⚠️ Schedule is stale (${Math.floor(diff / (24 * 60 * 60000))} days old). Auto-renewing...`);
    await scheduleAllNotifications(undefined, true);
  } else {
    console.log('[NotificationManager] ✅ Schedule is fresh. detailed check skipped.');
  }
};

/**
 * Cancels the "Did you pray?" reminder for a specific prayer.
 * Called when user explicitly marks prayer as done.
 * @param prayerKey 'fajr' | 'dhuhr' | etc.
 */
export const cancelMissedPrayerReminder = async (prayerKey: string) => {
  if (!Capacitor.isNativePlatform()) return;

  // Map key to ID
  const keyMap: Record<string, number> = { 'fajr': 1, 'dhuhr': 2, 'asr': 3, 'maghrib': 4, 'isha': 5 };
  const id = keyMap[prayerKey];
  if (!id) return;

  // Calculate the notification ID for TODAY (offset 0).
  const notifId = ID_OFFSET_MISSED_REMINDER + id;

  try {
    // FIX: Provide explicit type check bypass or full object
    // @ts-ignore
    await LocalNotifications.cancel({ notifications: [{ id: notifId }] });
    console.log(`✅ Cancelled missed prayer reminder for ${prayerKey} (ID: ${notifId})`);
  } catch (e) {
    console.warn("Failed to cancel reminder", e);
  }
};

// Helper: Parse time string on a specific date object
// Helper: Parse time string on a specific date object
function parseTimeOnDate(timeStr: string, dateObj: Date): Date {
  const [hours, minutes] = timeStr.split(':').map(Number);
  const newDate = new Date(dateObj);
  newDate.setHours(hours, minutes, 0, 0);
  return newDate;
};

// Store scheduled notifications to history for when listener doesn't fire
function storeScheduledNotifications(notifications: any[]) {
  const now = Date.now();

  for (const notif of notifications) {
    const scheduleTime = notif.schedule?.at?.getTime() || now;
    // Only store/handle if it's within next 24 hours to keep localStorage clean? 
    // Actually we keep 7 days. Better to clear old ones in processScheduledNotifications.

    const extra = notif.extra || {};
    const deepLink = getDeepLinkForNotification(extra.type, extra);

    const key = `scheduled_notif_${notif.id}`;
    const storedData = {
      id: notif.id,
      title: notif.title,
      body: notif.body,
      scheduledAt: scheduleTime,
      type: extra.type || 'reminder',
      deepLink
    };
    localStorage.setItem(key, JSON.stringify(storedData));
  }
}

// Check and move due scheduled notifications to history (called on app open)
export function processScheduledNotifications() {
  const now = Date.now();
  console.log('[NotificationManager] Processing scheduled notifications history...');

  // We scan ALL keys for our prefix
  const keys = Object.keys(localStorage).filter(k => k.startsWith('scheduled_notif_'));

  for (const key of keys) {
    try {
      const storedItem = localStorage.getItem(key);
      if (!storedItem) continue;

      const data = JSON.parse(storedItem);

      // If the scheduled time has PASSED, it means the notification 'fired' (or should have)
      if (data.scheduledAt && data.scheduledAt <= now) {

        // Add to history if it's within the last 24 hours (so we don't lose them if user opens app late)
        // User complained they weren't seeing them. 30 mins was too short. 
        // Let's keep them if they are from "Today" effectively (last 12 hours is safe).
        if (now - data.scheduledAt < 12 * 60 * 60000) {
          console.log(`[NotificationManager] Moving fired notification to history: ${data.title}`);
          addNotificationWithTimestamp(data.title, data.body, data.type, data.deepLink, data.scheduledAt);
        } else {
          console.log(`[NotificationManager] Notification too old to add to history: ${data.title}`);
        }

        // Remove from pending storage as it's done
        localStorage.removeItem(key);
      } else if (data.scheduledAt && data.scheduledAt < now - 24 * 60 * 60000) {
        // Cleanup very old junk
        localStorage.removeItem(key);
      }
    } catch (e) {
      console.warn("[NotificationManager] Error processing stored notification", e);
      localStorage.removeItem(key);
    }
  }
}

// Listen for notifications
if (Capacitor.isNativePlatform()) {
  LocalNotifications.addListener('localNotificationReceived', (notification) => {
    const extra = notification.extra || {};
    const deepLink = getDeepLinkForNotification(extra.type, extra);
    const scheduledAt = notification.schedule?.at ? new Date(notification.schedule.at).getTime() : Date.now();
    addNotificationWithTimestamp(notification.title || 'تنبيه', notification.body || '', 'reminder', deepLink, scheduledAt);
  });

  LocalNotifications.addListener('localNotificationActionPerformed', (action) => {
    const extra = action.notification.extra || {};
    const deepLink = getDeepLinkForNotification(extra.type, extra);
    const scheduledAt = action.notification.schedule?.at ? new Date(action.notification.schedule.at).getTime() : Date.now();
    addNotificationWithTimestamp(action.notification.title || 'تنبيه', action.notification.body || '', 'reminder', deepLink, scheduledAt);

    if (deepLink) {
      localStorage.setItem('pending_deep_link', deepLink);
      window.dispatchEvent(new CustomEvent('notification-tap', { detail: { deepLink, extra } }));
    }
  });
}

function getDeepLinkForNotification(type: string, extra: any): string | undefined {
  switch (type) {
    case 'prayer':
    case 'pre_prayer':
    case 'missed_prayer_reminder':
      return '/?openPrayer=true';
    case 'post_prayer_adhkar':
      return '/adhkar?category=الأذكار%20بعد%20السلام%20من%20الصلاة';
    case 'morning_adhkar':
      return '/adhkar?category=أذكار%20الصباح';
    case 'evening_adhkar':
      return '/adhkar?category=أذكار%20المساء';
    case 'sleep_adhkar':
      return '/adhkar?category=أذكار%20النوم';
    case 'wakeup_adhkar':
      return '/adhkar?category=أذكار%20الاستيقاظ%20من%20النوم';
    case 'qiyam':
      return '/adhkar?category=أذكار%20الصباح'; // Usually Qiyam leads to Fajr/Morning prep
    case 'friday':
      if (extra.subtype === 'kahf') return '/reader?page=293&temporary=true'; // Surah Al-Kahf starts at page 293
      if (extra.subtype === 'dua_hour') return '/adhkar';
      return '/';
    case 'islamic_event':
      return '/events';
    case 'ramadan':
      if (extra.subtype === 'iftar' || extra.subtype === 'suhoor') return '/';
      if (extra.subtype === 'last_ten') return '/adhkar?category=أذكار%20الصباح';
      return '/';
    default:
      return undefined;
  }
}
