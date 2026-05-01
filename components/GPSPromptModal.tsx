import React from 'react';
import { MapPin, Settings, X, Navigation } from 'lucide-react';

interface GPSPromptModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
}

export const GPSPromptModal: React.FC<GPSPromptModalProps> = ({ isOpen, onClose, onConfirm }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-navy-950/80 backdrop-blur-sm transition-opacity"
                onClick={onClose}
            ></div>

            {/* Modal Container */}
            <div className="relative w-full max-w-sm bg-white dark:bg-navy-900 rounded-[2rem] shadow-2xl overflow-hidden animate-in zoom-in-95 border border-navy-100 dark:border-navy-700">

                {/* Decorative Header Background */}
                <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-br from-navy-800 to-navy-900 dark:from-black dark:to-navy-950">
                    <div className="absolute inset-0 opacity-20 bg-[url('https://www.transparenttextures.com/patterns/arabesque.png')]"></div>
                    <div className="absolute bottom-0 left-0 w-full h-16 bg-gradient-to-t from-white dark:from-navy-900 to-transparent"></div>
                </div>

                <div className="relative p-6 px-8 flex flex-col items-center text-center">

                    {/* Icon Badge */}
                    <div className="w-20 h-20 bg-gradient-to-br from-gold-400 to-gold-600 rounded-2xl rotate-3 flex items-center justify-center shadow-lg shadow-gold-500/30 mb-6 mt-4">
                        <div className="bg-white/20 w-full h-full absolute inset-0 rounded-2xl animate-pulse"></div>
                        <Navigation size={40} className="text-white relative z-10 -rotate-3" fill="currentColor" />
                    </div>

                    <h3 className="text-2xl font-bold font-quran text-navy-900 dark:text-white mb-2">
                        خدمة الموقع غير مفعلة
                    </h3>

                    <p className="text-navy-500 dark:text-navy-300 text-sm leading-relaxed mb-8">
                        للحصول على مواقيت الصلاة واتجاه القبلة بدقة، يرجى تفعيل خدمة الموقع (GPS) من الإعدادات.
                    </p>

                    {/* Action Buttons */}
                    <div className="flex flex-col gap-3 w-full">
                        <button
                            onClick={() => {
                                onConfirm();
                                onClose();
                            }}
                            className="w-full py-4 bg-navy-800 hover:bg-navy-700 dark:bg-gold-500 dark:hover:bg-gold-400 text-white dark:text-navy-900 rounded-xl font-bold shadow-lg shadow-navy-900/20 dark:shadow-gold-500/20 transition-all active:scale-95 flex items-center justify-center gap-2"
                        >
                            <Settings size={20} />
                            <span>فتح الإعدادات</span>
                        </button>

                        <button
                            onClick={onClose}
                            className="w-full py-3 text-navy-500 dark:text-navy-400 font-bold hover:bg-navy-50 dark:hover:bg-navy-800 rounded-xl transition-colors"
                        >
                            إلغاء
                        </button>
                    </div>

                </div>
            </div>
        </div>
    );
};
