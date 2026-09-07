import React from 'react';
import { Link } from 'react-router-dom';

const Estructura = ({ estructura = [], liveDia }) => {
  const todaysLessons = estructura.filter((g) => Number(g.dia) === liveDia);

  if (todaysLessons.length === 0) return null;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-100 border-l-[6px] border-l-emerald-400 p-6 sm:p-8 space-y-6">
      <h3 className="font-bold text-xl text-emerald-500 flex items-center gap-3 mb-2">
        <span className="text-2xl drop-shadow-sm">📚</span> Estructura y Gramática
      </h3>
      
      <div className="space-y-8">
        {todaysLessons.map((lesson, idx) => {
          const enlacesArr = lesson.enlaces ? lesson.enlaces.split(',').map(s => s.trim()) : [];
          const recursosArr = lesson.recursos ? lesson.recursos.split(',').map(s => s.trim()) : [];

          return (
            <div key={idx} className="flex flex-col gap-6">
              
              {lesson.introText && (
                <div className="text-center flex flex-col items-center gap-3">
                  <span className="text-[10px] font-black uppercase text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded tracking-widest block w-fit">
                    Introducir
                  </span>
                  <p className="text-lg text-slate-700 leading-relaxed whitespace-pre-wrap">
                    {lesson.introText}
                  </p>
                </div>
              )}
              
              {lesson.repasoText && (
                <div className="text-center flex flex-col items-center gap-3 mt-2">
                  <span className="text-[10px] font-black uppercase text-sky-700 bg-sky-50 px-3 py-1.5 rounded tracking-widest block w-fit">
                    Repasar
                  </span>
                  <p className="text-lg text-slate-700 leading-relaxed whitespace-pre-wrap">
                    {lesson.repasoText}
                  </p>
                </div>
              )}
              
              {(enlacesArr.length > 0 || recursosArr.length > 0) && (
                <div className="pt-6 mt-2 border-t border-slate-100 space-y-3">
                  
                  {enlacesArr.length > 0 && (
                    <div className="flex flex-wrap items-baseline gap-2 text-sm font-mono">
                      <span className="text-slate-400 font-sans font-bold uppercase tracking-widest text-[10px]">
                        Enlaces:
                      </span>
                      {enlacesArr.map((enlace, i) => {
                        // Clean up the ID to match the Firestore document ID format
                        const docId = enlace.trim();

                        return (
                          <React.Fragment key={i}>
                            {/* 🔗 This routes the user to your new grammar page viewer */}
                            <Link 
                              to={`/gramatica/${encodeURIComponent(docId)}`} 
                              className="text-indigo-500 hover:text-indigo-700 underline font-bold transition-colors"
                            >
                              {enlace}
                            </Link>
                            {i < enlacesArr.length - 1 && <span className="text-indigo-300">,</span>}
                          </React.Fragment>
                        );
                      })}
                    </div>
                  )}

                  {recursosArr.length > 0 && (
                    <div className="flex flex-wrap items-baseline gap-2 text-sm font-mono">
                      <span className="text-slate-400 font-sans font-bold uppercase tracking-widest text-[10px]">
                        Recursos:
                      </span>
                      {recursosArr.map((recurso, i) => (
                        <span key={i} className="text-emerald-600 font-bold">
                          {recurso}{i < recursosArr.length - 1 ? ', ' : ''}
                        </span>
                      ))}
                    </div>
                  )}

                </div>
              )}
              
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default Estructura;