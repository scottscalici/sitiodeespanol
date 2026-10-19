import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getCachedCollection } from '../utils/firestoreCache';
import RolodexStrip from './RolodexStrip';

// Fallback category hub for a category that has no `type: 'landing'` note
// yet — just the category's own notes as a Rolodex, so a gallery card never
// leads to a dead end while the teacher is still building out a topic. Once
// a landing note exists for the category, GrammarIndexPage links straight
// to it instead of here.
export default function GrammarCategoryPage() {
  const { categoryName } = useParams();
  const [pages, setPages] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        setPages(await getCachedCollection('grammar_pages'));
      } catch (err) {
        console.error('Error loading category:', err);
      }
      setLoading(false);
    };
    load();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center text-white">
        <p className="animate-pulse font-bold text-slate-400 uppercase tracking-widest">Cargando Categoría...</p>
      </div>
    );
  }

  const label = decodeURIComponent(categoryName || '');
  const notesInCategory = pages
    .filter((p) => p.type !== 'landing' && (p.category || 'General').toLowerCase() === label.toLowerCase())
    .sort((a, b) => (a.title || a.id).localeCompare(b.title || b.id));

  const cards = notesInCategory.map((page) => ({
    id: page.id,
    title: page.title || page.id,
    exists: true,
    videoCount: (page.blocks || []).filter((b) => b.type === 'media' && b.kind === 'video').length,
  }));

  return (
    <div className="min-h-screen bg-slate-900 text-white p-6 md:p-12 font-sans flex flex-col items-center pb-24">
      <div className="w-full max-w-4xl">
        <div className="flex justify-between items-center mb-6 pb-4 border-b border-slate-800">
          <Link
            to="/gramatica"
            className="px-4 py-2 bg-indigo-950/40 hover:bg-indigo-900/60 text-indigo-300 rounded-xl text-xs font-black uppercase tracking-wider transition-all border border-indigo-800/50"
          >
            📚 Índice Completo
          </Link>
        </div>

        <div className="bg-white border border-slate-200 p-8 md:p-12 rounded-2xl shadow-xl">
          <h1 className="text-3xl font-black text-slate-900 uppercase tracking-tight mb-6 pb-4 border-b border-slate-200">{label}</h1>
          <RolodexStrip cards={cards} />
        </div>
      </div>
    </div>
  );
}
