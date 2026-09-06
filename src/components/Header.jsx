import React from 'react';
import { signOut } from 'firebase/auth';
import { auth } from '../firebase';

// Add isAdmin and onToggleCourse to the props
const Header = ({ liveDia, course, cal = [], isAdmin, onToggleCourse }) => {
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
        {/* The Badge is now clickable for Admins */}
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
          className="text-[10px] font-bold uppercase tracking-widest opacity-50 hover:opacity-100 transition-opacity"
        >
          Cerrar Sesión ↗
        </button>
      </div>
    </header>
  );
};

export default Header;
