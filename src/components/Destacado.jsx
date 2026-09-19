import React from 'react';

const Destacado = ({ destacado = [] }) => {
  if (!destacado || destacado.length === 0) return null;

  return (
    <div className="space-y-8">
      {destacado.map((item, idx) => {
        // Auto-color logic based on location
        let pillColor = "#64748b"; // Default slate
        let textColor = "text-white";
        const loc = (item.location || item.tag || "").toUpperCase();

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

        // Safe data extraction (handles different Firebase naming conventions)
        const spanishText = item.content?.spanish || item.body_es;
        const englishText = item.content?.english || item.body_en;
        const wordObj = item.word_of_the_day || {};
        const wordEs = wordObj.word || item.word;

        return (
          <article 
            key={item.id || idx}
            className="bg-white rounded-2xl shadow-sm border-[6px] overflow-hidden" 
            style={{ borderColor: borderColor }}
          >
            {/* Main Cover Image */}
            {(item.image_url || item.img || item.imagen) && (
              <div className="w-full h-40 sm:h-48 overflow-hidden bg-slate-100">
                <img 
                  src={item.image_url || item.img || item.imagen} 
                  alt={loc} 
                  className="w-full h-full object-cover transition-transform duration-700 hover:scale-105" 
                />
              </div>
            )}
            
            <div className="p-6 sm:p-8">
              {/* Location Tag */}
              {loc && (
                <span 
                  className={`text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg ${textColor} mb-4 inline-block shadow-sm`} 
                  style={{ backgroundColor: pillColor }}
                >
                  {loc}
                </span>
              )}
              
              {/* Header */}
              <h3 className="font-black text-xs uppercase mb-3 text-slate-400 tracking-widest">
                {item.header || item.type || 'Destacado Diario'}
              </h3>
              
              {/* Text Content */}
              <div className="space-y-2 mb-8">
                {spanishText && <p className="text-slate-800 font-black text-xl sm:text-2xl leading-tight tracking-tight">{spanishText}</p>}
                {englishText && <p className="text-slate-500 italic text-sm leading-relaxed">{englishText}</p>}
              </div>
              
              {/* Palabra del Día Section */}
              {wordEs && (
                <>
                  <div className="border-t-2 border-dashed border-slate-200 my-8 relative flex justify-center">
                    <span className="absolute -top-3 bg-white px-4 text-[10px] font-black text-slate-300 uppercase tracking-widest">
                      Palabra del Día
                    </span>
                  </div>
                  
                  <div className="text-center">
                    <h4 className="text-3xl sm:text-4xl font-black text-slate-900 lowercase tracking-tight">
                      {wordEs}
                    </h4>
                    <p className="text-slate-400 text-xs font-black uppercase mb-5 tracking-widest mt-1">
                      {wordObj.translation || item.word_en}
                    </p>
                    
                    {/* Sample Sentence Box */}
                    {(wordObj.sample_sentence || item.example_es) && (
                      <div className="bg-slate-50 p-5 rounded-xl border border-slate-100 text-center shadow-inner">
                        <p className="text-base text-slate-700 font-medium italic mb-1.5">
                          "{wordObj.sample_sentence || item.example_es}"
                        </p>
                        <p className="text-xs text-slate-400 font-medium">
                          {wordObj.sentence_translation || item.example_en}
                        </p>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </article>
        );
      })}
    </div>
  );
};

export default Destacado;