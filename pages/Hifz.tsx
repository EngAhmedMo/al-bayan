
import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useHifz } from '../contexts/HifzContext';
import { HifzDashboard } from '../components/hifz/dashboard/HifzDashboard';
import { HifzCompletionCalendar } from '../components/hifz/HifzCompletionCalendar';
import { TopBar } from '../components/TopBar';

import {
  BookOpen, Check, Target, Sparkles, Trash2, Clock, CheckCircle2, AlertTriangle, ArrowLeft, RotateCcw, FolderInput, ArrowRight, Calendar
} from 'lucide-react';
import { toArabicDigits } from '../services/normalization';
import { ArabicTimePicker } from '../components/ArabicTimePicker';
import { getApproxGlobalAyahFromPage, getApproxPageFromGlobalAyah } from '../services/quranStaticData';
import { HifzState, HifzService } from '../services/HifzService';

// --- Preset Plans for Quick Start ---
interface PresetPlan {
  id: string;
  emoji: string;
  title: string;
  description: string;
  amountPerDay: number;
  daysPerWeek: number;
  estimatedMonths: number;
  color: string;
}

const PRESET_PLANS: PresetPlan[] = [
  {
    id: 'quick',
    emoji: '⚡',
    title: 'الخطة السريعة',
    description: '~٥ أشهر للختم',
    amountPerDay: 4,
    daysPerWeek: 6,
    estimatedMonths: 5,
    color: 'from-amber-500 to-orange-500'
  },
  {
    id: 'moderate',
    emoji: '⭐',
    title: 'الخطة المعتدلة',
    description: '~١٠ أشهر للختم',
    amountPerDay: 2,
    daysPerWeek: 6,
    estimatedMonths: 10,
    color: 'from-emerald-500 to-teal-500'
  },
  {
    id: 'calm',
    emoji: '🌙',
    title: 'الخطة الهادئة',
    description: '~٢٠ شهر للختم',
    amountPerDay: 1,
    daysPerWeek: 5,
    estimatedMonths: 20,
    color: 'from-blue-500 to-indigo-500'
  },
  {
    id: 'custom',
    emoji: '✏️',
    title: 'خطة مخصصة',
    description: 'اختر إعداداتك',
    amountPerDay: 0, // Will trigger custom mode
    daysPerWeek: 6,
    estimatedMonths: 0,
    color: 'from-purple-500 to-pink-500'
  }
];

export const Hifz: React.FC = () => {
  const { state, updateState, importData } = useHifz();
  const navigate = useNavigate();

  // Mode: View (Dashboard) or Edit (Setup)
  const [isEditing, setIsEditing] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isUndoModalOpen, setIsUndoModalOpen] = useState(false);

  // Setup Form State
  const [tempType, setTempType] = useState<'pages' | 'ayahs'>('pages');
  const [tempAmount, setTempAmount] = useState<number>(2);
  const [tempSelectedDays, setTempSelectedDays] = useState<number[]>([0, 1, 2, 3, 4, 6]);
  const [tempStart, setTempStart] = useState<number>(1);
  const [tempStrictness, setTempStrictness] = useState<'easy' | 'medium' | 'strict'>('medium');
  const [tempMode, setTempMode] = useState<'classic' | 'interactive'>('interactive');

  const [selectedPreset, setSelectedPreset] = useState<string | null>('moderate');
  const [showCustomOptions, setShowCustomOptions] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [showCompletionCalendar, setShowCompletionCalendar] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync state to form when editing starts
  useEffect(() => {
    if (isEditing && state) {
      setTempType(state.planType);
      setTempAmount(state.amountPerDay);
      setTempSelectedDays(state.selectedDays || [0, 1, 2, 3, 4, 6]);
      setTempStart(state.startPoint);
      setTempStrictness(state.testStrictness || 'medium');
      setTempMode(state.preferredTestMode || 'interactive');
      setShowCustomOptions(true);
      setSelectedPreset('custom');
    }
  }, [isEditing, state]);

  // Handle Preset Selection
  const handleSelectPreset = (plan: PresetPlan) => {
    setSelectedPreset(plan.id);
    if (plan.id === 'custom') {
      setShowCustomOptions(true);
    } else {
      setShowCustomOptions(false);
      setTempAmount(plan.amountPerDay);
      // Logic for days per week: assume Sat-Thu if 6 days, Sat-Wed if 5
      const days = plan.daysPerWeek === 6 ? [0, 1, 2, 3, 4, 6] : [0, 1, 2, 3, 6];
      setTempSelectedDays(days);
    }
  };

  const handleStartPlan = () => {
    // If state is null (fresh start), use default or passed state
    // Actually useHifz provides initial state usually, but safe check
    const baseState = state || HifzService.loadState();

    let newStartPoint = tempStart;

    // --- Validation & Sanitization ---
    // 1. Clamp Start Point
    newStartPoint = Math.max(1, newStartPoint);
    if (tempType === 'pages') newStartPoint = Math.min(newStartPoint, 604);
    else newStartPoint = Math.min(newStartPoint, 6236);

    // 2. Validate Amount
    if (tempAmount < 1) {
      setTempAmount(1); // Visual feedback fix
      return; // Stop execution
    }

    // 3. Validate Days
    if (tempSelectedDays.length === 0) {
      alert('عذراً، يجب اختيار يوم واحد على الأقل للحفظ'); // Basic feedback
      return;
    }
    // ---------------------------------
    let newProgress = baseState.currentProgress || 0;

    // Migration Logic if switching types
    if (baseState.isSetup && baseState.planType !== tempType) {
      const currentTotalProgress = baseState.startPoint + baseState.currentProgress;
      if (baseState.planType === 'pages' && tempType === 'ayahs') {
        newStartPoint = getApproxGlobalAyahFromPage(currentTotalProgress);
      } else if (baseState.planType === 'ayahs' && tempType === 'pages') {
        newStartPoint = getApproxPageFromGlobalAyah(currentTotalProgress);
      }
      newProgress = 0; // Reset progress count as unit changed, but start point moved
    } else if (!baseState.isSetup) {
      // New plan
      newProgress = 0;
    }

    const newState: HifzState = {
      ...baseState,
      isSetup: true,
      planType: tempType,
      amountPerDay: tempAmount,
      daysPerWeek: tempSelectedDays.length,
      selectedDays: tempSelectedDays,
      startPoint: newStartPoint,
      currentProgress: newProgress,
      testStrictness: tempStrictness,
      preferredTestMode: tempMode,
      // Preserve history if editing
      history: baseState.isSetup ? baseState.history : [],
    };

    updateState(newState);

    // Logic to handle history if we were in editing mode
    if (isEditing) {
      window.history.back(); // This will trigger popstate -> setIsEditing(false)
    } else {
      setIsEditing(false);
    }
  };

  const handleUndoCompletion = () => {
    if (!state) return;
    setIsUndoModalOpen(true);
  };

  const confirmUndo = () => {
    if (!state) return;
    const newState = HifzService.undoDailyWird(state);
    updateState(newState);
    setIsUndoModalOpen(false);
    if (navigator.vibrate) navigator.vibrate(50);
  };

  const handleDeletePlan = () => {
    // Hard Reset to Default
    const cleanState: HifzState = {
      isSetup: false,
      planType: 'pages',
      amountPerDay: 2,
      daysPerWeek: 6,
      selectedDays: [0, 1, 2, 3, 4, 6],
      currentProgress: 0,
      startPoint: 1,
      history: [],
      lastCompletedDate: null,
      srsItems: [],
      testHistory: [],
      notificationEnabled: true,
      notificationTime: '08:00',
      revisionHistory: [],
      lastRevisionDate: null,
      revisionAmount: 5,
      todayRevisionDone: false,
      revisionNotificationEnabled: true,
      revisionNotificationTime: '20:00',
      revisionStartPoint: 1
    };

    updateState(cleanState);
    // Exit edit mode via history back to clean stack
    window.history.back();
    setIsDeleteModalOpen(false);
    setTempStart(1);
    setSelectedPreset('moderate');
  };

  const toggleDay = (dayIndex: number) => {
    if (tempSelectedDays.includes(dayIndex)) {
      if (tempSelectedDays.length > 1) { // Prevent empty selection
        setTempSelectedDays(prev => prev.filter(d => d !== dayIndex));
      }
    } else {
      setTempSelectedDays(prev => [...prev, dayIndex].sort());
    }
  };

  // --- NAVIGATION & HISTORY LOGIC ---

  // Handle Hardware Back Button & Swipe
  useEffect(() => {
    if (isEditing) {
      // Push specific state to trap the back button
      window.history.pushState({ isEditing: true }, '');

      const handlePopState = () => {
        // When user swipes back or clicks hardware back
        setIsEditing(false);
      };

      window.addEventListener('popstate', handlePopState);

      return () => {
        window.removeEventListener('popstate', handlePopState);
      };
    }
  }, [isEditing]);

  const handleBack = () => {
    if (isEditing) {
      // Trigger browser back to pop the state and close modal
      window.history.back();
    } else {
      // Normal navigation
      navigate(-1);
    }
  };

  // --- RENDER ---

  let content;

  if (state?.isSetup && !isEditing) {
    content = <HifzDashboard
      onEditPlan={() => setIsEditing(true)}
      onShowCalendar={() => setShowCompletionCalendar(true)}
      onUndoCompletion={handleUndoCompletion}
    />;
  } else {
    // 2. SETUP/EDIT VIEW
    // Calculate generic plan stats dynamically for display
    const currentPlanDetails = {
      amount: tempAmount,
      days: tempSelectedDays.length,
      estimatedMonths: tempType === 'pages'
        ? Math.ceil(604 / (tempAmount * tempSelectedDays.length * 4)) // Approx weeks -> months
        : Math.ceil(6236 / (tempAmount * tempSelectedDays.length * 4)),
      endDate: new Date(Date.now() + (tempType === 'pages'
        ? (604 / (tempAmount * tempSelectedDays.length / 7) * 24 * 60 * 60 * 1000)
        : (6236 / (tempAmount * tempSelectedDays.length / 7) * 24 * 60 * 60 * 1000)))
    };

    content = (
      <div className="min-h-screen bg-gray-50 dark:bg-navy-950 font-sans pb-64 xl:pb-40"> {/* pb-64 to account for fixed bottom sheet + nav bar */}
        <TopBar
          showBack={true}
          title={isEditing ? "تعديل الخطة" : "إعداد خطة الحفظ"}
          onBack={handleBack}
          extra={
            <div className="flex gap-2">
              {!isEditing && (
                <>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="w-10 h-10 flex items-center justify-center rounded-xl bg-white/80 dark:bg-navy-900/40 backdrop-blur-sm border border-navy-100 dark:border-gold-500/50 text-navy-600 dark:text-gold-400 hover:border-gold-400 hover:text-gold-600 dark:hover:text-gold-300 hover:bg-gold-50/50 dark:hover:bg-gold-500/10 shadow-sm transition-all duration-200 active:scale-95"
                    title="استيراد خطة سابقة"
                  >
                    <FolderInput size={20} />
                  </button>
                </>
              )}
            </div>
          }
        />

        {/* Hidden Import Input */}
        <input
          type="file"
          accept=".json"
          ref={fileInputRef}
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) {
              const reader = new FileReader();
              reader.onload = (ev) => importData(ev.target?.result as string);
              reader.readAsText(file);
            }
          }}
        />

        {/* Main Content Container */}
        <div className="max-w-3xl mx-auto px-4 pt-4 animate-in fade-in duration-500">

          {/* Header Section */}
          <div className="text-center mb-8 relative">
            <div className="inline-flex items-center justify-center p-4 bg-white dark:bg-navy-900 rounded-full shadow-lg border border-gold-100 dark:border-navy-700 mb-4 ring-4 ring-gold-50 dark:ring-navy-800">
              <Target size={40} className="text-gold-500" />
            </div>
            <h1 className="text-2xl font-bold text-navy-900 dark:text-white mb-2">بناء العادة القرآنية</h1>
            <p className="text-sm text-navy-500 dark:text-navy-300">
              حدد هدفك اليومي وأيام التفرغ، وسنحسب لك خطة الختم.
            </p>

            <div className="mt-4 px-6 py-2 bg-navy-50 dark:bg-navy-900/50 rounded-full inline-block">
              <p className="text-xs font-bold text-navy-600 dark:text-gold-400">
                "قليل دائم خير من كثير منقطع"
              </p>
            </div>
          </div>

          {/* Plans Grid - 2 Columns on Mobile/Tablet */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-4 px-1">
              <h3 className="text-sm font-bold text-navy-500 dark:text-navy-400">اختر خطتك</h3>
            </div>

            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              {PRESET_PLANS.map((plan) => {
                const isSelected = selectedPreset === plan.id;

                // Dynamic gradients based on plan type just like mockup
                let gradientClass = "bg-white dark:bg-navy-800"; // Default
                if (plan.id === 'quick') gradientClass = "bg-gradient-to-br from-emerald-500 to-teal-600 text-white";
                if (plan.id === 'moderate') gradientClass = "bg-gradient-to-br from-cyan-500 to-blue-600 text-white"; // Simulating the star plan
                if (plan.id === 'calm') gradientClass = "bg-gradient-to-br from-indigo-500 to-purple-600 text-white";
                if (plan.id === 'custom') gradientClass = "bg-gradient-to-br from-slate-700 to-slate-800 text-white";

                return (
                  <button
                    key={plan.id}
                    onClick={() => handleSelectPreset(plan)}
                    className={`
                      relative p-4 rounded-3xl text-center transition-all duration-300
                      flex flex-col items-center justify-center gap-3 h-40
                      ${isSelected
                        ? `${gradientClass} ring-4 ring-gold-200 dark:ring-gold-500/30 scale-105 shadow-xl`
                        : 'bg-white dark:bg-navy-800 hover:bg-gray-50 dark:hover:bg-navy-700 text-navy-900 dark:text-white border border-gray-100 dark:border-navy-700'}
                    `}
                  >
                    <div className={`text-4xl filter drop-shadow-md ${isSelected ? 'animate-bounce-short' : 'grayscale opacity-70'}`}>
                      {plan.emoji}
                    </div>

                    <div className="space-y-1">
                      <div className={`font-bold text-sm ${isSelected ? 'text-white' : 'text-navy-900 dark:text-white'}`}>
                        {plan.title}
                      </div>
                      <div className={`text-[10px] ${isSelected ? 'text-white/90' : 'text-navy-400'}`}>
                        {plan.description}
                      </div>
                    </div>

                    {isSelected && (
                      <div className="absolute top-3 right-3 bg-white/20 rounded-full p-1">
                        <Check size={12} className="text-white" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Selected Plan Details Card (The Green Card in Mockup) */}
          {selectedPreset && (
            <div className="bg-navy-900/5 dark:bg-black/20 rounded-3xl p-1 mb-24 animate-in slide-in-from-bottom-2">
              <div className="bg-emerald-900/90 dark:bg-emerald-900/50 backdrop-blur-md rounded-2xl p-5 text-white border border-emerald-500/20 shadow-lg">
                <div className="flex items-start gap-3">
                  <div className="bg-emerald-500/20 p-2 rounded-full mt-1">
                    <CheckCircle2 className="text-emerald-400" size={20} />
                  </div>
                  <div className="flex-1">
                    <div className="flex justify-between items-center mb-1">
                      <h3 className="font-bold text-lg text-white">
                        {PRESET_PLANS.find(p => p.id === selectedPreset)?.title || 'خطة مخصصة'}
                      </h3>
                      {/* Edit Button for Custom only or all? Let's show edit link if needed */}
                      <button
                        onClick={() => setShowCustomOptions(!showCustomOptions)}
                        className="text-xs text-emerald-300 underline hover:text-emerald-200"
                      >
                        تعديل التفاصيل
                      </button>
                    </div>
                    <p className="text-emerald-100/80 text-sm leading-relaxed">
                      {toArabicDigits(tempAmount)} {tempType === 'pages' ? 'صفحات' : 'آيات'} × {toArabicDigits(tempSelectedDays.length)} أيام/أسبوع
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* CUSTOM OPTIONS PANEL (Collapsible or Modal-like) */}
          {(showCustomOptions || selectedPreset === 'custom') && (
            <div className="bg-white dark:bg-navy-900 rounded-3xl p-6 shadow-xl border border-gray-100 dark:border-navy-700 mb-20 animate-in fade-in zoom-in-95 duration-300">
              <h3 className="font-bold text-navy-900 dark:text-white mb-6 flex items-center gap-2">
                <Sparkles size={18} className="text-gold-500" />
                تخصيص الإعدادات
              </h3>

              {/* Type Selection */}
              <div className="mb-6">
                <label className="text-xs font-bold text-navy-500 uppercase tracking-wider mb-2 block">وحدة الحفظ</label>
                <div className="flex bg-gray-100 dark:bg-navy-950 p-1 rounded-xl">
                  <button
                    onClick={() => setTempType('pages')}
                    className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${tempType === 'pages' ? 'bg-white dark:bg-navy-800 shadow text-navy-900 dark:text-white' : 'text-navy-400'}`}
                  >
                    صفحات
                  </button>
                  <button
                    onClick={() => setTempType('ayahs')}
                    className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${tempType === 'ayahs' ? 'bg-white dark:bg-navy-800 shadow text-navy-900 dark:text-white' : 'text-navy-400'}`}
                  >
                    آيات
                  </button>
                </div>
              </div>

              {/* Amount Slider */}
              <div className="mb-6 px-2">
                <div className="flex justify-between mb-4">
                  <label className="text-sm font-bold text-navy-900 dark:text-white">الكمية اليومية</label>
                  <span className="text-lg font-bold text-gold-600 dark:text-gold-400 bg-gold-50 dark:bg-gold-500/10 px-3 py-1 rounded-lg">
                    {toArabicDigits(tempAmount)}
                  </span>
                </div>
                <input
                  type="range"
                  min="1"
                  max={tempType === 'pages' ? 20 : 100}
                  value={tempAmount}
                  onChange={(e) => setTempAmount(Number(e.target.value))}
                  className="w-full h-2 bg-gray-200 dark:bg-navy-700 rounded-lg appearance-none cursor-pointer accent-gold-500"
                />
                <div className="flex justify-between text-xs text-navy-400 mt-2 font-mono">
                  <span>1</span>
                  <span>{tempType === 'pages' ? 20 : 100}</span>
                </div>
              </div>

              {/* Days Selection */}
              <div className="mb-6">
                <label className="text-sm font-bold text-navy-900 dark:text-white mb-3 block">أيام الحفظ</label>
                <div className="flex flex-wrap gap-2 justify-center" dir="rtl">
                  {['ح', 'ن', 'ث', 'ر', 'خ', 'ج', 'س'].map((day, idx) => (
                    <button
                      key={idx}
                      onClick={() => toggleDay(idx)}
                      className={`w-10 h-10 rounded-full text-sm font-bold transition-all ${tempSelectedDays.includes(idx)
                        ? 'bg-navy-900 dark:bg-white text-white dark:text-navy-900 scale-110 shadow-lg'
                        : 'bg-gray-100 dark:bg-navy-800 text-navy-400 hover:bg-gray-200'
                        }`}
                    >
                      {day}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* Start Point */}
                <div className="bg-gray-50 dark:bg-navy-950 p-4 rounded-2xl">
                  <label className="text-xs text-navy-400 block mb-2">البداية من</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      value={tempStart}
                      onChange={(e) => setTempStart(Number(e.target.value))}
                      className="w-full bg-transparent font-bold text-lg text-navy-900 dark:text-white outline-none placeholder-navy-300"
                      placeholder="1"
                    />
                    <BookOpen size={16} className="text-navy-300" />
                  </div>
                </div>

                {/* Time Picker Trigger */}
                <button
                  onClick={() => setShowTimePicker(true)}
                  className="bg-gray-50 dark:bg-navy-950 p-4 rounded-2xl text-right"
                >
                  <label className="text-xs text-navy-400 block mb-2">وقت التنبيه</label>
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-lg text-navy-900 dark:text-white">
                      {state?.notificationTime ? getTimeParams(state.notificationTime).formatted : '08:00 ص'}
                    </span>
                    <Clock size={16} className="text-navy-300" />
                  </div>
                </button>
              </div>
            </div>
          )}

        </div>

        {/* BOTTOM SHEET ACTIONS (Fixed) */}
        <div className="fixed bottom-[70px] xl:bottom-0 left-0 right-0 bg-white dark:bg-navy-900 border-t border-gray-200 dark:border-navy-800 rounded-t-[2.5rem] shadow-[0_-10px_40px_rgba(0,0,0,0.1)] z-50">
          <div className="max-w-3xl mx-auto px-6 py-6">

            {/* Summary Row */}
            <div className="flex items-center justify-between mb-6">
              <div>
                <p className="text-xs text-navy-400 mb-1">تاريخ الختم المتوقع</p>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold text-navy-900 dark:text-white">
                    {/* Calculate Date dynamically based on input */}
                    {currentPlanDetails.endDate.toLocaleDateString('ar-EG', { month: 'long', year: 'numeric' })}
                  </span>
                  <span className="text-xs px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded-md font-bold">
                    {/* Days Remaining */}
                    {Math.ceil((currentPlanDetails.endDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))} يوم
                  </span>
                </div>
              </div>

              <div className="text-left">
                <p className="text-xs text-navy-400 mb-1">الوتيرة الأسبوعية</p>
                <p className="font-bold text-navy-900 dark:text-white">
                  {toArabicDigits(tempAmount * tempSelectedDays.length)} {tempType === 'pages' ? 'صفحات' : 'آيات'}/أسبوع
                </p>
              </div>
            </div>

            {/* Main Action Button */}
            <button
              onClick={handleStartPlan}
              className="w-full py-4 bg-gradient-to-r from-gold-500 to-amber-600 hover:from-gold-400 hover:to-amber-500 text-white rounded-2xl font-bold text-lg shadow-lg shadow-gold-500/30 transition-all flex items-center justify-center gap-3 transform active:scale-[0.99]"
            >
              <span>بدء الرحلة</span>
              <ArrowLeft size={20} className="rtl:rotate-180" />
            </button>

            <p className="text-[10px] text-center text-navy-400 mt-3">
              بالضغط على البدء، أنت توافق على الالتزام بوردك اليومي
            </p>
          </div>
        </div>
      </div>
    );
  }

  // 3. RENDER CONTENT + SHARED MODALS
  return (
    <>
      {content}

      {/* Delete Confirmation Modal */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-navy-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-navy-900 rounded-3xl p-6 max-w-md w-full shadow-2xl border border-red-100 dark:border-red-900/30 transform transition-all scale-100 animate-in zoom-in-95 duration-200">
            <div className="text-center space-y-4">
              <div className="w-20 h-20 bg-red-50 dark:bg-red-900/20 rounded-full flex items-center justify-center mx-auto mb-2 ring-8 ring-red-50/50 dark:ring-red-900/10">
                <AlertTriangle size={40} className="text-red-500 dark:text-red-400" />
              </div>

              <div className="space-y-2">
                <h3 className="text-2xl font-bold text-navy-900 dark:text-white">
                  حذف خطة الحفظ؟
                </h3>
                <p className="text-sm text-navy-500 dark:text-navy-300 leading-relaxed px-4">
                  هل أنت متأكد من رغبتك في حذف الخطة الحالية نهائياً؟
                  <br />
                  <span className="text-red-500 dark:text-red-400 font-bold text-xs mt-1 block">
                    سيؤدي هذا الإجراء إلى فقدان جميع السجلات ولا يمكن التراجع عنه.
                  </span>
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-4">
                <button
                  onClick={() => setIsDeleteModalOpen(false)}
                  className="py-3.5 px-4 bg-gray-100 dark:bg-navy-800 text-navy-700 dark:text-navy-200 rounded-xl font-bold hover:bg-gray-200 dark:hover:bg-navy-700 transition-colors"
                >
                  تراجع
                </button>
                <button
                  onClick={handleDeletePlan}
                  className="py-3.5 px-4 bg-red-500 hover:bg-red-600 text-white rounded-xl font-bold shadow-lg shadow-red-500/20 transition-all active:scale-95"
                >
                  نعم، حذف الخطة
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Time Picker Modal (Memorization) */}
      {
        showTimePicker && state && (
          <ArabicTimePicker
            isOpen={showTimePicker}
            onClose={() => setShowTimePicker(false)}
            initialTime={state.notificationTime || '08:00'}
            onSelect={(t) => {
              updateState({ ...state, notificationTime: t });
            }}
          />
        )
      }

      {/* Undo Confirmation Modal */}
      {isUndoModalOpen && state && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-navy-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-navy-900 rounded-3xl p-6 max-w-sm w-full shadow-2xl border border-amber-100 dark:border-amber-900/30 transform transition-all scale-100 animate-in zoom-in-95 duration-200">
            <div className="text-center space-y-4">
              <div className="w-16 h-16 bg-amber-50 dark:bg-amber-900/20 rounded-full flex items-center justify-center mx-auto mb-2 ring-8 ring-amber-50/50 dark:ring-amber-900/10">
                <RotateCcw size={32} className="text-amber-500 dark:text-amber-400" />
              </div>

              <div className="space-y-2">
                <h3 className="text-xl font-bold text-navy-900 dark:text-white">
                  تراجع عن الإتمام؟
                </h3>
                <p className="text-sm text-navy-500 dark:text-navy-300 leading-relaxed px-2">
                  هل أنت متأكد من التراجع عن تسجيل ورد اليوم؟
                  <br />
                  <span className="text-amber-600 dark:text-amber-400 font-bold text-xs mt-2 block bg-amber-50 dark:bg-amber-900/20 py-2 rounded-lg">
                    سيتم إعادتك للحفظ من: {state.planType === 'pages' ? 'صفحة' : 'آية'} {toArabicDigits(Math.max(1, state.startPoint + state.currentProgress - state.amountPerDay))}
                  </span>
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <button
                  onClick={() => setIsUndoModalOpen(false)}
                  className="py-3 px-4 bg-gray-100 dark:bg-navy-800 text-navy-700 dark:text-navy-200 rounded-xl font-bold hover:bg-gray-200 dark:hover:bg-navy-700 transition-colors text-sm"
                >
                  إلغاء
                </button>
                <button
                  onClick={confirmUndo}
                  className="py-3 px-4 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-bold shadow-lg shadow-amber-500/20 transition-all active:scale-95 text-sm"
                >
                  تأكيد التراجع
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Completion Calendar Modal */}
      {showCompletionCalendar && state && (
        <HifzCompletionCalendar
          isOpen={showCompletionCalendar}
          onClose={() => setShowCompletionCalendar(false)}
          state={state}
        />
      )}
    </>
  );

};

// Helper for time display
const getTimeParams = (timeStr: string) => {
  let [h, m] = timeStr.split(':').map(Number);
  const period = h >= 12 ? 'م' : 'ص';
  if (h > 12) h -= 12;
  if (h === 0) h = 12;
  return { formatted: `${h}:${String(m).padStart(2, '0')} ${period}` };
};

export default Hifz;
