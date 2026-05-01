
import React, { useState, useEffect } from 'react';
import { TopBar } from '../components/TopBar';
import { getPageBookmarks, getAyahBookmarks, removePageBookmark, deleteAyahBookmark, getNotes, deleteNote, getHadithBookmarks, deleteHadithBookmark } from '../services/storage';
import { PageBookmark, AyahBookmark, Note, HadithBookmark } from '../types';
import { Bookmark, FileText, Trash2, ArrowUpLeft, FileEdit, Clock, ChevronRight, Inbox, StickyNote, AlertTriangle, BookOpen } from 'lucide-react';
import { toArabicDigits } from '../services/normalization';
import { useNavigate } from 'react-router-dom';
import { ConfirmDialog } from '../components/ConfirmDialog';

export const Bookmarks: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'pages' | 'ayahs' | 'notes' | 'hadiths'>('pages');
  const [pages, setPages] = useState<PageBookmark[]>([]);
  const [ayahs, setAyahs] = useState<AyahBookmark[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [hadiths, setHadiths] = useState<HadithBookmark[]>([]);
  const navigate = useNavigate();

  // Dialog State
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<{ type: 'page' | 'ayah' | 'note' | 'hadith', id: string | number } | null>(null);

  const refreshData = () => {
    setPages(getPageBookmarks());
    setAyahs(getAyahBookmarks());
    setNotes(getNotes());
    setHadiths(getHadithBookmarks());
  };

  useEffect(() => {
    refreshData();
  }, []);

  const confirmDelete = (type: 'page' | 'ayah' | 'note' | 'hadith', id: string | number) => {
    setItemToDelete({ type, id });
    setIsDialogOpen(true);
  };

  const executeDelete = () => {
    if (!itemToDelete) return;

    if (itemToDelete.type === 'page') {
      removePageBookmark(itemToDelete.id as number);
    } else if (itemToDelete.type === 'ayah') {
      deleteAyahBookmark(itemToDelete.id as string);
    } else if (itemToDelete.type === 'note') {
      deleteNote(itemToDelete.id as string);
    } else if (itemToDelete.type === 'hadith') {
      deleteHadithBookmark(itemToDelete.id as string);
    }

    refreshData();
    setIsDialogOpen(false);
    setItemToDelete(null);
  };

  const currentCount = activeTab === 'pages' ? pages.length : activeTab === 'ayahs' ? ayahs.length : activeTab === 'notes' ? notes.length : hadiths.length;

  return (
    <div className="flex flex-col h-full bg-gradient-to-b from-gold-50 via-white to-gold-50/50 dark:from-navy-950 dark:via-navy-900 dark:to-navy-950 font-sans relative overflow-hidden">
      {/* Background Decorative Elements */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 right-0 w-80 h-80 bg-gold-400/10 dark:bg-gold-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3"></div>
        <div className="absolute bottom-1/4 left-0 w-64 h-64 bg-amber-400/10 dark:bg-amber-500/5 rounded-full blur-3xl -translate-x-1/2"></div>
      </div>

      <TopBar title="المحفوظات والملاحظات" />

      {/* Premium Segmented Control - Enhanced */}
      <div className="px-4 pt-4 relative z-10">
        <div className="max-w-md mx-auto bg-white/95 dark:bg-navy-800/95 backdrop-blur-xl p-1.5 sm:p-2 rounded-2xl border border-gold-200/50 dark:border-navy-700 shadow-xl shadow-gold-500/5 dark:shadow-navy-950/50 flex">
          {[
            { id: 'pages', label: 'الفواصل', icon: <Bookmark size={16} /> },
            { id: 'ayahs', label: 'الآيات', icon: <FileText size={16} /> },
            { id: 'notes', label: 'الملاحظات', icon: <FileEdit size={16} /> },
            { id: 'hadiths', label: 'الأحاديث', icon: <BookOpen size={16} /> },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex-1 py-3 text-xs font-bold rounded-xl transition-all duration-300 flex items-center justify-center gap-2 ${activeTab === tab.id
                ? 'bg-gradient-to-br from-navy-700 to-navy-900 dark:from-gold-500 dark:to-amber-600 text-white shadow-lg shadow-navy-500/30 dark:shadow-gold-500/30'
                : 'text-navy-500 hover:bg-navy-50 dark:hover:bg-navy-700 dark:text-navy-400'
                }`}
            >
              {tab.icon}
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Count Badge */}
      {currentCount > 0 && (
        <div className="flex justify-center mt-4 relative z-10">
          <span className="text-xs font-bold text-navy-500 dark:text-navy-400 bg-white/80 dark:bg-navy-800/80 backdrop-blur-sm px-4 py-1.5 rounded-full border border-gold-200/50 dark:border-navy-700">
            {toArabicDigits(currentCount)} {activeTab === 'pages' ? 'فاصل' : activeTab === 'ayahs' ? 'آية' : activeTab === 'notes' ? 'ملاحظة' : 'حديث'}
          </span>
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-4 md:p-8 pb-24 custom-scrollbar relative z-10">
        <div className="max-w-3xl mx-auto space-y-3 sm:space-y-4">

          {/* --- Pages Tab --- */}
          {activeTab === 'pages' && (
            pages.length > 0 ? (
              pages.map((item) => (
                <div key={item.id} className="bg-white/95 dark:bg-navy-800/95 backdrop-blur-xl p-4 sm:p-5 rounded-2xl border border-gold-100 dark:border-navy-700 shadow-lg shadow-gold-500/5 dark:shadow-navy-950/50 flex items-center justify-between group hover:shadow-xl hover:-translate-y-0.5 transition-all duration-300 animate-in fade-in slide-in-from-bottom-2">
                  <div className="flex items-center gap-4 cursor-pointer flex-1" onClick={() => navigate(`/reader?page=${item.pageNumber}`)}>
                    <div className="w-14 h-14 bg-gradient-to-br from-gold-400 to-amber-500 text-white rounded-2xl flex flex-col items-center justify-center shadow-lg shadow-gold-500/30">
                      <span className="text-[10px] font-bold opacity-80">ص</span>
                      <span className="text-xl font-black leading-none font-sans">{toArabicDigits(item.pageNumber)}</span>
                    </div>
                    <div>
                      <h3 className="font-bold text-navy-900 dark:text-white text-base sm:text-lg">{item.surahName}</h3>
                      <p className="text-xs text-navy-400 dark:text-navy-500 mt-1 flex items-center gap-1.5">
                        <Clock size={10} />
                        {new Date(item.timestamp).toLocaleDateString('ar-EG')}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => confirmDelete('page', item.pageNumber)}
                      className="p-2.5 text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-all hover:scale-105"
                      title="حذف"
                    >
                      <Trash2 size={18} />
                    </button>
                    <button
                      onClick={() => navigate(`/reader?page=${item.pageNumber}`)}
                      className="p-2.5 bg-gradient-to-br from-navy-100 to-navy-200 dark:from-navy-700 dark:to-navy-800 text-navy-600 dark:text-navy-300 rounded-xl hover:from-gold-400 hover:to-amber-500 hover:text-white transition-all shadow-sm hover:shadow-md hover:scale-105"
                      title="انتقال"
                    >
                      <ChevronRight size={18} className="rotate-180" />
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <EmptyState icon={<Bookmark size={48} />} text="لا توجد فواصل صفحات محفوظة" subtext="يمكنك إضافة فاصل أثناء القراءة للعودة لاحقاً" />
            )
          )}

          {/* --- Ayahs Tab --- */}
          {activeTab === 'ayahs' && (
            ayahs.length > 0 ? (
              ayahs.map((item) => (
                <div key={item.id} className="bg-white/95 dark:bg-navy-800/95 backdrop-blur-xl p-4 sm:p-5 rounded-2xl border border-gold-100 dark:border-navy-700 shadow-lg shadow-gold-500/5 dark:shadow-navy-950/50 flex items-center justify-between group hover:shadow-xl hover:-translate-y-0.5 transition-all duration-300 animate-in fade-in slide-in-from-bottom-2">
                  <div className="flex items-center gap-4 cursor-pointer flex-1" onClick={() => navigate(`/reader?page=${item.pageNumber}&highlight=${item.surahNumber}:${item.ayahNumber}`)}>
                    <div className="w-14 h-14 bg-gradient-to-br from-emerald-400 to-emerald-600 text-white rounded-2xl flex flex-col items-center justify-center shadow-lg shadow-emerald-500/30">
                      <span className="text-[10px] font-bold opacity-80">آية</span>
                      <span className="text-xl font-black leading-none font-sans">{toArabicDigits(item.ayahNumber)}</span>
                    </div>
                    <div>
                      <h3 className="font-bold text-navy-900 dark:text-white text-base sm:text-lg">{item.surahName}</h3>
                      <p className="text-xs text-navy-400 dark:text-navy-500 mt-1">صفحة {toArabicDigits(item.pageNumber)}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => confirmDelete('ayah', item.id)}
                      className="p-2.5 text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-all hover:scale-105"
                      title="حذف"
                    >
                      <Trash2 size={18} />
                    </button>
                    <button
                      onClick={() => navigate(`/reader?page=${item.pageNumber}&highlight=${item.surahNumber}:${item.ayahNumber}`)}
                      className="p-2.5 bg-gradient-to-br from-navy-100 to-navy-200 dark:from-navy-700 dark:to-navy-800 text-navy-600 dark:text-navy-300 rounded-xl hover:from-emerald-400 hover:to-emerald-600 hover:text-white transition-all shadow-sm hover:shadow-md hover:scale-105"
                      title="انتقال"
                    >
                      <ArrowUpLeft size={18} />
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <EmptyState icon={<Inbox size={48} />} text="لا توجد آيات محفوظة" subtext="اضغط على أي آية أثناء القراءة لحفظها" />
            )
          )}

          {/* --- Notes Tab --- */}
          {activeTab === 'notes' && (
            notes.length > 0 ? (
              notes.map((item) => (
                <div key={item.id} className="bg-white/95 dark:bg-navy-800/95 backdrop-blur-xl p-5 sm:p-6 rounded-2xl border border-gold-100 dark:border-navy-700 shadow-lg shadow-gold-500/5 dark:shadow-navy-950/50 hover:shadow-xl hover:-translate-y-0.5 transition-all duration-300 group animate-in fade-in slide-in-from-bottom-2">
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-bold text-gold-700 bg-gradient-to-r from-gold-50 to-amber-50 dark:from-gold-900/30 dark:to-amber-900/20 dark:text-gold-400 px-3 py-1.5 rounded-lg border border-gold-200/50 dark:border-gold-700/50">
                        {item.surahName} : {toArabicDigits(item.ayahNumber)}
                      </span>
                      <span className="text-[10px] text-navy-400 dark:text-navy-500 flex items-center gap-1">
                        <Clock size={10} /> {new Date(item.timestamp).toLocaleDateString('ar-EG')}
                      </span>
                    </div>
                    <div className="flex gap-1">
                      <button
                        onClick={() => navigate(`/reader?page=${item.pageNumber}&highlight=${item.surahNumber}:${item.ayahNumber}`)}
                        className="p-2 text-navy-400 hover:text-gold-500 hover:bg-gold-50 dark:hover:bg-gold-900/20 rounded-lg transition-all hover:scale-105"
                        title="انتقال للآية"
                      >
                        <ArrowUpLeft size={16} />
                      </button>
                      <button
                        onClick={() => confirmDelete('note', item.id)}
                        className="p-2 text-navy-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all hover:scale-105"
                        title="حذف"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>

                  <p className="text-navy-800 dark:text-navy-100 text-sm leading-relaxed whitespace-pre-wrap bg-gradient-to-br from-navy-50 to-stone-50 dark:from-navy-900 dark:to-navy-950 p-4 rounded-xl border border-navy-100 dark:border-navy-700">
                    {item.text}
                  </p>
                </div>
              ))
            ) : (
              <EmptyState icon={<StickyNote size={48} />} text="لا توجد ملاحظات مدونة" subtext="دون خواطرك وتدبراتك على الآيات بسهولة" />
            )
          )}

          {/* --- Hadiths Tab --- */}
          {activeTab === 'hadiths' && (
            hadiths.length > 0 ? (
              hadiths.map((item) => (
                <div key={item.id} className="bg-white/95 dark:bg-navy-800/95 backdrop-blur-xl p-5 sm:p-6 rounded-2xl border border-gold-100 dark:border-navy-700 shadow-lg shadow-gold-500/5 dark:shadow-navy-950/50 hover:shadow-xl hover:-translate-y-0.5 transition-all duration-300 group animate-in fade-in slide-in-from-bottom-2">
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-bold text-gold-700 bg-gradient-to-r from-gold-50 to-amber-50 dark:from-gold-900/30 dark:to-amber-900/20 dark:text-gold-400 px-3 py-1.5 rounded-lg border border-gold-200/50 dark:border-gold-700/50">
                        {item.bookName} {item.chapterName ? `- ${item.chapterName}` : ''}
                      </span>
                      <span className="text-[10px] text-navy-400 dark:text-navy-500 flex items-center gap-1">
                        <Clock size={10} /> {new Date(item.timestamp).toLocaleDateString('ar-EG')}
                      </span>
                    </div>
                    <div className="flex gap-1">
                      <button
                        onClick={() => navigate(`/hadith?book=${item.bookId}&hadith=${item.hadithId}`)}
                        className="p-2 text-navy-400 hover:text-gold-500 hover:bg-gold-50 dark:hover:bg-gold-900/20 rounded-lg transition-all hover:scale-105"
                        title="انتقال للحديث"
                      >
                        <ArrowUpLeft size={16} />
                      </button>
                      <button
                        onClick={() => confirmDelete('hadith', item.id)}
                        className="p-2 text-navy-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all hover:scale-105"
                        title="حذف"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>

                  <p className="text-navy-800 dark:text-navy-100 text-sm leading-[2.2] font-quran bg-gradient-to-br from-navy-50 to-stone-50 dark:from-navy-900 dark:to-navy-950 p-4 rounded-xl border border-navy-100 dark:border-navy-700" dir="rtl">
                    {item.textSnippet}
                  </p>
                </div>
              ))
            ) : (
              <EmptyState icon={<BookOpen size={48} />} text="لا توجد أحاديث محفوظة" subtext="يمكنك حفظ الأحاديث التي تود العودة إليها لاحقاً" />
            )
          )}
        </div>
      </div>

      <ConfirmDialog
        isOpen={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
        onConfirm={executeDelete}
        title="تأكيد الحذف"
        message={
          itemToDelete?.type === 'page' ? "هل أنت متأكد من حذف هذا الفاصل؟" :
            itemToDelete?.type === 'ayah' ? "هل أنت متأكد من حذف هذه الآية من المفضلة؟" :
              itemToDelete?.type === 'hadith' ? "هل أنت متأكد من حذف هذا الحديث من المفضلة؟" :
                "هل أنت متأكد من حذف هذه الملاحظة؟"
        }
        confirmText="نعم، حذف"
        variant="danger"
        icon={<AlertTriangle size={32} />}
      />

    </div>
  );
};

const EmptyState = ({ icon, text, subtext }: { icon: React.ReactNode, text: string, subtext?: string }) => (
  <div className="flex flex-col items-center justify-center py-20 sm:py-24 text-center animate-in fade-in zoom-in-95">
    <div className="mb-5 w-20 h-20 bg-gradient-to-br from-gold-100 to-amber-100 dark:from-navy-800 dark:to-navy-900 rounded-2xl flex items-center justify-center shadow-lg shadow-gold-500/10 dark:shadow-navy-950/50 text-gold-500 dark:text-gold-400">
      {icon}
    </div>
    <p className="font-bold text-base text-navy-700 dark:text-navy-300 mb-2">{text}</p>
    {subtext && <p className="text-xs text-navy-400 dark:text-navy-500 max-w-xs leading-relaxed">{subtext}</p>}
  </div>
);

