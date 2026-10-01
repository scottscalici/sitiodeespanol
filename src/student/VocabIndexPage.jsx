import React, { useState, useEffect, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getCachedCollection } from '../utils/firestoreCache';
import { getVocabUnitWord } from '../utils/vocabUnitLabel';
import { getAllowedTextbooks, getDefaultTextbook } from '../utils/textbookAccess';

// Landing view is a table of contents — every chapter of the student's
// default book (their course's current textbook), so they can jump
// straight into any chapter's full study page (VocabPage). The book
// dropdown lets them look back at earlier books. Typing in the search box
// swaps to a flat word lookup instead, like a small Spanish dictionary,
// scoped to whichever book is selected.
export default function VocabIndexPage() {
  const { userData } = useAuth();
  const [searchParams] = useSearchParams();
  const isAdmin = userData?.role === 'admin';
  const courseOverride = searchParams.get('course');
  const course = isAdmin && (courseOverride === 's2' || courseOverride === 's4')
    ? courseOverride
    : (userData?.course || 's2');

  const allowedTextbooks = useMemo(() => getAllowedTextbooks(course), [course]);
  const [textbookFilter, setTextbookFilter] = useState(() => getDefaultTextbook(course));
  const [search, setSearch] = useState('');
  const [bundles, setBundles] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setTextbookFilter(getDefaultTextbook(course));
  }, [course]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const all = await getCachedCollection('vocab_bundles');
        setBundles(all.filter((b) => allowedTextbooks.includes(b.textbook)));
      } catch (err) {
        console.error('Error loading vocab index:', err);
      }
      setLoading(false);
    };
    load();
  }, [allowedTextbooks]);

  const bundlesInScope = useMemo(
    () => bundles.filter((b) => textbookFilter === 'Todos' || b.textbook === textbookFilter),
    [bundles, textbookFilter]
  );

  const chapters = useMemo(
    () => [...bundlesInScope].sort((a, b) => (
      (a.textbook || '').localeCompare(b.textbook || '') || (Number(a.chapter) || 0) - (Number(b.chapter) || 0)
    )),
    [bundlesInScope]
  );

  const isSearching = search.trim().length > 0;

  const searchResults = useMemo(() => {
    if (!isSearching) return [];
    const q = search.trim().toLowerCase();
    const flattened = [];
    bundlesInScope.forEach((b) => {
      (b.words || []).forEach((w) => {
        if (w.palabra?.toLowerCase().includes(q) || w.traduccion?.toLowerCase().includes(q)) {
          flattened.push({ palabra: w.palabra, traduccion: w.traduccion, textbook: b.textbook, chapter: b.chapter, bundleId: b.id });
        }
      });
    });
    return flattened.sort((a, b) => (a.palabra || '').localeCompare(b.palabra || ''));
  }, [bundlesInScope, search, isSearching]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <h2 className="text-xl font-bold animate-pulse text-slate-400 uppercase tracking-widest">Cargando Índice de Vocabulario...</h2>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 sm:p-8 font-sans text-slate-800 pb-24">
      <div className="max-w-4xl mx-auto">
        <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4 bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <div>
            <p className="text-xs font-black text-indigo-500 uppercase tracking-widest mb-1">Referencia</p>
            <h1 className="text-3xl font-black text-slate-800 uppercase tracking-tight">📚 Índice de Vocabulario</h1>
            <p className="text-sm font-medium text-slate-500 mt-1">
              {isSearching ? `${searchResults.length} palabras encontradas` : `${chapters.length} capítulos`}
            </p>
          </div>
          <Link to="/" className="text-slate-500 hover:text-slate-800 font-bold text-sm bg-slate-100 hover:bg-slate-200 px-5 py-2.5 rounded-xl transition-colors">
            Volver al Inicio ↗
          </Link>
        </header>

        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar palabra o traducción..."
            className="flex-1 bg-white border-2 border-slate-200 rounded-xl px-4 py-3 text-sm font-medium outline-none focus:border-indigo-400"
          />
          <select
            value={textbookFilter}
            onChange={(e) => setTextbookFilter(e.target.value)}
            className="bg-white border-2 border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-indigo-700 outline-none focus:border-indigo-400"
          >
            <option value="Todos">Todos los Libros</option>
            {allowedTextbooks.map((tb) => (
              <option key={tb} value={tb}>{tb}</option>
            ))}
          </select>
        </div>

        {isSearching ? (
          searchResults.length === 0 ? (
            <div className="text-center py-20 text-slate-400 font-bold uppercase tracking-widest">
              No se encontraron palabras.
            </div>
          ) : (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 divide-y divide-slate-100">
              {searchResults.map((w, i) => (
                <Link
                  key={`${w.bundleId}_${w.palabra}_${i}`}
                  to={`/vocabulario/${w.bundleId}`}
                  className="flex items-center justify-between gap-4 px-5 py-3 hover:bg-slate-50 transition-colors"
                >
                  <div className="min-w-0">
                    <p className="font-black text-slate-800 truncate">{w.palabra}</p>
                    <p className="text-sm text-slate-500 truncate">{w.traduccion}</p>
                  </div>
                  <span className="shrink-0 text-[10px] font-bold uppercase tracking-widest text-indigo-600 bg-indigo-50 px-3 py-1.5 rounded-full">
                    {w.textbook} · {getVocabUnitWord(w.textbook)} {w.chapter}
                  </span>
                </Link>
              ))}
            </div>
          )
        ) : chapters.length === 0 ? (
          <div className="text-center py-20 text-slate-400 font-bold uppercase tracking-widest">
            Todavía no hay capítulos para este libro.
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {chapters.map((b) => (
              <Link
                key={b.id}
                to={`/vocabulario/${b.id}`}
                className="bg-white rounded-2xl shadow-sm border border-slate-200 hover:border-indigo-300 hover:shadow-md hover:-translate-y-0.5 transition-all p-5 flex flex-col gap-1"
              >
                <span className="text-[10px] font-bold uppercase tracking-widest text-indigo-500">{b.textbook}</span>
                <span className="text-lg font-black text-slate-800">{getVocabUnitWord(b.textbook)} {b.chapter}</span>
                <span className="text-xs text-slate-400 font-medium">{(b.words || []).length} palabras</span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
