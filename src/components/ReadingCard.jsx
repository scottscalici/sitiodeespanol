import React from 'react';
import { Link } from 'react-router-dom';
import { useActiveTheme } from '../context/ThemeContext';
import { resolveCardTheme } from '../utils/resolveCardTheme';
import { CardCornerDecoration, CardOverlay } from './CardDecorations';
import { isImageUrl } from '../utils/isImageUrl';

// A reading card assigned to a specific day/course — same tile pattern as
// PracticeCard.jsx, linking into ReadingCardEngine's course+día route.
export default function ReadingCard({ card }) {
  const { theme } = useActiveTheme() || {};
  const cardTheme = resolveCardTheme(theme, 'readingCard');

  if (!card) return null;

  return (
    <Link
      to={`/lectura/tarjeta/${card.course}/${card.dia}`}
      className="group relative block overflow-hidden rounded-2xl bg-gradient-to-br from-cyan-600 via-sky-700 to-slate-900 p-6 shadow-xl transition-all hover:shadow-2xl hover:-translate-y-1"
      style={cardTheme.style}
    >
      <CardOverlay overlay={cardTheme.overlay} />
      <CardCornerDecoration decoration={cardTheme.cornerDecoration} />
      <div className="absolute -bottom-8 -right-8 w-32 h-32 bg-white/10 rounded-full blur-2xl pointer-events-none"></div>

      <div className="flex items-center gap-4">
        <div className="w-16 h-16 shrink-0 rounded-2xl bg-white/15 backdrop-blur-sm flex items-center justify-center shadow-inner overflow-hidden">
          {isImageUrl(theme?.styles?.imageOverrides?.readingCard) ? (
            <img src={theme.styles.imageOverrides.readingCard} alt="" className="w-full h-full object-cover" />
          ) : (
            <span className="text-3xl drop-shadow">{theme?.styles?.imageOverrides?.readingCard || '📖'}</span>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <span className="block text-xs font-black uppercase tracking-widest text-cyan-100 mb-1">Lectura · Día {card.dia}</span>
          <h3 className="text-2xl font-black text-white uppercase tracking-tighter truncate" style={{ color: cardTheme.headingColor }}>{card.title}</h3>
          <p className="text-cyan-50/80 text-sm font-medium mt-1 line-clamp-2" style={{ color: cardTheme.textColor }}>{card.questions?.length || 0} preguntas de comprensión.</p>
        </div>
      </div>

      <div className="mt-5 flex justify-end">
        <span className="bg-white/15 group-hover:bg-white text-white group-hover:text-cyan-700 font-black text-sm px-6 py-2.5 rounded-lg text-center uppercase tracking-wider transition-colors shadow-sm inline-flex items-center gap-2">
          Leer <span>→</span>
        </span>
      </div>
    </Link>
  );
}
