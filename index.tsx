import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// ==========================================
// VIEWPORT HEIGHT FIX (Mobile/Tablet/WebView)
// 100vh on mobile doesn't account for browser chrome
// This calculates real viewport and sets CSS variable
// ==========================================
const setViewportHeight = () => {
  const vh = window.innerHeight * 0.01;
  document.documentElement.style.setProperty('--app-vh', `${vh}px`);
};

// Set on load
setViewportHeight();

// Update on resize and orientation change
window.addEventListener('resize', setViewportHeight);
window.addEventListener('orientationchange', () => {
  // Delay for orientation animation to complete
  setTimeout(setViewportHeight, 100);
});

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);