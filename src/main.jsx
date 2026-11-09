import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';
import { polyfillCountryFlagEmojis } from 'country-flag-emoji-polyfill';
import flagFontUrl from 'country-flag-emoji-polyfill/dist/TwemojiCountryFlags.woff2?url';

// Windows (Chrome/Edge) has no flag emojis and shows 🇪🇸 as the letters "ES".
// This loads a flags-only font on those browsers (no-op everywhere else).
// The font is bundled with the site rather than pulled from a CDN so school
// web filters can't block it. The family name "Twemoji Country Flags" is
// listed first in every font stack in index.css and ThemeContext.jsx.
polyfillCountryFlagEmojis('Twemoji Country Flags', flagFontUrl);
import { AuthProvider } from './context/AuthContext'; // 👈 Import the provider

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AuthProvider>
      {' '}
      {/* 👈 Wrap your app */}
      <App />
    </AuthProvider>
  </React.StrictMode>
);
