import React from 'react';
import { Link } from 'react-router-dom';
import { useActiveTheme } from '../context/ThemeContext';
import { getThemedCardStyle } from '../utils/getThemedCardStyle';

// A small graded practice (Gustar, prepositional pronouns, etc.) — distinct
// from the ungated, always-visible Practice Hub tile: this one is assigned
// to a specific day/course, graded, and folds into the same running
// "Promedio Calentamientos" average as warm-ups (see warmupBreakdown.js).
export default function PracticeCard({ card }) {
  const { theme } = useActiveTheme() || {};
  const themeStyle = getThemedCardStyle(
    theme?.styles?.cardOverrides?.practicaCard,
    theme?.styles?.accent,
    theme?.styles?.textures?.practicaCard
  );

  if (!card) return null;

  return (
    <Link
      to={`/practica/tarjeta/${card.course}/${card.dia}`}
      className="group relative block overflow-hidden rounded-2xl bg-gradient-to-br from-violet-600 via-fuchsia-700 to-slate-900 p-6 shadow-xl transition-all hover:shadow-2xl hover:-translate-y-1"
      style={themeStyle}
    >
      <div className="absolute -bottom-8 -right-8 w-32 h-32 bg-white/10 rounded-full blur-2xl pointer-events-none"></div>

      <div className="flex items-center gap-4">
        <div className="w-16 h-16 shrink-0 rounded-2xl bg-white/15 backdrop-blur-sm flex items-center justify-center shadow-inner">
          <span className="text-3xl drop-shadow">✏️</span>
        </div>

        <div className="min-w-0 flex-1">
          <span className="block text-xs font-black uppercase tracking-widest text-violet-100 mb-1">Práctica · Día {card.dia}</span>
          <h3 className="text-2xl font-black text-white uppercase tracking-tighter truncate">{card.title}</h3>
          <p className="text-violet-50/80 text-sm font-medium mt-1 line-clamp-2">{card.questions?.length || 0} preguntas rápidas.</p>
        </div>
      </div>

      <div className="mt-5 flex justify-end">
        <span className="bg-white/15 group-hover:bg-white text-white group-hover:text-violet-700 font-black text-sm px-6 py-2.5 rounded-lg text-center uppercase tracking-wider transition-colors shadow-sm inline-flex items-center gap-2">
          Practicar <span>→</span>
        </span>
      </div>
    </Link>
  );
}
