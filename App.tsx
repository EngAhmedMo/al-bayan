
import React, { Suspense, useEffect, useRef } from 'react';
import { HashRouter, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Home } from './pages/Home'; // Home is loaded instantly
import { FirebaseService } from './services/firebase'; // Updated Service
import { runBackgroundCheckup, tryScheduleWithSafetyCheck, scheduleAllNotifications } from './services/notificationManager';
import { App as CapApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { HifzProvider } from './contexts/HifzContext';
import { DownloadProvider } from './contexts/DownloadContext';

// Lazy Load other pages to reduce bundle size
const QuranReader = React.lazy(() => import('./pages/QuranReader').then(m => ({ default: m.QuranReader })));
const Search = React.lazy(() => import('./pages/Search').then(m => ({ default: m.Search })));
const Hifz = React.lazy(() => import('./pages/Hifz').then(m => ({ default: m.Hifz })));
const Tasbih = React.lazy(() => import('./pages/Tasbih').then(m => ({ default: m.Tasbih })));
const HadithPage = React.lazy(() => import('./pages/Hadith').then(m => ({ default: m.HadithPage })));
const Adhkar = React.lazy(() => import('./pages/Adhkar').then(m => ({ default: m.Adhkar })));
const Events = React.lazy(() => import('./pages/Events').then(m => ({ default: m.Events })));
const Bookmarks = React.lazy(() => import('./pages/Bookmarks').then(m => ({ default: m.Bookmarks })));
const Notifications = React.lazy(() => import('./pages/Notifications').then(m => ({ default: m.Notifications })));
const NotificationSettings = React.lazy(() => import('./pages/NotificationSettings').then(m => ({ default: m.NotificationSettingsPage })));
const Downloads = React.lazy(() => import('./pages/Downloads').then(m => ({ default: m.Downloads })));
const About = React.lazy(() => import('./pages/About').then(m => ({ default: m.About })));
const Radio = React.lazy(() => import('./pages/Radio').then(m => ({ default: m.Radio })));
const HajjUmrah = React.lazy(() => import('./pages/HajjUmrah').then(m => ({ default: m.HajjUmrah })));
const TafsirLibrary = React.lazy(() => import('./pages/TafsirLibrary').then(m => ({ default: m.TafsirLibrary })));
const TafsirReader = React.lazy(() => import('./pages/TafsirReader').then(m => ({ default: m.TafsirReader })));
const AzhanDiagnostics = React.lazy(() => import('./pages/AzhanDiagnostics').then(m => ({ default: m.AzhanDiagnostics })));
const QuranQuiz = React.lazy(() => import('./pages/QuranQuiz').then(m => ({ default: m.QuranQuiz })));

// Loading Component
const LoadingSpinner = () => (
  <div className="flex flex-col items-center justify-center h-full w-full bg-gold-50 dark:bg-navy-950">
    <div className="w-12 h-12 border-4 border-gold-200 border-t-gold-500 rounded-full animate-spin"></div>
    <p className="mt-4 text-sm font-bold text-navy-500 dark:text-navy-300">جاري التحميل...</p>
  </div>
);

// Component to track route changes and handle back button
const RouteTracker = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const lastBackPress = useRef<number>(0);

  useEffect(() => {
    const pageName = location.pathname === '/' ? 'Home' : location.pathname.substring(1);
    FirebaseService.logScreen(pageName);
  }, [location]);

  // Handle Android back button
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    let listenerHandle: { remove: () => void } | null = null;

    const setupListener = async () => {
      listenerHandle = await CapApp.addListener('backButton', ({ canGoBack }) => {
        const isHome = location.pathname === '/' || location.pathname === '';

        if (isHome) {
          // Double tap to exit logic
          const now = Date.now();
          if (now - lastBackPress.current < 2000) {
            // Second press within 2 seconds - exit app
            CapApp.exitApp();
          } else {
            // First press - record timestamp
            lastBackPress.current = now;
          }
        } else if (canGoBack) {
          // Not on home - navigate back
          navigate(-1);
        } else {
          // No history - go to home
          navigate('/');
        }
      });
    };

    setupListener();

    return () => {
      listenerHandle?.remove();
    };
  }, [location.pathname, navigate]);

  return null;
};

const App: React.FC = () => {

  useEffect(() => {
    // Initialize Firebase (Analytics, Crashlytics, Remote Config)
    FirebaseService.init();

    // Initialize persistent logger
    import('./services/LoggerService').then(({ LoggerService }) => LoggerService.init());

    // Run background permission checks (Notifications, Exact Alarm, Battery)
    runBackgroundCheckup();

    // 🧠 SMART RESCHEDULE: Check if we need to renew alarms
    tryScheduleWithSafetyCheck();

    // Listen for notification taps (Deep Linking)
    const handleNotificationTap = (event: Event) => {
      const customEvent = event as CustomEvent;
      if (customEvent.detail && customEvent.detail.deepLink) {
        // Use window.location.hash for HashRouter if outside React context, 
        // but since we are inside App (but outside Router context in this useEffect?), wait...
        // Routes is below. We need 'navigate' hook. But App is the parent.
        // We can dispatch a navigation event or use a ref if RouteTracker was uplifted.
        // Easiest: Dispatch to window location hash since we use HashRouter
        window.location.hash = customEvent.detail.deepLink;
      }
    };

    window.addEventListener('notification-tap', handleNotificationTap);

    // Listen for Hifz settings changes to reschedule reminders
    const handleHifzChange = () => {
      console.log('[App] Hifz settings changed, rescheduling notifications...');
      scheduleAllNotifications();
    };
    window.addEventListener('hifz-settings-changed', handleHifzChange);

    return () => {
      window.removeEventListener('notification-tap', handleNotificationTap);
      window.removeEventListener('hifz-settings-changed', handleHifzChange);
    };
  }, []);

  return (
    <HifzProvider>
      <DownloadProvider>
        <HashRouter>
          <RouteTracker />
          <Routes>
            <Route path="/" element={<Layout />}>
              <Route index element={<Home />} />
              <Route path="reader" element={
                <Suspense fallback={<LoadingSpinner />}>
                  <QuranReader />
                </Suspense>
              } />
              <Route path="search" element={
                <Suspense fallback={<LoadingSpinner />}>
                  <Search />
                </Suspense>
              } />
              <Route path="downloads" element={
                <Suspense fallback={<LoadingSpinner />}>
                  <Downloads />
                </Suspense>
              } />
              <Route path="hifz" element={
                <Suspense fallback={<LoadingSpinner />}>
                  <Hifz />
                </Suspense>
              } />
              <Route path="quiz" element={
                <Suspense fallback={<LoadingSpinner />}>
                  <QuranQuiz />
                </Suspense>
              } />
              <Route path="tasbih" element={
                <Suspense fallback={<LoadingSpinner />}>
                  <Tasbih />
                </Suspense>
              } />
              <Route path="hadith" element={
                <Suspense fallback={<LoadingSpinner />}>
                  <HadithPage />
                </Suspense>
              } />
              <Route path="radio" element={
                <Suspense fallback={<LoadingSpinner />}>
                  <Radio />
                </Suspense>
              } />
              <Route path="adhkar" element={
                <Suspense fallback={<LoadingSpinner />}>
                  <Adhkar />
                </Suspense>
              } />
              <Route path="events" element={
                <Suspense fallback={<LoadingSpinner />}>
                  <Events />
                </Suspense>
              } />
              <Route path="bookmarks" element={
                <Suspense fallback={<LoadingSpinner />}>
                  <Bookmarks />
                </Suspense>
              } />
              <Route path="notifications" element={
                <Suspense fallback={<LoadingSpinner />}>
                  <Notifications />
                </Suspense>
              } />
              <Route path="notification-settings" element={
                <Suspense fallback={<LoadingSpinner />}>
                  <NotificationSettings />
                </Suspense>
              } />
              <Route path="azhan-diagnostics" element={
                <Suspense fallback={<LoadingSpinner />}>
                  <AzhanDiagnostics />
                </Suspense>
              } />
              <Route path="hajj-umrah" element={
                <Suspense fallback={<LoadingSpinner />}>
                  <HajjUmrah />
                </Suspense>
              } />
              <Route path="about" element={
                <Suspense fallback={<LoadingSpinner />}>
                  <About />
                </Suspense>
              } />
              {/* Tafsir Library Routes */}
              <Route path="tafsir" element={
                <Suspense fallback={<LoadingSpinner />}>
                  <TafsirLibrary />
                </Suspense>
              } />
              <Route path="tafsir/:slug" element={
                <Suspense fallback={<LoadingSpinner />}>
                  <TafsirReader />
                </Suspense>
              } />
              {/* Ensure any unknown path redirects to Home */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </HashRouter>
      </DownloadProvider>
    </HifzProvider>
  );
};

export default App;
