import React, { useState } from 'react';

const Evaluacion = ({ evals = [], liveDia, course, cal = [] }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Find today's evaluation
  const todayEval = evals.find((e) => e.dia === liveDia);
  const hasEvalToday = todayEval && todayEval.label && todayEval.label !== 'Nada';

  // Filter out 'Nada' for the full calendar view
  const actualEvals = evals.filter((e) => e.label && e.label !== 'Nada');

  // Find the next 2 upcoming evaluations
  const upcomingEvals = actualEvals
    .filter((e) => e.dia > liveDia)
    .slice(0, 2);

  // Course Title mapping
  const courseTitle = course === 's2' ? 'Español II' : 'IB Español II';

  // Helper to determine the "time away" text (kept but made subtle)
  const getUpcomingText = (evalDia) => {
    const diff = evalDia - liveDia;
    if (diff === 1) return 'la próxima clase';
    if (diff === 2) return 'en 2 clases';
    return `en ${diff} clases`;
  };

  // Helper to match Día numbers to actual calendar dates for the modal
  const getDatesForDia = (diaNum) => {
    if (!cal || !Array.isArray(cal)) return '';
    const matchingDays = cal.filter(c => c.dia === diaNum && c.status === 'school');
    
    if (matchingDays.length === 0) return 'Fecha TBD';
    
    return matchingDays.map(d => {
      let formattedDate = d.fecha;
      if (d.fecha && d.fecha.includes('-')) {
        const parts = d.fecha.split('-');
        if (parts.length === 3) formattedDate = `${parseInt(parts[1])}/${parseInt(parts[2])}`; // Removes leading zeros
      }
      return `${formattedDate}${d.ciclo ? ` (${d.ciclo})` : ''}`;
    }).join(' & ');
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-100 border-l-[6px] border-l-rose-400 p-5 sm:p-6 relative">
      
      {/* HEADER */}
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-bold text-xl text-rose-500 flex items-center gap-2">
          <span>📋</span> Evaluación
        </h3>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="text-[10px] font-bold uppercase tracking-widest text-slate-400 hover:text-rose-500 transition-colors"
          title="Ver calendario completo"
        >
          Calendario
        </button>
      </div>

      {/* TODAY'S EVALUATION */}
      <div className="mb-5">
        {hasEvalToday ? (
          <p className="text-slate-800 text-lg font-medium leading-tight">
            {todayEval.label}
          </p>
        ) : (
          <p className="text-slate-700 text-lg italic">
            Nada
          </p>
        )}
      </div>

      {/* UPCOMING EVALUATIONS */}
      {upcomingEvals.length > 0 && (
        <>
          <hr className="border-slate-100 my-4" />
          <div>
            <h4 className="text-sm font-black text-slate-900 uppercase tracking-wider mb-2">
              Próximas Pruebas
            </h4>
            <div className="space-y-1.5">
              {upcomingEvals.map((upc, idx) => (
                <p key={idx} className="text-slate-700 text-sm">
                  <span className="font-black text-slate-800">Día {upc.dia}:</span> {upc.label}
                  <span className="text-slate-400 italic text-xs ml-1.5">({getUpcomingText(upc.dia)})</span>
                </p>
              ))}
            </div>
          </div>
        </>
      )}

      {/* FULL CALENDAR MODAL (Unchanged) */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[80vh] animate-in fade-in zoom-in-95 duration-200">
            <div className="bg-slate-900 p-5 flex justify-between items-center">
              <div>
                <h2 className="text-white font-black uppercase tracking-widest text-lg">
                  Calendario de Evaluaciones
                </h2>
                <p className="text-indigo-400 font-bold text-xs uppercase tracking-widest mt-1">
                  {courseTitle}
                </p>
              </div>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-white text-3xl font-bold leading-none p-2 -mr-2"
              >
                ×
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1 space-y-3 bg-slate-50">
              {actualEvals.length === 0 ? (
                <p className="text-center text-slate-500 italic font-bold py-8">
                  No hay evaluaciones programadas.
                </p>
              ) : (
                actualEvals.map((item, idx) => {
                  const isPast = item.dia < liveDia;
                  const isToday = item.dia === liveDia;
                  const datesStr = getDatesForDia(item.dia);
                  
                  return (
                    <div 
                      key={idx} 
                      className={`p-4 rounded-xl border flex items-center gap-4 transition-all ${
                        isToday 
                          ? 'bg-rose-50 border-rose-200 shadow-md transform scale-[1.02]' 
                          : isPast 
                            ? 'bg-white border-slate-200 opacity-60' 
                            : 'bg-white border-slate-200 shadow-sm'
                      }`}
                    >
                      <div className={`flex flex-col items-center justify-center min-w-[70px] px-2 py-2 rounded-lg shrink-0 ${
                        isToday ? 'bg-rose-500 text-white' : 'bg-slate-100 text-slate-500'
                      }`}>
                        <span className="text-[10px] font-black uppercase tracking-widest leading-none mb-1">Día {item.dia}</span>
                        <span className="text-[9px] font-bold leading-none text-center opacity-80">{datesStr}</span>
                      </div>
                      <div>
                        {isToday && (
                          <span className="text-[9px] font-black uppercase tracking-widest text-rose-500 block mb-0.5">
                            HOY
                          </span>
                        )}
                        <p className={`font-bold text-sm ${isToday ? 'text-rose-900' : 'text-slate-700'}`}>
                          {item.label}
                        </p>
                      </div>
                      {isPast && !isToday && (
                        <div className="ml-auto text-emerald-500 text-xl font-bold" title="Completado">
                          ✓
                        </div>
                      )}
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Evaluacion;