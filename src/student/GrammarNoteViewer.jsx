import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { getCachedCollection } from '../utils/firestoreCache';
import { useActiveTheme } from '../context/ThemeContext';
import { BLOCK_TYPES } from '../shared/noteBlocks';

// Renders one note's `blocks` array via the shared block-type registry —
// the `showEnglish` toggle and `existingIds` (for safe forward-reference
// links) are threaded through to every block; each type ignores whatever
// props it doesn't need.
const BlockList = ({ blocks, showEnglish, existingIds }) => (
  <div className="space-y-6">
    {(blocks || []).map((block, i) => {
      const BlockRenderer = BLOCK_TYPES[block.type]?.Renderer;
      return BlockRenderer ? <BlockRenderer key={i} block={block} showEnglish={showEnglish} existingIds={existingIds} /> : null;
    })}
  </div>
);

// One row of a landing page's table of contents — expandable to preview the
// subtopic's video(s) and a short text preview without leaving the page.
// A subtopic listed but not yet built (forward reference, since notes are
// built a couple of topics ahead) shows as "próximamente" instead of a dead
// link — matching how the `link` block itself handles the same situation.
const SubtopicRow = ({ entry, allPages }) => {
  const [expanded, setExpanded] = useState(false);
  const page = allPages.find((p) => p.id === entry.id);
  if (!page) {
    return (
      <div className="flex items-center justify-between px-4 py-3 text-slate-400">
        <span className="font-bold">{entry.label || entry.id}</span>
        <span className="text-[10px] font-black uppercase tracking-widest bg-slate-100 px-2 py-1 rounded-full">Próximamente</span>
      </div>
    );
  }
  const videoBlocks = (page.blocks || []).filter((b) => b.type === 'media' && b.kind === 'video');
  return (
    <div>
      <button onClick={() => setExpanded((v) => !v)} className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-50 text-left">
        <span className="font-black text-slate-800">{entry.label || page.title}</span>
        <span className="flex items-center gap-2 shrink-0">
          {videoBlocks.length > 0 && (
            <span className="text-[10px] font-black uppercase tracking-widest text-indigo-600 bg-indigo-50 px-2 py-1 rounded-full">🎥 {videoBlocks.length}</span>
          )}
          <span className="text-slate-400 text-xs">{expanded ? '▲' : '▼'}</span>
        </span>
      </button>
      {expanded && (
        <div className="px-4 pb-4 space-y-3">
          {videoBlocks.map((b, i) => {
            const MediaRenderer = BLOCK_TYPES.media.Renderer;
            return <MediaRenderer key={i} block={b} />;
          })}
          <Link to={`/gramatica/${encodeURIComponent(page.id)}`} className="inline-block text-indigo-600 hover:text-indigo-800 underline font-bold text-sm">
            Ver nota completa →
          </Link>
        </div>
      )}
    </div>
  );
};

export default function GrammarNoteViewer() {
  const { noteId } = useParams();
  const navigate = useNavigate();
  const { theme } = useActiveTheme() || {};

  const [noteData, setNoteData] = useState(null);
  const [allPages, setAllPages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showEnglish, setShowEnglish] = useState(false);

  useEffect(() => {
    const fetchNote = async () => {
      if (!noteId) return;
      setLoading(true);
      setShowEnglish(false);
      try {
        const docId = noteId.trim().toLowerCase().replace(/\s+/g, '_');
        const [snap, pages] = await Promise.all([getDoc(doc(db, 'grammar_pages', docId)), getCachedCollection('grammar_pages')]);
        setAllPages(pages);
        if (snap.exists()) {
          setNoteData(snap.data());
        } else {
          console.warn('Grammar note not found:', docId);
          setNoteData(null);
        }
      } catch (err) {
        console.error('Error fetching grammar note:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchNote();
  }, [noteId]);

  const existingIds = useMemo(() => new Set(allPages.map((p) => p.id)), [allPages]);
  const accentColor = theme?.styles?.cardOverrides?.notaGramatica;

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center text-white">
        <p className="animate-pulse font-bold text-slate-400 uppercase tracking-widest">Cargando Nota...</p>
      </div>
    );
  }

  const isLanding = noteData?.type === 'landing';
  const isBlockNote = !isLanding && Array.isArray(noteData?.blocks);
  const hasEnglishContent = isBlockNote && (noteData.blocks || []).some((b) => b.textEn || (b.items || []).some?.((it) => it?.en));

  return (
    <div className="min-h-screen bg-slate-900 text-white p-6 md:p-12 font-sans flex flex-col items-center pb-24">
      <div className="w-full max-w-4xl">
        {/* TOP NAVIGATION BAR */}
        <div className="flex justify-between items-center mb-6 pb-4 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate(-1)}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-black uppercase tracking-wider transition-all border border-slate-700"
            >
              ← Volver
            </button>
            <Link
              to="/gramatica"
              className="px-4 py-2 bg-indigo-950/40 hover:bg-indigo-900/60 text-indigo-300 rounded-xl text-xs font-black uppercase tracking-wider transition-all border border-indigo-800/50"
            >
              📚 Índice Completo
            </Link>
          </div>
          <div className="flex items-center gap-2">
            {hasEnglishContent && (
              <button
                onClick={() => setShowEnglish((v) => !v)}
                className={`px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all border ${
                  showEnglish ? 'bg-sky-600 border-sky-500 text-white' : 'bg-slate-800 border-slate-700 text-slate-300'
                }`}
              >
                🇬🇧 Ver en inglés
              </button>
            )}
            {noteData?.category && (
              <span className="text-xs font-black uppercase tracking-widest text-emerald-400 bg-emerald-950/40 px-3 py-1 rounded-full border border-emerald-900/50">
                {noteData.category}
              </span>
            )}
          </div>
        </div>

        {/* CONTENT CARD */}
        <div className="bg-white border border-slate-200 p-8 md:p-12 rounded-2xl shadow-xl" style={accentColor ? { borderTopColor: accentColor, borderTopWidth: 4 } : undefined}>
          {!noteData ? (
            <div className="text-center py-16">
              <p className="text-xl font-bold text-rose-500 mb-2">Nota no encontrada</p>
              <p className="text-sm text-slate-500">
                Asegúrate de que el documento en la colección <code className="text-sky-600 bg-sky-50 px-1 rounded">grammar_pages</code> coincida con el enlace.
              </p>
            </div>
          ) : isLanding ? (
            <div>
              <h1 className="text-3xl font-black text-slate-900 uppercase tracking-tight mb-6 pb-4 border-b border-slate-200">{noteData.title}</h1>
              {Array.isArray(noteData.blocks) && noteData.blocks.length > 0 && (
                <div className="mb-8">
                  <BlockList blocks={noteData.blocks} showEnglish={showEnglish} existingIds={existingIds} />
                </div>
              )}
              <h2 className="text-sm font-black text-slate-500 uppercase tracking-widest mb-3">Subtemas</h2>
              <div className="border border-slate-200 rounded-xl divide-y divide-slate-100">
                {(noteData.subtopics || []).map((entry, i) => (
                  <SubtopicRow key={i} entry={entry} allPages={allPages} />
                ))}
              </div>
            </div>
          ) : isBlockNote ? (
            <div>
              <h1 className="text-3xl font-black text-slate-900 uppercase tracking-tight mb-6 pb-4 border-b border-slate-200">{noteData.title}</h1>
              <BlockList blocks={noteData.blocks} showEnglish={showEnglish} existingIds={existingIds} />
            </div>
          ) : (
            <div>
              <h1 className="text-3xl font-black text-slate-900 uppercase tracking-tight mb-6 pb-4 border-b border-slate-200">{noteData.title}</h1>

              {/* TABLE & CODE FORCING STYLES (legacy HTML notes) */}
              <style>{`
                .grammar-doc table { width: 100%; border-collapse: collapse; margin: 1.5rem 0; }
                .grammar-doc th { background: #f8fafc; color: #0f172a !important; font-weight: 900; padding: 12px; border: 2px solid #cbd5e1; }
                .grammar-doc td { padding: 12px; border: 1px solid #e2e8f0; color: #334155 !important; font-weight: 500; }
                .grammar-doc code { background: #f0f9ff; color: #0284c7 !important; font-weight: 800; padding: 3px 6px; border-radius: 4px; }
              `}</style>
              <div className="grammar-doc prose max-w-none text-slate-700 leading-relaxed space-y-4" dangerouslySetInnerHTML={{ __html: noteData.htmlContent }} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
