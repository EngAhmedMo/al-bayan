
export interface FaithMessage {
    text: string;
    source: string;
    type: 'success' | 'comfort' | 'warning' | 'info';
}

export const FAITH_MESSAGES: Record<string, FaithMessage[]> = {
    // Scenario: All 5 Prayers Completed (Streak or Daily Success)
    success: [
        {
            text: "من صلى اثنتي عشرة ركعة في يوم وليلة بني له بهن بيت في الجنة",
            source: "رواه مسلم",
            type: 'success'
        },
        {
            text: "أحب الأعمال إلى الله أدومها وإن قل",
            source: "متفق عليه",
            type: 'success'
        },
        {
            text: "من حافظ على الصلوات الخمس كانت له نوراً وبرهاناً ونجاة يوم القيامة",
            source: "رواه أحمد",
            type: 'success'
        },
        {
            text: "بشر المشائين في الظلم إلى المساجد بالنور التام يوم القيامة",
            source: "رواه أبو داود",
            type: 'success'
        }
    ],

    // Scenario: Missed a prayer or broken streak (Comfort & Recovery)
    comfort: [
        {
            text: "اتق الله حيثما كنت، وأتبع السيئة الحسنة تمحها",
            source: "رواه الترمذي",
            type: 'comfort'
        },
        {
            text: "كل ابن آدم خطّاء، وخير الخطائين التوابون",
            source: "رواه الترمذي",
            type: 'comfort'
        },
        {
            text: "يا ابن آدم لو بلغت ذنوبك عنان السماء ثم استغفرتني غفرت لك ولا أبالي",
            source: "حديث قدسي - الترمذي",
            type: 'comfort'
        },
        {
            text: "إن الحسنات يذهبن السيئات",
            source: "سورة هود: ١١٤",
            type: 'comfort'
        }
    ],

    // Scenario: General Encouragement / Upcoming Prayer
    info: [
        {
            text: "الصلاة خير موضوع، فمن استطاع أن يستكثر فليستكثر",
            source: "رواه الطبراني",
            type: 'info'
        },
        {
            text: "أرحنا بها يا بلال",
            source: "رواه أبو داود",
            type: 'info'
        },
        {
            text: "استعينوا بالصبر والصلاة",
            source: "سورة البقرة: ٤٥",
            type: 'info'
        }
    ]
};

export const getRandomFaithMessage = (category: keyof typeof FAITH_MESSAGES): FaithMessage => {
    const collection = FAITH_MESSAGES[category];
    return collection[Math.floor(Math.random() * collection.length)];
};
