import React, { useState, useMemo } from 'react';
import { Search, MapPin, X, AlertCircle } from 'lucide-react';
import { LocationManager, POPULAR_CITIES, CityData } from '../services/LocationManager';

interface CitySearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCitySelected: () => void;
}

export const CitySearchModal: React.FC<CitySearchModalProps> = ({ isOpen, onClose, onCitySelected }) => {
  const [searchQuery, setSearchQuery] = useState('');

  // Filter cities based on search query
  const filteredCities = useMemo(() => {
    if (!searchQuery.trim()) {
      return POPULAR_CITIES.slice(0, 30); // Show top 30 initially
    }
    const query = searchQuery.toLowerCase().trim();
    return POPULAR_CITIES.filter(city => 
      city.nameAr.toLowerCase().includes(query) || 
      city.name.toLowerCase().includes(query) ||
      city.countryAr.toLowerCase().includes(query)
    ).slice(0, 50); // Limit results for performance
  }, [searchQuery]);

  const handleCitySelect = (city: CityData) => {
    LocationManager.setManualLocation(city);
    onCitySelected();
    onClose();
  };

  const handleClearManual = () => {
    LocationManager.clearManualLocation();
    onCitySelected();
    onClose();
  };

  if (!isOpen) return null;

  const hasManualLocation = LocationManager.hasManualLocation();

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-navy-950/60 dark:bg-black/80 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      ></div>

      {/* Modal */}
      <div className="bg-white dark:bg-navy-900 w-full max-w-lg rounded-3xl shadow-2xl relative flex flex-col max-h-[85vh] overflow-hidden border border-stone-200 dark:border-navy-700 animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="px-6 py-5 border-b border-stone-100 dark:border-navy-800 flex justify-between items-center bg-stone-50/50 dark:bg-navy-800/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gold-100 dark:bg-gold-900/30 flex items-center justify-center">
              <MapPin className="text-gold-600 dark:text-gold-400" size={20} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-navy-900 dark:text-white">البحث عن مدينتك</h2>
              <p className="text-xs text-stone-500 dark:text-navy-400 mt-0.5">احصل على أدق مواقيت للصلاة</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-stone-200 dark:hover:bg-navy-700 rounded-full transition-colors text-stone-500 dark:text-navy-400"
          >
            <X size={20} />
          </button>
        </div>

        {/* Search Bar */}
        <div className="p-4 border-b border-stone-100 dark:border-navy-800">
          <div className="relative">
            <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-stone-400 dark:text-navy-500" size={18} />
            <input 
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ابحث عن اسم مدينتك أو محافظتك..."
              className="w-full pl-4 pr-12 py-3.5 bg-stone-100 dark:bg-navy-950 border-transparent focus:border-gold-500 focus:bg-white dark:focus:bg-navy-900 rounded-xl text-navy-900 dark:text-white outline-none transition-all shadow-sm focus:shadow-md"
              autoFocus
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 dark:hover:text-stone-300"
              >
                <X size={16} />
              </button>
            )}
          </div>
        </div>

        {/* Results */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-2">
          {filteredCities.length > 0 ? (
            <div className="space-y-1">
              {hasManualLocation && !searchQuery && (
                <div className="mb-4 px-2">
                  <button 
                    onClick={handleClearManual}
                    className="w-full flex items-center justify-center gap-2 p-3 text-sm font-bold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/40 rounded-xl transition-colors border border-red-100 dark:border-red-900/30"
                  >
                    <AlertCircle size={16} />
                    <span>إلغاء التحديد اليدوي (العودة للبحث التلقائي)</span>
                  </button>
                </div>
              )}

              {filteredCities.map((city, idx) => (
                <button
                  key={`${city.name}-${idx}`}
                  onClick={() => handleCitySelect(city)}
                  className="w-full flex items-center justify-between p-4 hover:bg-stone-50 dark:hover:bg-navy-800/50 rounded-xl transition-colors group text-right"
                >
                  <div className="flex flex-col">
                    <span className="font-bold text-stone-800 dark:text-stone-200 group-hover:text-gold-600 dark:group-hover:text-gold-400 transition-colors">
                      {city.nameAr}
                    </span>
                    <span className="text-xs text-stone-500 dark:text-navy-400 mt-1">
                      {city.countryAr}
                    </span>
                  </div>
                  <div className="w-8 h-8 rounded-full bg-stone-100 dark:bg-navy-800 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <MapPin size={14} className="text-gold-500" />
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="py-12 flex flex-col items-center justify-center text-center">
              <div className="w-16 h-16 bg-stone-100 dark:bg-navy-800 rounded-full flex items-center justify-center mb-4">
                <Search size={24} className="text-stone-400 dark:text-navy-500" />
              </div>
              <p className="font-bold text-stone-700 dark:text-stone-300">لم نتمكن من العثور على المدينة</p>
              <p className="text-sm text-stone-500 dark:text-navy-400 mt-1">تأكد من كتابة الاسم بشكل صحيح باللغة العربية</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
