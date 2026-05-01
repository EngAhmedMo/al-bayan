export const SALAWAT_DEFAULTS = {
    ENABLED: false,
    MODE: 'daily' as const,
    TIMES_PER_HOUR: 1,
    TIMES_PER_DAY: 3,
    SOUND_ENABLED: true,
    SELECTED_SOUND: 'salawat_one',
    AVOID_PRAYER_TIMES: true,
    START_TIME: '08:00',
    END_TIME: '22:00',
    // System limits
    MAX_ALARMS: 250
};
