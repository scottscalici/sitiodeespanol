import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { getCachedCollection } from '../utils/firestoreCache';
import { useActiveTheme } from '../context/ThemeContext';
import { resolveCardTheme } from '../utils/resolveCardTheme';
import { CardCornerDecoration, CardOverlay } from './CardDecorations';
import { renderFormattedText } from '../utils/formattedText';
import { isImageUrl } from '../utils/isImageUrl';
import { loadGoogleFont } from '../utils/loadGoogleFont';

const normalizeGrammarId = (raw) => raw.trim().toLowerCase().replace(/\s+/g, '_');

// A small "live red-pen markup" hook — a fixed, always-the-same example (not
// tied to today's actual lesson) that turns on hover/tap: the mistake fades,
// a red line strikes through it at a hand-drawn angle, a caret and the
// handwritten correction pop up above. Purely decorative — it's a preview of
// "what grammar notes feel like," not a real note, so one good example beats
// a rotating pool that would need its own content-authoring upkeep.
const RedPenExample = () => {
  const [active, setActive] = useState(false);

  useEffect(() => {
    loadGoogleFont('Caveat', [600, 700]);
  }, []);

  return (
    <div
      className="inline-block select-none cursor-pointer"
      onMouseEnter={() => setActive(true)}
      onMouseLeave={() => setActive(false)}
      onClick={() => setActive((a) => !a)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setActive((a) => !a); }}
    >
      <p className="font-serif text-lg sm:text-xl text-stone-700 leading-relaxed">
        Yo{' '}
        <span className="relative inline-block">
          <span
            aria-hidden="true"
            className={`absolute -top-7 left-0 whitespace-nowrap text-red-600 transition-all duration-300 ${
              active ? 'opacity-100 -translate-y-0.5' : 'opacity-0 translate-y-1'
            }`}
            style={{ fontFamily: "'Caveat', cursive", fontSize: '1.5rem', lineHeight: 1 }}
          >
            tengo
          </span>
          <span
            aria-hidden="true"
            className={`absolute -top-2.5 left-2 text-red-600 font-black transition-opacity duration-300 ${active ? 'opacity-100' : 'opacity-0'}`}
            style={{ fontSize: '0.85rem' }}
          >
            ^
          </span>
          <span className={`transition-colors duration-300 ${active ? 'text-stone-400' : 'text-stone-700'}`}>tiene</span>
          <span
            aria-hidden="true"
            className={`absolute left-0 top-1/2 h-[2px] bg-red-600 transition-all duration-500 ease-out ${active ? 'w-full' : 'w-0'}`}
            style={{ transform: 'translateY(-50%) rotate(-3deg)' }}
          />
        </span>{' '}
        que estudiar más.
      </p>
      <p className="text-[10px] font-bold uppercase tracking-widest text-stone-400 mt-1">
        {active ? '¡Corregido!' : 'Pasa el cursor o toca para corregir →'}
      </p>
    </div>
  );
};

const Estructura = ({ estructura = [], liveDia, course }) => {
  const { theme } = useActiveTheme() || {};
  const cardTheme = resolveCardTheme(theme, 'estructura');
  const todaysLessons = estructura.filter((g) => Number(g.dia) === liveDia);
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

  // Looked up from the already-fetched allPages above instead of a separate
  // getDoc per linked note — allPages already holds every grammar page, so
  // a second per-id Firestore read here was pure redundancy.
  const pagesById = useMemo(() => new Map(allPages.map((p) => [p.id, p])), [allPages]);
  const linkTitles = useMemo(() => {
    const titles = {};
    estructura
      .filter((g) => Number(g.dia) === liveDia)
      .forEach((lesson) => {
        (lesson.enlaces ? lesson.enlaces.split(',') : []).forEach((raw) => {
          const trimmed = raw.trim();
          if (!trimmed) return;
          const page = pagesById.get(normalizeGrammarId(trimmed));
          if (page?.title) titles[trimmed] = page.title;
        });
      });
    return titles;
  }, [estructura, liveDia, pagesById]);

  // Always render this card — even with nothing assigned for today, a
  // student should always find grammar notes in the same spot and be able
  // to reach the index, rather than the whole card vanishing for a day or
  // two whenever nothing new is introduced.
  const hasLessonsToday = todaysLessons.length > 0;

  // "Index card" look: cream paper, a red margin rule, faint ruled lines —
  // default (non-themed) colors only. A seasonal theme's own cardStyle/
  // cardOverrides (via cardTheme.style/headingColor/textColor below) still
  // wins exactly as it did before this rework; nothing here removes that.
  const paperStyle = {
    backgroundColor: '#fdfaf3',
    backgroundImage:
      'repeating-linear-gradient(to bottom, transparent, transparent 27px, rgba(185,28,28,0.07) 28px)',
    backgroundPosition: '0 8px',
  };

  return (
    <div
      className="relative overflow-hidden rounded-2xl p-6 sm:p-8 shadow-xl space-y-6 border border-stone-200"
      style={{ ...paperStyle, ...cardTheme.style }}
    >
      <CardOverlay overlay={cardTheme.overlay} />
      <CardCornerDecoration decoration={cardTheme.cornerDecoration} />
      {/* Notebook margin rule */}
      <div className="absolute top-0 bottom-0 left-10 w-px bg-red-300/70 pointer-events-none" />

      <div className="relative flex justify-between items-start gap-3">
        <div className="min-w-0">
          <h3
            className="font-serif font-black text-2xl text-stone-800 flex items-center gap-3"
            style={{ color: cardTheme.headingColor }}
          >
            <span className="w-11 h-11 rounded-xl bg-stone-900/5 border border-stone-200 flex items-center justify-center text-xl shrink-0 overflow-hidden">
              {isImageUrl(theme?.styles?.imageOverrides?.estructura) ? (
                <img src={theme.styles.imageOverrides.estructura} alt="" className="w-full h-full object-cover" />
              ) : (
                theme?.styles?.imageOverrides?.estructura || '📚'
              )}
            </span>
            Estructura y Gramática
          </h3>
          <div className="mt-4 pl-1">
            <RedPenExample />
          </div>
        </div>
        <Link
          to={`/gramatica${course ? `?course=${course}` : ''}`}
          className="shrink-0 text-xs font-black uppercase tracking-widest text-red-700 bg-white hover:bg-red-50 border-2 border-red-600 px-3 py-2 rounded-lg transition-colors"
          title="Buscar cualquier tema de gramática"
        >
          Índice
        </Link>
      </div>

      {!hasLessonsToday && (
        <p className="relative text-sm text-stone-500 italic">
          No hay notas nuevas asignadas hoy — usa el índice para repasar cualquier tema ya visto.
        </p>
      )}

      <div className="relative space-y-6">
        {todaysLessons.map((lesson, idx) => {
          const enlacesArr = lesson.enlaces ? lesson.enlaces.split(',').map(s => s.trim()) : [];
          const recursosArr = lesson.recursos ? lesson.recursos.split(',').map(s => s.trim()) : [];

          return (
            <div key={idx} className="flex flex-col gap-4">

              {lesson.introText && (
                <div className="bg-white border border-stone-200 rounded-xl p-5 shadow-sm">
                  <span className="text-[10px] font-black uppercase text-red-600 tracking-widest block mb-2">
                    Introducir
                  </span>
                  <p className="text-lg text-stone-800 leading-relaxed font-serif">
                    {renderFormattedText(lesson.introText)}
                  </p>
                </div>
              )}

              {lesson.repasoText && (
                <div className="bg-white border border-stone-200 rounded-xl p-5 shadow-sm">
                  <span className="text-[10px] font-black uppercase text-red-600 tracking-widest block mb-2">
                    Repasar
                  </span>
                  <p className="text-lg text-stone-800 leading-relaxed font-serif">
                    {renderFormattedText(lesson.repasoText)}
                  </p>
                </div>
              )}

              {(enlacesArr.length > 0 || recursosArr.length > 0) && (
                <div className="pt-4 border-t border-stone-200 space-y-3">

                  {enlacesArr.length > 0 && (
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-stone-400 font-bold uppercase tracking-widest text-[10px] mr-1">
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
                            className="bg-white hover:bg-red-50 border border-red-200 text-red-700 text-xs font-bold px-3 py-1.5 rounded-full transition-colors"
                          >
                            {linkTitles[enlace] || enlace}
                          </Link>
                        );
                      })}
                    </div>
                  )}

                  {recursosArr.length > 0 && (
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-stone-400 font-bold uppercase tracking-widest text-[10px] mr-1">
                        Recursos
                      </span>
                      {recursosArr.map((recurso, i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => setActiveCategory(recurso)}
                          className="bg-white hover:bg-red-50 border border-red-200 text-red-700 text-xs font-bold px-3 py-1.5 rounded-full transition-colors"
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
            <div className="bg-stone-900 p-5 flex justify-between items-center">
              <h2 className="text-white font-black uppercase tracking-widest text-sm">
                {activeCategory}
              </h2>
              <button
                onClick={() => setActiveCategory(null)}
                className="text-stone-400 hover:text-white text-3xl font-bold leading-none p-2 -mr-2"
              >
                ×
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1 space-y-2 bg-stone-50">
              {(() => {
                const pagesInCategory = allPages.filter(
                  (page) => (page.category || '').toLowerCase() === activeCategory.toLowerCase()
                );

                if (pagesInCategory.length === 0) {
                  return (
                    <p className="text-center text-stone-400 italic font-bold py-8">
                      No hay páginas en esta categoría todavía.
                    </p>
                  );
                }

                return pagesInCategory.map((page) => (
                  <Link
                    key={page.id}
                    to={`/gramatica/${encodeURIComponent(page.id)}`}
                    onClick={() => setActiveCategory(null)}
                    className="block bg-white hover:bg-red-50 border border-stone-200 hover:border-red-200 p-4 rounded-xl shadow-sm transition-colors font-bold text-stone-800 text-sm"
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
