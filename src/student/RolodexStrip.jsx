import React from 'react';
import { Link } from 'react-router-dom';

// A horizontally-scrolling, snap-to-card strip of notes — "flip through" a
// category's notes instead of reading a vertical table of contents. Shared
// between GrammarNoteViewer's landing-note view and GrammarCategoryPage's
// fallback (a category with no landing note yet).
//
// `cards`: [{ id, title, exists, videoCount }] — `exists: false` renders a
// disabled "Próximamente" card for a forward reference that isn't built yet,
// matching how the `link` block handles the same situation.
export default function RolodexStrip({ cards }) {
  if (!cards || cards.length === 0) {
    return <p className="text-sm text-slate-400 italic">Todavía no hay notas aquí.</p>;
  }

  return (
    <div className="flex gap-4 overflow-x-auto snap-x snap-mandatory pb-4 -mx-1 px-1">
      {cards.map((card) => {
        const inner = (
          <div
            className={`shrink-0 snap-start w-48 h-32 rounded-2xl border-2 p-4 flex flex-col justify-between transition-transform ${
              card.exists
                ? 'bg-white border-slate-200 hover:border-indigo-400 hover:-translate-y-1 cursor-pointer shadow-sm'
                : 'bg-slate-50 border-dashed border-slate-200'
            }`}
          >
            <span className={`font-black leading-tight line-clamp-3 ${card.exists ? 'text-slate-800' : 'text-slate-400'}`}>
              {card.title}
            </span>
            <div className="flex items-center justify-between gap-1">
              {card.videoCount > 0 && (
                <span className="text-[10px] font-black uppercase tracking-widest text-indigo-600 bg-indigo-50 px-2 py-1 rounded-full">
                  🎥 {card.videoCount}
                </span>
              )}
              {!card.exists && (
                <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 bg-slate-100 px-2 py-1 rounded-full ml-auto">
                  Próximamente
                </span>
              )}
            </div>
          </div>
        );
        return card.exists ? (
          <Link key={card.id} to={`/gramatica/${encodeURIComponent(card.id)}`}>
            {inner}
          </Link>
        ) : (
          <div key={card.id}>{inner}</div>
        );
      })}
    </div>
  );
}
