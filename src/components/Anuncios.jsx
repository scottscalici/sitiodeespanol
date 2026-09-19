import React from 'react';

const Anuncios = ({ anuncios = [], cal = [], liveDia, course }) => {
  // 1. Find the actual date string (YYYY-MM-DD) for the current liveDia
  const currentEntry = cal.find(c => c.dia == liveDia);
  const currentDateStr = currentEntry ? currentEntry.fecha : new Date().toLocaleDateString('en-CA');

  // 2. Filter the announcements based on course and date
  const activeAnuncios = anuncios.filter(note => {
    const isDateValid = currentDateStr >= note.start_date && currentDateStr <= note.end_date;
    const isCourseValid = note.courses && note.courses.includes(course);
    return isDateValid && isCourseValid;
  });

  // If there are no announcements for today, the component stays completely hidden
  if (activeAnuncios.length === 0) return null;

  return (
    <div className="space-y-4">
      {activeAnuncios.map((note, idx) => {
        // Default styling (Blue / Anuncio)
        let gradientClass = "from-indigo-600 via-blue-700 to-slate-900";
        let pillTextClass = "text-indigo-200";
        let ctaHoverTextClass = "group-hover:text-indigo-700";
        let icon = "📢";
        let titleText = "Anuncio";

        // Override styling if it's a warning or trip
        if (note.type === 'warning') {
          gradientClass = "from-red-600 via-rose-700 to-slate-900";
          pillTextClass = "text-red-200";
          ctaHoverTextClass = "group-hover:text-red-700";
          icon = "⚠️";
          titleText = "Importante";
        } else if (note.type === 'trip') {
          gradientClass = "from-emerald-600 via-teal-700 to-slate-900";
          pillTextClass = "text-emerald-200";
          ctaHoverTextClass = "group-hover:text-emerald-700";
          icon = "✈️";
          titleText = "Viaje";
        }

        return (
          <div key={idx} className={`group relative overflow-hidden rounded-2xl bg-gradient-to-br ${gradientClass} shadow-xl flex items-stretch`}>
            <div className="absolute -top-8 -right-8 w-32 h-32 bg-white/10 rounded-full blur-2xl pointer-events-none"></div>

            {/* Image Column — stretches to the card's full height */}
            <div className="w-28 sm:w-40 shrink-0 bg-white/10">
              {note.thumbnail ? (
                <img src={note.thumbnail} alt="thumbnail" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <span className="text-4xl drop-shadow">{icon}</span>
                </div>
              )}
            </div>

            <div className="min-w-0 flex-1 p-6 flex flex-col justify-between gap-4">
              <div>
                <span className={`block text-xs font-black uppercase tracking-widest mb-1 ${pillTextClass}`}>
                  {titleText}
                </span>
                <p className="text-white font-bold text-base leading-snug">
                  {note.text}
                </p>
              </div>

              {note.link && (
                <div className="flex justify-end">
                  <a
                    href={note.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`bg-white/15 group-hover:bg-white text-white ${ctaHoverTextClass} font-black text-sm px-6 py-2.5 rounded-lg text-center uppercase tracking-wider transition-colors shadow-sm inline-flex items-center gap-2`}
                  >
                    Ver Detalles <span>↗</span>
                  </a>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default Anuncios;