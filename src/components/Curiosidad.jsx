import React from 'react';

const Curiosidad = ({ curiosidades = [], liveDia, course }) => {
  // Determine which column in your JSON to check based on the course
  const courseKey = `${course}_dia`; 
  
  // Find the specific curiosity for today
  const curiosidadDelDia = curiosidades.find(c => c[courseKey] == liveDia);

  // If there's no fun fact today, just hide the component completely
  if (!curiosidadDelDia) return null;

  return (
    <article className="bg-white rounded-xl border-l-[6px] border-indigo-500 p-6 shadow-sm border border-y-slate-200 border-r-slate-200 space-y-4">
      
      <h3 className="font-bold text-xs uppercase text-indigo-500 tracking-widest">
        Curiosidad Día {liveDia}
      </h3>
      
      <h2 className="text-2xl font-extrabold text-slate-900 leading-tight">
        {curiosidadDelDia.title}
      </h2>
      
      {/* Only render the image if one actually exists in the JSON */}
      {curiosidadDelDia.img && (
        <img 
          src={curiosidadDelDia.img} 
          alt={curiosidadDelDia.title}
          className="rounded-lg max-h-64 object-contain w-full bg-slate-50 border border-slate-100 p-2" 
        />
      )}
      
      {/* Only render the note if one actually exists */}
      {curiosidadDelDia.student_note && (
        <p className="italic text-sm text-slate-700 bg-indigo-50/50 p-4 rounded-lg border border-indigo-50">
          {curiosidadDelDia.student_note}
        </p>
      )}
      
    </article>
  );
};

export default Curiosidad;