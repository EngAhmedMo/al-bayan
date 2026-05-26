
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { TopBar } from '../components/TopBar';
import { getNotifications, markNotificationsRead, clearNotifications } from '../services/storage';
import { AppNotification } from '../types';
import { Bell, Calendar, Info, Trash2, CheckCircle2, Clock, Settings2 } from 'lucide-react';
import { toArabicDigits } from '../services/normalization';

export const Notifications: React.FC = () => {
  const [list, setList] = useState<AppNotification[]>([]);
  const [isClearModalOpen, setIsClearModalOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    setList(getNotifications());
    // Mark as read after a short delay so user sees "new" status briefly
    const timer = setTimeout(() => {
      markNotificationsRead();
    }, 2000);
    return () => clearTimeout(timer);
  }, []);

  const handleClear = () => {
    setIsClearModalOpen(true);
  };

  const confirmClear = () => {
    clearNotifications();
    setList([]);
    setIsClearModalOpen(false);
  };

  const getIconData = (type: AppNotification['type']) => {
    switch (type) {
      case 'event': return { icon: <Calendar size={20} />, bg: 'bg-amber-100 dark:bg-amber-900/30', text: 'text-amber-600 dark:text-amber-400' };
      case 'reminder': return { icon: <CheckCircle2 size={20} />, bg: 'bg-emerald-100 dark:bg-emerald-900/30', text: 'text-emerald-600 dark:text-emerald-400' };
      default: return { icon: <Info size={20} />, bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-600 dark:text-blue-400' };
    }
  };

  const unreadCount = list.filter(n => !n.isRead).length;

  const handleMarkAllRead = () => {
    markNotificationsRead();
    setList(list.map(n => ({ ...n, isRead: true })));
  };

  return (
    <div className="flex flex-col min-h-full h-full bg-gradient-to-b from-gold-50 via-stone-50 to-stone-100 dark:from-navy-950 dark:via-navy-900 dark:to-navy-950 font-sans overflow-hidden">
      <TopBar
        title="التنبيهات والإشعارات"
        extra={
          <div className="flex items-center gap-2 md:gap-3">
            <button
              onClick={() => navigate('/notification-settings')}
              className="flex items-center gap-1.5 px-2.5 sm:px-4 py-2 md:py-2.5 bg-gradient-to-r from-gold-100 to-amber-100 dark:from-gold-900/30 dark:to-amber-900/20 text-gold-600 dark:text-gold-400 rounded-full hover:shadow-md transition-all duration-200 text-xs md:text-sm font-bold shadow-sm border border-gold-200/50 dark:border-gold-700/50"
            >
              <Settings2 size={14} />
              <span className="hidden sm:inline">الإعدادات</span>
            </button>
            {list.length > 0 && (
              <button
                onClick={handleClear}
                className="flex items-center gap-1.5 px-2.5 sm:px-4 py-2 md:py-2.5 bg-red-50 dark:bg-red-900/20 text-red-500 rounded-full hover:bg-red-100 dark:hover:bg-red-900/30 hover:shadow-md transition-all duration-200 text-xs md:text-sm font-bold border border-red-200/50 dark:border-red-800/50"
              >
                <Trash2 size={14} />
                <span className="hidden sm:inline">مسح الكل</span>
              </button>
            )}
          </div>
        }
      />

      <div className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 pb-24 custom-scrollbar">
        <div className="max-w-3xl mx-auto space-y-4 md:space-y-5">

          {/* Unread Count & Mark All Read Header */}
          {list.length > 0 && (
            <div className="flex items-center justify-between px-3 py-4 bg-white/50 dark:bg-navy-900/30 rounded-2xl backdrop-blur-sm">
              <div className="flex items-center gap-2.5">
                {unreadCount > 0 && (
                  <span className="bg-gradient-to-r from-red-500 to-red-600 text-white text-xs font-bold px-3 py-1.5 rounded-full animate-pulse shadow-sm shadow-red-500/30">
                    {toArabicDigits(unreadCount)} جديد
                  </span>
                )}
                <span className="text-sm md:text-base text-navy-500 dark:text-navy-400 font-bold">
                  {toArabicDigits(list.length)} تنبيه
                </span>
              </div>
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllRead}
                  className="flex items-center gap-1.5 text-sm font-bold text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 transition-colors bg-emerald-50 dark:bg-emerald-900/20 px-3 py-1.5 rounded-full"
                >
                  <CheckCircle2 size={16} />
                  <span>تم قراءة الكل</span>
                </button>
              )}
            </div>
          )}

          {list.length > 0 ? (
            list.map(item => {
              const { icon, bg, text } = getIconData(item.type);

              return (
                <div
                  key={item.id}
                  onClick={() => item.deepLink && navigate(item.deepLink)}
                  className={`relative p-5 md:p-6 rounded-2xl border transition-all duration-300 group ${!item.isRead
                    ? 'bg-white dark:bg-navy-900 border-gold-300 dark:border-gold-700 shadow-lg shadow-gold-500/10'
                    : 'bg-white dark:bg-navy-900/80 border-navy-100/80 dark:border-navy-800 opacity-90 hover:opacity-100 hover:shadow-md'
                    } ${item.deepLink ? 'cursor-pointer hover:scale-[1.01] active:scale-[0.99]' : ''}`}
                >
                  <div className="flex gap-4 md:gap-5">
                    <div className={`mt-1 w-12 h-12 md:w-14 md:h-14 rounded-xl flex items-center justify-center shrink-0 ${bg} ${text} shadow-sm`}>
                      {icon}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start mb-1.5">
                        <h3 className={`font-bold text-base md:text-lg ${!item.isRead ? 'text-navy-900 dark:text-white' : 'text-navy-700 dark:text-navy-200'}`}>
                          {item.title}
                        </h3>
                        {!item.isRead && (
                          <span className="w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse shadow-sm"></span>
                        )}
                      </div>

                      <p className="text-sm text-navy-600 dark:text-navy-300 leading-relaxed">
                        {item.content}
                      </p>

                      <div className="flex items-center justify-between mt-3">
                        <div className="flex items-center gap-1.5 text-[10px] font-bold text-navy-400">
                          <Clock size={12} />
                          <span>
                            {new Date(item.timestamp).toLocaleDateString('ar-EG', { weekday: 'long', day: 'numeric', month: 'long' })}
                            {' • '}
                            {new Date(item.timestamp).toLocaleTimeString('ar-EG', { hour: 'numeric', minute: '2-digit', hour12: true })}
                          </span>
                        </div>
                        {item.deepLink && (
                          <span className="text-[10px] font-bold text-gold-500 group-hover:text-gold-600">
                            اضغط للفتح ←
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="flex flex-col items-center justify-center py-20 text-center animate-in fade-in slide-in-from-bottom-4">
              <div className="w-24 h-24 bg-navy-100 dark:bg-navy-800 rounded-full flex items-center justify-center mb-6 shadow-inner">
                <Bell size={40} className="text-navy-300 dark:text-navy-500" />
              </div>
              <h3 className="text-xl font-bold text-navy-800 dark:text-white mb-2">لا توجد تنبيهات جديدة</h3>
              <p className="text-navy-500 dark:text-navy-400 max-w-xs mx-auto">
                ستظهر هنا الإشعارات الخاصة بالأذكار، المناسبات الإسلامية، وتحديثات التطبيق.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Custom Confirmation Modal */}
      {isClearModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-navy-800 rounded-3xl p-6 w-full max-w-sm shadow-2xl scale-100 animate-in zoom-in-95 duration-200 border border-gold-500/20">
            <div className="flex flex-col items-center text-center gap-4">
              <div className="w-16 h-16 rounded-full bg-red-50 dark:bg-red-900/20 flex items-center justify-center text-red-500 mb-2 shadow-inner">
                <Trash2 size={32} />
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-bold text-navy-900 dark:text-white">
                  مسح جميع الإشعارات؟
                </h3>
                <p className="text-navy-500 dark:text-navy-300 text-sm leading-relaxed px-4">
                  هل أنت متأكد من رغبتك في حذف سجل التنبيهات بالكامل؟ لن تتمكن من التراجع عن هذا الإجراء.
                </p>
              </div>
              <div className="flex gap-3 w-full mt-4">
                <button
                  onClick={() => setIsClearModalOpen(false)}
                  className="flex-1 py-3.5 rounded-2xl bg-gray-100 dark:bg-navy-700 text-navy-700 dark:text-navy-200 font-bold hover:bg-gray-200 dark:hover:bg-navy-600 transition-all active:scale-95"
                >
                  إلغاء
                </button>
                <button
                  onClick={confirmClear}
                  className="flex-1 py-3.5 rounded-2xl bg-red-500 text-white font-bold hover:bg-red-600 shadow-lg shadow-red-500/30 transition-all hover:-translate-y-0.5 hover:shadow-red-500/40 active:scale-95"
                >
                  حذف الجميع
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
