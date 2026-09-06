import React from 'react';

// 🔗 Your exact Google Sites links from the original code!
const CALENDAR_LINKS = {
  s2: "https://sites.google.com/view/srscalici/espa%C3%B1ol-2/evaluaciones",
  s4: "https://sites.google.com/view/srscalici/ib-espa%C3%B1ol-ii/evaluaciones"
};

const Evaluacion = ({ evals = {}, liveDia, course }) => {
  const evalList = evals.courses?.[course] || [];

  const findEval = (d) => {
    const found = evalList.find(e => e.dia == d);
    return found ? found.label : "Nada";
  };

  const currentEval = findEval(liveDia);
  const nextEval1 = findEval(parseInt(liveDia) + 1);
  const nextEval2 = findEval(parseInt(liveDia) + 2);

  return (
    <section className="bg-white rounded-xl border-l-[6px] border-indigo-500 p-6 shadow-sm border border-y-slate-200 border-r-slate-200">
      <h2 className="font-bold text-xl mb-3 flex items-center gap-2 text-slate-800">
        <span>📋</span> Evaluación
      </h2>
      
      <div className="text-lg text-indigo-700 font-bold italic mb-4">
        {currentEval}
      </div>
      
              
      <div className="pt-4 border-t border-slate-100 flex-grow">
        <h3 className="text-slate-900 font-bold text-sm mb-3 uppercase tracking-wide">
          Próximas pruebas
        </h3>
        <ul className="space-y-2 text-sm text-slate-600">
          <li className="flex items-center gap-3">
            <span className="font-bold text-slate-500 bg-slate-100 px-2 py-1 rounded text-[10px] uppercase tracking-widest border border-slate-200">
              Día {parseInt(liveDia) + 1}
            </span> 
            <span className={nextEval1 === "Nada" ? "italic opacity-60" : "font-medium"}>
              {nextEval1}
            </span>
          </li>
          <li className="flex items-center gap-3">
            <span className="font-bold text-slate-500 bg-slate-100 px-2 py-1 rounded text-[10px] uppercase tracking-widest border border-slate-200">
              Día {parseInt(liveDia) + 2}
            </span> 
            <span className={nextEval2 === "Nada" ? "italic opacity-60" : "font-medium"}>
              {nextEval2}
            </span>
          </li>
        </ul>
      </div>

      {/* 🚀 THE NEW CONSOLIDATED BUTTON */}
      <a 
        href={CALENDAR_LINKS[course] || "#"} 
        target="_blank" 
        rel="noopener noreferrer"
        className="mt-6 block w-full bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-center py-2.5 rounded-lg font-bold text-xs uppercase tracking-widest transition-colors border border-indigo-100"
      >
        Ver Calendario Completo ↗
      </a>
    </section>
  );
};

export default Evaluacion;