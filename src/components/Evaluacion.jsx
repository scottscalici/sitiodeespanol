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
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-rose-600 via-pink-700 to-slate-900 p-6 shadow-xl">
      <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/10 rounded-full blur-3xl pointer-events-none"></div>

      {/* HEADER */}
      <div className="flex justify-between items-center mb-5">
        <h3 className="font-black text-2xl text-white flex items-center gap-2.5">
          <span className="w-10 h-10 rounded-xl bg-white/15 backdrop-blur-sm flex items-center justify-center text-xl shrink-0">📋</span>
          Evaluación
        </h3>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="text-xs font-black uppercase tracking-widest text-white bg-white/15 hover:bg-white/25 px-3 py-2 rounded-lg transition-colors shrink-0"
          title="Ver calendario completo"
        >
          Calendario
        </button>
      </div>

      {/* TODAY'S EVALUATION */}
      <div className="mb-5">
        <span className="block text-xs font-black uppercase tracking-widest text-rose-200 mb-1">Hoy · Día {liveDia}</span>
        {hasEvalToday ? (
          <p className="text-white text-lg font-bold leading-tight">
            {todayEval.label}
          </p>
        ) : (
          <p className="text-rose-100/70 text-lg italic">
            Nada
          </p>
        )}
      </div>

      {/* UPCOMING EVALUATIONS */}
      {upcomingEvals.length > 0 && (
        <>
          <hr className="border-white/15 my-4" />
          <div>
            <h4 className="text-xs font-black text-rose-200 uppercase tracking-widest mb-2">
              Próximas Pruebas
            </h4>
            <div className="space-y-1.5">
              {upcomingEvals.map((upc, idx) => (
                <p key={idx} className="text-rose-50 text-sm">
                  <span className="font-black text-white">Día {upc.dia}:</span> {upc.label}
                  <span className="text-rose-200/70 italic text-xs ml-1.5">({getUpcomingText(upc.dia)})</span>
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