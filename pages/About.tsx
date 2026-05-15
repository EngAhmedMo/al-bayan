
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { TopBar } from '../components/TopBar';
import {
  Heart, Code, Mail, MessageCircle, BookOpen, Activity, Radio,
  Clock, Shield, Database, ChevronLeft, Layers, Bug, Sparkles,
  Star, Download, Trash2, ExternalLink, Github, Zap, BookMarked
} from 'lucide-react';
import { ConfirmDialog } from '../components/ConfirmDialog';

export const About: React.FC = () => {
  const navigate = useNavigate();

  // Dialog states
  // Dialog states
  const [showAzhanLogDeleteDialog, setShowAzhanLogDeleteDialog] = useState(false);
  const [showSystemLogsDeleteDialog, setShowSystemLogsDeleteDialog] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);

  const handleAzhanLogDelete = async () => {
    setIsDeleting(true);
    try {
      const { MediaBridge } = await import('../services/mediaBridge');
      await MediaBridge.deleteLogFile({ fileName: 'azhan_debug_log.txt' });

      // Success flow
      setShowAzhanLogDeleteDialog(false);
      setTimeout(() => {
        setSuccessMessage('تم حذف سجل تحليل الأذان بنجاح');
        setIsDeleting(false);
      }, 300);
    } catch (e) {
      setIsDeleting(false);
      setShowAzhanLogDeleteDialog(false);
      setShareError('حدث خطأ أثناء حذف السجل');
    }
  };

  const handleSystemLogsDelete = async () => {
    setIsDeleting(true);
    try {
      const { LoggerService } = await import('../services/LoggerService');
      await LoggerService.clearLogs();

      // Success flow
      setShowSystemLogsDeleteDialog(false);
      setTimeout(() => {
        setSuccessMessage('تم حذف جميع سجلات النظام بنجاح');
        setIsDeleting(false);
      }, 300);
    } catch (e) {
      setIsDeleting(false);
      setShowSystemLogsDeleteDialog(false);
      setShareError('حدث خطأ أثناء حذف السجلات');
    }
  };

  const handleShareFeedback = async (platform: 'whatsapp' | 'email' | 'general') => {
    try {
      const { LoggerService } = await import('../services/LoggerService');
      const logFile = await LoggerService.getCombinesLogFilePath();
      const { Share } = await import('@capacitor/share');

      let text = 'السلام عليكم، لدي ملاحظات بخصوص تطبيق البيان:\n\n(اكتب ملاحظاتك هنا)\n\n--- سجلات التطبيق مرفقة ---';
      let title = 'ملاحظات تطبيق البيان';

      await Share.share({
        title: title,
        text: text,
        files: [logFile],
        dialogTitle: 'إرسال الملاحظات (اختر التطبيق)'
      });
    } catch (e: any) {
      console.error('Failed to share logs', e);
      const errorMsg = e?.message || e?.toString() || 'خطأ غير معروف';
      setShareError(errorMsg);
    }
  };

  // Feature data for clean iteration
  const features = [
    { icon: <Activity />, title: 'خطة الحفظ', desc: 'متابعة ذكية للورد اليومي', path: '/hifz', gradient: 'from-[#DFCD92] to-[#9A7B3C]', bg: 'bg-white dark:bg-navy-800' },
    { icon: <Clock />, title: 'مواقيت الصلاة', desc: 'أذان وتنبيهات دقيقة', path: '/?action=prayers', gradient: 'from-[#DFCD92] to-[#9A7B3C]', bg: 'bg-white dark:bg-navy-800' },
    { icon: <Database />, title: 'الموسوعة الحديثية', desc: 'البخاري، مسلم، والنووي', path: '/hadith', gradient: 'from-[#DFCD92] to-[#9A7B3C]', bg: 'bg-white dark:bg-navy-800' },
    { icon: <Shield />, title: 'حصن المسلم', desc: 'أذكار الصباح والمساء', path: '/adhkar', gradient: 'from-[#DFCD92] to-[#9A7B3C]', bg: 'bg-white dark:bg-navy-800' },
    { icon: <Radio />, title: 'الإذاعة المباشرة', desc: 'بث مباشر للقرآن الكريم', path: '/radio', gradient: 'from-[#DFCD92] to-[#9A7B3C]', bg: 'bg-white dark:bg-navy-800' },
    { icon: <Download />, title: 'التحميلات', desc: 'إدارة المحتوى بدون إنترنت', path: '/downloads', gradient: 'from-[#DFCD92] to-[#9A7B3C]', bg: 'bg-white dark:bg-navy-800' },
  ];

  return (
    <>
      <div className="flex flex-col min-h-full bg-gradient-to-b from-stone-50 via-gold-50/20 to-white dark:from-navy-950 dark:via-navy-900 dark:to-navy-950 font-sans transition-colors duration-500">
        <TopBar title="عن التطبيق" showBack />

        <div className="flex-1 overflow-y-auto pb-28 custom-scrollbar">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6 sm:space-y-8">

            {/* ═══════════════════════════════════════════════════════════════════
                HERO SECTION - Premium Branding with Glassmorphism
            ═══════════════════════════════════════════════════════════════════ */}
            <section className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-white via-gold-50/50 to-amber-50/30 dark:from-navy-900 dark:via-navy-800 dark:to-navy-900 border border-gold-200/50 dark:border-gold-800/30 shadow-xl shadow-gold-500/10 dark:shadow-black/30 p-6 sm:p-8">
              {/* Decorative Gradients */}
              <div className="absolute -top-20 -right-20 w-40 h-40 bg-gradient-to-br from-gold-400/30 to-amber-300/20 rounded-full blur-3xl animate-pulse" />
              <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-gradient-to-tr from-emerald-400/20 to-teal-300/10 rounded-full blur-2xl" />

              <div className="relative z-10 flex flex-col items-center text-center">
                {/* Logo */}
                <div className="relative group">
                  <div className="absolute inset-0 bg-gradient-to-br from-gold-400 to-amber-500 rounded-[1.75rem] blur-xl opacity-40 group-hover:opacity-60 transition-opacity duration-500 animate-pulse" />
                  <div className="relative w-24 h-24 sm:w-28 sm:h-28 bg-gradient-to-br from-[#DFCD92] via-[#C6AD73] to-[#9A7B3C] rounded-[1.75rem] flex items-center justify-center shadow-[0_0_25px_rgba(251,191,36,0.4)] border-2 border-white/50 dark:border-gold-300/50 transform group-hover:scale-105 group-hover:rotate-1 transition-all duration-500">
                    <span className="font-quran text-6xl sm:text-7xl font-bold text-white mt-2 drop-shadow-lg">ب</span>
                  </div>
                </div>

                {/* Title */}
                <h1 className="mt-5 text-3xl sm:text-4xl font-bold text-navy-900 dark:text-white font-quran tracking-wide">البيان</h1>

                {/* Subtitle with decorative lines */}
                <div className="flex items-center justify-center gap-3 mt-2">
                  <span className="h-[2px] w-8 sm:w-12 bg-gradient-to-r from-transparent to-gold-500 rounded-full" />
                  <div className="flex items-center gap-1.5">
                    <Sparkles size={12} className="text-gold-500" />
                    <p className="text-xs sm:text-sm font-bold text-gold-600 dark:text-gold-400 tracking-widest">القرآن والسنة</p>
                    <Sparkles size={12} className="text-gold-500" />
                  </div>
                  <span className="h-[2px] w-8 sm:w-12 bg-gradient-to-l from-transparent to-gold-500 rounded-full" />
                </div>

                {/* Version Badge */}
                <div className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-white/80 dark:bg-navy-800/80 backdrop-blur-sm rounded-full border border-gold-200/50 dark:border-navy-600 shadow-sm">
                  <Star size={14} className="text-gold-500 fill-gold-500/30" />
                  <span className="text-xs font-bold text-navy-600 dark:text-navy-300">الإصدار 1.0.0</span>
                  <Zap size={12} className="text-emerald-500" />
                </div>
              </div>
            </section>

            {/* ═══════════════════════════════════════════════════════════════════
                SADAQAH JARIYAH CARD - Emotional Impact Design
            ═══════════════════════════════════════════════════════════════════ */}
            <section className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-[#0F2238] via-[#132A42] to-[#0A1929] text-white shadow-2xl shadow-navy-900/50 group border border-gold-500/20">
              {/* Pattern Overlay */}
              <div className="absolute inset-0 opacity-[0.05]">
                <div className="absolute inset-0" style={{ backgroundImage: 'url("https://www.transparenttextures.com/patterns/arabesque.png")' }} />
              </div>

              {/* Floating Orbs */}
              <div className="absolute -bottom-20 -right-20 w-56 h-56 bg-gold-400/10 rounded-full blur-3xl group-hover:scale-125 transition-transform duration-1000" />
              <div className="absolute -top-16 -left-16 w-36 h-36 bg-gold-500/10 rounded-full blur-2xl" />

              <div className="relative z-10 p-6 sm:p-8 flex flex-col items-center text-center">
                {/* Icon */}
                <div className="p-4 bg-gradient-to-br from-[#DFCD92] to-[#9A7B3C] rounded-2xl border border-gold-300/40 shadow-[0_0_15px_rgba(251,191,36,0.3)] mb-4 group-hover:scale-110 group-hover:rotate-6 transition-transform duration-500">
                  <Heart className="text-navy-900 fill-navy-900/20" size={32} />
                </div>

                <h3 className="font-bold text-xl sm:text-2xl mb-2 text-gold-400 drop-shadow-sm font-quran tracking-wide">صدقة جارية</h3>
                <p className="text-gray-200 text-sm sm:text-base leading-relaxed max-w-sm mx-auto font-medium">
                  هذا العمل وقف لله تعالى عن جميع أموات المسلمين
                </p>

                {/* Prayer Request */}
                <div className="mt-5 inline-flex items-center gap-2 bg-white/5 backdrop-blur-md py-3 px-5 rounded-2xl border border-gold-500/20 shadow-inner">
                  <span className="text-xs sm:text-sm font-bold text-gold-300 opacity-95">🤲 نسألكم الدعاء بالمغفرة والرحمة لوالدي</span>
                </div>
              </div>
            </section>

            {/* ═══════════════════════════════════════════════════════════════════
                FEATURES GRID - Modern Bento Box Layout
            ═══════════════════════════════════════════════════════════════════ */}
            <section className="space-y-4">
              {/* Section Header */}
              <div className="flex items-center gap-3 px-1">
                <div className="p-2.5 bg-gradient-to-br from-gold-100 to-amber-100 dark:from-gold-900/40 dark:to-amber-900/30 rounded-xl shadow-sm">
                  <Layers size={18} className="text-gold-600 dark:text-gold-400" />
                </div>
                <h2 className="text-base sm:text-lg font-bold text-navy-800 dark:text-white">مميزات التطبيق</h2>
              </div>

              {/* Main Feature - Quran */}
              <button
                onClick={() => navigate('/reader')}
                className="w-full bg-gradient-to-br from-white via-stone-50 to-gold-50/50 dark:from-navy-900 dark:via-navy-800 dark:to-navy-900 p-5 sm:p-6 rounded-2xl border border-navy-100 dark:border-navy-700 shadow-lg shadow-navy-900/5 dark:shadow-black/20 flex items-center gap-4 hover:border-gold-400 dark:hover:border-gold-500/50 hover:shadow-xl active:scale-[0.99] transition-all duration-300 group"
              >
                <div className="w-14 h-14 sm:w-16 sm:h-16 bg-gradient-to-br from-gold-400 to-amber-500 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-gold-500/30 group-hover:scale-110 group-hover:rotate-2 transition-all duration-300">
                  <BookOpen size={28} />
                </div>
                <div className="flex-1 text-right">
                  <h3 className="font-bold text-navy-900 dark:text-white text-base sm:text-lg">المصحف الشريف</h3>
                  <p className="text-xs sm:text-sm text-navy-500 dark:text-navy-400 mt-1">تلاوة، تفسير، بحث دقيق، وعلامات وقف</p>
                </div>
                <ChevronLeft className="text-navy-300 dark:text-navy-500 group-hover:-translate-x-1 group-hover:text-gold-500 transition-all" size={24} />
              </button>

              {/* Feature Grid - Responsive 2x3 on mobile, 3x2 on tablet+ */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {features.map((feature, index) => (
                  <button
                    key={index}
                    onClick={() => navigate(feature.path)}
                    className={`${feature.bg} p-4 rounded-2xl border border-gold-200/40 dark:border-gold-800/40 flex flex-col items-start text-right shadow-sm shadow-gold-500/5 hover:shadow-gold-500/15 hover:border-gold-400/60 dark:hover:border-gold-500/60 hover:-translate-y-0.5 active:scale-[0.98] transition-all duration-300 group`}
                  >
                    <div className={`p-2.5 sm:p-3 rounded-xl bg-gradient-to-br ${feature.gradient} text-white mb-3 shadow-md shadow-gold-500/20 group-hover:scale-110 group-hover:rotate-2 group-hover:shadow-[0_0_15px_rgba(251,191,36,0.4)] transition-all duration-300 border border-gold-300/30`}>
                      {React.cloneElement(feature.icon as React.ReactElement, { size: 18 })}
                    </div>
                    <h4 className="font-bold text-navy-900 dark:text-white text-xs sm:text-sm mb-0.5">{feature.title}</h4>
                    <p className="text-[10px] sm:text-xs text-navy-500 dark:text-navy-400 leading-relaxed">{feature.desc}</p>
                  </button>
                ))}
              </div>
            </section>

            {/* ═══════════════════════════════════════════════════════════════════
                DIAGNOSTICS SECTION - Developer Tools
            ═══════════════════════════════════════════════════════════════════ */}
            <section className="bg-gradient-to-br from-red-50 to-orange-50/50 dark:from-red-900/10 dark:to-orange-900/5 rounded-[2rem] p-5 sm:p-6 border border-red-100 dark:border-red-900/30">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2.5 bg-red-100 dark:bg-red-900/30 rounded-xl">
                  <Bug size={20} className="text-red-600 dark:text-red-400" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-navy-900 dark:text-white">أدوات التشخيص</h3>
                  <p className="text-[10px] sm:text-xs text-navy-500 dark:text-navy-400">لتشخيص مشاكل الأذان والإشعارات</p>
                </div>
              </div>

              <div className="space-y-3">
                {/* Diagnostics Button */}
                <button
                  onClick={() => navigate('/azhan-diagnostics')}
                  className="w-full flex items-center justify-center gap-2 py-3.5 px-4 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white rounded-xl shadow-lg shadow-indigo-500/25 active:scale-[0.98] transition-all text-xs sm:text-sm font-bold"
                >
                  <Activity size={18} />
                  فتح أداة تشخيص الأذان
                </button>

                {/* Action Buttons */}
                <div className="flex gap-2">
                  <button
                    onClick={async () => {
                      const { MediaBridge } = await import('../services/mediaBridge');
                      await MediaBridge.shareLogFile({ fileName: 'azhan_debug_log.txt' });
                    }}
                    className="flex-1 flex items-center justify-center gap-2 py-3 px-3 bg-white dark:bg-navy-800 border border-navy-200 dark:border-navy-700 rounded-xl shadow-sm hover:bg-navy-50 dark:hover:bg-navy-700 active:scale-[0.98] transition-all text-xs font-bold text-navy-700 dark:text-navy-200"
                  >
                    <Download size={14} />
                    <span className="hidden sm:inline">مشاركة</span> السجل
                  </button>

                  <button
                    onClick={() => setShowAzhanLogDeleteDialog(true)}
                    className="flex items-center justify-center gap-2 py-3 px-4 bg-red-100 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl hover:bg-red-200 dark:hover:bg-red-900/40 active:scale-[0.98] transition-all text-xs font-bold text-red-700 dark:text-red-400"
                  >
                    <Trash2 size={14} />
                    حذف
                  </button>
                </div>

                {/* Info Note */}
                <div className="flex items-center gap-2 text-[10px] text-navy-400 dark:text-navy-500 px-1">
                  <Clock size={10} />
                  <span>يتم الاحتفاظ بالسجلات لمدة 48 ساعة فقط</span>
                </div>
              </div>
            </section>

            {/* ═══════════════════════════════════════════════════════════════════
                DEVELOPER CONTACT - Professional Card
            ═══════════════════════════════════════════════════════════════════ */}
            <section className="bg-gradient-to-br from-white via-gold-50/30 to-white dark:from-navy-900 dark:via-navy-800 dark:to-navy-900 rounded-[2rem] p-5 sm:p-6 shadow-lg shadow-gold-500/5 dark:shadow-black/30 border border-gold-200/50 dark:border-gold-800/40 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-gold-400/10 rounded-full blur-2xl pointer-events-none -mr-10 -mt-10"></div>
              {/* Developer Info */}
              <div className="flex items-center gap-4 mb-5 relative z-10">
                <div className="w-14 h-14 sm:w-16 sm:h-16 bg-gradient-to-br from-navy-800 via-navy-900 to-navy-950 dark:from-[#DFCD92] dark:to-[#9A7B3C] rounded-2xl flex items-center justify-center text-white dark:text-navy-900 shadow-md shadow-navy-900/20 dark:shadow-gold-500/20 border border-navy-700 dark:border-gold-300/50">
                  <Code size={24} />
                </div>
                <div>
                  <h3 className="font-bold text-navy-900 dark:text-white text-base sm:text-lg">تطوير وبرمجة</h3>
                  <p className="text-gold-600 dark:text-gold-400 font-bold text-sm sm:text-base mt-0.5 font-quran tracking-wide">م. أحمد محمد</p>
                </div>
              </div>

              {/* Contact Grid */}
              <div className="grid grid-cols-2 gap-3">
                {/* WhatsApp */}
                <button
                  onClick={() => window.open("https://wa.me/201012489813?text=" + encodeURIComponent("السلام عليكم، لدي ملاحظات بخصوص تطبيق البيان:"), "_blank")}
                  className="flex flex-col items-center justify-center gap-2.5 p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-[#25D366]/10 to-[#128C7E]/10 hover:from-[#25D366]/20 hover:to-[#128C7E]/20 border border-[#25D366]/30 active:scale-[0.98] transition-all duration-300 group"
                >
                  <div className="p-3 bg-[#25D366]/20 rounded-xl group-hover:scale-110 transition-transform">
                    <MessageCircle className="text-[#25D366]" size={22} />
                  </div>
                  <span className="font-bold text-navy-800 dark:text-white text-xs">واتساب</span>
                </button>

                {/* Email */}
                <button
                  onClick={async () => {
                    try {
                      const { MediaBridge } = await import('../services/mediaBridge');
                      const { LoggerService } = await import('../services/LoggerService');
                      const logPath = await LoggerService.getCombinesLogFilePath();
                      await MediaBridge.sendEmailDirect({
                        subject: "تواصل بخصوص تطبيق البيان",
                        body: "السلام عليكم، لدي ملاحظات بخصوص التطبيق:\n\n",
                        attachmentPath: logPath
                      });
                    } catch (e) {
                      console.error(e);
                      window.location.href = "mailto:engahmedmohammed00@gmail.com?subject=تواصل بخصوص تطبيق البيان";
                    }
                  }}
                  className="flex flex-col items-center justify-center gap-2.5 p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 hover:from-blue-100 hover:to-indigo-100 dark:hover:from-blue-900/30 border border-blue-200/50 dark:border-blue-800 active:scale-[0.98] transition-all duration-300 group"
                >
                  <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-xl group-hover:scale-110 transition-transform">
                    <Mail className="text-blue-600 dark:text-blue-400" size={22} />
                  </div>
                  <span className="font-bold text-navy-800 dark:text-white text-xs">بريد إلكتروني</span>
                </button>

                {/* Report Issue */}
                <button
                  onClick={() => handleShareFeedback('general')}
                  className="flex items-center justify-center gap-3 p-3.5 rounded-2xl bg-gradient-to-r from-navy-50 to-stone-50 dark:from-navy-800 dark:to-navy-800 hover:from-navy-100 hover:to-stone-100 dark:hover:from-navy-700 border border-navy-200/50 dark:border-navy-700 active:scale-[0.98] transition-all group"
                >
                  <div className="p-2 bg-navy-200/70 dark:bg-navy-900 rounded-lg group-hover:scale-110 transition-transform">
                    <Bug className="text-navy-600 dark:text-navy-300" size={16} />
                  </div>
                  <span className="font-bold text-navy-600 dark:text-navy-300 text-xs">إبلاغ عن مشكلة</span>
                </button>

                {/* Clear Logs */}
                <button
                  onClick={() => setShowSystemLogsDeleteDialog(true)}
                  className="flex items-center justify-center gap-3 p-3.5 rounded-2xl bg-gradient-to-r from-red-50 to-stone-50 dark:from-red-900/20 dark:to-navy-800 hover:from-red-100 hover:to-stone-100 dark:hover:from-red-900/30 border border-red-200/50 dark:border-red-900/50 active:scale-[0.98] transition-all group"
                >
                  <div className="p-2 bg-red-100 dark:bg-red-900/40 rounded-lg group-hover:scale-110 transition-transform">
                    <Trash2 className="text-red-600 dark:text-red-400" size={16} />
                  </div>
                  <span className="font-bold text-red-600 dark:text-red-300 text-xs">مسح السجلات</span>
                </button>
              </div>
            </section>

            {/* ═══════════════════════════════════════════════════════════════════
                FOOTER - Dua and Copyright
            ═══════════════════════════════════════════════════════════════════ */}
            <footer className="text-center pt-4 pb-8 space-y-3">
              <p className="text-xs text-navy-600 dark:text-navy-300 font-bold bg-gradient-to-r from-gold-100/80 via-gold-50 to-gold-100/80 dark:from-navy-800 dark:via-navy-700 dark:to-navy-800 inline-block px-6 py-3 rounded-full border border-gold-300/50 dark:border-gold-700/50 shadow-[0_0_10px_rgba(251,191,36,0.15)] transition-all hover:shadow-[0_0_15px_rgba(251,191,36,0.3)]">
                🤲 اللهم اجعل هذا العمل خالصاً لوجهك الكريم
              </p>
            </footer>

          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          CONFIRMATION DIALOGS
      ═══════════════════════════════════════════════════════════════════ */}
      <ConfirmDialog
        isOpen={showAzhanLogDeleteDialog}
        onClose={() => setShowAzhanLogDeleteDialog(false)}
        onConfirm={handleAzhanLogDelete}
        title="حذف سجل تحليل الأذان"
        message="هل أنت متأكد من حذف سجل تحليل الأذان؟ لا يمكن التراجع عن هذا الإجراء."
        confirmText={isDeleting ? "جاري الحذف..." : "حذف"}
        cancelText="إلغاء"
        variant="danger"
        isLoading={isDeleting}
      />

      <ConfirmDialog
        isOpen={showSystemLogsDeleteDialog}
        onClose={() => setShowSystemLogsDeleteDialog(false)}
        onConfirm={handleSystemLogsDelete}
        title="حذف جميع سجلات النظام"
        message="هل أنت متأكد من حذف جميع السجلات؟ يشمل ذلك سجلات الأخطاء والتصحيح. لا يمكن التراجع عن هذا الإجراء."
        confirmText={isDeleting ? "جاري الحذف..." : "حذف الكل"}
        cancelText="إلغاء"
        variant="danger"
        isLoading={isDeleting}
      />

      {/* Success Dialog */}
      <ConfirmDialog
        isOpen={!!successMessage}
        onClose={() => setSuccessMessage(null)}
        onConfirm={() => setSuccessMessage(null)}
        title="تمت العملية بنجاح"
        message={successMessage || ''}
        confirmText="حسناً"
        variant="success"
        hideCancel
      />

      {/* Error Modal for Share/Delete Failure */}
      <ConfirmDialog
        isOpen={!!shareError}
        onClose={() => setShareError(null)}
        onConfirm={() => setShareError(null)}
        title="تنبيه"
        message={shareError || ''}
        confirmText="حسناً"
        variant="warning"
        hideCancel
      />
    </>
  );
};
