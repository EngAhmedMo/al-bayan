
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { TopBar } from '../components/TopBar';
import { RotateCcw, Infinity as InfinityIcon, ChevronLeft, ChevronRight, Activity, CheckCircle2, List, Plus, Trash2, X, Target, Info, AlertTriangle, Award } from 'lucide-react';
import { toArabicDigits } from '../services/normalization';
import { getLastTasbihTarget, setLastTasbihTarget, getCustomTasbihs, addCustomTasbih, deleteCustomTasbih, getTasbihState, saveTasbihState, clearTasbihState, getLifetimeTasbihTotal, addLifetimeTasbihTotal } from '../services/storage';
import { useSettings } from '../components/Layout';
import { TasbihItem } from '../types';

// Default built-in Adhkar (Updated and Verified)
const BASE_ADHKAR_ITEMS: TasbihItem[] = [
  { 
    id: "std_post_prayer", 
    label: "أذكار بعد الصلاة (مجمّعة)", 
    count: 0, 
    target: 100, 
    virtue: "تُقال بعد الصلوات المكتوبة (33 تسبيح، 33 تحميد، 34 تكبير، وختاماً التهليل)",
    hadithSource: "عَنْ أَبِي هُرَيْرَةَ عَنْ رَسُولِ اللَّهِ صَلَّى اللَّهُ عَلَيْهِ وَسَلَّمَ قَالَ: مَنْ سَبَّحَ اللَّهَ فِي دُبُرِ كُلِّ صَلَاةٍ ثَلَاثًا وَثَلَاثِينَ، وَحَمِدَ اللَّهَ ثَلَاثًا وَثَلَاثِينَ، وَكَبَّرَ اللَّهَ ثَلَاثًا وَثَلَاثِينَ، فَتْلِكَ تِسْعَةٌ وَتِسْعُونَ، وَقَالَ تَمَامَ الْمِائَةِ: لَا إِلَهَ إِلَّا اللَّهُ وَحْدَهُ لَا شَرِيكَ لَهُ، لَهُ الْمُلْكُ وَلَهُ الْحَمْدُ وَهُوَ عَلَى كُلِّ شَيْءٍ قَدِيرٌ غُفِرَتْ خَطَايَاهُ وَإِنْ كَانَتْ مِثْلَ زَبَدِ الْبَحْرِ. (رواه مسلم)",
    sequenceMode: true
  },
  { id: "std_1", label: "سُبْحَانَ اللَّهِ", count: 0, target: 100, virtue: "تُكتب له ألف حسنة أو تُحط عنه ألف خطيئة", hadithSource: "عَنْ سَعْدِ بْنِ أَبِي وَقَّاصٍ، قَالَ: كُنَّا عِنْدَ رَسُولِ اللَّهِ صَلَّى اللَّهُ عَلَيْهِ وَسَلَّمَ فَقَالَ: «أَيَعْجِزُ أَحَدُكُمْ أَنْ يَكْسِبَ، كُلَّ يَوْمٍ أَلْفَ حَسَنَةٍ؟» فَسَأَلَهُ سَائِلٌ مِنْ جُلَسَائِهِ: كَيْفَ يَكْسِبُ أَحَدُنَا أَلْفَ حَسَنَةٍ؟ قَالَ: «يُسَبِّحُ مِائَةَ تَسْبِيحَةٍ، فَيُكْتَبُ لَهُ أَلْفُ حَسَنَةٍ، أَوْ يُحَطُّ عَنْهُ أَلْفُ خَطِيئَةٍ». (رواه مسلم)" },
  { id: "std_2", label: "الْحَمْدُ لِلَّهِ", count: 0, target: 33, virtue: "تَمْلَأُ الْمِيزَانَ", hadithSource: "عَنْ أَبِي مَالِكٍ الْأَشْعَرِيِّ قَالَ: قَالَ رَسُولُ اللَّهِ صَلَّى اللَّهُ عَلَيْهِ وَسَلَّمَ: «الطُّهُورُ شَطْرُ الْإِيمَانِ، وَالْحَمْدُ لِلَّهِ تَمْلَأُ الْمِيزَانَ...» (رواه مسلم)" },
  { id: "std_3", label: "لَا إِلَهَ إِلَّا اللَّهُ", count: 0, target: 100, virtue: "أَفْضَلُ الذِّكْرِ", hadithSource: "عَنْ جَابِرِ بْنِ عَبْدِ اللَّهِ يَقُولُ: سَمِعْتُ رَسُولَ اللَّهِ صَلَّى اللَّهُ عَلَيْهِ وَسَلَّمَ يَقُولُ: «أَفْضَلُ الذِّكْرِ لَا إِلَهَ إِلَّا اللَّهُ، وَأَفْضَلُ الدُّعَاءِ الْحَمْدُ لِلَّهِ». (رواه الترمذي وحسنه الألباني)" },
  { id: "std_4", label: "اللَّهُ أَكْبَرُ", count: 0, target: 34, virtue: "خيرٌ من خادم (عند النوم)", hadithSource: "عَنْ عَلِيٍّ أَنَّ فَاطِمَةَ عَلَيْهَا السَّلَامُ شَكَتْ مَا تَلْقَى مِنْ أَثَرِ الرَّحَى... فَقَالَ رَسُولُ اللَّهِ: «أَلَا أَدُلُّكُمَا عَلَى مَا هُوَ خَيْرٌ لَكُمَا مِنْ خَادِمٍ؟ إِذَا أَوَيْتُمَا إِلَى فِرَاشِكُمَا، أَوْ أَخَذْتُمَا مَضَاجِعَكُمَا، فَكَبِّرَا ثَلَاثًا وَثَلَاثِينَ، وَسَبِّحَا ثَلَاثًا وَثَلَاثِينَ، وَاحْمَدَا ثَلَاثًا وَثَلَاثِينَ، فَهَذَا خَيْرٌ لَكُمَا مِنْ خَادِمٍ». (متفق عليه)" },
  { id: "std_new_1", label: "سُبْحَانَ اللَّهِ، وَالْحَمْدُ لِلَّهِ، وَلَا إِلَهَ إِلَّا اللَّهُ، وَاللَّهُ أَكْبَرُ", count: 0, target: 100, virtue: "أَحَبُّ الْكَلَامِ إِلَى اللَّهِ", hadithSource: "عَنْ سَمُرَةَ بْنِ جُنْدَبٍ، قَالَ: قَالَ رَسُولُ اللَّهِ صَلَّى اللَّهُ عَلَيْهِ وَسَلَّمَ: «أَحَبُّ الْكَلَامِ إِلَى اللَّهِ أَرْبَعٌ: سُبْحَانَ اللَّهِ، وَالْحَمْدُ لِلَّهِ، وَلَا إِلَهَ إِلَّا اللَّهُ، وَاللَّهُ أَكْبَرُ، لَا يَضُرُّكَ بِأَيِّهِنَّ بَدَأْتَ». (رواه مسلم)" },
  { id: "std_5", label: "سُبْحَانَ اللَّهِ وَبِحَمْدِهِ", count: 0, target: 100, virtue: "حُطَّتْ خَطَايَاهُ وَإِنْ كَانَتْ مِثْلَ زَبَدِ الْبَحْرِ", hadithSource: "عَنْ أَبِي هُرَيْرَةَ رَضِيَ اللَّهُ عَنْهُ، أَنَّ رَسُولَ اللَّهِ صَلَّى اللَّهُ عَلَيْهِ وَسَلَّمَ قَالَ: «مَنْ قَالَ: سُبْحَانَ اللَّهِ وَبِحَمْدِهِ، فِي يَوْمٍ مِائَةَ مَرَّةٍ، حُطَّتْ خَطَايَاهُ، وَإِنْ كَانَتْ مِثْلَ زَبَدِ الْبَحْرِ». (متفق عليه)" },
  { id: "std_6", label: "سُبْحَانَ اللَّهِ وَبِحَمْدِهِ، سُبْحَانَ اللَّهِ الْعَظِيمِ", count: 0, target: 100, virtue: "كَلِمَتَانِ خَفِيفَتَانِ عَلَى اللِّسَانِ، ثَقِيلَتَانِ فِي الْمِيزَانِ", hadithSource: "عَنْ أَبِي هُرَيْرَةَ رَضِيَ اللَّهُ عَنْهُ قَالَ: قَالَ النَّبِيُّ صَلَّى اللَّهُ عَلَيْهِ وَسَلَّمَ: «كَلِمَتَانِ حَبِيبَتَانِ إِلَى الرَّحْمَنِ، خَفِيفَتَانِ عَلَى اللِّسَانِ، ثَقِيلَتَانِ فِي الْمِيزَانِ: سُبْحَانَ اللَّهِ وَبِحَمْدِهِ، سُبْحَانَ اللَّهِ الْعَظِيمِ». (متفق عليه)" },
  { id: "std_7", label: "لَا إِلَهَ إِلَّا اللَّهُ وَحْدَهُ لَا شَرِيكَ لَهُ، لَهُ الْمُلْكُ وَلَهُ الْحَمْدُ، وَهُوَ عَلَى كُلِّ شَيْءٍ قَدِيرٌ", count: 0, target: 100, virtue: "كَانَتْ لَهُ عَدْلَ عَشْرِ رِقَابٍ، وَكُتِبَتْ لَهُ مِائَةُ حَسَنَةٍ...", hadithSource: "عَنْ أَبِي هُرَيْرَةَ رَضِيَ اللَّهُ عَنْهُ، أَنَّ رَسُولَ اللَّهِ صَلَّى اللَّهُ عَلَيْهِ وَسَلَّمَ قَالَ: «مَنْ قَالَ لَا إِلَهَ إِلَّا اللَّهُ وَحْدَهُ لَا شَرِيكَ لَهُ، لَهُ الْمُلْكُ وَلَهُ الْحَمْدُ، وَهُوَ عَلَى كُلِّ شَيْءٍ قَدِيرٌ فِي يَوْمٍ مِائَةَ مَرَّةٍ، كَانَتْ لَهُ عَدْلَ عَشْرِ رِقَابٍ، وَكُتِبَتْ لَهُ مِائَةُ حَسَنَةٍ، وَمُحِيَتْ عَنْهُ مِائَةُ سَيِّئَةٍ، وَكَانَتْ لَهُ حِرْزًا مِنَ الشَّيْطَانِ يَوْمَهُ ذَلِكَ حَتَّى يُمْسِيَ». (متفق عليه)" },
  { id: "std_8", label: "لَا حَوْلَ وَلَا قُوَّةَ إِلَّا بِاللَّهِ", count: 0, target: 100, virtue: "كَنْزٌ مِنْ كُنُوزِ الْجَنَّةِ", hadithSource: "عَنْ أَبِي مُوسَى الْأَشْعَرِيِّ، أَنَّ النَّبِيَّ صَلَّى اللَّهُ عَلَيْهِ وَسَلَّمَ قَالَ لَهُ: «يَا عَبْدَ اللَّهِ بْنَ قَيْسٍ أَلَا أَدُلُّكَ عَلَى كَنْزٍ مِنْ كُنُوزِ الْجَنَّةِ؟»، فَقُلْتُ: بَلَى يَا رَسُولَ اللَّهِ، قَالَ: «قُلْ لَا حَوْلَ وَلَا قُوَّةَ إِلَّا بِاللَّهِ». (متفق عليه)" },
  { id: "std_9", label: "أَسْتَغْفِرُ اللَّهَ وَأَتُوبُ إِلَيْهِ", count: 0, target: 100, virtue: "طُوبَى لِمَنْ وَجَدَ فِي صَحِيفَتِهِ اسْتِغْفَارًا كَثِيرًا", hadithSource: "قَالَ رَسُولُ اللَّهِ صَلَّى اللَّهُ عَلَيْهِ وَسَلَّمَ: «إِنَّهُ لَيُغَانُ عَلَى قَلْبِي، وَإِنِّي لَأَسْتَغْفِرُ اللَّهَ فِي الْيَوْمِ مِائَةَ مَرَّةٍ». (رواه مسلم)\nوقوله: «طُوبَى لِمَنْ وَجَدَ فِي صَحِيفَتِهِ اسْتِغْفَارًا كَثِيرًا». (رواه ابن ماجه وصححه الألباني)" },
  { id: "std_10", label: "اللَّهُمَّ صَلِّ وَسَلِّمْ عَلَى نَبِيِّنَا مُحَمَّدٍ", count: 0, target: 10, virtue: "أَدْرَكَتْهُ شَفَاعَتِي يَوْمَ الْقِيَامَةِ", hadithSource: "قَالَ النَّبِيُّ صَلَّى اللَّهُ عَلَيْهِ وَسَلَّمَ: «مَنْ صَلَّى عَلَيَّ حِينَ يُصْبِحُ عَشْرًا، وَحِينَ يُمْسِي عَشْرًا، أَدْرَكَتْهُ شَفَاعَتِي يَوْمَ الْقِيَامَةِ». (رواه الطبراني وحسنه الألباني)\nوقوله: «مَنْ صَلَّى عَلَيَّ وَاحِدَةً صَلَّى اللَّهُ عَلَيْهِ عَشْرًا». (رواه مسلم)" },
  { id: "std_11", label: "حَسْبُنَا اللَّهُ وَنِعْمَ الْوَكِيلُ", count: 0, target: 0, virtue: "أمان الخائفين وتفويض الأمر لله", hadithSource: "عَنِ ابْنِ عَبَّاسٍ رَضِيَ اللَّهُ عَنْهُمَا قَالَ: «حَسْبُنَا اللَّهُ وَنِعْمَ الْوَكِيلُ، قَالَهَا إِبْرَاهِيمُ عَلَيْهِ السَّلَامُ حِينَ أُلْقِيَ فِي النَّارِ، وَقَالَهَا مُحَمَّدٌ صَلَّى اللَّهُ عَلَيْهِ وَسَلَّمَ حِينَ قَالُوا: إِنَّ النَّاسَ قَدْ جَمَعُوا لَكُمْ فَاخْشَوْهُمْ...». (رواه البخاري)" },
  { id: "std_new_2", label: "حَسْبِيَ اللَّهُ لَا إِلَهَ إِلَّا هُوَ عَلَيْهِ تَوَكَّلْتُ وَهُوَ رَبُّ الْعَرْشِ الْعَظِيمِ", count: 0, target: 7, virtue: "كَفَاهُ اللَّهُ مَا أَهَمَّهُ", hadithSource: "عَنْ أَبِي الدَّرْدَاءِ مَوْقُوفًا: «مَنْ قَالَ إِذَا أَصْبَحَ وَإِذَا أَمْسَى: حَسْبِيَ اللَّهُ لَا إِلَهَ إِلَّا هُوَ، عَلَيْهِ تَوَكَّلْتُ، وَهُوَ رَبُّ الْعَرْشِ الْعَظِيمِ سَبْعَ مَرَّاتٍ، كَفَاهُ اللَّهُ مَا أَهَمَّهُ». (رواه أبو داود وصححه الأرناؤوط)" },
  { id: "std_12", label: "يَا ذَا الْجَلَالِ وَالْإِكْرَامِ", count: 0, target: 0, virtue: "أَلِظُّوا بِهَا (أي الزموها وأكثروا منها)", hadithSource: "قَالَ رَسُولُ اللَّهِ صَلَّى اللَّهُ عَلَيْهِ وَسَلَّمَ: «أَلِظُّوا بِـ: يَا ذَا الْجَلَالِ وَالْإِكْرَامِ». (رواه الترمذي وصححه الألباني)\nأي الزموها وداوموا عليها." },
  { id: "std_13", label: "لَا إِلَهَ إِلَّا أَنْتَ سُبْحَانَكَ إِنِّي كُنْتُ مِنَ الظَّالِمِينَ", count: 0, target: 0, virtue: "لَمْ يَدْعُ بِهَا مُسْلِمٌ فِي شَيْءٍ قَطُّ إِلَّا اسْتَجَابَ اللَّهُ لَهُ", hadithSource: "عَنْ سَعْدِ بْنِ أَبِي وَقَّاصٍ قَالَ: قَالَ رَسُولُ اللَّهِ صَلَّى اللَّهُ عَلَيْهِ وَسَلَّمَ: «دَعْوَةُ ذِي النُّونِ إِذْ دَعَا وَهُوَ فِي بَطْنِ الْحُوتِ: لَا إِلَهَ إِلَّا أَنْتَ سُبْحَانَكَ إِنِّي كُنْتُ مِنَ الظَّالِمِينَ، فَإِنَّهُ لَمْ يَدْعُ بِهَا رَجُلٌ مُسْلِمٌ فِي شَيْءٍ قَطُّ إِلَّا اسْتَجَابَ اللَّهُ لَهُ». (رواه الترمذي وصححه الألباني)" },
  { id: "std_14", label: "سُبْحَانَ اللَّهِ عَدَدَ خَلْقِهِ، سُبْحَانَ اللَّهِ رِضَا نَفْسِهِ، سُبْحَانَ اللَّهِ زِنَةَ عَرْشِهِ، سُبْحَانَ اللَّهِ مِدَادَ كَلِمَاتِهِ", count: 0, target: 3, virtue: "تعدل أجر التسبيح لساعات طويلة", hadithSource: "عَنْ جُوَيْرِيَةَ أَنَّ النَّبِيَّ صَلَّى اللَّهُ عَلَيْهِ وَسَلَّمَ خَرَجَ مِنْ عِنْدِهَا بُكْرَةً حِينَ صَلَّى الصُّبْحَ وَهِيَ فِي مَسْجِدِهَا، ثُمَّ رَجَعَ بَعْدَ أَنْ أَضْحَى وَهِيَ جَالِسَةٌ... فَقَالَ النَّبِيُّ: «لَقَدْ قُلْتُ بَعْدَكِ أَرْبَعَ كَلِمَاتٍ، ثَلَاثَ مَرَّاتٍ، لَوْ وُزِنَتْ بِمَا قُلْتِ مُنْذُ الْيَوْمِ لَوَزَنَتْهُنَّ...». (رواه مسلم)" },
  { id: "std_15", label: "رَضِيتُ بِاللَّهِ رَبًّا، وَبِالْإِسْلَامِ دِينًا، وَبِمُحَمَّدٍ صَلَّى اللَّهُ عَلَيْهِ وَسَلَّمَ نَبِيًّا", count: 0, target: 3, virtue: "كَانَ حَقًّا عَلَى اللَّهِ أَنْ يُرْضِيَهُ", hadithSource: "مَنْ قَالَ إِذَا أَصْبَحَ وَإِذَا أَمْسَى: رَضِيتُ بِاللَّهِ رَبًّا، وَبِالْإِسْلَامِ دِينًا، وَبِمُحَمَّدٍ نَبِيًّا، كَانَ حَقًّا عَلَى اللَّهِ أَنْ يُرْضِيَهُ. (رواه أبو داود والترمذي وحسنه)" }
];

export const Tasbih: React.FC = () => {
  // State
  const [count, setCount] = useState(0);
  const [rounds, setRounds] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [lifetimeTotal, setLifetimeTotal] = useState(0);
  const [target, setTarget] = useState<number>(33); // Current active target
  const [isPressed, setIsPressed] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [customItems, setCustomItems] = useState<TasbihItem[]>([]);

  // Interaction Lock for Accuracy
  const isTransitioning = useRef(false);

  // Press timeout ref for cleanup (prevents race conditions)
  const pressTimeoutRef = useRef<ReturnType<typeof setTimeout>>();

  // Touch Swipe State
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);

  // Modals State
  const [isListOpen, setIsListOpen] = useState(false);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [deleteConfirmItem, setDeleteConfirmItem] = useState<TasbihItem | null>(null);
  const [isResetOpen, setIsResetOpen] = useState(false);
  const [hadithModalItem, setHadithModalItem] = useState<TasbihItem | null>(null);

  const { fontSize } = useSettings();

  // Combine Default and Custom
  const allTasbihs = useMemo(() => {
    return [...customItems, ...BASE_ADHKAR_ITEMS];
  }, [customItems]);

  const currentTasbih = allTasbihs[currentIndex] || BASE_ADHKAR_ITEMS[0];

  // Dynamic Label for Sequence Mode
  const getDynamicLabel = (item: TasbihItem, currentCount: number) => {
    if (item.sequenceMode && item.id === 'std_post_prayer') {
      if (currentCount < 33) return "سُبْحَانَ اللَّهِ";
      if (currentCount < 66) return "الْحَمْدُ لِلَّهِ";
      if (currentCount < 100) return "اللَّهُ أَكْبَرُ";
      return "لَا إِلَهَ إِلَّا اللَّهُ وَحْدَهُ لَا شَرِيكَ لَهُ، لَهُ الْمُلْكُ وَلَهُ الْحَمْدُ، وَهُوَ عَلَى كُلِّ شَيْءٍ قَدِيرٌ";
    }
    return item.label;
  };

  const displayLabel = getDynamicLabel(currentTasbih, count);

  // Initialize: Restore preferences & Load Custom
  useEffect(() => {
    setCustomItems(getCustomTasbihs());
    setLifetimeTotal(getLifetimeTasbihTotal());
    const savedState = getTasbihState();
    if (savedState) {
      setCount(savedState.count);
      setRounds(savedState.rounds);
      setTotalCount(savedState.totalCount);
      setCurrentIndex(savedState.currentIndex);
      setTarget(savedState.target);
    } else {
      const savedTarget = getLastTasbihTarget();
      if (savedTarget !== null) {
        setTarget(savedTarget);
      }
    }
  }, []);

  // Save State on Change
  useEffect(() => {
    saveTasbihState({ count, rounds, totalCount, currentIndex, target });
  }, [count, rounds, totalCount, currentIndex, target]);

  // Smart Keyboard Interactions
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in an input or textarea
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }
      
      // If any modal is open, let Escape close it
      if (isListOpen || isAddOpen || hadithModalItem || isResetOpen) {
        if (e.code === 'Escape') {
          setIsListOpen(false);
          setIsAddOpen(false);
          setHadithModalItem(null);
          setIsResetOpen(false);
        }
        return;
      }

      switch (e.code) {
        case 'Space':
        case 'Enter':
        case 'NumpadEnter':
          e.preventDefault();
          handleTap();
          break;
        case 'ArrowRight':
          e.preventDefault();
          changeZekr('prev'); // RTL: Right arrow goes to previous
          break;
        case 'ArrowLeft':
          e.preventDefault();
          changeZekr('next'); // RTL: Left arrow goes to next
          break;
        case 'ArrowUp':
        case 'ArrowDown':
          e.preventDefault();
          const targets = [33, 100, 1000, 0];
          const cIndex = targets.indexOf(target);
          if (cIndex !== -1) {
            const nextIndex = e.code === 'ArrowUp' 
              ? (cIndex + 1) % targets.length 
              : (cIndex - 1 + targets.length) % targets.length;
            handleTargetChange(targets[nextIndex]);
          }
          break;
        case 'Escape':
          e.preventDefault();
          setIsResetOpen(true);
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isListOpen, isAddOpen, hadithModalItem, isResetOpen, count, target, allTasbihs, currentIndex]);

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      if (pressTimeoutRef.current) clearTimeout(pressTimeoutRef.current);
    };
  }, []);

  const handleTargetChange = (newTarget: number) => {
    setTarget(newTarget);
    setLastTasbihTarget(newTarget);
    setCount(0);
    // Safety unlock when manual change happens
    isTransitioning.current = false;
  };

  const changeZekr = (direction: 'next' | 'prev') => {
    let newIndex = 0;
    if (direction === 'next') {
      newIndex = (currentIndex + 1) % allTasbihs.length;
    } else {
      newIndex = (currentIndex - 1 + allTasbihs.length) % allTasbihs.length;
    }

    setCurrentIndex(newIndex);
    setCount(0);

    // Safety unlock when manual change happens
    isTransitioning.current = false;

    // When switching, update target to the item's default preference
    if (allTasbihs[newIndex].target > 0) {
      setTarget(allTasbihs[newIndex].target);
    }

    if (navigator.vibrate) navigator.vibrate(10);
  };

  const selectTasbihFromList = (index: number) => {
    setCurrentIndex(index);
    const item = allTasbihs[index];
    if (item.target > 0) setTarget(item.target);
    setCount(0);
    setIsListOpen(false);
    isTransitioning.current = false;
  };

  const handleAddCustom = (text: string, defaultTarget: number) => {
    const newItem: TasbihItem = {
      id: Date.now().toString(),
      label: text,
      count: 0,
      target: defaultTarget
    };
    addCustomTasbih(newItem);
    setCustomItems(getCustomTasbihs());
    setIsAddOpen(false);

    // Switch to the new item immediately
    setTimeout(() => {
      setCurrentIndex(0); // Because we prepend custom items
      setTarget(defaultTarget);
      setCount(0);
      isTransitioning.current = false;
    }, 100);
  };

  const handleDeleteCustom = (item: TasbihItem) => {
    setDeleteConfirmItem(item);
  };

  const confirmDelete = () => {
    if (!deleteConfirmItem) return;
    deleteCustomTasbih(deleteConfirmItem.id);
    setCustomItems(getCustomTasbihs());
    // If we deleted the current one, reset index
    if (currentTasbih.id === deleteConfirmItem.id) {
      setCurrentIndex(0);
      setCount(0);
      isTransitioning.current = false;
    }
    setDeleteConfirmItem(null);
  };

  // Haptic Feedback Helper
  const triggerHaptic = (pattern: number | number[] = 10) => {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(pattern);
    }
  };

  const handleTap = () => {
    // 1. SECURITY LOCK: Prevent rapid taps from messing up the logic during transition
    if (isTransitioning.current) return;

    // Clear any existing press timeout to prevent race conditions
    if (pressTimeoutRef.current) {
      clearTimeout(pressTimeoutRef.current);
    }

    setIsPressed(true);
    pressTimeoutRef.current = setTimeout(() => setIsPressed(false), 80);

    const newCount = count + 1;
    setTotalCount(t => t + 1);
    setLifetimeTotal(t => t + 1);
    addLifetimeTasbihTotal(1);

    if (target > 0 && newCount >= target) {
      // --- COMPLETION & AUTO-ADVANCE LOGIC ---

      // Lock immediately to ignore any extra taps (Ghost touch prevention)
      isTransitioning.current = true;

      triggerHaptic([30, 50, 30]);
      setCount(target); // Visually reach the target

      // Short delay to show completion, then switch
      setTimeout(() => {
        // Increment completed rounds (Sets)
        setRounds(r => r + 1);

        // Move to NEXT Dhikr automatically
        const nextIndex = (currentIndex + 1) % allTasbihs.length;
        setCurrentIndex(nextIndex);

        // Update target for the new Dhikr
        const nextItem = allTasbihs[nextIndex];
        if (nextItem.target > 0) {
          setTarget(nextItem.target);
        }

        // Reset count for the NEW Dhikr
        setCount(0);

        // Unlock for interaction
        isTransitioning.current = false;
      }, 400); // 400ms transition delay
    } else {
      // --- NORMAL INCREMENT ---
      triggerHaptic(8);
      setCount(newCount);
    }
  };

  const confirmReset = () => {
    triggerHaptic(20);
    setCount(0);
    setRounds(0);
    isTransitioning.current = false;
    setIsResetOpen(false);
  };

  // Touch Swipe Handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null || touchStartY.current === null) return;
    
    const touchEndX = e.changedTouches[0].clientX;
    const touchEndY = e.changedTouches[0].clientY;
    
    const deltaX = touchStartX.current - touchEndX;
    const deltaY = touchStartY.current - touchEndY;

    // Check if it's a horizontal swipe (more horizontal than vertical)
    if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 50) {
      if (deltaX > 0) {
        // Swiped Left -> Next Dhikr
        changeZekr('next');
      } else {
        // Swiped Right -> Prev Dhikr
        changeZekr('prev');
      }
    }
    
    touchStartX.current = null;
    touchStartY.current = null;
  };

  // Background Blind-Tap Handler
  const handleBackgroundTap = (e: React.MouseEvent | React.TouchEvent) => {
    // Ignore if clicked on a button, input, or any interactive element
    if (
      e.target instanceof Element && 
      (e.target.closest('button') || e.target.closest('input') || e.target.closest('textarea'))
    ) {
      return;
    }
    // Increment only if we are not interacting with UI elements
    handleTap();
  };

  // Consistent Button Style
  // Consistent Button Style - Premium Gold Update
  const headerBtnClass = "w-10 h-10 flex items-center justify-center rounded-xl bg-white/80 dark:bg-navy-900/40 backdrop-blur-sm border border-navy-100 dark:border-[#C6AD73]/60 text-navy-600 dark:text-[#C6AD73] hover:border-gold-400 dark:hover:border-[#C6AD73] hover:text-gold-600 dark:hover:text-[#F0CF85] hover:bg-white dark:hover:bg-[#C6AD73]/10 shadow-sm hover:shadow-md transition-all duration-200 active:scale-95 relative overflow-hidden";

  return (
    <div className="flex flex-col h-full bg-gold-50 dark:bg-navy-950 font-sans overflow-hidden">
      <TopBar
        title="السبحة الإلكترونية"
        extra={
          <button onClick={() => setIsListOpen(true)} className={headerBtnClass} title="قائمة التسابيح">
            <List size={22} />
          </button>
        }
      />

      {/* Main Content Area - Scrollable with Gestures */}
      <div 
        className="flex-1 relative overflow-y-auto overflow-x-hidden custom-scrollbar w-full"
        style={{ touchAction: 'pan-y' }}
        onClick={handleBackgroundTap}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {/* Enhanced Background Pattern */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute inset-0 bg-gradient-to-b from-gold-50 via-white to-gold-100/50 dark:from-navy-950 dark:via-navy-900 dark:to-navy-950"></div>
          <div className="absolute inset-0 opacity-[0.03] dark:opacity-[0.02] bg-[url('https://www.transparenttextures.com/patterns/arabesque.png')]"></div>
          <div className="absolute top-0 right-0 w-96 h-96 bg-gold-400/10 dark:bg-gold-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3"></div>
          <div className="absolute bottom-0 left-0 w-80 h-80 bg-amber-400/10 dark:bg-amber-500/5 rounded-full blur-3xl translate-y-1/2 -translate-x-1/3"></div>
        </div>

        <div className="min-h-full flex flex-col justify-between items-center pb-24 relative z-10">

          {/* Top: Stats Section */}
          <div className="w-full px-4 sm:px-6 pt-6 flex flex-col items-center">
            {/* Stats Badges */}
            <div className="flex flex-wrap items-center justify-center gap-3 mb-6">
              
              {/* Lifetime Total Badge */}
              <div className="bg-indigo-50/90 dark:bg-indigo-900/30 backdrop-blur-xl px-4 py-2 rounded-2xl border border-indigo-200/50 dark:border-indigo-700/50 shadow-lg shadow-indigo-500/10 dark:shadow-indigo-950/50 flex items-center gap-2.5 group hover:scale-105 transition-transform">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-400 to-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-500/30">
                  <Award size={16} className="text-white" />
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-bold block">الإجمالي العام</span>
                  <span className="text-lg font-bold text-indigo-700 dark:text-indigo-300 font-sans tracking-tight">{toArabicDigits(lifetimeTotal)}</span>
                </div>
              </div>

              {/* Session Total Counter Badge */}
              <div className="bg-white/90 dark:bg-navy-800/90 backdrop-blur-xl px-4 py-2 rounded-2xl border border-gold-200/50 dark:border-navy-700 shadow-lg shadow-gold-500/5 dark:shadow-navy-950/50 flex items-center gap-2.5 group hover:scale-105 transition-transform">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-gold-400 to-amber-500 flex items-center justify-center shadow-lg shadow-gold-500/30">
                  <Activity size={16} className="text-white" />
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-navy-400 dark:text-navy-500 font-bold block">المجموع</span>
                  <span className="text-lg font-bold text-navy-900 dark:text-white font-sans tracking-tight">{toArabicDigits(totalCount)}</span>
                </div>
              </div>

              {/* Rounds Badge */}
              {rounds > 0 && (
                <div className="bg-emerald-50/90 dark:bg-emerald-900/30 backdrop-blur-xl px-4 py-2 rounded-2xl border border-emerald-200/50 dark:border-emerald-700/50 shadow-lg shadow-emerald-500/10 dark:shadow-emerald-950/50 flex items-center gap-2.5 animate-in zoom-in duration-300">
                  <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-500/30">
                    <CheckCircle2 size={16} className="text-white" />
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold block">الدورات</span>
                    <span className="text-lg font-bold text-emerald-700 dark:text-emerald-300 font-sans">{toArabicDigits(rounds)}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Dhikr Display Card */}
            <div className="w-full max-w-md bg-white/95 dark:bg-navy-800/95 backdrop-blur-xl rounded-3xl p-5 shadow-2xl shadow-gold-500/10 dark:shadow-navy-950/50 border border-white/80 dark:border-navy-700 relative overflow-hidden text-center">
              {/* Decorative Corner */}
              <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-gold-400/10 to-transparent rounded-full -translate-y-1/2 translate-x-1/2"></div>

              {/* Navigation Row */}
              <div className="flex items-center justify-between gap-4 mb-4">
                <button
                  onClick={() => changeZekr('prev')}
                  className="w-10 h-10 flex shrink-0 items-center justify-center rounded-xl bg-navy-50/80 dark:bg-navy-900/40 text-navy-400 dark:text-[#C6AD73] border border-transparent dark:border-[#C6AD73]/30 hover:border-gold-400 dark:hover:border-[#C6AD73] hover:bg-gold-100 dark:hover:bg-[#C6AD73]/10 hover:text-gold-600 dark:hover:text-[#F0CF85] transition-all shadow-sm hover:shadow-md active:scale-95"
                >
                  <ChevronRight size={20} />
                </button>

                {/* Current Index Pill */}
                <div className="flex items-center gap-2 bg-gradient-to-r from-gold-100 to-amber-100 dark:from-navy-700 dark:to-navy-800 px-4 py-1.5 rounded-full border border-gold-200/50 dark:border-navy-600">
                  <span className="text-xs font-bold text-gold-700 dark:text-gold-400">
                    {toArabicDigits(currentIndex + 1)} / {toArabicDigits(allTasbihs.length)}
                  </span>
                </div>

                <button
                  onClick={() => changeZekr('next')}
                  className="w-10 h-10 flex shrink-0 items-center justify-center rounded-xl bg-navy-50/80 dark:bg-navy-900/40 text-navy-400 dark:text-[#C6AD73] border border-transparent dark:border-[#C6AD73]/30 hover:border-gold-400 dark:hover:border-[#C6AD73] hover:bg-gold-100 dark:hover:bg-[#C6AD73]/10 hover:text-gold-600 dark:hover:text-[#F0CF85] transition-all shadow-sm hover:shadow-md active:scale-95"
                >
                  <ChevronLeft size={20} />
                </button>
              </div>

              {/* Dhikr Text */}
              <div className="min-h-[110px] flex flex-col items-center justify-center overflow-y-auto custom-scrollbar px-2 py-0">
                <h2
                  className={`font-quran font-bold text-navy-900 dark:text-white leading-[1.8] text-center break-words w-full transition-all duration-300 ${isTransitioning.current ? 'opacity-80 scale-95' : 'opacity-100 scale-100'}`}
                  style={{ fontSize: `${Math.max(22, Math.min(fontSize * 1.2, 34))}px` }}
                >
                  {displayLabel}
                </h2>
                {currentTasbih.virtue && (
                  <div className="mt-3.5 flex items-center gap-2 bg-emerald-50 dark:bg-emerald-900/20 pl-1 pr-3 py-1.5 rounded-xl text-emerald-700 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-800/50 shadow-sm animate-in fade-in max-w-[95%] mx-auto">
                    <span className="flex-shrink-0"><CheckCircle2 size={13} /></span>
                    <span className="text-[11px] md:text-xs font-bold leading-relaxed text-right flex-1">{currentTasbih.virtue}</span>
                    {currentTasbih.hadithSource && (
                      <button 
                        onClick={() => setHadithModalItem(currentTasbih)}
                        className="p-1.5 rounded-lg bg-emerald-100/50 dark:bg-emerald-800/50 hover:bg-emerald-200 dark:hover:bg-emerald-700 transition-colors shrink-0"
                        title="تخريج الحديث"
                      >
                        <Info size={14} className="text-emerald-800 dark:text-emerald-300" />
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Center: Main Tap Button */}
          <div className="flex-1 flex items-center justify-center w-full z-10 py-6 sm:py-10">
            <button
              onClick={handleTap}
              className="relative group outline-none focus:outline-none select-none"
              style={{
                WebkitTapHighlightColor: 'transparent',
                touchAction: 'manipulation', // Prevents zoom/pan on rapid taps
                WebkitUserSelect: 'none',
                userSelect: 'none'
              }}
            >
              {/* Outer Glow Effect */}
              <div className={`absolute inset-0 rounded-full transition-opacity duration-150 ${isPressed
                ? 'scale-[1.15] opacity-100'
                : 'scale-100 opacity-0 group-hover:opacity-30 group-hover:scale-110'}`}>
                <div className="w-full h-full rounded-full bg-gradient-to-r from-gold-400 to-amber-500 blur-2xl"></div>
              </div>

              {/* Main Button */}
              <div className={`
                   relative w-56 h-56 sm:w-64 sm:h-64 md:w-72 md:h-72 rounded-full 
                   bg-gradient-to-br from-white via-gold-50 to-amber-50 dark:from-navy-800 dark:via-navy-850 dark:to-navy-900
                   shadow-[0_15px_50px_-15px_rgba(0,0,0,0.15),inset_0_-8px_20px_rgba(0,0,0,0.04)] 
                   dark:shadow-[0_15px_50px_-15px_rgba(0,0,0,0.5),inset_0_2px_2px_rgba(255,255,255,0.05)]
                   border-[6px] border-white/80 dark:border-navy-700/80
                   flex flex-col items-center justify-center
                   transition-transform duration-100 ease-out will-change-transform
                   ${isPressed ? 'scale-[0.96]' : 'scale-100 group-hover:scale-[1.02]'}
                `}>

                {/* Inner Highlight Ring */}
                <div className="absolute inset-4 rounded-full border-2 border-gold-200/30 dark:border-gold-500/10"></div>

                {/* Counter Display */}
                <span className="text-7xl sm:text-8xl font-sans font-black text-navy-800 dark:text-white tracking-tighter drop-shadow-sm select-none tabular-nums">
                  {toArabicDigits(count)}
                </span>

                {/* Target Info */}
                <div className="flex items-center gap-2 mt-3 bg-navy-50/80 dark:bg-navy-700/80 px-4 py-1.5 rounded-full">
                  <Target size={12} className="text-gold-500" />
                  <span className="text-xs font-bold text-navy-500 dark:text-navy-400">
                    الهدف: {target === 0 ? '∞' : toArabicDigits(target)}
                  </span>
                </div>
              </div>

              {/* Progress Ring */}
              <svg className="absolute inset-0 w-full h-full -rotate-90 pointer-events-none" viewBox="0 0 100 100">
                {/* Background Ring */}
                <circle
                  cx="50" cy="50" r="47"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  className="text-navy-100 dark:text-navy-800"
                />
                {/* Progress Ring */}
                <circle
                  cx="50" cy="50" r="47"
                  fill="none"
                  stroke="url(#progressGradient)"
                  strokeWidth="4"
                  strokeDasharray={295}
                  strokeDashoffset={295 - (target > 0 ? (Math.min(count / target, 1)) * 295 : 295)}
                  strokeLinecap="round"
                  className="transition-all duration-300 drop-shadow-lg"
                />
                <defs>
                  <linearGradient id="progressGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#f59e0b" />
                    <stop offset="100%" stopColor="#d97706" />
                  </linearGradient>
                </defs>
              </svg>
            </button>
          </div>

          {/* Bottom: Controls Panel */}
          <div className="w-full px-4 sm:px-8 pb-6 z-10 mt-auto">
            <div className="bg-white/95 dark:bg-navy-800/95 backdrop-blur-xl rounded-3xl p-3 sm:p-4 flex justify-between items-center shadow-2xl shadow-gold-500/10 dark:shadow-navy-950/50 border border-white/80 dark:border-navy-700">

              {/* Reset Button */}
              <button
                onClick={() => setIsResetOpen(true)}
                className="w-12 h-12 sm:w-14 sm:h-14 flex items-center justify-center rounded-2xl text-[#C6AD73] border border-[#C6AD73]/30 dark:border-[#C6AD73]/60 hover:border-red-500/50 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all active:scale-95 shadow-sm"
                title="تصفير"
              >
                <RotateCcw size={22} />
              </button>

              {/* Divider */}
              <div className="h-10 w-px bg-navy-100 dark:bg-navy-700 mx-2 sm:mx-3"></div>

              {/* Target Presets */}
              <div className="flex-1 flex justify-center gap-2 sm:gap-3">
                {[33, 100, 1000, 0].map(val => (
                  <button
                    key={val}
                    onClick={() => handleTargetChange(val)}
                    className={`flex-1 max-w-[4.5rem] py-2.5 sm:py-3 rounded-xl text-xs sm:text-sm font-bold transition-all active:scale-95 ${target === val
                      ? 'bg-gradient-to-br from-gold-400 to-amber-500 text-white shadow-lg shadow-gold-500/30'
                      : 'text-navy-500 dark:text-navy-400 bg-navy-50/50 dark:bg-navy-700/50 hover:bg-navy-100 dark:hover:bg-navy-700'
                      }`}
                  >
                    {val === 0 ? <InfinityIcon size={18} className="mx-auto" /> : toArabicDigits(val)}
                  </button>
                ))}
              </div>
            </div>

            {/* Keyboard Shortcuts Hint (Desktop) */}
            <div className="hidden md:flex justify-center items-center gap-4 mt-5 text-xs font-bold text-navy-400 dark:text-navy-500/80">
              <span className="flex items-center gap-1.5"><kbd className="px-2 py-0.5 rounded-md bg-navy-100 dark:bg-navy-800 font-sans border border-navy-200 dark:border-navy-700 shadow-sm">Space</kbd> للتسبيح</span>
              <span className="flex items-center gap-1.5"><kbd className="px-2 py-0.5 rounded-md bg-navy-100 dark:bg-navy-800 font-sans border border-navy-200 dark:border-navy-700 shadow-sm">← →</kbd> للتبديل</span>
              <span className="flex items-center gap-1.5"><kbd className="px-2 py-0.5 rounded-md bg-navy-100 dark:bg-navy-800 font-sans border border-navy-200 dark:border-navy-700 shadow-sm">↑ ↓</kbd> للهدف</span>
              <span className="flex items-center gap-1.5"><kbd className="px-2 py-0.5 rounded-md bg-navy-100 dark:bg-navy-800 font-sans border border-navy-200 dark:border-navy-700 shadow-sm">Esc</kbd> للتصفير</span>
            </div>
          </div>
        </div>
      </div>

      {/* --- Management List Modal --- */}
      {isListOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-navy-900/80 backdrop-blur-sm" onClick={() => setIsListOpen(false)}></div>
          <div className="relative w-full max-w-sm bg-white dark:bg-navy-900 rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 border border-navy-100 dark:border-navy-800 flex flex-col max-h-[80vh]">

            <div className="p-4 border-b border-navy-100 dark:border-navy-800 flex justify-between items-center bg-navy-50 dark:bg-navy-950">
              <h3 className="font-bold text-lg text-navy-900 dark:text-white flex items-center gap-2">
                <List size={20} className="text-gold-500" /> قائمة التسابيح
              </h3>
              <button onClick={() => setIsListOpen(false)}><X size={20} className="text-navy-400" /></button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar space-y-2 bg-white dark:bg-navy-900">
              <button
                onClick={() => { setIsListOpen(false); setIsAddOpen(true); }}
                className="w-full mb-2 flex items-center justify-center gap-2 p-3 rounded-xl border-2 border-dashed border-navy-200 dark:border-navy-700 text-navy-500 hover:border-gold-500 hover:text-gold-600 hover:bg-gold-50/50 transition-all font-bold"
              >
                <Plus size={18} /> إضافة تسبيح جديد
              </button>

              {allTasbihs.map((item, idx) => (
                <div key={item.id} className={`flex items-center gap-2 p-3 rounded-xl border transition-all ${idx === currentIndex ? 'bg-gold-50 dark:bg-gold-900/20 border-gold-500' : 'bg-white dark:bg-navy-800 border-navy-100 dark:border-navy-700'}`}>
                  <button
                    onClick={() => selectTasbihFromList(idx)}
                    className="flex-1 text-right"
                  >
                    <p className={`font-bold font-quran text-sm ${idx === currentIndex ? 'text-navy-900 dark:text-white' : 'text-navy-600 dark:text-navy-300'}`}>{item.label}</p>
                    <span className="text-[10px] text-navy-400">الهدف الافتراضي: {toArabicDigits(item.target)}</span>
                  </button>
                  {/* Only custom items (those not starting with 'std_') can be deleted */}
                  {!item.id.startsWith('std_') && (
                    <button
                      onClick={() => handleDeleteCustom(item)}
                      className="p-2 text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-full transition-colors"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* --- Add New Tasbih Modal --- */}
      {isAddOpen && (
        <AddTasbihModal onClose={() => setIsAddOpen(false)} onAdd={handleAddCustom} />
      )}

      {/* --- Delete Confirmation Modal --- */}
      {deleteConfirmItem && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-navy-950/80 backdrop-blur-sm" onClick={() => setDeleteConfirmItem(null)}></div>
          <div className="relative w-full max-w-sm md:max-w-md bg-white dark:bg-navy-900 rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 border border-navy-100 dark:border-navy-800">

            {/* Header with gradient */}
            <div className="p-6 bg-gradient-to-br from-red-500 to-red-600 text-white text-center">
              <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-3 backdrop-blur-sm">
                <Trash2 size={32} />
              </div>
              <h3 className="text-xl font-bold">حذف التسبيح</h3>
            </div>

            {/* Content */}
            <div className="p-6 text-center">
              <p className="text-sm text-navy-500 dark:text-navy-400 mb-3">هل أنت متأكد من حذف هذا الذكر؟</p>

              {/* Dhikr Preview */}
              <div className="bg-navy-50 dark:bg-navy-800 p-4 rounded-2xl mb-6 border border-navy-100 dark:border-navy-700">
                <p className="font-quran text-lg text-navy-900 dark:text-white leading-relaxed">
                  {deleteConfirmItem.label}
                </p>
                <span className="text-[10px] text-navy-400 mt-2 block">
                  الهدف: {toArabicDigits(deleteConfirmItem.target)}
                </span>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3">
                <button
                  onClick={() => setDeleteConfirmItem(null)}
                  className="flex-1 py-3.5 px-4 rounded-xl font-bold text-navy-600 dark:text-navy-300 bg-navy-100 dark:bg-navy-800 hover:bg-navy-200 dark:hover:bg-navy-700 transition-all active:scale-95"
                >
                  إلغاء
                </button>
                <button
                  onClick={confirmDelete}
                  className="flex-1 py-3.5 px-4 rounded-xl font-bold text-white bg-red-500 hover:bg-red-600 transition-all flex items-center justify-center gap-2 shadow-lg shadow-red-500/20 active:scale-95"
                >
                  <Trash2 size={18} />
                  حذف
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --- Hadith Source Modal --- */}
      {hadithModalItem && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-navy-950/80 backdrop-blur-sm" onClick={() => setHadithModalItem(null)}></div>
          <div className="relative w-full max-w-sm md:max-w-lg bg-white dark:bg-navy-900 rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 border border-navy-100 dark:border-navy-800">
            <div className="p-5 border-b border-navy-100 dark:border-navy-800 flex justify-between items-center bg-navy-50 dark:bg-navy-800/50">
              <h3 className="font-bold text-lg text-navy-800 dark:text-white font-sans flex items-center gap-2">
                <Info size={20} className="text-gold-500" /> نص الحديث وتخريجه
              </h3>
              <button onClick={() => setHadithModalItem(null)} className="p-1.5 rounded-full hover:bg-navy-200 dark:hover:bg-navy-700 text-navy-500">
                <X size={20} />
              </button>
            </div>
            <div className="p-6">
              <p className="font-quran text-xl leading-loose text-navy-900 dark:text-white text-center mb-6 bg-gold-50 dark:bg-navy-800 p-4 rounded-2xl border border-gold-100 dark:border-navy-700">
                {hadithModalItem.hadithSource?.split('\n').map((line, i) => (
                  <span key={i} className="block mb-2 last:mb-0">{line}</span>
                ))}
              </p>
              <button
                onClick={() => setHadithModalItem(null)}
                className="w-full py-3 bg-navy-100 dark:bg-navy-800 hover:bg-navy-200 dark:hover:bg-navy-700 text-navy-900 dark:text-white font-bold rounded-xl transition-colors"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- Reset Confirmation Modal --- */}
      {isResetOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-navy-950/80 backdrop-blur-sm" onClick={() => setIsResetOpen(false)}></div>
          <div className="relative w-full max-w-sm bg-white dark:bg-navy-900 rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 border border-navy-100 dark:border-navy-800">
            <div className="p-6 bg-gradient-to-br from-amber-500 to-amber-600 text-white text-center">
              <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-3 backdrop-blur-sm">
                <AlertTriangle size={32} />
              </div>
              <h3 className="text-xl font-bold">تصفير العداد</h3>
            </div>
            <div className="p-6 text-center">
              <p className="text-sm text-navy-600 dark:text-navy-300 mb-6 font-medium">هل أنت متأكد من رغبتك في تصفير العداد الحالي وعدد الدورات؟</p>
              <div className="flex gap-3">
                <button
                  onClick={() => setIsResetOpen(false)}
                  className="flex-1 py-3.5 px-4 rounded-xl font-bold text-navy-600 dark:text-navy-300 bg-navy-100 dark:bg-navy-800 hover:bg-navy-200 dark:hover:bg-navy-700 transition-all active:scale-95"
                >
                  إلغاء
                </button>
                <button
                  onClick={confirmReset}
                  className="flex-1 py-3.5 px-4 rounded-xl font-bold text-white bg-amber-500 hover:bg-amber-600 transition-all flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 active:scale-95"
                >
                  <RotateCcw size={18} />
                  تأكيد
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

const AddTasbihModal = ({ onClose, onAdd }: { onClose: () => void, onAdd: (text: string, target: number) => void }) => {
  const [text, setText] = useState('');
  const [target, setTarget] = useState(''); // Default empty to force choice

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;

    const targetNum = parseInt(target);
    if (!targetNum || targetNum < 1) {
      alert("الرجاء تحديد العدد المستهدف");
      return;
    }

    onAdd(text, targetNum);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-navy-900/80 backdrop-blur-sm" onClick={onClose}></div>
      <div className="relative w-full max-w-md bg-white dark:bg-navy-900 rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 border border-navy-100 dark:border-navy-800">
        <div className="p-5 border-b border-navy-100 dark:border-navy-800 flex justify-between items-center bg-navy-50 dark:bg-navy-800/50">
          <h3 className="font-bold text-lg text-navy-800 dark:text-white font-sans">إضافة تسبيح جديد</h3>
          <button onClick={onClose} className="p-1.5 rounded-full hover:bg-navy-200 dark:hover:bg-navy-700 text-navy-500">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div>
            <label className="block text-sm font-bold text-navy-700 dark:text-navy-300 mb-2">نص الذكر / التسبيح</label>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              className="w-full p-4 rounded-2xl border bg-white dark:bg-navy-950 border-navy-200 dark:border-navy-700 focus:ring-2 focus:ring-gold-500 outline-none h-32 font-quran text-xl text-navy-900 dark:text-white placeholder:font-sans placeholder:text-sm"
              placeholder="اكتب الذكر هنا..."
              required
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-navy-700 dark:text-navy-300 mb-2 flex items-center gap-2">
              <Target size={16} className="text-gold-500" /> العدد المستهدف
            </label>
            <div className="flex gap-2">
              {[33, 100, 1000].map(val => (
                <button
                  key={val}
                  type="button"
                  onClick={() => setTarget(val.toString())}
                  className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all border ${target === val.toString() ? 'bg-gold-500 text-white border-gold-500' : 'bg-white dark:bg-navy-950 text-navy-500 border-navy-200 dark:border-navy-700'}`}
                >
                  {toArabicDigits(val)}
                </button>
              ))}
            </div>
            <input
              type="number"
              min="1"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              className="w-full p-3.5 mt-3 rounded-xl border bg-white dark:bg-navy-950 border-navy-200 dark:border-navy-700 focus:ring-2 focus:ring-gold-500 outline-none text-navy-900 dark:text-white font-bold text-center"
              placeholder="اختر من القائمة أو اكتب رقماً"
              required
            />
          </div>

          <button
            type="submit"
            className="w-full py-4 bg-gold-500 hover:bg-gold-600 text-navy-900 font-bold rounded-2xl transition-colors shadow-lg shadow-gold-500/20 mt-2"
          >
            حفظ وإضافة
          </button>
        </form>
      </div>
    </div>
  );
};
