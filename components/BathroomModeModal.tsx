import React, { useState, useEffect } from 'react';
import { MediaBridge } from '../services/mediaBridge';
import { App } from '@capacitor/app';
import { X, Clock, Pause, Shield, CheckCircle } from 'lucide-react';

interface BathroomModeModalProps {
    visible: boolean;
    onClose: () => void;
    onStatusChange: (isActive: boolean) => void;
}

export const BathroomModeModal: React.FC<BathroomModeModalProps> = ({ visible, onClose, onStatusChange }) => {
    const [selectedDuration, setSelectedDuration] = useState<number>(20);
    const [isActive, setIsActive] = useState(false);
    const [endTime, setEndTime] = useState<number | null>(null);
    const [remainingTime, setRemainingTime] = useState<string>('');

    // Check status on mount and visibility change
    useEffect(() => {
        let backListener: any;
        if (visible) {
            checkStatus();
            // Add Back Button Listener to close this modal
            App.addListener('backButton', () => {
                onClose();
            }).then(l => { backListener = l; });
        }
        return () => {
            if (backListener) backListener.remove();
        };
    }, [visible, onClose]);

    // Timer for countdown updates
    useEffect(() => {
        let interval: NodeJS.Timeout;
        if (isActive && endTime) {
            interval = setInterval(() => {
                const now = Date.now();
                const diff = Math.max(0, Math.floor((endTime - now) / 1000));

                if (diff <= 0) {
                    setIsActive(false);
                    setEndTime(null);
                    onStatusChange(false);
                    clearInterval(interval);
                } else {
                    const m = Math.floor(diff / 60);
                    const s = diff % 60;
                    setRemainingTime(`${m}:${s.toString().padStart(2, '0')}`);
                }
            }, 1000);
        }
        return () => clearInterval(interval);
    }, [isActive, endTime]);

    const checkStatus = async () => {
        try {
            const status = await MediaBridge.getBathroomModeStatus();
            setIsActive(status.isActive);
            if (status.isActive && status.endTime) {
                setEndTime(status.endTime);
                // Initial calc
                const diff = Math.max(0, Math.floor((status.endTime - Date.now()) / 1000));
                const m = Math.floor(diff / 60);
                const s = diff % 60;
                setRemainingTime(`${m}:${s.toString().padStart(2, '0')}`);
            }
            onStatusChange(status.isActive);
        } catch (e) {
            console.warn("Failed to check bathroom mode", e);
        }
    };

    const handleActivate = async () => {
        try {
            await MediaBridge.setBathroomMode({ duration: selectedDuration });
            await checkStatus();
            // Optional: Close modal after brief delay
            setTimeout(onClose, 500);
        } catch (e) {
            console.error("Failed to set bathroom mode", e);
        }
    };

    const handleDeactivate = async () => {
        try {
            await MediaBridge.setBathroomMode({ duration: 0 }); // 0 means deactivate
            setIsActive(false);
            setEndTime(null);
            onStatusChange(false);
        } catch (e) {
            console.error("Failed to deactivate bathroom mode", e);
        }
    };

    if (!visible) return null;

    const durations = [10, 20, 30, 45, 60];

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-navy-900/80 backdrop-blur-sm transition-opacity"
                onClick={onClose}
            ></div>

            {/* Modal Container */}
            <div className="relative w-full max-w-sm bg-white dark:bg-navy-900 rounded-3xl shadow-2xl overflow-hidden border border-navy-100 dark:border-navy-800 animate-in zoom-in-95">

                {/* Header */}
                <div className="p-5 border-b border-navy-100 dark:border-navy-800 flex justify-between items-center bg-navy-50 dark:bg-navy-950">
                    <div className="flex items-center gap-2">
                        <Pause size={20} className="text-gold-500 fill-gold-500" />
                        <h3 className="font-bold text-lg text-navy-900 dark:text-white">وضع الكتم المؤقت (لدورات المياه)</h3>
                    </div>
                    <button onClick={onClose} className="p-1.5 rounded-full hover:bg-navy-200 dark:hover:bg-navy-800 text-navy-500">
                        <X size={20} />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6">
                    {isActive ? (
                        <div className="flex flex-col items-center py-4">
                            <Shield size={64} className="text-red-500 mb-4 animate-pulse" />
                            <h2 className="text-2xl font-bold text-red-500 mb-2">الوضع مُفَعّل</h2>
                            <div className="text-5xl font-bold text-navy-900 dark:text-white font-mono mb-4 tracking-widest">
                                {remainingTime}
                            </div>
                            <p className="text-sm text-center text-navy-500 dark:text-navy-400 mb-6 max-w-[80%]">
                                جميع التنبيهات والأصوات مكتومة حالياً لضمان الخصوصية.
                            </p>

                            <button
                                onClick={handleDeactivate}
                                className="w-full py-3 rounded-xl bg-navy-100 dark:bg-navy-800 text-navy-700 dark:text-navy-200 font-bold hover:bg-navy-200 dark:hover:bg-navy-700 transition-colors"
                            >
                                إيقاف الوضع الآن
                            </button>
                        </div>
                    ) : (
                        <>
                            <p className="text-center text-sm text-navy-600 dark:text-navy-300 mb-6 leading-relaxed">
                                سيتم كتم جميع التنبيهات الدينية (الأذان، الصلاة على النبي) لمدة محددة لضمان الخصوصية في الأماكن غير المناسبة (مثل دورات المياه).
                            </p>

                            <div className="mb-6">
                                <label className="block text-right text-xs font-bold text-navy-400 mb-3">اختر المدة (دقيقة):</label>
                                <div className="flex flex-wrap justify-center gap-3">
                                    {durations.map((d) => (
                                        <button
                                            key={d}
                                            onClick={() => setSelectedDuration(d)}
                                            className={`w-14 h-14 rounded-full flex items-center justify-center text-lg font-bold transition-all ${selectedDuration === d
                                                ? 'bg-gold-500 text-white shadow-lg shadow-gold-500/30 scale-110'
                                                : 'bg-navy-50 dark:bg-navy-800 text-navy-600 dark:text-navy-400 hover:bg-gold-50 dark:hover:bg-navy-700'
                                                }`}
                                        >
                                            {d}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="flex items-center justify-center gap-2 mb-6 p-2 bg-navy-50 dark:bg-navy-950 rounded-lg">
                                <Clock size={14} className="text-navy-400" />
                                <span className="text-xs text-navy-500 dark:text-navy-400">سيعود الصوت تلقائياً بعد انتهاء الوقت</span>
                            </div>

                            <button
                                onClick={handleActivate}
                                className="w-full py-3.5 rounded-xl bg-gradient-to-r from-red-500 to-red-600 text-white font-bold shadow-lg shadow-red-500/30 hover:shadow-xl active:scale-95 transition-all flex items-center justify-center gap-2"
                            >
                                <Pause size={18} fill="currentColor" />
                                تفعيل وضع الصمت
                            </button>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};
