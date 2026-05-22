
import { RadioStation } from '../types';

export const RADIO_STATIONS: RadioStation[] = [
  // --- إذاعات الحرمين والقاهرة ---
  {
    id: 'cairo_radio',
    name: 'إذاعة القرآن الكريم من القاهرة',
    url: [
      'https://n06.radiojar.com/8s5u5tpdtwzuv',
      'https://stream.radiojar.com/8s5u5tpdtwzuv',
      'https://qurango.net/radio/cairo',
      'https://backup.qurango.net/radio/cairo'
    ],
    category: 'other'
  },
  {
    id: 'saudi_quran_radio',
    name: 'إذاعة القرآن الكريم (السعودية)',
    url: [
      'https://stream.radiojar.com/4wqre23fytzuv',
      'https://qurango.net/radio/saudi',
      'https://backup.qurango.net/radio/saudi'
    ],
    category: 'other'
  },


  // --- القراء ---

  // 1. Minshawi
  {
    id: 'minshawi_radio',
    name: 'المنشاوي (المصحف المرتل)',
    url: [
      'https://qurango.net/radio/mohammed_siddiq_alminshawi',
      'https://backup.qurango.net/radio/mohammed_siddiq_alminshawi',
      'https://server11.mp3quran.net/radios/mohammed_siddiq_alminshawi'
    ],
    category: 'reciters'
  },
  {
    id: 'minshawi_mujawwad_radio',
    name: 'المنشاوي (المصحف المجود)',
    url: [
      'https://qurango.net/radio/mohammed_siddiq_alminshawi_mojawwad',
      'https://backup.qurango.net/radio/mohammed_siddiq_alminshawi_mojawwad',
      'https://server11.mp3quran.net/radios/mohammed_siddiq_alminshawi_mojawwad'
    ],
    category: 'reciters'
  },

  // 2. Abdulbasit
  {
    id: 'abdulbasit_warsh',
    name: 'عبدالباسط (ورش عن نافع)',
    url: [
      'https://qurango.net/radio/abdulbasit_abdulsamad_warsh',
      'https://backup.qurango.net/radio/abdulbasit_abdulsamad_warsh',
      'https://server12.mp3quran.net/radios/abdulbasit_abdulsamad_warsh'
    ],
    category: 'reciters'
  },
  {
    id: 'abdulbasit_mujawwad',
    name: 'عبدالباسط (المصحف المجود)',
    url: [
      'https://qurango.net/radio/abdulbasit_abdulsamad_mojawwad',
      'https://backup.qurango.net/radio/abdulbasit_abdulsamad_mojawwad',
      'https://server10.mp3quran.net/radios/abdulbasit_abdulsamad_mojawwad'
    ],
    category: 'reciters'
  },

  // 3. Hussary
  {
    id: 'husary_mujawwad_radio',
    name: 'محمود خليل الحصري (المصحف المجود)',
    url: [
      'https://qurango.net/radio/mahmoud_khalil_alhussary_mojawwad',
      'https://backup.qurango.net/radio/mahmoud_khalil_alhussary_mojawwad'
    ],
    category: 'reciters'
  },
  {
    id: 'husary_radio',
    name: 'محمود خليل الحصري (المصحف المرتل)',
    url: [
      'https://qurango.net/radio/mahmoud_khalil_alhussary',
      'https://backup.qurango.net/radio/mahmoud_khalil_alhussary',
      'https://server13.mp3quran.net/radios/mahmoud_khalil_alhussary'
    ],
    category: 'reciters'
  },

  // 4. Badr
  {
    id: 'badr_radio',
    name: 'بدر التركي',
    url: [
      'https://qurango.net/radio/bader',
      'https://backup.qurango.net/radio/bader',
      'https://server10.mp3quran.net/radios/bader'
    ],
    category: 'reciters'
  },

  // 5. Khalid Al-Jileel
  {
    id: 'khalid_aljileel',
    name: 'خالد الجليل',
    url: [
      'https://qurango.net/radio/khalid_aljileel'
    ],
    category: 'reciters'
  },

  // 6. Mustafa Ismail (Consolidated)
  {
    id: 'mustafa_ismail',
    name: 'مصطفى إسماعيل',
    url: [
      'https://qurango.net/radio/mustafa_ismail',
      'https://backup.qurango.net/radio/mustafa_ismail'
    ],
    category: 'reciters'
  },

  // 7. Tablawi
  {
    id: 'tablawi_radio',
    name: 'محمد محمود الطبلاوي',
    url: [
      'https://qurango.net/radio/mohammad_altablaway'
    ],
    category: 'reciters'
  },
  {
    id: 'tablawi_hafs_new',
    name: 'محمد محمود الطبلاوي (برواية حفص)',
    url: [
      'https://serverkw.quran-uni.com:8078/stream'
    ],
    category: 'reciters'
  },

  // 8. Rest of Reciters
  {
    id: 'variety_radio',
    name: 'إذاعة متنوعة لمختلف القراء',
    url: [
      'https://qurango.net/radio/mix',
      'https://backup.qurango.net/radio/mix'
    ],
    category: 'reciters'
  },
  {
    id: 'alafasy_radio',
    name: 'مشاري العفاسي',
    url: [
      'https://qurango.net/radio/mishary_alafasi',
      'https://backup.qurango.net/radio/mishary_alafasi',
      'https://server10.mp3quran.net/radios/mishary_alafasi'
    ],
    category: 'reciters'
  },
  {
    id: 'fares_abbad',
    name: 'فارس عباد',
    url: [
      'https://qurango.net/radio/fares_abbad',
      'https://backup.qurango.net/radio/fares_abbad'
    ],
    category: 'reciters'
  },
  {
    id: 'nasser_qatami',
    name: 'ناصر القطامي',
    url: [
      'https://qurango.net/radio/nasser_alqatami',
      'https://backup.qurango.net/radio/nasser_alqatami'
    ],
    category: 'reciters'
  },
  {
    id: 'yasser_dosari',
    name: 'ياسر الدوسري',
    url: [
      'https://qurango.net/radio/yasser_aldosari',
      'https://backup.qurango.net/radio/yasser_aldosari'
    ],
    category: 'reciters'
  },
  {
    id: 'hazza_balushi',
    name: 'هزاع البلوشي',
    url: [
      'https://qurango.net/radio/hazza',
      'https://backup.qurango.net/radio/hazza'
    ],
    category: 'reciters'
  },
  {
    id: 'shuraim_radio',
    name: 'سعود الشريم',
    url: [
      'https://qurango.net/radio/saud_alshuraim',
      'https://backup.qurango.net/radio/saud_alshuraim',
      'https://server11.mp3quran.net/radios/saud_alshuraim'
    ],
    category: 'reciters'
  },
  {
    id: 'sudais_radio',
    name: 'عبدالرحمن السديس',
    url: [
      'https://qurango.net/radio/abdulrahman_alsudaes',
      'https://backup.qurango.net/radio/abdulrahman_alsudaes',
      'https://server11.mp3quran.net/radios/abdulrahman_alsudaes'
    ],
    category: 'reciters'
  },
  {
    id: 'maher_radio',
    name: 'ماهر المعيقلي',
    url: [
      'https://qurango.net/radio/maher_almaikulai',
      'https://backup.qurango.net/radio/maher_almaikulai',
      'https://server12.mp3quran.net/radios/maher_almaikulai'
    ],
    category: 'reciters'
  },
  {
    id: 'ajamy_radio',
    name: 'أحمد العجمي',
    url: [
      'https://qurango.net/radio/ahmad_alajmy',
      'https://backup.qurango.net/radio/ahmad_alajmy',
      'https://server10.mp3quran.net/radios/ahmad_alajmy'
    ],
    category: 'reciters'
  },

  {
    id: 'abdullah_aljohany',
    name: 'عبد الله عواد الجهني',
    url: [
      'https://qurango.net/radio/abdullah_aljohany'
    ],
    category: 'reciters'
  },
  {
    id: 'saad_alghamdi',
    name: 'سعد الغامدي',
    url: [
      'https://qurango.net/radio/saad_alghamdi'
    ],
    category: 'reciters'
  },
  {
    id: 'mahmoud_ali_albanna',
    name: 'محمود علي البنا',
    url: [
      'https://qurango.net/radio/mahmoud_ali__albanna'
    ],
    category: 'reciters'
  },
  {
    id: 'mustafa_allahoni',
    name: 'مصطفى اللاهوني',
    url: [
      'https://qurango.net/radio/mustafa_allahoni',
      'https://backup.qurango.net/radio/mustafa_allahoni'
    ],
    category: 'reciters'
  },
  {
    id: 'bandar_balilah',
    name: 'بندر بليلة',
    url: [
      'https://qurango.net/radio/bandar_balilah',
      'https://backup.qurango.net/radio/bandar_balilah'
    ],
    category: 'reciters'
  },
  {
    id: 'ali_alhuthaifi',
    name: 'علي الحذيفي',
    url: [
      'https://qurango.net/radio/ali_alhuthaifi',
      'https://backup.qurango.net/radio/ali_alhuthaifi'
    ],
    category: 'reciters'
  },
  {
    id: 'mohammed_jibreel',
    name: 'محمد جبريل',
    url: [
      'https://qurango.net/radio/mohammed_jibreel',
      'https://backup.qurango.net/radio/mohammed_jibreel'
    ],
    category: 'reciters'
  },
  {
    id: 'ahmad_nauina',
    name: 'أحمد نعينع',
    url: [
      'https://qurango.net/radio/ahmad_nauina',
      'https://backup.qurango.net/radio/ahmad_nauina'
    ],
    category: 'reciters'
  },
  {
    id: 'ali_jaber',
    name: 'علي جابر',
    url: [
      'https://qurango.net/radio/ali_jaber',
      'https://backup.qurango.net/radio/ali_jaber'
    ],
    category: 'reciters'
  },
  {
    id: 'mohammed_ayyub',
    name: 'محمد أيوب',
    url: [
      'https://qurango.net/radio/mohammed_ayyub',
      'https://backup.qurango.net/radio/mohammed_ayyub'
    ],
    category: 'reciters'
  },
  {
    id: 'ibrahim_alakdar',
    name: 'إبراهيم الأخضر',
    url: [
      'https://qurango.net/radio/ibrahim_alakdar',
      'https://backup.qurango.net/radio/ibrahim_alakdar'
    ],
    category: 'reciters'
  },
  {
    id: 'khaled_alqahtani',
    name: 'خالد القحطاني',
    url: [
      'https://qurango.net/radio/khaled_alqahtani',
      'https://backup.qurango.net/radio/khaled_alqahtani'
    ],
    category: 'reciters'
  },

  // --- إذاعات تفسير وعلوم وأخرى ---
  {
    id: 'tafsir_mukhtasar',
    name: 'المختصر في تفسير القرآن',
    url: [
      'https://qurango.net/radio/mukhtasartafsir',
      'https://backup.qurango.net/radio/mukhtasartafsir'
    ],
    category: 'other'
  },

  {
    id: 'tafsir_gharib',
    name: 'تفسير غريب القرآن',
    url: [
      'https://qurango.net/radio/gareeb-quran',
      'https://backup.qurango.net/radio/gareeb-quran'
    ],
    category: 'other'
  },
  {
    id: 'seerah_radio',
    name: 'السيرة النبوية (المختصر)',
    url: [
      'https://qurango.net/radio/almukhtasar_fi_alsiyra',
      'https://backup.qurango.net/radio/almukhtasar_fi_alsiyra'
    ],
    category: 'other'
  },
  {
    id: 'seerah_400_radio',
    name: '400 حلقة عن سيرة النبي ﷺ',
    url: [
      'https://qurango.net/radio/fi_zilal_alsiyra'
    ],
    category: 'other'
  },
  {
    id: 'ibn_baz_fiqh',
    name: 'الاختيارات الفقهية لابن باز',
    url: [
      'https://qurango.net/radio/alaikhtiarat_alfiqhayh_bin_baz'
    ],
    category: 'other'
  },
  {
    id: 'sahaba_radio',
    name: 'صور من حياة الصحابة',
    url: [
      'https://qurango.net/radio/sahabah',
      'https://backup.qurango.net/radio/sahabah'
    ],
    category: 'other'
  },
  {
    id: 'fatwa_radio',
    name: 'فتاوى العلماء',
    url: [
      'https://qurango.net/radio/fatwa',
      'https://backup.qurango.net/radio/fatwa'
    ],
    category: 'other'
  },
  {
    id: 'azkar_sabah',
    name: 'أذكار الصباح',
    url: [
      'https://qurango.net/radio/athkar_sabah',
      'https://backup.qurango.net/radio/athkar_sabah'
    ],
    category: 'other'
  },
  {
    id: 'azkar_masa',
    name: 'أذكار المساء',
    url: [
      'https://qurango.net/radio/athkar_masa',
      'https://backup.qurango.net/radio/athkar_masa'
    ],
    category: 'other'
  },
  {
    id: 'roqya_radio',
    name: 'الرقية الشرعية',
    url: [
      'https://qurango.net/radio/roqiah',
      'https://backup.qurango.net/radio/roqiah'
    ],
    category: 'other'
  },
  {
    id: 'roqya_afasy',
    name: 'الرقية الشرعية (مشاري العفاسي)',
    url: [
      'https://serverkw.quran-uni.com:8028/stream'
    ],
    category: 'other'
  },
  {
    id: 'sakina_radio',
    name: 'آيات السكينة',
    url: [
      'https://qurango.net/radio/sakeenah',
      'https://backup.qurango.net/radio/sakeenah'
    ],
    category: 'other'
  }
];
