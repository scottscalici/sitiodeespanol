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
        // Default styling (Indigo / Anuncio)
        let accentColor = 'border-indigo-500';
        let labelColor = 'text-indigo-600';
        let icon = '📢';
        let titleText = 'Anuncio';

        // Override styling if it's a warning or trip
        if (note.type === 'warning') {
          accentColor = 'border-red-500';
          labelColor = 'text-red-600';
          icon = '⚠️';
          titleText = 'Importante';
        } else if (note.type === 'trip') {
          accentColor = 'border-emerald-500';
          labelColor = 'text-emerald-600';
          icon = '✈️';
          titleText = 'Viaje';
        }

        return (
          <div
            key={idx}
            className={`bg-white border border-slate-200 ${accentColor} border-l-[6px] rounded-2xl shadow-sm p-5 flex items-start gap-4 transition-all hover:shadow-md hover:-translate-y-0.5`}
          >
            <div className="shrink-0">
              {note.thumbnail ? (
                <img
                  src={note.thumbnail}
                  alt=""
                  className="w-16 h-16 object-cover rounded-xl border border-slate-200 shadow-sm bg-slate-50"
                />
              ) : (
                <div className="w-16 h-16 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-center text-2xl">
                  {icon}
                </div>
              )}
            </div>

            <div className="flex-1 min-w-0">
              <h4 className={`font-black text-[10px] uppercase tracking-widest ${labelColor}`}>
                {icon} {titleText}
              </h4>
              <p className="text-slate-800 font-bold text-sm leading-snug mt-1 mb-3">
                {note.text}
              </p>

              {note.link && (
                <a
                  href={note.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 bg-slate-900 hover:bg-slate-700 text-white font-black text-[11px] px-4 py-2 rounded-lg uppercase tracking-wider transition-colors shadow-sm"
                >
                  Ver Detalles →
                </a>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default Anuncios;
