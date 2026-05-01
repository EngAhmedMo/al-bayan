import React, { useEffect, useState } from 'react';
import { X, AlertTriangle, Trash2, CheckCircle2, Loader2, Info } from 'lucide-react';

interface ConfirmDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm?: () => void;
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    variant?: 'danger' | 'warning' | 'info' | 'success';
    icon?: React.ReactNode;
    isLoading?: boolean;
    hideCancel?: boolean;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
    isOpen,
    onClose,
    onConfirm,
    title,
    message,
    confirmText = 'تأكيد',
    cancelText = 'إلغاء',
    variant = 'danger',
    icon,
    isLoading = false,
    hideCancel = false
}) => {
    const [isClosing, setIsClosing] = useState(false);
    const [isRendered, setIsRendered] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setIsRendered(true);
            document.body.style.overflow = 'hidden';
        } else {
            setIsClosing(true);
            const timer = setTimeout(() => {
                setIsRendered(false);
                setIsClosing(false);
                document.body.style.overflow = 'unset';
            }, 300); // Match animation duration
            return () => clearTimeout(timer);
        }
    }, [isOpen]);

    const handleClose = () => {
        if (isLoading) return; // Prevent closing while loading
        onClose();
    };

    const handleConfirm = () => {
        if (isLoading) return;
        if (onConfirm) onConfirm();
    };

    if (!isRendered) return null;

    const variantStyles = {
        danger: {
            iconBg: 'bg-red-100 dark:bg-red-900/30',
            iconColor: 'text-red-600 dark:text-red-400',
            confirmBtn: 'bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 shadow-red-500/25',
            defaultIcon: <Trash2 size={32} />
        },
        warning: {
            iconBg: 'bg-amber-100 dark:bg-amber-900/30',
            iconColor: 'text-amber-600 dark:text-amber-400',
            confirmBtn: 'bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 shadow-amber-500/25',
            defaultIcon: <AlertTriangle size={32} />
        },
        info: {
            iconBg: 'bg-blue-100 dark:bg-blue-900/30',
            iconColor: 'text-blue-600 dark:text-blue-400',
            confirmBtn: 'bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 shadow-blue-500/25',
            defaultIcon: <Info size={32} />
        },
        success: {
            iconBg: 'bg-emerald-100 dark:bg-emerald-900/30',
            iconColor: 'text-emerald-600 dark:text-emerald-400',
            confirmBtn: 'bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 shadow-emerald-500/25',
            defaultIcon: <CheckCircle2 size={32} />
        }
    };

    const styles = variantStyles[variant];

    return (
        <div
            className={`fixed inset-0 z-[1000] flex items-center justify-center p-4 sm:p-6 transition-all duration-300
        ${isOpen && !isClosing ? 'opacity-100' : 'opacity-0'}`}
        >
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-navy-950/60 backdrop-blur-sm transition-opacity duration-300"
                onClick={handleClose}
            />

            {/* Dialog Container */}
            <div
                className={`relative w-full max-w-sm sm:max-w-md bg-white dark:bg-navy-900 rounded-[2rem] shadow-2xl 
                shadow-black/20 dark:shadow-black/50 border border-white/50 dark:border-navy-700/50
                transform transition-all duration-300 overflow-hidden
                ${isOpen && !isClosing ? 'scale-100 translate-y-0 opacity-100' : 'scale-95 translate-y-4 opacity-0'}`}
            >
                {/* Decorative gradients */}
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-gold-400/50 to-transparent opacity-50" />
                <div className="absolute -top-10 -right-10 w-32 h-32 bg-gradient-to-br from-gold-400/10 to-amber-300/10 rounded-full blur-2xl" />
                <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-gradient-to-tr from-blue-400/10 to-indigo-300/10 rounded-full blur-2xl" />

                {/* Close Button */}
                {!isLoading && !hideCancel && (
                    <button
                        onClick={handleClose}
                        className="absolute top-4 left-4 p-2 rounded-full bg-stone-50 dark:bg-navy-800/50 
                        hover:bg-stone-100 dark:hover:bg-navy-800 transition-colors z-10"
                    >
                        <X size={18} className="text-stone-400 dark:text-stone-500" />
                    </button>
                )}

                {/* Content Content inside scroll view for landscape safety */}
                <div className="max-h-[85vh] overflow-y-auto custom-scrollbar">
                    <div className="p-6 pt-10 sm:p-8 flex flex-col items-center text-center relative z-10">
                        {/* Icon */}
                        <div className={`w-20 h-20 mb-6 rounded-[1.5rem] ${styles.iconBg} flex items-center justify-center shadow-inner relative group`}>
                            <div className="absolute inset-0 rounded-[1.5rem] bg-white/20 dark:bg-black/5 blur-sm" />
                            <span className={`${styles.iconColor} relative z-10 transform group-hover:scale-110 transition-transform duration-500`}>
                                {icon || styles.defaultIcon}
                            </span>
                        </div>

                        {/* Title */}
                        <h3 className="text-xl font-bold text-navy-900 dark:text-white mb-3 font-quran tracking-wide">
                            {title}
                        </h3>

                        {/* Message */}
                        <p className="text-sm sm:text-base text-navy-600 dark:text-navy-300 leading-relaxed max-w-[90%]">
                            {message}
                        </p>
                    </div>

                    {/* Actions */}
                    <div className="p-6 pt-2 pb-8 flex flex-col sm:flex-row gap-3 relative z-10">
                        {!hideCancel && (
                            <button
                                onClick={handleClose}
                                disabled={isLoading}
                                className="flex-1 py-3.5 px-6 rounded-xl font-bold text-sm
                                bg-stone-100 dark:bg-navy-800/80 text-navy-600 dark:text-navy-300
                                hover:bg-stone-200 dark:hover:bg-navy-800 border border-stone-200 dark:border-navy-700
                                transition-all duration-200 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {cancelText}
                            </button>
                        )}

                        <button
                            onClick={handleConfirm}
                            disabled={isLoading}
                            className={`flex-1 py-3.5 px-6 rounded-xl font-bold text-sm text-white
                            ${styles.confirmBtn} shadow-lg flex items-center justify-center gap-2
                            transition-all duration-200 active:scale-[0.98] disabled:opacity-80 disabled:cursor-not-allowed`}
                        >
                            {isLoading && <Loader2 size={16} className="animate-spin" />}
                            {confirmText}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
