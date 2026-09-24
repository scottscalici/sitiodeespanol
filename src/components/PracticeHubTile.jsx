import React from 'react';
import { Link } from 'react-router-dom';
import { useActiveTheme } from '../context/ThemeContext';

// Always-visible entry point to the ungated practice pool — unlike
// LearningPathTile, this never depends on what's currently assigned, so it
// renders unconditionally. `course` carries an admin's Dashboard toggle
// through to Practice Hub (same pattern as LearningPathTile) — a real
// student's own link never needs the param since Practice Hub falls back to
// their profile course on its own.
const PracticeHubTile = ({ course }) => {
  const { theme } = useActiveTheme() || {};
  const themeColor = theme?.styles?.cardOverrides?.practica;

  return (
    <Link
      to={`/practice-hub${course ? `?course=${course}` : ''}`}
      className="group block bg-slate-900 border-2 border-slate-800 rounded-2xl p-5 shadow-lg hover:shadow-teal-500/20 hover:border-teal-500 transition-all duration-300 relative overflow-hidden"
      style={themeColor ? { borderColor: themeColor } : undefined}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-teal-500/10 to-emerald-500/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>

      <div className="relative z-10">
        <div className="flex items-center justify-between mb-2">
          <h3
            className="font-black text-transparent bg-clip-text bg-gradient-to-r from-teal-400 to-emerald-400 uppercase tracking-widest text-xl"
            style={themeColor ? { backgroundImage: `linear-gradient(to right, ${themeColor}, ${theme?.styles?.accent || themeColor})` } : undefined}
          >
            Practice Hub
          </h3>
          <span className="text-2xl">🎯</span>
        </div>

        <p className="text-slate-300 text-sm font-bold uppercase tracking-wide mb-5">
          Práctica libre por capítulo o por evaluación
        </p>

        <div
          className="w-full bg-teal-600 text-white text-[11px] font-black uppercase tracking-[0.2em] py-3 rounded-xl text-center group-hover:bg-teal-500 transition-colors shadow-md"
          style={themeColor ? { backgroundColor: themeColor } : undefined}
        >
          Entrar a Practicar ↗
        </div>
      </div>
    </Link>
  );
};

export default PracticeHubTile;
