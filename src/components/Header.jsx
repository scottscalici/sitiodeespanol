import React from 'react';
import { signOut } from 'firebase/auth';
import { auth } from '../firebase';

const Header = ({ liveDia, setLiveDia, maxAllowedDay, course, cal = [], isAdmin, onToggleCourse }) => {
  const badgeText = course === 's2' ? 'ESPAÑOL II' : 'IB ESPAÑOL';

  const formatSpanishDate = (dateStr) => {
    if (!dateStr) return '';
    return new Date(dateStr + 'T00:00:00')
      .toLocaleDateString('es-ES', {
        day: 'numeric',
        month: 'long',
      })
      .toUpperCase();
  };

  let displayDate = 'FECHA TBD';

  const entryA = cal.find((c) => c.dia == liveDia && c.ciclo === 'A');
  const entryB = cal.find((c) => c.dia == liveDia && c.ciclo === 'B');

  if (entryA && entryB) {
    displayDate = `${formatSpanishDate(entryA.fecha)} / ${formatSpanishDate(
      entryB.fecha
    )}`;
  } else if (entryA) {
    displayDate = formatSpanishDate(entryA.fecha);
  } else if (entryB) {
    displayDate = formatSpanishDate(entryB.fecha);
  } else {
    const anyEntry = cal.find((c) => c.dia == liveDia);
    if (anyEntry) displayDate = formatSpanishDate(anyEntry.fecha);
  }

  return (
    <header className="bg-gradient-to-r from-[#0f172a] via-[#1e3a8a] to-[#b91c1c] rounded-xl p-8 text-white flex justify-between items-center shadow-lg">
      <div className="flex flex-col gap-1">
        <h1
          className="text-5xl font-black tracking-tight uppercase"
          style={{ textShadow: '2px 2px 4px rgba(0,0,0,0.3)' }}
        >
          Día {liveDia}
        </h1>
        <p className="text-sm opacity-90 tracking-widest font-bold uppercase">
          {displayDate}
        </p>
      </div>

      <div className="hidden sm:flex flex-col items-end gap-3">
        
        {/* DAY SELECTOR WITH ADMIN OVERRIDE LOGIC */}
        <div className="flex items-center gap-3 bg-white/10 border border-white/20 shadow-sm px-4 py-1.5 rounded-xl backdrop-blur-sm">
          <label className="text-[10px] font-black uppercase tracking-wider text-slate-200">
            Ir al Día:
          </label>
          <input
            type="number"
            min="1"
            max={isAdmin ? undefined : maxAllowedDay} 
            value={liveDia}
            onChange={(e) => {
              const val = parseInt(e.target.value);
              if (!val) return;
              
              // 🛡️ Security Check: Prevent students from manually typing a future day
              if (!isAdmin && val > maxAllowedDay) {
                setLiveDia(maxAllowedDay); 
              } else {
                setLiveDia(val);
              }
            }}
            className="w-14 bg-black/30 text-white border border-white/30 rounded-md px-1 py-1 font-bold text-center outline-none focus:ring-2 focus:ring-sky-400 transition-all"
          />
        </div>

        <div className="flex items-center gap-4 mt-1">
          <span
            onClick={isAdmin ? onToggleCourse : undefined}
            title={isAdmin ? 'Cambiar de nivel' : ''}
            className={`text-[10px] font-black uppercase tracking-widest bg-white/20 px-4 py-1.5 rounded-full shadow-sm select-none ${
              isAdmin
                ? 'cursor-pointer hover:bg-white/30 hover:scale-105 active:scale-95 transition-all ring-1 ring-white/50'
                : ''
            }`}
          >
            {badgeText} {isAdmin && ' 🔄'}
          </span>

          <button
            onClick={() => signOut(auth)}
            className="text-[10px] font-bold uppercase tracking-widest opacity-60 hover:opacity-100 transition-opacity"
          >
            Cerrar Sesión ↗
          </button>
        </div>

      </div>
    </header>
  );
};

export default Header;