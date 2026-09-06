import React from 'react';
import ActivityGrid from './ActivityGrid';

const Recursos = ({ data, liveDia, course }) => {
  
  // 1. Gramática Logic
  const activeGrammar = Object.values(data.apuntes || {}).filter(topic => {
    const ranges = topic.dashboard_ranges?.[course] || [];
    return ranges.some(r => liveDia >= r[0] && liveDia <= r[1]);
  });

  // 2. Static Bottom Cards Logic
  const dynamicCardTypes = ["vocab", "misd", "costarica"];
  if (course === 's4') dynamicCardTypes.push("ib");

  const mascots = data.temas?.mascots || {};
  const vocabKey = course === 's2' ? 'descubre2' : 'descubre3';
  const vocabData = data.vocab?.[vocabKey]?.chapters || {};
  const activeVocab = Object.values(vocabData).find(ch => ch.dias?.includes(liveDia));

  return (
    <div className="border-t-4 border-dashed border-slate-200 pt-12">
      
      {/* 🚀 1. THE NEW UNIVERSAL ACTIVITY ENGINE */}
      <ActivityGrid activities={data.activities} liveDia={liveDia} course={course} />

      {/* ⚙️ 2. REFERENCIAS DE GRAMÁTICA */}
      {activeGrammar.length > 0 && (
        <div className="mb-12">
          <h2 className="text-slate-400 font-black text-xl uppercase tracking-widest mb-6">Referencias de Gramática</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {activeGrammar.map((topic, idx) => (
              <div key={idx} className="bg-white rounded-xl border-l-[6px] border-indigo-500 p-6 shadow-sm border border-y-slate-200 border-r-slate-200">
                <h3 className="font-black text-base mb-4 pb-4 border-b border-slate-100 flex items-start gap-3 leading-tight">
                  <span className="text-xl">⚙️</span> 
                  <span className="break-words">{topic.title}</span>
                </h3>
                <div className="flex flex-col gap-3">
                  {Object.values(topic.links || {}).map((l, i) => (
                    <a key={i} href={l.url} target="_blank" rel="noreferrer" className="block text-xs font-bold uppercase py-1.5 border-b border-slate-50 text-slate-500 hover:text-indigo-600 transition-colors">
                      {l.title} ↗
                    </a>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 📌 3. BLOQUES ESTÁTICOS INFERIORES */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        
        {/* Vocabulario */}
        {dynamicCardTypes.includes('vocab') && (
          activeVocab ? (
            <div className="bg-white rounded-xl border-l-[6px] border-indigo-500 shadow-sm flex flex-col h-full border border-y-slate-200 border-r-slate-200 overflow-hidden">
              <div className="h-32 bg-slate-50 relative border-b border-slate-100">
                <img src={mascots.vocabTree || "https://raw.githubusercontent.com/scottscalici/imagenes/main/diasfestivos/arboldevocab.png"} alt="Vocab" className="w-full h-full object-cover opacity-80 mix-blend-multiply" />
              </div>
              <div className="p-5 flex flex-col flex-grow justify-between">
                <div className="mb-4">
                  <h3 className="font-black text-[10px] uppercase mb-1 text-indigo-500 tracking-widest">Vocabulario</h3>
                  <h3 className="text-slate-900 font-bold text-lg leading-tight">{activeVocab.label}</h3>
                </div>
                <div className="flex gap-2 mt-auto">
                  <a href={activeVocab.listas} target="_blank" rel="noreferrer" className="flex-1 text-center py-2.5 border-2 border-slate-200 hover:border-indigo-500 rounded-lg font-bold text-[10px] uppercase text-slate-600 transition-colors">Lista ↗</a>
                  <a href={activeVocab.flashcards} target="_blank" rel="noreferrer" className="flex-1 text-center py-2.5 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg font-bold text-[10px] uppercase shadow-md transition-colors">Tarjetas ↗</a>
                </div>
              </div>
            </div>
          ) : (
            <div className="hidden"></div>
          )
        )}

        {/* MISD Portal */}
        {dynamicCardTypes.includes('misd') && (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col h-full overflow-hidden">
            <div className="h-32 bg-slate-100 border-b border-slate-200">
              <img src={mascots.misd || "https://raw.githubusercontent.com/scottscalici/imagenes/main/diasfestivos/misd.png"} alt="MISD" className="w-full h-full object-cover mix-blend-multiply" />
            </div>
            <div className="p-5 flex-grow flex flex-col justify-between items-center text-center">
              <h3 className="font-bold text-lg mb-4 text-slate-800">MISD Portal</h3>
              <a href="https://connection.misd.net/index.html" target="_blank" rel="noreferrer" className="w-full bg-slate-800 hover:bg-black text-white py-2.5 rounded-lg font-bold text-[10px] uppercase tracking-widest transition-colors shadow-md mt-auto">Abrir Portal ↗</a>
            </div>
          </div>
        )}

        {/* Costa Rica */}
        {dynamicCardTypes.includes('costarica') && (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col h-full overflow-hidden">
            <div className="h-32 bg-emerald-50 border-b border-emerald-100 p-2">
              <img src={mascots.sloth || "https://raw.githubusercontent.com/scottscalici/imagenes/main/diasfestivos/sloth_orig.jpg"} alt="Costa Rica" className="w-full h-full object-contain mix-blend-multiply" />
            </div>
            <div className="p-5 flex-grow flex flex-col justify-between items-center text-center">
              <h3 className="font-bold text-lg mb-4 text-slate-800">Costa Rica 2027</h3>
              <a href="https://senoraburak.weebly.com/costa-rica-2027.html" target="_blank" rel="noreferrer" className="w-full bg-emerald-500 hover:bg-emerald-600 text-white py-2.5 rounded-lg font-bold text-[10px] uppercase tracking-widest transition-colors shadow-md mt-auto">Ver Detalles ↗</a>
            </div>
          </div>
        )}

        {/* Recursos IB (Only for s4) */}
        {dynamicCardTypes.includes('ib') && (
           <div className="bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col h-full overflow-hidden">
           <div className="h-32 bg-indigo-50 p-4 border-b border-indigo-100">
             <img src={mascots.ib || 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1b/International_Baccalaureate_Logo.svg/1200px-International_Baccalaureate_Logo.svg.png'} alt="IB" className="w-full h-full object-contain" />
           </div>
           <div className="p-5 flex-grow flex flex-col justify-between text-center">
             <h3 className="font-bold text-lg mb-4 text-slate-800">Recursos IB</h3>
             <div className="flex gap-2 mt-auto">
               <a href="https://sites.google.com/view/srscalici/ib-espa%C3%B1ol-ii/ib/las-evaluaciones-de-ib" target="_blank" rel="noreferrer" className="flex-1 text-center py-2.5 bg-indigo-500 hover:bg-indigo-600 rounded-lg font-bold text-[10px] uppercase text-white shadow-md transition-colors">Recursos ↗</a>
               <a href="https://sites.google.com/view/srscalici/ib-espa%C3%B1ol-ii/ib/%C3%ADndice-de-los-ex%C3%A1menes-de-pr%C3%A1ctica" target="_blank" rel="noreferrer" className="flex-1 text-center py-2.5 bg-slate-100 hover:bg-slate-200 rounded-lg font-bold text-[10px] uppercase text-slate-600 transition-colors border border-slate-200">Exámenes ↗</a>
             </div>
           </div>
         </div>
        )}
      </div>
    </div>
  );
};

export default Recursos;