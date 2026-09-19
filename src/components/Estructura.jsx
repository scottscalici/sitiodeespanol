import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';

const normalizeGrammarId = (raw) => raw.trim().toLowerCase().replace(/\s+/g, '_');

const Estructura = ({ estructura = [], liveDia }) => {
  const todaysLessons = estructura.filter((g) => Number(g.dia) === liveDia);
  const [linkTitles, setLinkTitles] = useState({});

  useEffect(() => {
    const allIds = new Set();
    estructura
      .filter((g) => Number(g.dia) === liveDia)
      .forEach((lesson) => {
        (lesson.enlaces ? lesson.enlaces.split(',') : []).forEach((raw) => {
          const trimmed = raw.trim();
          if (trimmed) allIds.add(trimmed);
        });
      });

    if (allIds.size === 0) return;

    const fetchTitles = async () => {
      const entries = await Promise.all(
        [...allIds].map(async (raw) => {
          try {
            const snap = await getDoc(doc(db, 'grammar_pages', normalizeGrammarId(raw)));
            return [raw, snap.exists() ? snap.data().title : null];
          } catch (error) {
            console.error('Error fetching grammar note title:', error);
            return [raw, null];
          }
        })
      );
      setLinkTitles(Object.fromEntries(entries.filter(([, title]) => title)));
    };

    fetchTitles();
  }, [estructura, liveDia]);

  if (todaysLessons.length === 0) return null;

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 border-l-[6px] border-l-emerald-500 p-6 sm:p-8 space-y-6">
      <h3 className="font-black text-2xl text-slate-800 flex items-center gap-3">
        <span className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center text-xl shrink-0">📚</span>
        Estructura y Gramática
      </h3>

      <div className="space-y-6">
        {todaysLessons.map((lesson, idx) => {
          const enlacesArr = lesson.enlaces ? lesson.enlaces.split(',').map(s => s.trim()) : [];
          const recursosArr = lesson.recursos ? lesson.recursos.split(',').map(s => s.trim()) : [];

          return (
            <div key={idx} className="flex flex-col gap-4">

              {lesson.introText && (
                <div className="bg-emerald-50/60 border border-emerald-100 rounded-xl p-5">
                  <span className="text-[10px] font-black uppercase text-emerald-700 tracking-widest block mb-2">
                    Introducir
                  </span>
                  <p className="text-lg text-slate-700 leading-relaxed whitespace-pre-wrap">
                    {lesson.introText}
                  </p>
                </div>
              )}

              {lesson.repasoText && (
                <div className="bg-sky-50/60 border border-sky-100 rounded-xl p-5">
                  <span className="text-[10px] font-black uppercase text-sky-700 tracking-widest block mb-2">
                    Repasar
                  </span>
                  <p className="text-lg text-slate-700 leading-relaxed whitespace-pre-wrap">
                    {lesson.repasoText}
                  </p>
                </div>
              )}

              {(enlacesArr.length > 0 || recursosArr.length > 0) && (
                <div className="pt-4 border-t border-slate-100 space-y-3">

                  {enlacesArr.length > 0 && (
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-slate-400 font-bold uppercase tracking-widest text-[10px] mr-1">
                        Enlaces
                      </span>
                      {enlacesArr.map((enlace, i) => {
                        // Clean up the ID to match the Firestore document ID format
                        const docId = enlace.trim();

                        return (
                          /* 🔗 This routes the user to your new grammar page viewer */
                          <Link
                            key={i}
                            to={`/gramatica/${encodeURIComponent(docId)}`}
                            className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold px-3 py-1.5 rounded-full transition-colors"
                          >
                            {linkTitles[enlace] || enlace}
                          </Link>
                        );
                      })}
                    </div>
                  )}

                  {recursosArr.length > 0 && (
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-slate-400 font-bold uppercase tracking-widest text-[10px] mr-1">
                        Recursos
                      </span>
                      {recursosArr.map((recurso, i) => (
                        <span key={i} className="bg-emerald-50 text-emerald-700 text-xs font-bold px-3 py-1.5 rounded-full">
                          {recurso}
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