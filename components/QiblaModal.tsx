import React, { useEffect, useState, useRef } from 'react';
import { App } from '@capacitor/app';
import { X, AlertTriangle, CheckCircle2, LocateFixed, RefreshCw, ChevronRight, ChevronLeft, ArrowRight, ArrowLeft } from 'lucide-react';
import { useCompass, calculateQibla } from '../services/qibla';
import { toArabicDigits } from '../services/normalization';

interface QiblaModalProps {
    isOpen: boolean;
    onClose: () => void;
    userLat: number | null;
    userLng: number | null;
    onRefreshLocation?: () => void;
}

export const QiblaModal: React.FC<QiblaModalProps> = ({ isOpen, onClose, userLat, userLng, onRefreshLocation }) => {
    // Compass Hook
    const { heading, accuracy, permissionGranted, requestPermission, needsCalibration } = useCompass(userLat ?? undefined, userLng ?? undefined);

    // Calculate Qibla Manually
    const qiblaDirection = (userLat && userLng) ? calculateQibla(userLat, userLng) : 0;

    // Constants
    const ALIGNMENT_THRESHOLD = 5; // Degrees

    // Guidance Logic
    const getCurrentStatus = () => {
        if (heading === null) return { status: 'waiting', text: 'جاري تحديد الاتجاه...', color: 'text-stone-500' };

        let delta = (qiblaDirection - heading + 360) % 360;
        if (delta > 180) delta -= 360; // Normalize to -180 to +180

        if (Math.abs(delta) <= ALIGNMENT_THRESHOLD) {
            return { status: 'aligned', text: 'أنت الآن على القبلة', color: 'text-emerald-600' };
        } else if (delta > 0) {
            return { status: 'right', text: 'أدر الهاتف يميناً', color: 'text-stone-600' };
        } else {
            return { status: 'left', text: 'أدر الهاتف يساراً', color: 'text-stone-600' };
        }
    };

    const { status, text: statusText, color: statusColor } = getCurrentStatus();
    const isAligned = status === 'aligned';

    // Rotation Values
    const dialRotation = -(heading || 0);
    const kaabaRotation = qiblaDirection || 0;

    // Permission Button Logic
    const showPermissionButton = !permissionGranted && typeof DeviceOrientationEvent !== 'undefined' && (DeviceOrientationEvent as any).requestPermission;

    // Handle Native Back Button (Android)
    useEffect(() => {
        if (!isOpen) return;

        const handleNativeBack = async () => {
            onClose();
        };

        const listener = App.addListener('backButton', handleNativeBack);
        return () => {
            listener.then(l => l.remove());
        };
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-8 bg-black/60 backdrop-blur-sm">
            <div className="relative w-full max-w-md md:max-w-xl lg:max-w-2xl bg-gradient-to-b from-[#FBF9F5] to-stone-50 dark:from-stone-900 dark:to-stone-950 rounded-3xl shadow-2xl border border-stone-200/50 dark:border-stone-800 overflow-y-auto flex flex-col max-h-[90vh]">

                {/* Header - RTL: Title on RIGHT (first), Back on LEFT (last) */}
                <div className="flex justify-between items-center p-5 z-10 bg-white/50 dark:bg-black/20 backdrop-blur-md sticky top-0 border-b border-stone-100 dark:border-stone-800">
                    {/* Title Group - Appears on RIGHT in RTL */}
                    <div className="flex items-center gap-2">
                        <h2 className="text-xl font-bold font-kufi text-stone-800 dark:text-stone-100">القبلة</h2>
                        {/* Live Accuracy Badge (Small) */}
                        {accuracy === 'high' && <span className="text-[10px] bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 px-2.5 py-1 rounded-full font-bold border border-emerald-200 dark:border-emerald-700/50">دقة عالية</span>}
                    </div>

                    {/* Back Button - Appears on LEFT in RTL */}
                    <button
                        onClick={onClose}
                        className="p-2.5 rounded-xl bg-gradient-to-br from-stone-100 to-stone-200 dark:from-stone-800 dark:to-stone-900 hover:from-gold-100 hover:to-amber-100 dark:hover:from-gold-900/30 dark:hover:to-amber-900/20 transition-all hover:scale-105 shadow-sm hover:shadow-md border border-stone-200 dark:border-stone-700"
                    >
                        <ArrowLeft className="w-5 h-5 text-stone-600 dark:text-stone-300" />
                    </button>
                </div>

                {/* Guidance Strip */}
                <div className={`py-4 flex items-center justify-center gap-3 transition-colors duration-300 ${isAligned ? 'bg-emerald-50 dark:bg-emerald-900/20' : 'bg-transparent'}`}>
                    {status === 'right' && <ArrowRight className="w-6 h-6 text-stone-400 animate-pulse" />}
                    <span className={`text-lg font-bold font-kufi transition-all duration-300 ${statusColor} ${isAligned ? 'scale-110' : ''}`}>
                        {statusText}
                    </span>
                    {status === 'left' && <ArrowLeft className="w-6 h-6 text-stone-400 animate-pulse" />}
                    {isAligned && <CheckCircle2 className="w-6 h-6 text-emerald-600" />}
                </div>


                {/* Main Compass Area */}
                <div className="qibla-compass-area relative min-h-[280px] md:min-h-[320px] flex items-center justify-center bg-gradient-to-b from-stone-50 via-stone-100/50 to-stone-100 dark:from-stone-900 dark:via-stone-900/80 dark:to-stone-950 overflow-hidden">

                    {(!userLat || !userLng) ? (
                        <div className="absolute inset-0 z-50 bg-stone-50/90 dark:bg-stone-900/90 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center">
                            <div className="w-16 h-16 bg-amber-100 dark:bg-amber-900/30 rounded-full flex items-center justify-center text-amber-600 mb-4 animate-bounce">
                                <LocateFixed size={32} />
                            </div>
                            <h3 className="text-xl font-bold text-stone-800 dark:text-white mb-2">تحديد الموقع مطلوب</h3>
                            <p className="text-stone-500 text-sm mb-6 max-w-xs">يرجى تحديث الموقع لحساب اتجاه القبلة بدقة</p>
                            {onRefreshLocation && (
                                <button
                                    onClick={onRefreshLocation}
                                    className="px-6 py-3 bg-emerald-600 text-white rounded-xl font-bold shadow-lg hover:bg-emerald-700 active:scale-95 transition-all flex items-center gap-2"
                                >
                                    <RefreshCw size={18} /> تحديث الموقع
                                </button>
                            )}
                        </div>
                    ) : (
                        <>
                            {/* Decorative Pattern */}
                            <div className="absolute inset-0 opacity-10 bg-[url('/assets/pattern.svg')] bg-center bg-repeat" />

                            {/* Compass Container */}
                            <div
                                className="qibla-compass relative w-64 h-64 md:w-[20rem] md:h-[20rem] lg:w-[24rem] lg:h-[24rem] transition-transform duration-500 ease-out will-change-transform"
                                style={{ transform: `rotate(${dialRotation}deg)` }}
                            >
                                {/* Compass Dial Background */}
                                <div className={`absolute inset-0 rounded-full border-[6px] transition-all duration-500 ${isAligned ? 'border-emerald-500 shadow-[0_0_40px_rgba(16,185,129,0.4)]' : 'border-stone-200/80 dark:border-stone-700 shadow-xl'} bg-gradient-to-br from-white via-white to-stone-50 dark:from-stone-800 dark:via-stone-800 dark:to-stone-850 flex items-center justify-center`}>

                                    {/* North Marker */}
                                    <div className="absolute top-2 w-2.5 h-7 bg-gradient-to-b from-red-400 to-red-600 rounded-full shadow-md z-20" />
                                    <div className="absolute top-10 text-sm md:text-base font-bold text-red-500/80 dark:text-red-400/80 font-kufi">الشمال</div>

                                    {/* Ticks */}
                                    {[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map((deg) => (
                                        <div key={deg} className="absolute inset-0" style={{ transform: `rotate(${deg}deg)` }}>
                                            <div className={`absolute top-0 left-1/2 -translate-x-1/2 ${deg % 90 === 0 ? 'w-1 h-3 bg-stone-300 dark:bg-stone-500' : 'w-0.5 h-2 bg-stone-200 dark:bg-stone-700'}`} />
                                        </div>
                                    ))}

                                    {/* Inner Decorative Circle */}
                                    <div className="absolute inset-8 rounded-full border border-stone-100 dark:border-stone-700/50" />
                                </div>

                                {/* KAABA Indicator (Rotates relative to Dial) */}
                                <div
                                    className="absolute inset-0 z-30 pointer-events-none"
                                    style={{ transform: `rotate(${kaabaRotation}deg)` }}
                                >
                                    {/* The Pointer/Kaaba Container */}
                                    <div className="absolute -top-6 left-1/2 -translate-x-1/2 flex flex-col items-center">
                                        {/* Kaaba Icon (CSS Art) */}
                                        <div className={`relative w-12 h-14 md:w-14 md:h-16 bg-gradient-to-b from-stone-900 to-black rounded-sm shadow-2xl border border-stone-700 flex flex-col items-center justify-start overflow-hidden transition-all duration-500 ${isAligned ? 'scale-110 shadow-[0_0_20px_rgba(16,185,129,0.3)]' : 'scale-100'}`}>
                                            {/* Gold Stripe */}
                                            <div className="w-full h-3 md:h-3.5 mt-2.5 md:mt-3 bg-gradient-to-r from-amber-700 via-yellow-500 to-amber-700 shadow-sm" />
                                            {/* Door (Rough approx) */}
                                            <div className="w-6 md:w-8 h-8 md:h-10 mt-1 md:mt-1.5 border border-stone-700/40 rounded-t-full opacity-25" />
                                        </div>
                                        {/* Arrow pointing to Kaaba */}
                                        <div className={`w-0 h-0 border-l-[8px] border-l-transparent border-r-[8px] border-r-transparent border-b-[12px] mt-2 transition-colors duration-300 ${isAligned ? 'border-b-emerald-600' : 'border-b-amber-500'}`} />
                                    </div>
                                </div>

                            </div>

                            {/* Central Pivot */}
                            <div className="absolute w-4 h-4 md:w-5 md:h-5 bg-gradient-to-br from-stone-100 to-stone-300 dark:from-stone-500 dark:to-stone-700 rounded-full border-2 border-white dark:border-stone-900 shadow-lg z-40 ring-2 ring-stone-200/50 dark:ring-stone-600/50" />

                            {/* User Heading Marker (Fixed at Top) */}
                            <div className="absolute top-4 md:top-6 left-1/2 -translate-x-1/2 z-40 flex flex-col items-center gap-1">
                                <LocateFixed className={`w-7 h-7 md:w-8 md:h-8 transition-all duration-300 ${isAligned ? 'text-emerald-500 drop-shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'text-stone-400 dark:text-stone-500'}`} />
                                <div className={`w-0.5 h-3 md:h-4 rounded-full transition-colors duration-300 ${isAligned ? 'bg-gradient-to-b from-emerald-500/80 to-transparent' : 'bg-gradient-to-b from-stone-400/50 to-transparent'}`} />
                            </div>
                        </>
                    )}

                </div>

                {/* Info & Actions Panel */}
                <div className="p-6 bg-white dark:bg-stone-900 space-y-4 border-t border-stone-100 dark:border-stone-800">

                    {/* City Name Display - Prominent */}
                    {localStorage.getItem('user_location_name') && (
                        <div className="flex justify-center -mt-2 mb-2">
                            <div className="flex items-center gap-2 px-4 py-1.5 bg-gold-50 dark:bg-navy-800 rounded-full border border-gold-100 dark:border-navy-700 shadow-sm animate-in zoom-in-50 duration-300">
                                <LocateFixed size={14} className="text-gold-600 dark:text-gold-400" />
                                <span className="text-xs font-bold text-navy-800 dark:text-white">
                                    {localStorage.getItem('user_location_name')}
                                </span>
                            </div>
                        </div>
                    )}

                    <div className="grid grid-cols-2 gap-4">
                        {/* Accuracy Status */}
                        <div className={`p-3 rounded-2xl flex flex-col items-center justify-center border ${accuracy === 'high' ? 'bg-emerald-50 border-emerald-100 text-emerald-700 dark:bg-emerald-900/20 dark:border-emerald-700/50 dark:text-emerald-400' :
                            accuracy === 'medium' ? 'bg-blue-50 border-blue-100 text-blue-700 dark:bg-blue-900/20 dark:border-blue-700/50 dark:text-blue-400' :
                                'bg-amber-50 border-amber-100 text-amber-700 dark:bg-amber-900/20 dark:border-amber-700/50 dark:text-amber-400'
                            }`}>
                            <span className="text-xs opacity-80 mb-1">الدقة</span>
                            <span className="text-sm font-bold flex items-center gap-1">
                                {accuracy === 'high' ? 'ممتازة' : accuracy === 'medium' ? 'جيدة' : 'منخفضة'}
                            </span>
                        </div>

                        {/* Direction Value */}
                        <div className="p-3 bg-stone-50 dark:bg-stone-800 rounded-2xl flex flex-col items-center justify-center border border-stone-100 dark:border-stone-700">
                            <span className="text-xs text-stone-500 dark:text-stone-400 mb-1">زاوية القبلة</span>
                            <span className="text-xl font-bold font-mono text-stone-800 dark:text-stone-200">{toArabicDigits(Math.round(qiblaDirection))}°</span>
                        </div>
                    </div>

                    {/* Calibration Alert (Conditional) */}
                    {needsCalibration && (
                        <div className="p-3 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 text-sm rounded-xl flex items-center gap-3 animate-pulse border border-amber-200 dark:border-amber-800">
                            <div className="p-2 bg-amber-100 dark:bg-amber-800 rounded-full"><AlertTriangle className="w-5 h-5 shrink-0" /></div>
                            <div className="flex-1">
                                <p className="font-bold">يرجى معايرة البوصلة</p>
                                <p className="text-xs opacity-80">قم بتحريك الهاتف على شكل رقم 8</p>
                            </div>
                        </div>
                    )}

                    {/* Buttons: Permission or Refresh */}
                    {showPermissionButton ? (
                        <button
                            onClick={requestPermission}
                            className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-xl font-bold font-kufi transition-all shadow-lg shadow-emerald-600/20 active:scale-95"
                        >
                            تشغيل البوصلة
                        </button>
                    ) : (
                        onRefreshLocation && (
                            <button
                                onClick={(e) => {
                                    const btn = e.currentTarget;
                                    btn.classList.add('opacity-75', 'scale-95'); // Visual feedback
                                    setTimeout(() => btn.classList.remove('opacity-75', 'scale-95'), 200);
                                    onRefreshLocation();
                                }}
                                className="w-full py-3.5 bg-gradient-to-r from-stone-100 to-stone-200 dark:from-stone-800 dark:to-stone-800 hover:from-gold-50 hover:to-gold-100 dark:hover:from-navy-800 dark:hover:to-navy-800 text-stone-700 dark:text-stone-300 hover:text-gold-700 dark:hover:text-gold-400 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all border border-stone-200 dark:border-stone-700 shadow-sm hover:shadow-md active:scale-95 group"
                            >
                                <RefreshCw className="w-4 h-4 group-hover:rotate-180 transition-transform duration-500" />
                                <span>تحديث الموقع الحالي (GPS)</span>
                            </button>
                        )
                    )}

                    <div className="text-center text-[10px] text-stone-400">
                        تأكد من الابتعاد عن المعادن والأجهزة الإلكترونية
                    </div>

                </div>

            </div>
        </div>
    );
};
