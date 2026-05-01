import React from 'react';
import { TopBar } from '../components/TopBar';
import { BookOpen, Volume2, Clock, Mic2, Hand, CircleDot, AlertCircle, Info } from 'lucide-react';

/**
 * TajweedGuide - Comprehensive Tajweed rules page with professional color coding
 * 
 * Colors are synchronized with TajweedText.tsx parser and GlobalQuran API:
 * - Red (#EF4444): Madd (المد) - Prolongation [m], [l] tags
 * - Green (#10B981): Ghunna (الغنة) - Nasalization [n], [g] tags  
 * - Light Blue (#0EA5E9): Qalqalah (القلقلة) - Echoing [q] tag
 * - Indigo (#6366F1): Iqlab/Tafkheem (الإقلاب/التفخيم) [c], [i] tags
 * - Gray: Other rules (Idgham bila ghunna, Izhar)
 * 
 * Sources: 
 * - التجويد المصور للدكتور أيمن سويد
 * - جمعية المحافظة على القرآن الكريم
 * - دار القرآن الكريم
 */
export const TajweedGuide: React.FC = () => {
    const tajweedRules = [
        // المد - Prolongation (Red shades) - [m], [l] tags
        {
            category: 'المد (الإطالة)',
            categoryEnglish: 'Prolongation (Madd)',
            categoryIcon: <Clock size={20} />,
            categoryColor: 'from-red-500 to-red-600',
            colorTag: '[m]',
            rules: [
                {
                    name: 'المد الطبيعي (الأصلي)',
                    englishName: 'Natural Madd',
                    description: 'حرف المد (ا، و، ي) بدون همز أو سكون بعده. هو أصل المدود كلها.',
                    example: 'نُوحِيهَا ۚ قَالُوا',
                    colorClass: 'text-[#FF0000] dark:text-[#FF4D4D]',
                    bgClass: 'bg-red-50 dark:bg-red-900/20',
                    borderClass: 'border-red-200 dark:border-red-800',
                    duration: 'حركتان (٢)',
                    condition: 'لا يوجد سبب خارجي'
                },
                {
                    name: 'المد المتصل (الواجب)',
                    englishName: 'Connected Madd',
                    description: 'حرف المد يليه همزة في نفس الكلمة. سمي واجبًا لوجوب مده عند جميع القراء.',
                    example: 'جَآءَ ۚ سُوٓءَ ۚ جِيٓءَ',
                    colorClass: 'text-[#FF0000] dark:text-[#FF4D4D]',
                    bgClass: 'bg-red-50 dark:bg-red-900/20',
                    borderClass: 'border-red-200 dark:border-red-800',
                    duration: '٤ أو ٥ حركات',
                    condition: 'همزة بعد المد في نفس الكلمة'
                },
                {
                    name: 'المد المنفصل (الجائز)',
                    englishName: 'Separated Madd',
                    description: 'حرف المد في آخر كلمة والهمزة في أول الكلمة التي تليها.',
                    example: 'يَٰٓأَيُّهَا ۚ إِنَّآ أَعْطَيْنَٰكَ',
                    colorClass: 'text-[#FF0000] dark:text-[#FF4D4D]',
                    bgClass: 'bg-red-50 dark:bg-red-900/20',
                    borderClass: 'border-red-200 dark:border-red-800',
                    duration: '٢ أو ٤ أو ٥ حركات',
                    condition: 'همزة بعد المد في كلمة أخرى'
                },
                {
                    name: 'المد اللازم',
                    englishName: 'Necessary Madd',
                    description: 'حرف المد يليه حرف ساكن سكونًا أصليًا (ثابتًا وصلًا ووقفًا).',
                    example: 'الضَّآلِّينَ ۚ آلْـٰٔنَ',
                    colorClass: 'text-[#FF0000] dark:text-[#FF4D4D]',
                    bgClass: 'bg-red-100 dark:bg-red-900/30',
                    borderClass: 'border-red-300 dark:border-red-700',
                    duration: '٦ حركات (إلزامًا)',
                    condition: 'سكون أصلي بعد المد'
                },
                {
                    name: 'المد العارض للسكون',
                    englishName: 'Temporary Madd',
                    description: 'حرف المد يليه حرف ساكن سكونًا عارضًا بسبب الوقف.',
                    example: 'نَسْتَعِينُ ۚ الْعَٰلَمِينَ',
                    colorClass: 'text-[#FF0000] dark:text-[#FF4D4D]',
                    bgClass: 'bg-red-50 dark:bg-red-900/20',
                    borderClass: 'border-red-200 dark:border-red-800',
                    duration: '٢ أو ٤ أو ٦ حركات',
                    condition: 'سكون عارض بسبب الوقف'
                }
            ]
        },
        // الغنة - Nasalization (Green) - [n], [g] tags
        {
            category: 'الغنة والإخفاء',
            categoryEnglish: 'Nasalization (Ghunna)',
            categoryIcon: <Volume2 size={20} />,
            categoryColor: 'from-emerald-500 to-emerald-600',
            colorTag: '[n]',
            rules: [
                {
                    name: 'الغنة (النون والميم المشددتان)',
                    englishName: 'Ghunna with Shaddah',
                    description: 'النون المشددة (نّ) والميم المشددة (مّ) تُمد بغنة واضحة.',
                    example: 'إِنَّ ۚ ثُمَّ ۚ مِنَ الْجِنَّةِ',
                    colorClass: 'text-[#00B300] dark:text-[#00E600]',
                    bgClass: 'bg-emerald-50 dark:bg-emerald-900/20',
                    borderClass: 'border-emerald-200 dark:border-emerald-800',
                    duration: 'غنة حركتين',
                    condition: 'نون أو ميم مشددة'
                },
                {
                    name: 'الإدغام بغنة',
                    englishName: 'Merging with Nasalization',
                    description: 'النون الساكنة أو التنوين إذا جاء بعدها أحد حروف (ينمو) ما عدا (ل، ر).',
                    example: 'مِن يَّعْمَلْ ۚ مِن نِّعْمَةٍ ۚ مِن وَّلِيٍّ',
                    colorClass: 'text-[#00B300] dark:text-[#00E600]',
                    bgClass: 'bg-emerald-50 dark:bg-emerald-900/20',
                    borderClass: 'border-emerald-200 dark:border-emerald-800',
                    duration: 'غنة حركتين',
                    condition: 'نون ساكنة + (ي، ن، م، و)'
                },
                {
                    name: 'الإخفاء الحقيقي',
                    englishName: 'True Hiding (Ikhfa)',
                    description: 'النون الساكنة أو التنوين قبل ١٥ حرفًا: (ص ذ ث ك ج ش ق س د ط ز ف ت ض ظ)',
                    example: 'مِن قَبْلُ ۚ عَلِيمٌ حَكِيمٌ ۚ مَن ذَا',
                    colorClass: 'text-[#00B300] dark:text-[#00E600]',
                    bgClass: 'bg-emerald-50 dark:bg-emerald-900/20',
                    borderClass: 'border-emerald-200 dark:border-emerald-800',
                    duration: 'غنة حركتين مع إخفاء',
                    condition: 'نون ساكنة + ١٥ حرف'
                },
                {
                    name: 'الإخفاء الشفوي',
                    englishName: 'Labial Hiding',
                    description: 'الميم الساكنة إذا جاء بعدها حرف الباء فقط.',
                    example: 'تَرْمِيهِم بِحِجَارَةٍ ۚ أَنتُم بِهِ',
                    colorClass: 'text-[#00B300] dark:text-[#00E600]',
                    bgClass: 'bg-emerald-50 dark:bg-emerald-900/20',
                    borderClass: 'border-emerald-200 dark:border-emerald-800',
                    duration: 'غنة حركتين',
                    condition: 'ميم ساكنة + باء'
                }
            ]
        },
        // الإقلاب (Indigo/Blue) - [c] tag
        {
            category: 'الإقلاب',
            categoryEnglish: 'Conversion (Iqlab)',
            categoryIcon: <Info size={20} />,
            categoryColor: 'from-blue-500 to-blue-600',
            colorTag: '[c]',
            rules: [
                {
                    name: 'الإقلاب',
                    englishName: 'Iqlab',
                    description: 'قلب النون الساكنة أو التنوين ميمًا مخفاة مع غنة إذا جاء بعدها حرف الباء.',
                    example: 'مِنۢ بَعْدِ ۚ سَمِيعٌۢ بَصِيرٌ ۚ أَنۢبِئْهُم',
                    colorClass: 'text-[#0099FF] dark:text-[#33ADFF]',
                    bgClass: 'bg-blue-50 dark:bg-blue-900/20',
                    borderClass: 'border-blue-200 dark:border-blue-800',
                    duration: 'غنة حركتين',
                    condition: 'نون ساكنة أو تنوين + باء'
                }
            ]
        },
        // القلقلة - Echoing (Light Blue) - [q] tag
        {
            category: 'القلقلة',
            categoryEnglish: 'Echoing (Qalqalah)',
            categoryIcon: <CircleDot size={20} />,
            categoryColor: 'from-blue-500 to-blue-600',
            colorTag: '[q]',
            rules: [
                {
                    name: 'القلقلة الصغرى',
                    englishName: 'Minor Qalqalah',
                    description: 'اهتزاز خفيف عند نطق حروف (قطب جد) إذا كانت ساكنة في وسط الكلمة.',
                    example: 'يَقْطَعُونَ ۚ أَدْبَارَهُمْ ۚ يَجْعَلُونَ',
                    colorClass: 'text-[#0099FF] dark:text-[#33ADFF]',
                    bgClass: 'bg-blue-50 dark:bg-blue-900/20',
                    borderClass: 'border-blue-200 dark:border-blue-800',
                    duration: 'اهتزاز خفيف',
                    condition: 'حروف قطب جد ساكنة وسط الكلمة'
                },
                {
                    name: 'القلقلة الكبرى',
                    englishName: 'Major Qalqalah',
                    description: 'اهتزاز أقوى عند نطق حروف (قطب جد) إذا كانت ساكنة في آخر الكلمة (عند الوقف).',
                    example: 'الْفَلَقْ ۚ تَبَّ ۚ مُحِيطْ ۚ أَحَدْ',
                    colorClass: 'text-[#0099FF] dark:text-[#33ADFF]',
                    bgClass: 'bg-blue-50 dark:bg-blue-900/20',
                    borderClass: 'border-blue-200 dark:border-blue-800',
                    duration: 'اهتزاز أقوى وأوضح',
                    condition: 'حروف قطب جد ساكنة آخر الكلمة'
                }
            ]
        },
        // التفخيم والترقيق - Emphasis
        {
            category: 'التفخيم والترقيق',
            categoryEnglish: 'Emphasis & Softening',
            categoryIcon: <Mic2 size={20} />,
            categoryColor: 'from-purple-500 to-purple-600',
            colorTag: '',
            rules: [
                {
                    name: 'حروف الاستعلاء المفخمة',
                    englishName: 'Heavy Letters',
                    description: 'سبعة أحرف مفخمة دائمًا مجموعة في: (خُصَّ ضَغْطٍ قِظ)',
                    example: 'خَلَقَ ۚ صِرَاطَ ۚ ضَرَبَ ۚ غَفُورٌ ۚ طَيِّبٌ ۚ قَالَ ۚ ظَلَمَ',
                    colorClass: 'text-purple-600 dark:text-purple-400',
                    bgClass: 'bg-purple-50 dark:bg-purple-900/20',
                    borderClass: 'border-purple-200 dark:border-purple-800',
                    duration: '',
                    condition: 'خ ص ض غ ط ق ظ'
                },
                {
                    name: 'لام لفظ الجلالة المفخمة',
                    englishName: 'Heavy Lam of Allah',
                    description: 'تُفخم لام لفظ الجلالة إذا سبقها فتح أو ضم.',
                    example: 'قَالَ اللَّهُ ۚ عَبْدُ اللَّهِ',
                    colorClass: 'text-purple-600 dark:text-purple-400',
                    bgClass: 'bg-purple-50 dark:bg-purple-900/20',
                    borderClass: 'border-purple-200 dark:border-purple-800',
                    duration: '',
                    condition: 'فتح أو ضم قبل لام الجلالة'
                },
                {
                    name: 'لام لفظ الجلالة المرققة',
                    englishName: 'Soft Lam of Allah',
                    description: 'تُرقق لام لفظ الجلالة إذا سبقها كسر.',
                    example: 'بِسْمِ اللَّهِ ۚ لِلَّهِ',
                    colorClass: 'text-purple-400 dark:text-purple-300',
                    bgClass: 'bg-purple-50 dark:bg-purple-900/20',
                    borderClass: 'border-purple-200 dark:border-purple-800',
                    duration: '',
                    condition: 'كسر قبل لام الجلالة'
                },
                {
                    name: 'الراء المفخمة',
                    englishName: 'Heavy Ra',
                    description: 'تُفخم الراء إذا كانت مفتوحة أو مضمومة، أو ساكنة بعد فتح أو ضم.',
                    example: 'رَبِّ ۚ رُزِقُوا ۚ أَرْسَلَ ۚ الْقُرْآنَ',
                    colorClass: 'text-purple-500 dark:text-purple-400',
                    bgClass: 'bg-purple-50 dark:bg-purple-900/20',
                    borderClass: 'border-purple-200 dark:border-purple-800',
                    duration: '',
                    condition: 'راء مفتوحة/مضمومة/ساكنة بعد فتح'
                },
                {
                    name: 'الراء المرققة',
                    englishName: 'Soft Ra',
                    description: 'تُرقق الراء إذا كانت مكسورة، أو ساكنة بعد كسر أصلي.',
                    example: 'رِجَالٌ ۚ فِرْعَوْنَ ۚ الذِّكْرِ',
                    colorClass: 'text-purple-400 dark:text-purple-300',
                    bgClass: 'bg-purple-50 dark:bg-purple-900/20',
                    borderClass: 'border-purple-200 dark:border-purple-800',
                    duration: '',
                    condition: 'راء مكسورة أو ساكنة بعد كسر'
                }
            ]
        },
        // أحكام أخرى (Gray - Silent Letters / Not Pronounced / Izhar)
        {
            category: 'الحروف غير المنطوقة والإظهار',
            categoryEnglish: 'Silent & Clear Letters',
            categoryIcon: <Hand size={20} />,
            categoryColor: 'from-slate-500 to-slate-600',
            colorTag: '',
            rules: [
                {
                    name: 'الحروف الرمادية (غير المنطوقة)',
                    englishName: 'Silent Letters',
                    description: 'حروف تُكتب ولا تُلفظ، مثل همزة الوصل في الدرج، اللام الشمسية، وحروف العلة المحذوفة.',
                    example: 'وَاسْمَعُوا ۚ الشَّمْسُ ۚ أُوْلَٰٓئِكَ',
                    colorClass: 'text-[#999999] dark:text-[#AAAAAA] opacity-70',
                    bgClass: 'bg-slate-50 dark:bg-slate-800/30',
                    borderClass: 'border-slate-200 dark:border-slate-700',
                    duration: 'لا تُلفظ',
                    condition: 'لون رمادي باهت'
                },
                {
                    name: 'الإظهار الحلقي',
                    englishName: 'Throat Clarity',
                    description: 'إظهار النون الساكنة أو التنوين إذا جاء بعدها حرف من حروف الحلق الستة.',
                    example: 'مِنْ أَهْلِ ۚ عَلِيمٌ حَكِيمٌ ۚ مِنْ خَيْرٍ ۚ مِنْ غِلٍّ',
                    colorClass: 'text-[#999999] dark:text-[#AAAAAA]',
                    bgClass: 'bg-slate-50 dark:bg-slate-800/30',
                    borderClass: 'border-slate-200 dark:border-slate-700',
                    duration: 'بدون غنة',
                    condition: 'نون ساكنة/تنوين + (ء هـ ع ح غ خ)'
                },
                {
                    name: 'الإظهار الشفوي',
                    englishName: 'Labial Clarity',
                    description: 'إظهار الميم الساكنة إذا جاء بعدها أي حرف ما عدا الباء والميم.',
                    example: 'أَنْعَمْتَ ۚ هُمْ فِيهَا ۚ لَكُمْ دِينُكُمْ',
                    colorClass: 'text-[#999999] dark:text-[#AAAAAA]',
                    bgClass: 'bg-slate-50 dark:bg-slate-800/30',
                    borderClass: 'border-slate-200 dark:border-slate-700',
                    duration: 'بدون غنة',
                    condition: 'ميم ساكنة + غير (ب، م)'
                },
                {
                    name: 'الإدغام بلا غنة',
                    englishName: 'Merging without Nasalization',
                    description: 'إدغام النون الساكنة أو التنوين في حرفي اللام والراء بدون غنة.',
                    example: 'مِن رَّبِّهِمْ ۚ غَفُورٌ رَّحِيمٌ ۚ مِن لَّدُنْهُ',
                    colorClass: 'text-[#999999] dark:text-[#AAAAAA]',
                    bgClass: 'bg-slate-50 dark:bg-slate-800/30',
                    borderClass: 'border-slate-200 dark:border-slate-700',
                    duration: 'إدغام كامل بدون غنة',
                    condition: 'نون ساكنة/تنوين + (ل، ر)'
                },
                {
                    name: 'إدغام المتماثلين',
                    englishName: 'Identical Letter Merging',
                    description: 'إدغام حرفين متماثلين (نفس الحرف) مثل دال في دال.',
                    example: 'قَد دَّخَلُوا ۚ وَقَد دَّخَلُوا',
                    colorClass: 'text-slate-500 dark:text-slate-400',
                    bgClass: 'bg-slate-50 dark:bg-slate-800/30',
                    borderClass: 'border-slate-200 dark:border-slate-700',
                    duration: 'إدغام كامل',
                    condition: 'حرفان متماثلان متصلان'
                }
            ]
        }
    ];

    return (
        <div className="flex flex-col h-full bg-gold-50 dark:bg-navy-950 font-sans">
            <TopBar title="أحكام التجويد" showBack />

            <div className="flex-1 overflow-y-auto p-4 md:p-6 pb-24 custom-scrollbar">
                <div className="max-w-4xl mx-auto">

                    {/* Header Description */}
                    <div className="mb-8 text-center space-y-2">
                        <div className="w-16 h-16 bg-gradient-to-br from-gold-500 to-gold-600 rounded-2xl flex items-center justify-center text-white shadow-xl mx-auto transform -rotate-3 mb-4">
                            <BookOpen size={32} />
                        </div>
                        <h2 className="text-2xl font-bold text-navy-900 dark:text-white">دليل أحكام التجويد</h2>
                        <p className="text-navy-600 dark:text-navy-300 text-sm max-w-md mx-auto leading-relaxed">
                            أحكام التجويد الأساسية لتلاوة القرآن الكريم بالطريقة الصحيحة.
                            الألوان متطابقة مع المصحف المُلوَّن في التطبيق.
                        </p>
                    </div>

                    {/* Important Note */}
                    <div className="mb-6 p-4 bg-amber-50 dark:bg-amber-900/20 rounded-2xl border border-amber-200 dark:border-amber-800 flex items-start gap-3">
                        <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                        <div>
                            <p className="text-sm font-bold text-amber-800 dark:text-amber-300">ملاحظة مهمة</p>
                            <p className="text-xs text-amber-700 dark:text-amber-400 mt-1">
                                هذا الدليل للتعريف بالأحكام الأساسية. لإتقان التجويد، يُنصح بالتلقي من شيخ متقن مجاز.
                            </p>
                        </div>
                    </div>

                    {/* Color Legend - Quick Reference */}
                    <div className="mb-8 p-4 bg-white dark:bg-navy-900 rounded-2xl border border-navy-100 dark:border-navy-800 shadow-sm">
                        <h3 className="text-sm font-bold text-navy-700 dark:text-navy-200 mb-3 text-center">
                            🎨 دليل ألوان المصحف المُلوَّن
                        </h3>
                        <div className="flex flex-wrap justify-center gap-3">
                            <div className="flex items-center gap-2 px-3 py-1.5 bg-red-50 dark:bg-red-900/20 rounded-full">
                                <span className="w-3 h-3 rounded-full bg-[#FF0000]"></span>
                                <span className="text-xs font-bold text-[#FF0000] dark:text-[#FF4D4D]">المد</span>
                            </div>
                            <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 dark:bg-emerald-900/20 rounded-full">
                                <span className="w-3 h-3 rounded-full bg-[#00B300]"></span>
                                <span className="text-xs font-bold text-[#00B300] dark:text-[#00E600]">الغنة والإخفاء</span>
                            </div>
                            <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 dark:bg-blue-900/20 rounded-full">
                                <span className="w-3 h-3 rounded-full bg-[#0099FF]"></span>
                                <span className="text-xs font-bold text-[#0099FF] dark:text-[#33ADFF]">القلقلة</span>
                            </div>
                            <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 dark:bg-blue-900/20 rounded-full">
                                <span className="w-3 h-3 rounded-full bg-[#0099FF]"></span>
                                <span className="text-xs font-bold text-[#0099FF] dark:text-[#33ADFF]">الإقلاب</span>
                            </div>
                            <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 dark:bg-slate-800/20 rounded-full">
                                <span className="w-3 h-3 rounded-full bg-[#999999]"></span>
                                <span className="text-xs font-bold text-[#999999] dark:text-[#AAAAAA]">غير منطوق</span>
                            </div>
                        </div>
                    </div>

                    {/* Rules by Category */}
                    <div className="space-y-8">
                        {tajweedRules.map((category, catIdx) => (
                            <div key={catIdx} className="space-y-4">
                                {/* Category Header */}
                                <div className="flex items-center gap-3">
                                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-white bg-gradient-to-br ${category.categoryColor} shadow-lg`}>
                                        {category.categoryIcon}
                                    </div>
                                    <div>
                                        <h3 className="text-xl font-bold text-navy-900 dark:text-white">
                                            {category.category}
                                        </h3>
                                        <p className="text-xs text-navy-500 dark:text-navy-400">
                                            {category.categoryEnglish}
                                        </p>
                                    </div>
                                    {category.colorTag && (
                                        <span className="ml-auto px-2 py-1 text-[10px] font-mono bg-navy-100 dark:bg-navy-800 text-navy-600 dark:text-navy-300 rounded">
                                            {category.colorTag}
                                        </span>
                                    )}
                                </div>

                                {/* Rules Grid */}
                                <div className="grid gap-4 md:grid-cols-2">
                                    {category.rules.map((rule, ruleIdx) => (
                                        <div
                                            key={ruleIdx}
                                            className={`relative overflow-hidden rounded-2xl p-5 border transition-all hover:shadow-lg hover:-translate-y-0.5 group ${rule.bgClass} ${rule.borderClass}`}
                                        >
                                            {/* Rule Name */}
                                            <h4 className={`font-bold text-lg mb-1 ${rule.colorClass}`}>
                                                {rule.name}
                                            </h4>
                                            <p className="text-xs text-navy-500 dark:text-navy-400 mb-2">
                                                {rule.englishName}
                                            </p>

                                            {/* Description */}
                                            <p className="text-sm text-navy-700 dark:text-navy-200 mb-3 leading-relaxed">
                                                {rule.description}
                                            </p>

                                            {/* Condition Badge */}
                                            {rule.condition && (
                                                <div className="mb-3 px-2 py-1 bg-navy-100 dark:bg-navy-800 rounded-lg inline-block">
                                                    <span className="text-[10px] font-bold text-navy-600 dark:text-navy-300">
                                                        الشرط: {rule.condition}
                                                    </span>
                                                </div>
                                            )}

                                            {/* Example Box */}
                                            <div className="bg-white/80 dark:bg-navy-950/60 p-3 rounded-xl border border-navy-100 dark:border-navy-800 backdrop-blur-sm">
                                                <p className="text-[10px] text-navy-400 dark:text-navy-500 font-bold mb-1 uppercase tracking-wider">
                                                    مثال قرآني
                                                </p>
                                                <p className={`font-quran text-xl leading-loose text-center ${rule.colorClass}`}>
                                                    {rule.example}
                                                </p>
                                            </div>

                                            {/* Duration Badge */}
                                            {rule.duration && (
                                                <div className="mt-3 inline-flex items-center gap-1.5 px-2.5 py-1 bg-white/60 dark:bg-navy-900/60 rounded-full">
                                                    <Clock size={12} className="text-navy-400" />
                                                    <span className="text-[10px] font-bold text-navy-600 dark:text-navy-300">
                                                        {rule.duration}
                                                    </span>
                                                </div>
                                            )}

                                            {/* Decorative Background */}
                                            <div className={`absolute -top-8 -right-8 w-24 h-24 rounded-full opacity-10 bg-gradient-to-br ${category.categoryColor} blur-2xl`}></div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Qalqalah Letters Reference */}
                    <div className="mt-10 p-5 bg-blue-50 dark:bg-blue-900/20 rounded-2xl border border-blue-200 dark:border-blue-800">
                        <h3 className="font-bold text-blue-700 dark:text-blue-300 mb-3 flex items-center gap-2">
                            <CircleDot size={18} />
                            حروف القلقلة
                        </h3>
                        <p className="text-4xl font-quran text-center text-blue-600 dark:text-blue-400 py-4 tracking-widest">
                            قُ طُ بُ جَ دُ
                        </p>
                        <p className="text-sm text-blue-700 dark:text-blue-400 text-center">
                            مجموعة في قولهم: <span className="font-bold">"قُطْبُ جَدٍّ"</span>
                        </p>
                    </div>

                    {/* Ikhfa Letters Reference */}
                    <div className="mt-6 p-5 bg-emerald-50 dark:bg-emerald-900/20 rounded-2xl border border-emerald-200 dark:border-emerald-800">
                        <h3 className="font-bold text-emerald-700 dark:text-emerald-300 mb-3 flex items-center gap-2">
                            <Volume2 size={18} />
                            حروف الإخفاء (١٥ حرف)
                        </h3>
                        <p className="text-2xl font-quran text-center text-emerald-600 dark:text-emerald-400 py-4 leading-loose">
                            ص ذ ث ك ج ش ق س د ط ز ف ت ض ظ
                        </p>
                        <p className="text-xs text-emerald-700 dark:text-emerald-400 text-center mt-2">
                            مجموعة في أوائل كلمات البيت: <span className="font-bold">"صِفْ ذَا ثَنَا كَمْ جَادَ شَخْصٌ قَدْ سَمَا دُمْ طَيِّبًا زِدْ فِي تُقًى ضَعْ ظَالِمًا"</span>
                        </p>
                    </div>

                    {/* Footer Note */}
                    <div className="mt-10 p-4 bg-gold-100/50 dark:bg-gold-900/10 rounded-2xl border border-gold-200 dark:border-gold-800 text-center">
                        <p className="text-sm text-gold-800 dark:text-gold-300 font-medium">
                            💡 المصادر: التجويد المصور للدكتور أيمن سويد | جمعية المحافظة على القرآن الكريم
                        </p>
                    </div>

                </div>
            </div>
        </div>
    );
};
