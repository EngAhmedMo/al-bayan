import React, { useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { SettingsContext, useTheme } from '../components/Layout';
import { Settings, Bell, ChevronLeft, Moon, Sun, Type, Square, ShieldCheck, Plus, Play, Pause, CheckCircle, Check, AlertCircle } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { MediaBridge } from '../services/mediaBridge';
import { RECITERS } from '../services/api';
import { MUAZZINS, isCustomMuazzin } from '../services/azhanData';

// ToggleSwitch Component
const ToggleSwitch = ({ enabled, onChange, disabled = false }: { enabled: boolean, onChange: (v: boolean) => void, disabled?: boolean }) => (
  <button
    type="button"
    disabled={disabled}
    className={`${enabled ? 'bg-gold-500' : 'bg-gray-200 dark:bg-navy-700'} relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
    onClick={() => !disabled && onChange(!enabled)}
  >
    <span className={`${enabled ? '-translate-x-5' : 'translate-x-0'} pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out`} />
  </button>
);

export const SettingsPage: React.FC = () => {
  const navigate = useNavigate();
  const { isDark, toggleTheme } = useTheme();
  const { fontSize, setFontSize, textAlign, setTextAlign, reciterId, setReciterId, azhanId, setAzhanId } = useContext(SettingsContext);

  const isAndroid = Capacitor.isNativePlatform();
  const [gestureSettings, setGestureSettings] = React.useState({ masterEnabled: false, flipEnabled: true, volumeEnabled: true });

  React.useEffect(() => {
    if (isAndroid) {
      MediaBridge.getAzhanStopMethods().then(methods => {
        setGestureSettings({
          masterEnabled: methods.masterEnabled ?? false,
          flipEnabled: methods.flipEnabled ?? true,
          volumeEnabled: methods.volumeEnabled ?? true
        });
      });
    }
  }, [isAndroid]);

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-navy-950 font-sans pb-24">
      {/* Top App Bar */}
      <div className="bg-white/80 dark:bg-navy-900/80 backdrop-blur-xl border-b border-navy-100 dark:border-navy-800 sticky top-0 z-40">
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate(-1)} className="p-2 rounded-full hover:bg-navy-50 dark:hover:bg-navy-800 text-navy-600 dark:text-navy-300 transition-colors">
              <ChevronLeft size={24} />
            </button>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-gold-100 dark:bg-gold-900/30 flex items-center justify-center text-gold-600 dark:text-gold-400">
                <Settings size={18} />
              </div>
              <h1 className="text-xl font-bold text-navy-900 dark:text-white">الإعدادات</h1>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        
        {/* Appearance Settings */}
        <div className="bg-white dark:bg-navy-900 rounded-2xl p-5 border border-navy-100 dark:border-navy-800 shadow-sm">
          <h3 className="text-sm font-bold text-navy-800 dark:text-white mb-4 border-b border-navy-100 dark:border-navy-800 pb-2">المظهر والقراءة</h3>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-slate-100 dark:bg-navy-800 rounded-xl text-navy-600 dark:text-navy-300">
                  {isDark ? <Moon size={18} /> : <Sun size={18} />}
                </div>
                <div>
                  <h4 className="font-bold text-sm text-navy-800 dark:text-white">المظهر الداكن</h4>
                  <p className="text-xs text-navy-500">تفعيل الوضع الليلي المريح للعين</p>
                </div>
              </div>
              <ToggleSwitch enabled={isDark} onChange={toggleTheme} />
            </div>

            <div className="pt-3 border-t border-navy-50 dark:border-navy-800/50">
              <div className="flex items-center gap-3 mb-3">
                <Type size={18} className="text-navy-400" />
                <h4 className="font-bold text-sm text-navy-800 dark:text-white">حجم الخط (الأذكار والتفسير)</h4>
              </div>
              <input
                type="range"
                min="16"
                max="40"
                step="2"
                value={fontSize}
                onChange={(e) => setFontSize(Number(e.target.value))}
                className="w-full accent-gold-500"
              />
              <div className="text-center mt-2 font-quran text-navy-800 dark:text-white" style={{ fontSize: `${fontSize}px` }}>
                بِسْمِ اللَّهِ الرَّحْمَنِ الرَّحِيمِ
              </div>
            </div>

            <div className="pt-3 border-t border-navy-50 dark:border-navy-800/50">
               <div className="flex items-center gap-3 mb-3">
                 <Square size={18} className="text-navy-400" />
                 <h4 className="font-bold text-sm text-navy-800 dark:text-white">محاذاة النص</h4>
               </div>
               <div className="flex bg-navy-50 dark:bg-navy-800 rounded-lg p-1 gap-1">
                 {['right', 'center', 'justify'].map(align => {
                   const isActive = textAlign === align;
                   return (
                     <button
                       key={align}
                       onClick={() => setTextAlign(align as any)}
                       className={`flex-1 py-1.5 rounded-md text-xs font-bold transition-all ${isActive ? 'bg-white dark:bg-navy-700 shadow-sm text-gold-600 dark:text-gold-400' : 'text-navy-500 hover:bg-navy-100 dark:hover:bg-navy-600'}`}
                     >
                       {align === 'right' ? 'يمين' : align === 'center' ? 'وسط' : 'مضبوط'}
                     </button>
                   );
                 })}
               </div>
            </div>
          </div>
        </div>

        {/* Audio & Reciters Settings */}
        <div className="bg-white dark:bg-navy-900 rounded-2xl p-5 border border-navy-100 dark:border-navy-800 shadow-sm">
          <h3 className="text-sm font-bold text-navy-800 dark:text-white mb-4 border-b border-navy-100 dark:border-navy-800 pb-2">الصوتيات</h3>
          
          <div className="space-y-4">
             <div>
                <h4 className="font-bold text-sm text-navy-800 dark:text-white mb-2">القارئ الافتراضي</h4>
                <div className="grid grid-cols-2 gap-2">
                  {RECITERS.slice(0, 6).map(r => {
                    const isActive = reciterId === r.id;
                    return (
                      <button
                        key={r.id}
                        onClick={() => setReciterId(r.id)}
                        className={`p-2 rounded-xl text-xs font-bold border transition-all ${isActive ? 'bg-gold-50 border-gold-500 text-gold-700 dark:bg-gold-900/30 dark:border-gold-500 dark:text-gold-300' : 'border-navy-100 dark:border-navy-700 text-navy-600 dark:text-navy-300 hover:bg-navy-50 dark:hover:bg-navy-800'}`}
                      >
                        {r.name}
                      </button>
                    );
                  })}
                </div>
             </div>

             <div className="pt-3 border-t border-navy-50 dark:border-navy-800/50">
                <h4 className="font-bold text-sm text-navy-800 dark:text-white mb-2">مؤذن التطبيق الافتراضي</h4>
                <div className="grid grid-cols-2 gap-2">
                  {MUAZZINS.filter(m => !isCustomMuazzin(m.id)).map(m => {
                     const isActive = azhanId === m.id;
                     return (
                       <button
                         key={m.id}
                         onClick={() => setAzhanId(m.id)}
                         className={`p-2 rounded-xl text-xs font-bold border transition-all ${isActive ? 'bg-emerald-50 border-emerald-500 text-emerald-700 dark:bg-emerald-900/30 dark:border-emerald-500 dark:text-emerald-300' : 'border-navy-100 dark:border-navy-700 text-navy-600 dark:text-navy-300 hover:bg-navy-50 dark:hover:bg-navy-800'}`}
                       >
                         {m.name}
                       </button>
                     );
                  })}
                </div>
                <button
                   onClick={() => navigate('/downloads?tab=azhan')}
                   className="mt-3 w-full py-2.5 px-4 bg-navy-50 dark:bg-navy-800/50 hover:bg-navy-100 dark:hover:bg-navy-800 border border-dashed border-navy-200 dark:border-navy-700 rounded-xl text-navy-600 dark:text-navy-300 font-bold text-xs flex items-center justify-center gap-2 transition-all hover:border-gold-400 dark:hover:border-gold-500"
                 >
                   <Plus size={16} className="text-gold-500" />
                   إضافة مؤذن مخصص من الجهاز
                 </button>
             </div>
             
             {/* Azhan Stop Methods Settings */}
             {isAndroid && (
                <div className="pt-3 border-t border-navy-50 dark:border-navy-800/50">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2.5">
                      <div className="p-2 bg-gradient-to-br from-emerald-500 to-teal-500 rounded-xl text-white shadow-lg shadow-emerald-500/20">
                        <ShieldCheck size={18} />
                      </div>
                      <div>
                        <h4 className="font-bold text-sm text-navy-800 dark:text-white">طرق إيقاف الأذان (الذكية)</h4>
                        <p className="text-[10px] text-navy-500 dark:text-navy-400">الوسائل المفضلة لإيقاف الأذان</p>
                      </div>
                    </div>
                    <ToggleSwitch
                      enabled={gestureSettings.masterEnabled}
                      onChange={async (val) => {
                        const newSettings = { ...gestureSettings, masterEnabled: val };
                        setGestureSettings(newSettings);
                        await MediaBridge.setAzhanStopMethods({ masterEnabled: val });
                      }}
                    />
                  </div>

                  {gestureSettings.masterEnabled && (
                    <div className="space-y-2 mt-3 p-3 bg-slate-50 dark:bg-navy-950/40 rounded-xl border border-emerald-100/30 dark:border-navy-800">
                      <div className="flex items-center justify-between p-2 hover:bg-white dark:hover:bg-navy-900 rounded-lg transition-colors">
                        <div className="flex items-center gap-3">
                          <span className="text-lg">🔄</span>
                          <div>
                            <span className="block text-xs font-bold text-navy-700 dark:text-navy-200">قلب الجهاز</span>
                            <span className="text-[10px] text-navy-500">بقلب الموبايل على وجهه</span>
                          </div>
                        </div>
                        <ToggleSwitch
                          enabled={gestureSettings.flipEnabled}
                          onChange={async (val) => {
                            const newSettings = { ...gestureSettings, flipEnabled: val };
                            setGestureSettings(newSettings);
                            await MediaBridge.setAzhanStopMethods({ flipEnabled: val });
                          }}
                        />
                      </div>
                      <div className="flex items-center justify-between p-2 hover:bg-white dark:hover:bg-navy-900 rounded-lg transition-colors">
                        <div className="flex items-center gap-3">
                          <span className="text-lg">🔉</span>
                          <div>
                            <span className="block text-xs font-bold text-navy-700 dark:text-navy-200">زر الصوت</span>
                            <span className="text-[10px] text-navy-500">بالضغط على زر الصوت</span>
                          </div>
                        </div>
                        <ToggleSwitch
                          enabled={gestureSettings.volumeEnabled}
                          onChange={async (val) => {
                            const newSettings = { ...gestureSettings, volumeEnabled: val };
                            setGestureSettings(newSettings);
                            await MediaBridge.setAzhanStopMethods({ volumeEnabled: val });
                          }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}
          </div>
        </div>

        {/* Notifications & Advanced Tab Redirection */}
        <button
          onClick={() => navigate('/notification-settings')}
          className="w-full group relative overflow-hidden rounded-2xl p-4 transition-all duration-300 hover:shadow-lg hover:shadow-gold-500/20 active:scale-[0.98] border border-navy-100 dark:border-navy-800"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-white via-gray-50 to-white dark:from-navy-900 dark:via-navy-800 dark:to-navy-900"></div>
          <div className="absolute top-0 right-0 w-32 h-32 bg-gold-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
          
          <div className="relative flex items-center justify-between z-10">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-gold-500 to-amber-600 flex items-center justify-center text-white shadow-lg shadow-gold-500/30 group-hover:scale-110 transition-transform duration-300">
                <Bell size={22} className="fill-white/20" />
              </div>
              <div className="text-right">
                <h4 className="font-bold text-base text-navy-900 dark:text-white mb-1">إعدادات التنبيهات والأذان</h4>
                <p className="text-[11px] text-navy-500 dark:text-navy-300 font-medium">الأذان • الأذكار • الصلاة على النبي</p>
              </div>
            </div>
            
            <div className="w-8 h-8 rounded-full bg-navy-100 dark:bg-white/10 flex items-center justify-center text-navy-600 dark:text-white group-hover:bg-gold-500 group-hover:text-white transition-colors duration-300">
              <ChevronLeft size={16} />
            </div>
          </div>
        </button>

      </div>
    </div>
  );
};
