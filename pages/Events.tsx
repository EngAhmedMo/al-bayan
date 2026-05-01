import React, { useState, useEffect } from 'react';
import { TopBar } from '../components/TopBar';
import { EVENTS_DATA, TITLE_MAP, MONTH_MAP, getHijriDate, getNextEvent, getDaysRemaining } from '../services/eventsData';
import { IslamicEvent } from '../types';
import { Calendar, Bell, ChevronLeft, BookOpen, Quote, Star, ArrowLeft, Clock, Sparkles, Timer } from 'lucide-react';
import { toArabicDigits } from '../services/normalization';
import { HijriCalendarGrid } from '../components/HijriCalendarGrid';

export const Events: React.FC = () => {
  const [hijriDate, setHijriDate] = useState({ day: 1, month: 1, year: 1445 });
  const [nextEvent, setNextEvent] = useState<IslamicEvent | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<IslamicEvent | null>(null);
  const [daysRemaining, setDaysRemaining] = useState<number | null>(null);
  const [viewMode, setViewMode] = useState<'timeline' | 'calendar'>('timeline');

  useEffect(() => {
    const today = getHijriDate();
    setHijriDate(today);

    const next = getNextEvent();
    setNextEvent(next);

    // Simple day difference calculation assuming 30 days per month for estimation
    // This is a heuristic, real moon sighting varies.
    if (next) {
      let currentTotal = today.month * 30 + today.day;
      let eventTotal = next.month * 30 + next.day[0];

      // If event is next year
      if (eventTotal < currentTotal) {
        eventTotal += 354; // Approx days in lunar year
      }

      setDaysRemaining(eventTotal - currentTotal);
    }

  }, []);

  // Handle back button for modal
  useEffect(() => {
    const handlePopState = () => {
      if (selectedEvent) {
        setSelectedEvent(null);
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [selectedEvent]);

  // Push history state when modal opens
  const openEventDetail = (event: IslamicEvent) => {
    window.history.pushState({ modal: 'event-detail' }, '');
    setSelectedEvent(event);
  };

  // Close modal and go back in history
  const closeEventDetail = () => {
    setSelectedEvent(null);
    if (window.history.state?.modal === 'event-detail') {
      window.history.back();
    }
  };

  const isToday = (event: IslamicEvent) => {
    return event.month === hijriDate.month && event.day.includes(hijriDate.day);
  };

  return (
    <div className="flex flex-col h-full bg-gradient-to-b from-gold-50 via-white to-gold-50/50 dark:from-navy-950 dark:via-navy-900 dark:to-navy-950 font-sans relative overflow-hidden">
      {/* Background Decorative Elements */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 right-0 w-96 h-96 bg-gold-400/10 dark:bg-gold-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3"></div>
        <div className="absolute bottom-1/3 left-0 w-72 h-72 bg-amber-400/10 dark:bg-amber-500/5 rounded-full blur-3xl -translate-x-1/2"></div>
      </div>

      <TopBar title="المناسبات الإسلامية" />

      <div className="flex-1 overflow-y-auto p-4 md:p-8 pb-48 space-y-6 custom-scrollbar relative z-10">
        <div className="max-w-4xl mx-auto space-y-6">

          {/* Today's Date Hero Card - Enhanced */}
          <div className="bg-gradient-to-br from-navy-800 via-navy-900 to-navy-950 rounded-3xl p-6 sm:p-8 md:p-10 text-white shadow-2xl shadow-navy-950/50 relative overflow-hidden border border-white/5">
            {/* Islamic Pattern Overlay */}
            <div className="absolute inset-0 opacity-5 bg-[url('https://www.transparenttextures.com/patterns/arabesque.png')]"></div>

            {/* Decorative Glow */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-gold-500/15 rounded-full -mr-16 -mt-16 blur-3xl"></div>
            <div className="absolute bottom-0 left-0 w-48 h-48 bg-emerald-500/10 rounded-full -ml-12 -mb-12 blur-3xl"></div>

            <div className="relative z-10 flex flex-col items-center justify-center text-center space-y-3">
              {/* Label */}
              <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-md px-4 py-1.5 rounded-full border border-white/10">
                <Calendar size={14} className="text-gold-400" />
                <span className="text-xs font-bold text-gold-300 uppercase tracking-widest">التاريخ الهجري اليوم</span>
              </div>

              {/* Main Date */}
              <div className="text-5xl sm:text-6xl md:text-7xl font-bold font-sans tracking-tight text-white drop-shadow-lg">
                {toArabicDigits(hijriDate.day)} <span className="text-gold-400 font-quran">{MONTH_MAP[hijriDate.month]}</span>
              </div>

              {/* Year */}
              <div className="text-xl sm:text-2xl text-navy-300 font-medium bg-white/5 px-6 py-2 rounded-full backdrop-blur-sm">
                {toArabicDigits(hijriDate.year)} هـ
              </div>
            </div>
          </div>

          {/* Next Event Card with Countdown - Enhanced */}
          {nextEvent && (
            <div className="bg-white/95 dark:bg-navy-800/95 backdrop-blur-xl p-5 sm:p-6 rounded-3xl border border-gold-200/50 dark:border-navy-700 shadow-xl shadow-gold-500/5 dark:shadow-navy-950/50 relative overflow-hidden">
              {/* Accent Border */}
              <div className="absolute top-0 left-0 w-1.5 h-full bg-gradient-to-b from-gold-400 to-amber-500 rounded-full"></div>

              <div className="flex flex-col sm:flex-row items-center sm:items-start justify-between gap-5 pr-2">
                {/* Event Info */}
                <div className="text-center sm:text-right flex-1">
                  <div className="inline-flex items-center gap-2 bg-gradient-to-r from-gold-100 to-amber-100 dark:from-gold-900/30 dark:to-amber-900/20 px-4 py-1.5 rounded-full mb-3">
                    <Star size={14} className="text-gold-600 dark:text-gold-400" fill="currentColor" />
                    <span className="text-xs font-bold text-gold-700 dark:text-gold-400 uppercase tracking-wider">المناسبة القادمة</span>
                  </div>
                  <h3 className="text-xl sm:text-2xl font-bold text-navy-900 dark:text-white mb-2">
                    {TITLE_MAP[nextEvent.title]}
                  </h3>
                  <p className="text-navy-500 dark:text-navy-400 text-sm font-medium flex items-center gap-2 justify-center sm:justify-start">
                    <Clock size={14} />
                    الموعد: {toArabicDigits(nextEvent.day[0])} {MONTH_MAP[nextEvent.month]}
                  </p>
                </div>

                {/* Countdown Circle */}
                <div className="flex-shrink-0 relative">
                  {isToday(nextEvent) ? (
                    <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 flex flex-col items-center justify-center text-white shadow-2xl shadow-emerald-500/40 animate-pulse">
                      <Sparkles size={20} className="mb-1" />
                      <span className="text-lg font-bold">اليوم!</span>
                    </div>
                  ) : (
                    <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-full border-4 border-gold-200/50 dark:border-navy-600 flex flex-col items-center justify-center relative bg-white dark:bg-navy-700 shadow-xl">
                      <span className="text-3xl sm:text-4xl font-black text-navy-900 dark:text-white font-sans">
                        {daysRemaining !== null ? toArabicDigits(daysRemaining) : '-'}
                      </span>
                      <span className="text-[10px] font-bold text-navy-400 dark:text-navy-400 uppercase tracking-widest mt-1">يوم متبقي</span>

                      {/* Progress Ring */}
                      <svg className="absolute inset-0 w-full h-full -rotate-90 pointer-events-none">
                        <circle cx="50%" cy="50%" r="45%" fill="none" stroke="url(#countdownGradient)" strokeWidth="4" strokeLinecap="round" strokeDasharray="100 100" />
                        <defs>
                          <linearGradient id="countdownGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                            <stop offset="0%" stopColor="#f59e0b" />
                            <stop offset="100%" stopColor="#d97706" />
                          </linearGradient>
                        </defs>
                      </svg>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Events Timeline List - Enhanced */}
          <div>
            {/* Section Header & Tabs */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-5 px-1 gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-gold-400 to-amber-500 flex items-center justify-center shadow-lg shadow-gold-500/20">
                  <Calendar size={18} className="text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-navy-900 dark:text-white">التقويم الإسلامي</h3>
                  <p className="text-xs text-navy-500 dark:text-navy-400">{EVENTS_DATA.length} مناسبة مسجلة</p>
                </div>
              </div>

              {/* View Switcher */}
              <div className="flex bg-white dark:bg-navy-800 p-1 rounded-xl border border-gold-100 dark:border-navy-700 shadow-sm self-stretch sm:self-auto">
                <button
                  onClick={() => setViewMode('timeline')}
                  className={`flex-1 sm:flex-none px-4 py-2 rounded-lg text-xs font-bold transition-all ${viewMode === 'timeline'
                    ? 'bg-navy-900 dark:bg-gold-500 text-white shadow-md'
                    : 'text-navy-500 dark:text-navy-400 hover:bg-gold-50 dark:hover:bg-navy-700'
                    }`}
                >
                  الجدول الزمني
                </button>
                <button
                  onClick={() => setViewMode('calendar')}
                  className={`flex-1 sm:flex-none px-4 py-2 rounded-lg text-xs font-bold transition-all ${viewMode === 'calendar'
                    ? 'bg-navy-900 dark:bg-gold-500 text-white shadow-md'
                    : 'text-navy-500 dark:text-navy-400 hover:bg-gold-50 dark:hover:bg-navy-700'
                    }`}
                >
                  التقويم الشهري
                </button>
              </div>
            </div>

            {/* Content Area */}
            {viewMode === 'timeline' ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                {EVENTS_DATA.sort((a, b) => (a.month * 30 + a.day[0]) - (b.month * 30 + b.day[0])).map((event) => {
                  const active = isToday(event);
                  const daysLeft = getDaysRemaining(event);
                  return (
                    <button
                      key={event.id}
                      onClick={() => openEventDetail(event)}
                      className={`relative p-4 sm:p-5 rounded-2xl border transition-all duration-300 text-right group hover:shadow-xl hover:-translate-y-1 overflow-hidden ${active
                        ? 'bg-gradient-to-br from-navy-800 to-navy-900 text-white border-navy-700 shadow-lg'
                        : 'bg-white/90 dark:bg-navy-800/90 backdrop-blur-xl border-gold-100 dark:border-navy-700 hover:border-gold-400 dark:hover:border-gold-500/50'
                        }`}
                    >
                      {/* Active Glow */}
                      {active && (
                        <div className="absolute inset-0 bg-gradient-to-r from-gold-500/10 to-transparent pointer-events-none"></div>
                      )}

                      <div className="flex items-center gap-4 relative z-10">
                        {/* Date Badge */}
                        <div className={`w-16 h-16 sm:w-18 sm:h-18 flex flex-col items-center justify-center rounded-2xl shrink-0 transition-all shadow-lg ${active
                          ? 'bg-gradient-to-br from-gold-400 to-amber-500 text-navy-900 shadow-gold-500/30'
                          : 'bg-gradient-to-br from-navy-50 to-navy-100 dark:from-navy-700 dark:to-navy-800 group-hover:from-gold-50 group-hover:to-amber-50 dark:group-hover:from-gold-900/20 dark:group-hover:to-amber-900/10'
                          }`}>
                          <span className={`text-2xl sm:text-3xl font-black font-sans leading-none mb-0.5 ${active ? 'text-navy-900' : 'text-navy-700 dark:text-white group-hover:text-gold-700 dark:group-hover:text-gold-400'}`}>
                            {toArabicDigits(event.day[0])}
                          </span>
                          <span className={`text-[9px] sm:text-[10px] font-bold truncate w-full text-center px-1 ${active ? 'text-navy-800/80' : 'text-gold-600 dark:text-gold-500'}`}>
                            {MONTH_MAP[event.month]}
                          </span>
                        </div>

                        {/* Event Info */}
                        <div className="flex-1 min-w-0">
                          <h4 className={`font-bold text-sm sm:text-base truncate mb-1.5 ${active ? 'text-white' : 'text-navy-800 dark:text-white'}`}>
                            {TITLE_MAP[event.title]}
                          </h4>
                          <div className="flex items-center gap-2 flex-wrap">
                            {event.isReminder && (
                              <span className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full w-fit font-bold ${active
                                ? 'bg-white/15 text-gold-300 border border-gold-400/30'
                                : 'bg-gradient-to-r from-gold-50 to-amber-50 dark:from-gold-900/30 dark:to-amber-900/20 text-gold-700 dark:text-gold-400 border border-gold-200/50 dark:border-gold-700/50'}`}
                              >
                                <Bell size={9} />
                                تذكير
                              </span>
                            )}
                            {/* Countdown Badge */}
                            {!active && daysLeft > 0 && (
                              <span className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-bold ${daysLeft <= 7
                                ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 border border-emerald-200/50 dark:border-emerald-700/50'
                                : 'bg-navy-50 dark:bg-navy-700 text-navy-500 dark:text-navy-300 border border-navy-200/50 dark:border-navy-600'}`}
                              >
                                <Timer size={9} />
                                {daysLeft <= 7 ? (
                                  <span>{toArabicDigits(daysLeft)} {daysLeft === 1 ? 'يوم' : 'أيام'}</span>
                                ) : (
                                  <span>بعد {toArabicDigits(daysLeft)} يوم</span>
                                )}
                              </span>
                            )}
                            {active && (
                              <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                                <Sparkles size={9} />
                                اليوم!
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Arrow */}
                        <ChevronLeft size={20} className={`${active ? 'text-white/60' : 'text-navy-300 dark:text-navy-500 group-hover:text-gold-500 dark:group-hover:text-gold-400'} transition-colors shrink-0`} />
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                <HijriCalendarGrid events={EVENTS_DATA} onEventClick={openEventDetail} />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Detail Modal - Enhanced */}
      {selectedEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-navy-950/80 backdrop-blur-md" onClick={closeEventDetail}></div>
          <div className="relative w-full max-w-lg bg-white dark:bg-navy-900 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 border border-gold-200/50 dark:border-navy-700">

            {/* Header */}
            <div className="p-5 sm:p-6 bg-gradient-to-br from-navy-50 to-white dark:from-navy-800 dark:to-navy-900 border-b border-gold-100 dark:border-navy-700 flex items-center gap-4">
              <button
                onClick={closeEventDetail}
                className="p-2.5 rounded-xl bg-white dark:bg-navy-800 border border-gold-200 dark:border-navy-700 hover:bg-gold-50 dark:hover:bg-navy-700 text-navy-500 dark:text-navy-400 transition-all shadow-sm hover:shadow-md"
              >
                <ArrowLeft size={18} />
              </button>
              <div className="flex-1">
                <h2 className="text-lg sm:text-xl font-bold text-navy-900 dark:text-white">
                  {TITLE_MAP[selectedEvent.title]}
                </h2>
                <p className="text-xs text-gold-600 dark:text-gold-400 mt-0.5 font-bold flex items-center gap-1.5">
                  <Calendar size={12} />
                  {selectedEvent.day.map(d => toArabicDigits(d)).join(' - ')} {MONTH_MAP[selectedEvent.month]}
                </p>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4 custom-scrollbar bg-gradient-to-b from-white to-gold-50/30 dark:from-navy-900 dark:to-navy-950">
              {selectedEvent.hadith.map((h, idx) => (
                <div key={idx} className="bg-white dark:bg-navy-800 p-5 sm:p-6 rounded-2xl border border-gold-100 dark:border-navy-700 shadow-lg shadow-gold-500/5 dark:shadow-navy-950/50">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-gold-400 to-amber-500 flex items-center justify-center mb-4 shadow-lg shadow-gold-500/20">
                    <Quote size={18} className="text-white rotate-180" />
                  </div>
                  <p className="font-quran text-lg sm:text-xl leading-loose text-justify text-navy-800 dark:text-white mb-5">
                    {h.hadith}
                  </p>
                  <div className="flex items-start gap-2 pt-4 border-t border-gold-100 dark:border-navy-700">
                    <BookOpen size={14} className="text-gold-500 mt-0.5 shrink-0" />
                    <p className="text-xs text-navy-500 dark:text-navy-400 leading-relaxed font-medium">
                      {h.bookInfo}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

