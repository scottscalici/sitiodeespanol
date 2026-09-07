import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';

export default function GrammarNoteViewer() {
  const { noteId } = useParams();
  const navigate = useNavigate();
  
  const [noteData, setNoteData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchNote = async () => {
      if (!noteId) return;
      try {
        // Clean up the URL string just in case it has spaces or formatting
        const docId = noteId.trim().toLowerCase().replace(/\s+/g, '_');
        const docRef = doc(db, 'grammar_pages', docId);
        const snap = await getDoc(docRef);

        if (snap.exists()) {
          setNoteData(snap.data());
        } else {
          console.warn('Grammar note not found:', docId);
        }
      } catch (err) {
        console.error('Error fetching grammar note:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchNote();
  }, [noteId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center text-white">
        <p className="animate-pulse font-bold text-slate-400 uppercase tracking-widest">Cargando Nota...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 text-white p-6 md:p-12 font-sans flex flex-col items-center pb-24">
      <div className="w-full max-w-4xl">
        
        {/* TOP NAVIGATION BAR */}
        <div className="flex justify-between items-center mb-6 pb-4 border-b border-slate-800">
          <button
            onClick={() => navigate(-1)}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-black uppercase tracking-wider transition-all border border-slate-700"
          >
            ← Volver
          </button>
          {noteData?.category && (
            <span className="text-xs font-black uppercase tracking-widest text-emerald-400 bg-emerald-950/40 px-3 py-1 rounded-full border border-emerald-900/50">
              {noteData.category}
            </span>
          )}
        </div>

        {/* CONTENT CARD */}
        <div className="bg-slate-800 border border-slate-700 p-8 rounded-2xl shadow-xl">
          {noteData ? (
            <div>
              <h1 className="text-3xl font-black text-white uppercase tracking-tight mb-6 pb-4 border-b border-slate-700">
                {noteData.title}
              </h1>

              {/* RAW HTML RENDERING CONTAINER */}
              <div 
                className="prose prose-invert max-w-none text-slate-300 leading-relaxed space-y-4"
                dangerouslySetInnerHTML={{ __html: noteData.htmlContent }}
              />
            </div>
          ) : (
            <div className="text-center py-16">
              <p className="text-xl font-bold text-rose-400 mb-2">Nota no encontrada</p>
              <p className="text-sm text-slate-400">
                Asegúrate de que el documento en la colección <code className="text-sky-400">grammar_pages</code> coincida con el enlace.
              </p>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}