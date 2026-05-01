export interface PrayerVirtue {
    text: string;
    source: string;
}

export const PRAYER_VIRTUES: Record<string, PrayerVirtue> = {
    'Fajr': {
        text: "من صلى البردين دخل الجنة",
        source: "رواه البخاري ومسلم"
    },
    'Sunrise': {
        text: "من صلى الغداة في جماعة ثم قعد يذكر الله حتى تطلع الشمس ثم صلى ركعتين كانت له كأجر حجة وعمرة",
        source: "رواه الترمذي"
    },
    'Dhuhr': {
        text: "إنها ساعة تفتح فيها أبواب السماء، فأحب أن يصعد لي فيها عمل صالح",
        source: "رواه الترمذي"
    },
    'Asr': {
        text: "من ترك صلاة العصر فقد حبط عمله",
        source: "رواه البخاري"
    },
    'Maghrib': {
        text: "ما يزالون بخير ما عجلوا المغرب",
        source: "رواه أبو داود"
    },
    'Isha': {
        text: "من صلى العشاء في جماعة فكأنما قام نصف الليل",
        source: "رواه مسلم"
    },
    'Friday': {
        text: "الجمعة إلى الجمعة كفارة لما بينهما إذا اجتنبت الكبائر",
        source: "رواه مسلم"
    }
};

export const getPrayerVirtue = (prayerName: string): PrayerVirtue | null => {
    return PRAYER_VIRTUES[prayerName] || null;
};

export const GENERAL_PRAYER_VIRTUE = {
    text: "أرحنا بها يا بلال",
    source: "حديث شريف"
};
