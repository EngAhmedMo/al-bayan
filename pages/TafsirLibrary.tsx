
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Book, Library, ArrowRight, Star } from 'lucide-react';
import { TopBar } from '../components/TopBar';

interface TafsirBook {
  id: string;
  title: string;
  author: string;
  description: string;
  coverColor: string;
  textColor: string;
  slug: 'ar.ibn-kathir' | 'ar.jalalayn' | 'ar.muyassar';
}

const TAFSIR_BOOKS: TafsirBook[] = [
  {
    id: 'ibn-kathir',
    title: 'تفسير ابن كثير',
    author: 'الإمام ابن كثير',
    description: 'تفسير القرآن العظيم، من أشهر التفاسير بالمأثور، يتميز بذكر الآية وتفسيرها وإيراد الأحاديث وأقوال الصحابة.',
    coverColor: 'bg-emerald-700',
    textColor: 'text-emerald-50',
    slug: 'ar.ibn-kathir'
  },
  {
    id: 'al-jalalayn',
    title: 'تفسير الجلالين',
    author: 'جلال الدين المحلي والسيوطي',
    description: 'تفسير موجز ومحرر، من واسع الانتشار لسهولة عبارته ووضوحه.',
    coverColor: 'bg-amber-700',
    textColor: 'text-amber-50',
    slug: 'ar.jalalayn'
  },
  {
    id: 'al-muyassar',
    title: 'التفسير الميسر',
    author: 'نخبة من العلماء',
    description: 'تفسير معاصر بأسلوب سهل ومباشر، أصدره مجمع الملك فهد لطباعة المصحف الشريف.',
    coverColor: 'bg-slate-700',
    textColor: 'text-slate-50',
    slug: 'ar.muyassar'
  }
];

export const TafsirLibrary: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col h-screen bg-gradient-to-b from-gold-50 via-white to-gold-50/30 dark:from-navy-950 dark:via-navy-900 dark:to-navy-950 overflow-hidden">
      <TopBar
        title="مكتبة التفسير"
        showBack={true}
        onBack={() => navigate('/')}
      />

      <div className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 pb-24">

        {/* Hero Header Section */}
        <div className="max-w-4xl mx-auto mb-8 text-center">
          <div className="inline-flex items-center gap-3 bg-white/80 dark:bg-navy-900/80 backdrop-blur-sm px-6 py-3 rounded-2xl border border-gold-200/50 dark:border-navy-700 shadow-sm mb-4">
            <div className="w-10 h-10 bg-gradient-to-br from-gold-500 to-amber-500 rounded-xl flex items-center justify-center text-white shadow-lg shadow-gold-500/20">
              <Library size={20} />
            </div>
            <div className="text-right">
              <h1 className="font-quran font-bold text-xl md:text-2xl text-navy-900 dark:text-white">مكتبة التفسير</h1>
              <p className="text-[10px] text-gold-600 dark:text-gold-400 font-bold">التفاسير المعتمدة للقرآن الكريم</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 md:gap-8 max-w-7xl mx-auto">
            {TAFSIR_BOOKS.map((book) => (
              <div
                key={book.id}
                onClick={() => navigate(`/tafsir/${book.slug}`)}
                className="group relative cursor-pointer flex flex-col h-full bg-white/90 dark:bg-navy-900/90 backdrop-blur-sm rounded-3xl border border-gold-100/50 dark:border-navy-700 hover:border-gold-400/80 dark:hover:border-gold-600/50 shadow-lg shadow-navy-900/5 dark:shadow-navy-950/30 hover:shadow-2xl hover:shadow-gold-500/10 dark:hover:shadow-gold-900/20 transition-all duration-500 overflow-hidden hover:-translate-y-2"
              >
                {/* Header / Cover Area */}
                <div className={`h-36 md:h-40 ${book.coverColor} relative overflow-hidden flex items-center justify-center p-6`}>
                  <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/arabesque.png')] opacity-10"></div>
                  <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-white/5"></div>
                  <div className="absolute top-4 right-4 w-8 h-8 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center">
                    <Star size={14} className="text-white/80" />
                  </div>
                  <Book size={52} className="text-white/95 drop-shadow-xl transform group-hover:scale-115 group-hover:rotate-3 transition-all duration-500" />
                </div>

                {/* Content */}
                <div className="p-5 md:p-6 flex flex-col flex-1 text-center">
                  <h3 className="font-quran font-bold text-xl md:text-2xl text-navy-900 dark:text-white mb-3 group-hover:text-gold-700 dark:group-hover:text-gold-400 transition-colors">{book.title}</h3>
                  <p className="text-xs font-bold text-gold-600 dark:text-gold-400 mb-4 bg-gradient-to-r from-gold-50 to-amber-50 dark:from-gold-900/30 dark:to-amber-900/20 py-1.5 px-4 rounded-full self-center border border-gold-100/50 dark:border-gold-700/30 shadow-sm">
                    {book.author}
                  </p>
                  <p className="text-sm text-navy-500 dark:text-navy-300 leading-relaxed mb-6 line-clamp-3 px-2">
                    {book.description}
                  </p>

                  <div className="mt-auto w-full pt-4 border-t border-gold-100/50 dark:border-navy-700">
                    <span className="text-navy-400 dark:text-navy-400 text-xs font-bold group-hover:text-gold-600 dark:group-hover:text-gold-400 transition-colors flex items-center justify-center gap-2">
                      <span className="px-3 py-1.5 bg-gold-50/80 dark:bg-gold-900/20 rounded-lg group-hover:bg-gold-100 dark:group-hover:bg-gold-900/40 transition-colors">
                        تصفح الكتاب
                      </span>
                      <ArrowRight size={16} className="transform group-hover:-translate-x-2 transition-transform duration-300" />
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
      </div>
    </div>
  );
};
