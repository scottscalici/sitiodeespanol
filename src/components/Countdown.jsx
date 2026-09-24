import React, { useState, useEffect } from 'react';
import { useActiveTheme } from '../context/ThemeContext';
import { getThemedCardStyle } from '../utils/getThemedCardStyle';

const Countdown = ({ course }) => {
  const { theme } = useActiveTheme() || {};
  // Only render for Seniors (s4)
  if (course !== 's4') return null;

  const themeStyle = getThemedCardStyle(
    theme?.styles?.cardOverrides?.countdown,
    theme?.styles?.accent,
    theme?.styles?.textures?.countdown
  );

  const [timeLeft, setTimeLeft] = useState({ days: '--', hrs: '--' });
  const targetDate = new Date("2027-03-08T07:20:00");

  useEffect(() => {
    const updateTimer = () => {
      const diff = targetDate - new Date();
      if (diff > 0) {
        setTimeLeft({
          days: Math.floor(diff / (1000 * 60 * 60 * 24)),
          hrs: Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
        });
      }
    };
    updateTimer();
    const interval = setInterval(updateTimer, 60000); // Update every minute
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-600 via-blue-700 to-slate-900 p-6 shadow-xl text-center" style={themeStyle}>
      <div className="absolute -top-10 -right-10 w-40 h-40 bg-indigo-400/20 rounded-full blur-3xl pointer-events-none"></div>

      <span className="inline-flex items-center gap-1.5 bg-white/10 text-indigo-200 text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full mb-5">
        <span>⏳</span> Evaluación interna
      </span>

      <div className="flex justify-center gap-3">
        <div className="bg-white/10 backdrop-blur-sm rounded-xl px-5 py-3 min-w-[76px] shadow-inner">
          <span className="text-4xl font-black block text-white tabular-nums">{timeLeft.days}</span>
          <span className="text-[9px] font-black uppercase tracking-widest text-indigo-200">Días</span>
        </div>
        <div className="bg-white/10 backdrop-blur-sm rounded-xl px-5 py-3 min-w-[76px] shadow-inner">
          <span className="text-4xl font-black block text-white tabular-nums">{timeLeft.hrs}</span>
          <span className="text-[9px] font-black uppercase tracking-widest text-indigo-200">Hrs</span>
        </div>
      </div>

      <p className="text-[10px] uppercase font-bold text-indigo-300 mt-4 tracking-widest">8 de Marzo</p>
    </div>
  );
};

export default Countdown;