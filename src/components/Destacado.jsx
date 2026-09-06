import React from 'react';

const Destacado = ({ destacado = [], liveDia, course }) => {
  // Find the highlight for today and this specific course
  const highlight = destacado.find(h => h.dia == liveDia && h.course?.includes(course));

  // If there's no highlight for today, hide the component
  if (!highlight) return null;

  // Auto-color logic based on location
  let pillColor = "#64748b"; // Default slate
  let textColor = "text-white";
  const loc = (highlight.location || "").toUpperCase();

  if (loc.includes("PUERTO RICO") || loc.includes("CUBA") || loc.includes("DOMINICANA")) {
    pillColor = "#3b82f6"; // Blue
  } else if (loc.includes("MÉXICO") || loc.includes("PANAMÁ") || loc.includes("COSTA RICA")) {
    pillColor = "#22c55e"; // Green
  } else if (loc.includes("ARGENTINA") || loc.includes("BOLIVIA") || loc.includes("CHILE") || loc.includes("COLOMBIA") || loc.includes("PERÚ")) {
    pillColor = "#ef4444"; // Red
  } else if (loc.includes("ESPAÑA")) {
    pillColor = "#eab308"; // Yellow
    textColor = "text-slate-900"; // Dark text for yellow bg
  }

  // A lighter version of the pill color for the border
  const borderColor = `${pillColor}66`;

  return (
    <article 
      className="bg-white rounded-xl shadow-sm border-8 overflow-hidden mb-6" 
      style={{ borderColor: borderColor }}
    >
      {highlight.image_url && (
        <img src={highlight.image_url} alt={highlight.location} className="w-full h-44 object-cover" />
      )}
      
      <div className="p-5">
        <span 
          className={`text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded ${textColor} mb-3 inline-block`} 
          style={{ backgroundColor: pillColor }}
        >
          {highlight.location}
        </span>
        
        <h3 className="font-black text-xs uppercase mb-2 text-slate-400">
          {highlight.header}
        </h3>
        
        <div className="space-y-2 mb-6">
          <p className="text-slate-800 font-bold text-sm leading-tight">{highlight.content.spanish}</p>
          <p className="text-slate-500 italic text-xs">{highlight.content.english}</p>
        </div>
        
        <div className="border-t-2 border-dashed border-slate-100 my-6 relative">
          <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-white px-3 text-[10px] font-black text-slate-300 uppercase tracking-widest">
            Palabra del Día
          </span>
        </div>
        
        <div className="text-center">
          <h4 className="text-2xl font-black text-slate-900 lowercase">{highlight.word_of_the_day.word}</h4>
          <p className="text-slate-400 text-[10px] font-black uppercase mb-3">{highlight.word_of_the_day.translation}</p>
          
          <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 text-left">
            <p className="text-sm text-slate-700 font-medium italic">"{highlight.word_of_the_day.sample_sentence}"</p>
            <p className="text-[10px] text-slate-400 mt-1">{highlight.word_of_the_day.sentence_translation}</p>
          </div>
        </div>
      </div>
    </article>
  );
};

export default Destacado;