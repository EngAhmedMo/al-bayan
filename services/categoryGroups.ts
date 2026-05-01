// Category Groups for Grid Layout - Based on Hisn Al-Muslim professional app
import { Home, Moon, Sun, Plane, Heart, Utensils, Sparkles, Users, Map, Leaf, Stethoscope, BookOpen, Star, Sunrise, Sunset, Coffee, Frown, Smile, Baby, Church } from 'lucide-react';

export interface CategoryGroup {
    id: string;
    name: string;
    icon: string;
    color: string;
    bgColor: string;
    subCategories: string[];
}

// Category groups matching the reference app structure
export const CATEGORY_GROUPS: CategoryGroup[] = [
    {
        id: 'all',
        name: 'جميع الأذكار',
        icon: 'star',
        color: 'text-gold-500',
        bgColor: 'bg-navy-800',
        subCategories: [] // Will show all
    },

    {
        id: 'day-night',
        name: 'اليوم والليلة',
        icon: 'moon',
        color: 'text-indigo-500',
        bgColor: 'bg-indigo-50 dark:bg-indigo-950/30',
        // 4 فئات
        subCategories: [
            'أذكار الصباح',
            'أذكار المساء',
            'أذكار النوم',
            'أذكار الاستيقاظ من النوم'
        ]
    },
    {
        id: 'wudu-salah',
        name: 'الوضوء والصلاة',
        icon: 'book',
        color: 'text-blue-500',
        bgColor: 'bg-blue-50 dark:bg-blue-950/30',
        // 18 فئة
        subCategories: [
            'الذكر قبل الوضوء',
            'الذكر بعد الفراغ من الوضوء',
            'دعاء الذهاب إلى المسجد',
            'دعاء دخول المسجد',
            'دعاء الخروج من المسجد',
            'أذكار الأذان',
            'دعاء الاستفتاح',
            'دعاء الركوع',
            'دعاء الرفع من الركوع',
            'دعاء السجود',
            'دعاء الجلسة بين السجدتين',
            'دعاء سجود التلاوة',
            'التشهد',
            'الصلاة على النبي بعد التشهد',
            'الدعاء بعد التشهد الأخير قبل السلام',
            'الأذكار بعد السلام من الصلاة',
            'دعاء صلاة الاستخارة',
            'دعاء القنوت'
        ]
    },
    {
        id: 'home-family',
        name: 'البيت والأهل',
        icon: 'home',
        color: 'text-emerald-500',
        bgColor: 'bg-emerald-50 dark:bg-emerald-950/30',
        // 10 فئات
        subCategories: [
            'الذكر عند الخروج من المنزل',
            'الذكر عند دخول المنزل',
            'دعاء لبس الثوب',
            'دعاء لبس الثوب الجديد',
            'دعاء دخول الخلاء - الحمام',
            'دعاء الخروج من الخلاء - الحمام',
            'ما يعوذ به الأولاد',
            'الدعاء للمتزوج',
            'الدعاء قبل إتيان الزوجة - الجماع',
            'تهنئة المولود له وجوابه'
        ]
    },
    {
        id: 'food-drink',
        name: 'الطعام والشراب',
        icon: 'coffee',
        color: 'text-amber-600',
        bgColor: 'bg-amber-50 dark:bg-amber-950/30',
        subCategories: [
            'الدعاء قبل الطعام',
            'الدعاء عند الفراغ من الطعام',
            'دعاء الضيف لصاحب الطعام',
            'التعريض بالدعاء لطلب الطعام أو الشراب',
            'الدعاء إذا أفطر عند أهل بيت',
            'دعاء الصائم إذا حضر الطعام ولم يفطر',
            'ما يقول الصائم إذا سابه أحد',
            'الدعاء عند إفطار الصائم',
            'الدعاء عند رؤية باكورة الثمر'
        ]
    },
    {
        id: 'travel',
        name: 'السفر والتنقل',
        icon: 'plane',
        color: 'text-sky-500',
        bgColor: 'bg-sky-50 dark:bg-sky-950/30',
        subCategories: [
            'دعاء السفر',
            'دعاء الركوب',

            'دعاء دخول القرية أو البلدة',
            'دعاء دخول السوق',
            'الدعاء إذا تعس المركوب',
            'دعاء المسافر للمقيم',
            'دعاء المقيم للمسافر',
            'التكبير والتسبيح في سير السفر',
            'دعاء المسافر إذا أسحر',
            'الدعاء إذا نزل منزلا في سفر أو غيره',
            'ذكر الرجوع من السفر'
        ]
    },
    {
        id: 'emotions',
        name: 'الفرح والحزن',
        icon: 'smile',
        color: 'text-rose-500',
        bgColor: 'bg-rose-50 dark:bg-rose-950/30',
        // 18 فئة
        subCategories: [
            'دعاء الهم والحزن',
            'دعاء الكرب',
            'دعاء لقاء العدو وذي السلطان',
            'دعاء من خاف ظلم السلطان',
            'الدعاء على العدو',
            'ما يقول من خاف قوما',
            'دعاء من أصابه وسوسة في الإيمان',
            'دعاء قضاء الدين',
            'دعاء من أصيب بمصيبة',
            'دعاء كراهية الطيرة',
            'ما يقول من أتاه أمر يسره أو يكرهه',
            'ما يقول عند التعجب والأمر السار',
            'ما يفعل من أتاه أمر يسره',
            'ما يقال عند الفزع',
            'دعاء من استصعب عليه أمر',
            'ما يقول ويفعل من أذنب ذنبا',
            'الدعاء حينما يقع ما لا يرضاه أو غلب على أمره',
            'دعاء الغضب'
        ]
    },
    {
        id: 'tasbeeh',
        name: 'التسابيح',
        icon: 'sparkles',
        color: 'text-purple-500',
        bgColor: 'bg-purple-50 dark:bg-purple-950/30',
        // 3 فئات
        subCategories: [
            'الاستغفار والتوبة',
            'فضل التسبيح والتحميد، والتهليل، والتكبير',
            'كيف كان النبي يسبح؟'
        ]
    },
    {
        id: 'manners',
        name: 'التعامل والآداب',
        icon: 'users',
        color: 'text-teal-500',
        bgColor: 'bg-teal-50 dark:bg-teal-950/30',
        // 12 فئة
        subCategories: [
            'دعاء العطاس',
            'ما يقول المسلم إذا مدح المسلم',
            'ما يقول المسلم إذا زكي',
            'فضل الصلاة على النبي',
            'إفشاء السلام',
            'الدعاء عند سماع صياح الديك ونهيق الحمار',
            'الدعاء عند سماع نباح الكلاب بالليل',
            'الدعاء لمن سببته',
            'ما يقال في اﻟﻤﺠلس',
            'كفارة اﻟﻤﺠلس',
            'الدعاء لمن صنع إليك معروفا',
            'دعاء من رأى مبتلى'
        ]
    },
    {
        id: 'hajj',
        name: 'الحج والعمرة',
        icon: 'map',
        color: 'text-gold-500 dark:text-amber-500',
        bgColor: 'bg-gold-50 dark:bg-gold-900/30',
        subCategories: [
            'كيف يلبي المحرم في الحج أو العمرة',
            'التكبير إذا أتى الحجر الأسود',
            'الدعاء بين الركن اليماني والحجر الأسود',
            'دعاء الوقوف على الصفا والمروة',
            'الدعاء يوم عرفة',
            'الذكر عند المشعر الحرام',
            'التكبير عند رمي الجمار مع كل حصاة',
            'ما يقول عند الذبح أو النحر'
        ]
    },
    {
        id: 'nature',
        name: 'الطبيعة',
        icon: 'leaf',
        color: 'text-green-500',
        bgColor: 'bg-green-50 dark:bg-green-950/30',
        // 7 فئات
        subCategories: [
            'من أدعية الاستسقاء',
            'الدعاء إذا رأى المطر',
            'الذكر بعد نزول المطر',
            'من أدعية الاستصحاء',
            'دعاء رؤية الهلال',
            'دعاء الريح',
            'دعاء الرعد'
        ]
    },
    {
        id: 'sickness-death',
        name: 'المرض والجنائز',
        icon: 'stethoscope',
        color: 'text-slate-500',
        bgColor: 'bg-slate-50 dark:bg-slate-950/30',
        // 11 فئة
        subCategories: [
            'الدعاء للمريض في عيادته',
            'فضل عيادة المريض',
            'دعاء المريض الذي يئس من حياته',
            'تلقين المحتضر',
            'الدعاء عند إغماض الميت',
            'الدعاء للميت في الصلاة عليه',
            'الدعاء للفرط في الصلاة عليه',
            'دعاء التعزية',
            'الدعاء عند إدخال الميت القبر',
            'الدعاء بعد دفن الميت',
            'ما يفعل ويقول من أحس وجعا في جسده'
        ]
    },
    {
        id: 'custom',
        name: 'أذكاري الخاصة',
        icon: 'edit',
        color: 'text-pink-500',
        bgColor: 'bg-pink-50 dark:bg-pink-950/30',
        subCategories: ['أذكاري الخاصة'] // This will match custom adhkar category
    }
];

// Helper to get icon component by name
export const getCategoryGroupIconName = (iconName: string) => {
    return iconName;
};

// Get all subcategories for a group
export const getSubCategoriesForGroup = (groupId: string): string[] => {
    const group = CATEGORY_GROUPS.find(g => g.id === groupId);
    return group?.subCategories || [];
};

// Count subcategories in a group - Returns number of فئات (categories), not individual adhkar
// Exception: For 'custom' group, return actual count of user adhkar
export const countAdhkarInGroup = (groupId: string, allAdhkar: { category: string }[]): number => {
    if (groupId === 'all') {
        // For 'all', return total number of unique categories
        const uniqueCategories = new Set(allAdhkar.map(a => a.category));
        return uniqueCategories.size;
    }

    // For custom group, count actual adhkar (not categories)
    if (groupId === 'custom') {
        return allAdhkar.filter(a => a.category === 'أذكاري الخاصة').length;
    }

    const group = CATEGORY_GROUPS.find(g => g.id === groupId);
    if (!group || group.subCategories.length === 0) return 0;

    // Return the number of subcategories (فئات) in this group
    return group.subCategories.length;
};
