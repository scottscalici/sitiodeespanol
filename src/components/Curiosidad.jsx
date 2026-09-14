import React from 'react';

const Curiosidad = ({ curiosidades = [] }) => {
  if (!curiosidades || curiosidades.length === 0) return null;

  return (
    <div className="space-y-6">
      {curiosidades.map((item, idx) => {
        // Find the active day to display in the header
        const activeDay = item.s2_dia || item.s4_dia || item.ib_dia || item.dia || '';

        return (
          <article 
            key={item.id || idx}
            className="bg-white rounded-2xl border-l-[6px] border-l-sky-500 p-6 sm:p-8 shadow-sm border border-y-slate-200 border-r-slate-200"
          >
            {/* Header */}
            <h3 className="font-black text-[10px] uppercase text-sky-500 tracking-widest mb-3">
              Curiosidad {activeDay}
            </h3>
            
            {/* Title */}
            <h2 className="text-2xl sm:text-3xl font-black text-slate-900 leading-tight tracking-tight mb-5">
              {item.title || item.titulo}
            </h2>
            
            {/* Image */}
            {(item.img || item.imagen || item.image_url) && (
              <div className="mb-5 rounded-xl overflow-hidden border border-slate-100 bg-slate-50 p-1.5 shadow-sm">
                <img 
                  src={item.img || item.imagen || item.image_url} 
                  alt={item.title}
                  className="rounded-lg max-h-72 object-contain w-full" 
                />
              </div>
            )}
            
            {/* Notes / Caption */}
            {(item.student_note || item.teacher_notes || item.caption || item.descripcion) && (
              <div className="bg-sky-50/50 p-5 rounded-xl border border-sky-100/50 mt-2">
                <p className="italic text-sm text-slate-700 leading-relaxed font-medium">
                  {item.student_note || item.teacher_notes || item.caption || item.descripcion}
                </p>
              </div>
            )}
          </article>
        );
      })}
    </div>
  );
};

export default Curiosidad;