import React, { useState, useEffect, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { getCachedCollection } from '../utils/firestoreCache';

// A plain, static print rendition of one or more grammar notes — deliberately
// NOT the interactive block/question-type registries used on screen (those
// carry state hooks, audio playback, drag handles, etc. that make no sense
// on paper). `?ids=a,b,c` prints those notes in that order, one per page.
export default function GrammarPrintView() {
  const [searchParams] = useSearchParams();
  const ids = useMemo(() => (searchParams.get('ids') || '').split(',').map((s) => s.trim()).filter(Boolean), [searchParams]);

  const [pages, setPages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showEnglish, setShowEnglish] = useState(false);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        setPages(await getCachedCollection('grammar_pages'));
      } catch (err) {
        console.error('Error loading notes to print:', err);
      }
      setLoading(false);
    };
    load();
  }, []);

  const notes = ids.map((id) => pages.find((p) => p.id === id)).filter(Boolean);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-slate-400 font-bold uppercase tracking-widest animate-pulse">Cargando...</div>;
  }

  return (
    <div className="min-h-screen bg-slate-200 print:bg-white">
      <div className="print:hidden sticky top-0 z-10 bg-slate-900 text-white p-4 flex flex-wrap items-center justify-between gap-3">
        <Link to="/gramatica" className="text-xs font-black uppercase tracking-wider bg-slate-800 hover:bg-slate-700 px-3 py-2 rounded-lg">
          ← Volver al Índice
        </Link>
        <label className="flex items-center gap-2 text-xs font-bold">
          <input type="checkbox" checked={showEnglish} onChange={(e) => setShowEnglish(e.target.checked)} />
          Incluir traducciones al inglés
        </label>
        <button
          onClick={() => window.print()}
          className="bg-indigo-600 hover:bg-indigo-700 px-4 py-2 rounded-lg text-xs font-black uppercase tracking-wider"
        >
          🖨 Imprimir ({notes.length} {notes.length === 1 ? 'nota' : 'notas'})
        </button>
      </div>

      {notes.length === 0 ? (
        <p className="p-8 text-center text-slate-500 font-bold">No se encontraron notas para imprimir.</p>
      ) : (
        notes.map((note, i) => <PrintedNote key={note.id} note={note} showEnglish={showEnglish} isLast={i === notes.length - 1} />)
      )}
    </div>
  );
}

export const PrintedNote = ({ note, showEnglish, isLast }) => (
  <div
    className={`bg-white max-w-3xl mx-auto my-6 print:my-0 p-10 print:p-0 shadow-lg print:shadow-none ${!isLast ? 'print:break-after-page' : ''}`}
  >
    <h1 className="text-2xl font-black text-slate-900 mb-1">{note.title}</h1>
    {note.category && <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-6">{note.category}</p>}
    <div className="space-y-5 text-slate-800">
      {(note.blocks || []).map((block, i) => (
        <PrintBlock key={i} block={block} showEnglish={showEnglish} />
      ))}
      {note.type !== 'landing' && !Array.isArray(note.blocks) && note.htmlContent && (
        <div className="prose max-w-none" dangerouslySetInnerHTML={{ __html: note.htmlContent }} />
      )}
    </div>
  </div>
);

const PrintBlock = ({ block, showEnglish }) => {
  switch (block.type) {
    case 'rule':
      return (
        <div>
          {block.title && <h3 className="font-black text-slate-900 mb-1">{block.title}</h3>}
          <p className="leading-relaxed">{block.text}</p>
          {showEnglish && block.textEn && <p className="leading-relaxed text-slate-500 italic mt-1">{block.textEn}</p>}
        </div>
      );
    case 'example':
      return (
        <ol className="list-decimal list-inside space-y-1">
          {(block.items || []).map((it, i) => (
            <li key={i}>
              {it.es}
              {showEnglish && it.en && <span className="text-slate-500 italic"> — {it.en}</span>}
            </li>
          ))}
        </ol>
      );
    case 'aside':
      return (
        <div className="border-l-4 border-slate-300 pl-4 italic text-slate-600">
          {block.text && <p>{block.text}</p>}
          {Array.isArray(block.items) && block.items.length > 0 && (
            <ul className="list-disc list-inside mt-1">
              {block.items.map((it, i) => <li key={i}>{it}</li>)}
            </ul>
          )}
        </div>
      );
    case 'comparison':
      return (
        <div>
          {block.title && <h3 className="font-black text-slate-900 mb-2">{block.title}</h3>}
          <table className="w-full border-collapse border border-slate-300 text-sm">
            <thead>
              <tr>
                {(block.columns || []).map((col, i) => (
                  <th key={i} className="border border-slate-300 bg-slate-50 p-2 font-black text-left">{col.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: Math.max(...(block.columns || []).map((c) => (c.items || []).length), 0) }).map((_, row) => (
                <tr key={row}>
                  {(block.columns || []).map((col, ci) => (
                    <td key={ci} className="border border-slate-300 p-2 align-top">{col.items?.[row] || ''}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    case 'link':
      return <p className="text-sm text-slate-500">→ {block.label}{block.url ? `: ${block.url}` : ''}</p>;
    // 'media' (video/slides) and 'question' (practice self-checks) are
    // deliberately never printed — this view is strictly the notes content,
    // not a worksheet or a pointer to online-only material.
    case 'media':
    case 'question':
      return null;
    default:
      return null;
  }
};
