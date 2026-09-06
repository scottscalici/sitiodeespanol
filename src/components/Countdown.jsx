import React, { useState, useEffect } from 'react';

const Countdown = ({ course }) => {
  // Only render for Seniors (s4)
  if (course !== 's4') return null;

  const [timeLeft, setTimeLeft] = useState({ days: '--', hrs: '--' });
  const targetDate = new Date("2026-05-13T12:05:00");

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
    <div className="bg-white rounded-xl p-6 shadow-sm border-t-8 border-slate-200 text-center">
      <h3 className="font-bold text-lg mb-2 text-slate-800 uppercase tracking-wide flex justify-center items-center gap-2">
        <span>⏳</span> Examen IB
      </h3>
      <div className="flex justify-center gap-6 text-slate-600 my-4">
        <div><span className="text-4xl font-black block text-indigo-600">{timeLeft.days}</span><span className="text-xs font-bold uppercase tracking-widest text-slate-400">Días</span></div>
        <div><span className="text-4xl font-black block text-indigo-600">{timeLeft.hrs}</span><span className="text-xs font-bold uppercase tracking-widest text-slate-400">Hrs</span></div>
      </div>
      <p className="text-[10px] uppercase font-bold text-slate-400">13 DE MAYO</p>
    </div>
  );
};

export default Countdown;