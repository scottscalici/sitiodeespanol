import React from 'react';
import { Link } from 'react-router-dom';

const GamesSidebar = () => {
  return (
    <div className="space-y-4">
      {/* 🎟️ THE PORTAL TO EL RECREO (Featuring Señordle) */}
      <Link 
        to="/recreo" 
        className="group block bg-slate-900 border-2 border-slate-800 rounded-2xl p-5 shadow-lg hover:shadow-indigo-500/20 hover:border-indigo-500 transition-all duration-300 relative overflow-hidden"
      >
        {/* Subtle background glow */}
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 to-fuchsia-500/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
        
        <div className="relative z-10">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-black text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-fuchsia-400 uppercase tracking-widest text-xl">
              El Recreo
            </h3>
            {/* The pulsing badge */}
            <span className="bg-red-500 text-white text-[9px] font-black px-2 py-1 rounded uppercase animate-pulse shadow-[0_0_10px_rgba(239,68,68,0.5)]">
              Abierto
            </span>
          </div>
          
          <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mb-5">
            Señordle, Eslabones y más...
          </p>

          {/* 🔡 THE BELOVED TILE VISUAL (Teasing Señordle) */}
          <div className="flex gap-1.5 justify-center mb-6">
            {['S', 'E', 'Ñ', 'O', 'R'].map((letter, i) => (
              <div 
                key={i} 
                className={`w-9 h-9 flex items-center justify-center rounded-md border-2 font-black text-lg transition-transform group-hover:-translate-y-1 group-hover:shadow-lg
                  ${i === 0 ? 'bg-emerald-500 border-emerald-400 text-white shadow-[0_0_10px_rgba(16,185,129,0.3)]' : 
                    i === 2 ? 'bg-amber-400 border-amber-300 text-white shadow-[0_0_10px_rgba(251,191,36,0.3)]' : 
                    'bg-slate-800 border-slate-600 text-slate-300'}`}              
                style={{ transitionDelay: `${i * 50}ms` }}
              >
                {letter}
              </div>
            ))}
          </div>

          {/* Action Button */}
          <div className="w-full bg-indigo-600 text-white text-[11px] font-black uppercase tracking-[0.2em] py-3 rounded-xl text-center group-hover:bg-indigo-500 transition-colors shadow-md">
            Entrar al Arcade ↗
          </div>
        </div>
      </Link>
    </div>
  );
};

export default GamesSidebar;