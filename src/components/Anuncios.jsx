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
        let containerClass = "bg-white border-indigo-500 border-l-[6px]";
        let titleColor = "text-indigo-600";
        let icon = "📢";
        let titleText = "Anuncio";

        // Override styling if it's a warning or trip
        if (note.type === 'warning') {
          containerClass = "bg-red-50 border-red-500 border-l-[6px]";
          titleColor = "text-red-700";
          icon = "⚠️";
          titleText = "Importante";
        } else if (note.type === 'trip') {
          containerClass = "bg-emerald-50 border-emerald-500 border-l-[6px]";
          titleColor = "text-emerald-700";
          icon = "✈️";
          titleText = "Viaje";
        }

        return (
          <div key={idx} className={`${containerClass} p-4 rounded-xl shadow-sm flex flex-col sm:flex-row items-start gap-4 transition-transform hover:scale-[1.01]`}>
            <div className="flex-shrink-0">
              {note.thumbnail ? (
                <img src={note.thumbnail} alt="thumbnail" className="w-32 h-32 object-cover rounded-lg border border-slate-200 shadow-sm" />
              ) : (
                <div className="text-3xl">{icon}</div>
              )}
            </div>
            
            <div className="flex-grow">
              <h4 className={`font-bold text-[10px] uppercase tracking-widest mb-1 opacity-80 ${titleColor}`}>
                {titleText}
              </h4>
              <p className="text-slate-800 font-bold text-sm leading-snug mb-2">
                {note.text}
              </p>
              
              {note.link && (
                <a href={note.link} target="_blank" rel="noopener noreferrer" className={`inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-wider bg-white/50 border hover:bg-white px-3 py-1.5 rounded transition-colors ${titleColor}`}>
                  <span>Ver Detalles</span> ↗
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