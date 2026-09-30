import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { getCachedCollection } from '../utils/firestoreCache';
import { useActiveTheme } from '../context/ThemeContext';
import { getThemedCardStyle } from '../utils/getThemedCardStyle';

const normalizeGrammarId = (raw) => raw.trim().toLowerCase().replace(/\s+/g, '_');

const Estructura = ({ estructura = [], liveDia }) => {
  const { theme } = useActiveTheme() || {};
  const themeStyle = getThemedCardStyle(
    theme?.styles?.cardOverrides?.estructura,
    theme?.styles?.accent,
    theme?.styles?.textures?.estructura
  );
  const todaysLessons = estructura.filter((g) => Number(g.dia) === liveDia);
  const [linkTitles, setLinkTitles] = useState({});
  const [allPages, setAllPages] = useState([]);
  const [activeCategory, setActiveCategory] = useState(null);

  // Fetch every grammar page once, so Recursos categories can be expanded into their pages
  useEffect(() => {
    const fetchAllPages = async () => {
      try {
        const pages = await getCachedCollection('grammar_pages');
        setAllPages(pages);
      } catch (error) {
        console.error('Error fetching grammar pages:', error);
      }
    };
    fetchAllPages();
  }, []);

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
    <div
      className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-600 via-violet-700 to-slate-900 p-6 sm:p-8 shadow-xl space-y-6"
      style={themeStyle}
    >
      <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/10 rounded-full blur-3xl pointer-events-none"></div>

      <div className="flex justify-between items-center gap-3">
        <h3 className="font-black text-2xl text-white flex items-center gap-3">
          <span className="w-11 h-11 rounded-xl bg-white/15 backdrop-blur-sm flex items-center justify-center text-xl shrink-0">📚</span>
          Estructura y Gramática
        </h3>
        <Link
          to="/gramatica"
          className="shrink-0 text-xs font-black uppercase tracking-widest text-white bg-white/15 hover:bg-white/25 px-3 py-2 rounded-lg transition-colors"
          title="Buscar cualquier tema de gramática"
        >
          Índice
        </Link>
      </div>

      <div className="space-y-6">
        {todaysLessons.map((lesson, idx) => {
          const enlacesArr = lesson.enlaces ? lesson.enlaces.split(',').map(s => s.trim()) : [];
          const recursosArr = lesson.recursos ? lesson.recursos.split(',').map(s => s.trim()) : [];

          return (
            <div key={idx} className="flex flex-col gap-4">

              {lesson.introText && (
                <div className="bg-white/10 border border-white/15 rounded-xl p-5">
                  <span className="text-[10px] font-black uppercase text-indigo-200 tracking-widest block mb-2">
                    Introducir
                  </span>
                  <p className="text-lg text-white leading-relaxed whitespace-pre-wrap">
                    {lesson.introText}
                  </p>
                </div>
              )}

              {lesson.repasoText && (
                <div className="bg-white/10 border border-white/15 rounded-xl p-5">
                  <span className="text-[10px] font-black uppercase text-indigo-200 tracking-widest block mb-2">
                    Repasar
                  </span>
                  <p className="text-lg text-white leading-relaxed whitespace-pre-wrap">
                    {lesson.repasoText}
                  </p>
                </div>
              )}

              {(enlacesArr.length > 0 || recursosArr.length > 0) && (
                <div className="pt-4 border-t border-white/15 space-y-3">

                  {enlacesArr.length > 0 && (
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-indigo-200 font-bold uppercase tracking-widest text-[10px] mr-1">
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
                            className="bg-white/15 hover:bg-white/25 text-white text-xs font-bold px-3 py-1.5 rounded-full transition-colors"
                          >
                            {linkTitles[enlace] || enlace}
                          </Link>
                        );
                      })}
                    </div>
                  )}

                  {recursosArr.length > 0 && (
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-indigo-200 font-bold uppercase tracking-widest text-[10px] mr-1">
                        Recursos
                      </span>
                      {recursosArr.map((recurso, i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => setActiveCategory(recurso)}
                          className="bg-white/15 hover:bg-white/25 text-white text-xs font-bold px-3 py-1.5 rounded-full transition-colors"
                        >
                          {recurso}
                        </button>
                      ))}
                    </div>
                  )}

                </div>
              )}

            </div>
          );
        })}
      </div>

      {/* RECURSOS CATEGORY POPUP */}
      {activeCategory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[80vh]">
            <div className="bg-slate-900 p-5 flex justify-between items-center">
              <h2 className="text-white font-black uppercase tracking-widest text-sm">
                {activeCategory}
              </h2>
              <button
                onClick={() => setActiveCategory(null)}
                className="text-slate-400 hover:text-white text-3xl font-bold leading-none p-2 -mr-2"
              >
                ×
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1 space-y-2 bg-slate-50">
              {(() => {
                const pagesInCategory = allPages.filter(
                  (page) => (page.category || '').toLowerCase() === activeCategory.toLowerCase()
                );

                if (pagesInCategory.length === 0) {
                  return (
                    <p className="text-center text-slate-400 italic font-bold py-8">
                      No hay páginas en esta categoría todavía.
                    </p>
                  );
                }

                return pagesInCategory.map((page) => (
                  <Link
                    key={page.id}
                    to={`/gramatica/${encodeURIComponent(page.id)}`}
                    onClick={() => setActiveCategory(null)}
                    className="block bg-white hover:bg-emerald-50 border border-slate-200 hover:border-emerald-200 p-4 rounded-xl shadow-sm transition-colors font-bold text-slate-800 text-sm"
                  >
                    {page.title || page.id}
                  </Link>
                ));
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Estructura;