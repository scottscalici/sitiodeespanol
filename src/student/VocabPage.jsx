import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { getVocabUnitWord } from '../utils/vocabUnitLabel';

export default function VocabPage() {
  const { bundleId } = useParams();
  const [bundleData, setBundleData] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // View Modes: 'lista', 'tarjetas', 'tabu'
  const [viewMode, setViewMode] = useState('lista');
  
  // Interactive Deck States
  const [activeFilters, setActiveFilters] = useState([]);
  const [studyDeck, setStudyDeck] = useState([]);
  const [activeCardIndex, setActiveCardIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  // Tarjetas only: which language shows on the front of the card.
  const [cardDirection, setCardDirection] = useState('es-en');

  // Theme colors for the list sections
  const sectionThemes = [
    { border: 'border-sky-500', text: 'text-sky-700', bg: 'bg-sky-50' },
    { border: 'border-emerald-500', text: 'text-emerald-700', bg: 'bg-emerald-50' },
    { border: 'border-purple-500', text: 'text-purple-700', bg: 'bg-purple-50' },
    { border: 'border-amber-500', text: 'text-amber-700', bg: 'bg-amber-50' },
    { border: 'border-rose-500', text: 'text-rose-700', bg: 'bg-rose-50' }
  ];

  // 1. Fetch Data
  useEffect(() => {
    const loadChapterVocab = async () => {
      if (!bundleId) return;
      try {
        const bundleRef = doc(db, 'vocab_bundles', bundleId);
        const bundleSnap = await getDoc(bundleRef);
        
        if (bundleSnap.exists()) {
          setBundleData(bundleSnap.data());
        }
      } catch (error) {
        console.error("Error loading vocab bundle:", error);
      } finally {
        setLoading(false);
      }
    };

    loadChapterVocab();
  }, [bundleId]);

  // 2. Base Lists (Used for the chronological List View & extracting available sections)
  const { sortedWords, groupedWords, allSections } = useMemo(() => {
    if (!bundleData || !bundleData.words) return { sortedWords: [], groupedWords: {}, allSections: [] };

    // Filter out words without sections
    const validWords = bundleData.words.filter(w => w.metadata?.secciones && w.metadata.secciones.length > 0);

    // Sort chronologically by section tag
    const sorted = validWords.sort((a, b) => {
      const secA = a.metadata.secciones[0];
      const secB = b.metadata.secciones[0];
      return secA.localeCompare(secB, undefined, { numeric: true, sensitivity: 'base' });
    });

    // Extract unique sections
    const sectionsSet = new Set(validWords.map(w => w.metadata.secciones[0]));
    const uniqueSections = Array.from(sectionsSet).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

    // Group for the List View
    const grouped = sorted.reduce((acc, word) => {
      const sec = word.metadata.secciones[0];
      if (!acc[sec]) acc[sec] = [];
      acc[sec].push(word);
      return acc;
    }, {});

    return { sortedWords: sorted, groupedWords: grouped, allSections: uniqueSections };
  }, [bundleData]);

  // 3. Initialize Filters (Check all sections by default when data loads)
  useEffect(() => {
    if (allSections.length > 0 && activeFilters.length === 0) {
      setActiveFilters(allSections);
    }
  }, [allSections]);

  // 4. Build the Randomized Study Deck based on active filters
  const shuffleAndSetDeck = useCallback((sectionsToInclude) => {
    if (!bundleData || !bundleData.words) return;
    
    // Filter words based on the active checkboxes
    const filtered = bundleData.words.filter(w => {
      const sec = w.metadata?.secciones?.[0];
      return sec && sectionsToInclude.includes(sec);
    });

    // Fisher-Yates Shuffle for true randomness
    const shuffled = [...filtered];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    setStudyDeck(shuffled);
    setActiveCardIndex(0);
    setIsFlipped(false);
  }, [bundleData]);

  // Re-build deck whenever filters change
  useEffect(() => {
    if (activeFilters.length > 0) {
      shuffleAndSetDeck(activeFilters);
    }
  }, [activeFilters, shuffleAndSetDeck]);

  // 5. Handlers
  const toggleFilter = (section) => {
    setActiveFilters(prev => {
      if (prev.includes(section)) {
        if (prev.length === 1) return prev; // Prevent unchecking the very last box
        return prev.filter(s => s !== section);
      } else {
        return [...prev, section];
      }
    });
  };

  const nextCard = () => {
    setIsFlipped(false);
    setTimeout(() => {
      setActiveCardIndex((prev) => (prev + 1) % studyDeck.length);
    }, 150);
  };

  const prevCard = () => {
    setIsFlipped(false);
    setTimeout(() => {
      setActiveCardIndex((prev) => (prev === 0 ? studyDeck.length - 1 : prev - 1));
    }, 150);
  };

  const handleModeChange = (mode) => {
    setViewMode(mode);
    setIsFlipped(false);
  };

  // --- RENDER ---

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-indigo-600 font-black animate-pulse uppercase tracking-widest">
          Cargando Capítulo...
        </div>
      </div>
    );
  }

  if (sortedWords.length === 0) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-8 text-center">
        <h2 className="text-3xl font-black text-slate-500 uppercase mb-4">Capítulo No Encontrado</h2>
        <Link to="/" className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-lg transition-all">
          Volver al Inicio
        </Link>
      </div>
    );
  }

  const currentStudyWord = studyDeck[activeCardIndex];

  return (
    <div className="min-h-screen bg-slate-50 p-4 sm:p-8 font-sans text-slate-800 pb-24">
      <div className="max-w-4xl mx-auto">
        
        {/* HEADER */}
        <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4 bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <div>
            <p className="text-xs font-black text-indigo-500 uppercase tracking-widest mb-1">
              {bundleData.textbook}
            </p>
            <h1 className="text-3xl font-black text-slate-800 uppercase tracking-tight">
              {getVocabUnitWord(bundleData.textbook)} {bundleData.chapter}
            </h1>
            <p className="text-sm font-medium text-slate-500 mt-1">
              {sortedWords.length} Términos Totales
            </p>
          </div>
          <Link to="/" className="text-slate-500 hover:text-slate-800 font-bold text-sm bg-slate-100 hover:bg-slate-200 px-5 py-2.5 rounded-xl transition-colors">
            Volver al Inicio ↗
          </Link>
        </header>

        {/* STUDY MODES TOGGLE */}
        <div className="flex flex-wrap gap-2 mb-6 bg-white p-2 rounded-2xl shadow-sm border border-slate-200 w-fit">
           <button 
             onClick={() => handleModeChange('lista')}
             className={`px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${viewMode === 'lista' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-100'}`}
           >
             📋 Lista
           </button>
           <button 
             onClick={() => handleModeChange('tarjetas')}
             className={`px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${viewMode === 'tarjetas' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-100'}`}
           >
             🗂️ Tarjetas
           </button>
           <button 
             onClick={() => handleModeChange('tabu')}
             className={`px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${viewMode === 'tabu' ? 'bg-rose-500 text-white shadow-md' : 'text-slate-500 hover:bg-slate-100'}`}
           >
             🗣️ Tabú
           </button>
        </div>

        {/* STUDY DECK CONTROLS (Only visible in Tarjetas/Tabu) */}
        {(viewMode === 'tarjetas' || viewMode === 'tabu') && (
          <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-8 bg-white p-4 rounded-2xl shadow-sm border border-slate-200">
            <div className="flex flex-wrap items-center gap-3 flex-1">
              <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Incluir Secciones:</span>
              {allSections.map(sec => (
                <label key={sec} className={`flex items-center gap-2 cursor-pointer px-3 py-1.5 rounded-lg border transition-colors ${activeFilters.includes(sec) ? 'bg-indigo-50 border-indigo-200' : 'bg-slate-50 border-slate-200 hover:bg-slate-100'}`}>
                  <input
                    type="checkbox"
                    checked={activeFilters.includes(sec)}
                    onChange={() => toggleFilter(sec)}
                    className="accent-indigo-600 w-4 h-4 cursor-pointer"
                  />
                  <span className={`text-xs font-bold ${activeFilters.includes(sec) ? 'text-indigo-700' : 'text-slate-500'}`}>{sec}</span>
                </label>
              ))}
            </div>

            {viewMode === 'tarjetas' && (
              <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-xl shrink-0">
                <button
                  onClick={() => { setCardDirection('es-en'); setIsFlipped(false); }}
                  className={`px-4 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${cardDirection === 'es-en' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  Español → Inglés
                </button>
                <button
                  onClick={() => { setCardDirection('en-es'); setIsFlipped(false); }}
                  className={`px-4 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${cardDirection === 'en-es' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  Inglés → Español
                </button>
              </div>
            )}

            <button
              onClick={() => shuffleAndSetDeck(activeFilters)}
              className="flex items-center justify-center gap-2 px-5 py-2.5 bg-indigo-100 hover:bg-indigo-200 text-indigo-700 font-bold text-xs uppercase tracking-widest rounded-xl transition-all active:scale-95 shrink-0"
            >
              <span>🔀</span> Mezclar Cartas
            </button>
          </div>
        )}

        {/* 📋 VIEW: STUDY LIST */}
        {viewMode === 'lista' && (
          <div className="space-y-6">
            {Object.entries(groupedWords).map(([section, wordsInSection], index) => {
              const theme = sectionThemes[index % sectionThemes.length];
              return (
                <section key={section} className={`bg-white rounded-2xl shadow-sm p-6 sm:p-8 border-l-4 ${theme.border}`}>
                  <h2 className={`text-xl font-bold mb-4 ${theme.text}`}>
                    Sección {section}
                  </h2>
                  <div className="overflow-auto">
                    <table className="min-w-full text-sm sm:text-base">
                      <tbody className="divide-y divide-slate-100">
                        {wordsInSection.map((w, idx) => (
                          <tr key={idx} className={`hover:${theme.bg} transition-colors group`}>
                            <td className="py-3 pr-4 font-bold text-slate-800 w-1/2 align-top">
                              {w.palabra}
                            </td>
                            <td className="py-3 text-slate-600 w-1/2 align-top">
                              {w.traduccion}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              );
            })}
          </div>
        )}

        {/* 🗂️ VIEW: TARJETAS */}
        {viewMode === 'tarjetas' && currentStudyWord && (
          <div className="flex flex-col items-center justify-center w-full max-w-2xl mx-auto relative perspective-1000 mt-4">
            <div className="w-full flex justify-between items-end mb-4 px-2">
              <span className="text-slate-400 font-bold text-xs uppercase tracking-widest">
                {studyDeck.length} Términos en juego
              </span>
              <span className="text-indigo-500 font-mono font-bold tracking-widest uppercase text-xs bg-indigo-50 px-3 py-1 rounded-md">
                Tarjeta {activeCardIndex + 1} / {studyDeck.length}
              </span>
            </div>

            <div 
              onClick={() => setIsFlipped(!isFlipped)}
              className="relative w-full h-[400px] cursor-pointer group"
              style={{ perspective: "1000px" }}
            >
              <div className="w-full h-full transition-transform duration-500 ease-in-out" style={{ transformStyle: 'preserve-3d', transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0)' }}>
                
                {/* FRONT */}
                <div className="absolute inset-0 w-full h-full bg-white border border-slate-200 rounded-[2rem] p-8 flex flex-col justify-center items-center text-center shadow-xl" style={{ backfaceVisibility: 'hidden' }}>
                  <div className="absolute top-6 left-6 flex gap-2">
                    <span className="bg-slate-100 text-slate-500 text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg border border-slate-200">
                      Sec. {currentStudyWord.metadata?.secciones?.[0] || '-'}
                    </span>
                    <span className="bg-indigo-50 text-indigo-500 text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg border border-indigo-100">
                      {currentStudyWord.metadata?.tipo || 'Término'}
                    </span>
                  </div>
                  <h2 className="text-4xl sm:text-5xl font-black text-slate-800 tracking-tighter">
                    {cardDirection === 'es-en' ? currentStudyWord.palabra : currentStudyWord.traduccion}
                  </h2>
                  <p className="absolute bottom-6 text-slate-400 text-[10px] font-bold uppercase tracking-widest">
                    Toca para voltear
                  </p>
                </div>

                {/* BACK */}
                <div className="absolute inset-0 w-full h-full bg-indigo-600 rounded-[2rem] p-8 flex flex-col justify-center items-center text-center shadow-xl" style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}>
                  <h3 className="text-4xl sm:text-5xl font-black text-white tracking-tighter">
                    {cardDirection === 'es-en' ? currentStudyWord.traduccion : currentStudyWord.palabra}
                  </h3>
                </div>
              </div>
            </div>

            {/* CONTROLS */}
            <div className="flex gap-6 mt-8">
              <button onClick={prevCard} className="w-16 h-16 rounded-full bg-white border border-slate-200 text-slate-400 flex items-center justify-center text-2xl hover:bg-slate-50 hover:text-indigo-600 shadow-sm transition-all active:scale-95">
                ←
              </button>
              <button onClick={nextCard} className="w-16 h-16 rounded-full bg-white border border-slate-200 text-slate-400 flex items-center justify-center text-2xl hover:bg-slate-50 hover:text-indigo-600 shadow-sm transition-all active:scale-95">
                →
              </button>
            </div>
          </div>
        )}

        {/* 🗣️ VIEW: TABÚ */}
        {viewMode === 'tabu' && currentStudyWord && (
          <div className="flex flex-col items-center justify-center w-full max-w-2xl mx-auto relative perspective-1000 mt-4">
            <div className="w-full flex justify-between items-end mb-4 px-2">
              <span className="text-slate-400 font-bold text-xs uppercase tracking-widest">
                {studyDeck.length} Pistas en juego
              </span>
              <span className="text-rose-500 font-mono font-bold tracking-widest uppercase text-xs bg-rose-50 px-3 py-1 rounded-md">
                Pista {activeCardIndex + 1} / {studyDeck.length}
              </span>
            </div>

            <div 
              onClick={() => setIsFlipped(!isFlipped)}
              className="relative w-full h-[400px] cursor-pointer group"
              style={{ perspective: "1000px" }}
            >
              <div className="w-full h-full transition-transform duration-500 ease-in-out" style={{ transformStyle: 'preserve-3d', transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0)' }}>
                
                {/* FRONT (Definición) */}
                <div className="absolute inset-0 w-full h-full bg-white border-t-8 border-rose-500 rounded-[2rem] p-8 sm:p-12 flex flex-col justify-center items-center text-center shadow-xl" style={{ backfaceVisibility: 'hidden' }}>
                  <span className="bg-rose-50 text-rose-500 text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg absolute top-6 right-6 border border-rose-100">
                    Adivina la palabra
                  </span>
                  <p className="text-xl sm:text-2xl font-medium text-slate-700 leading-relaxed">
                    {currentStudyWord.definiciones?.nivel2?.[1] || currentStudyWord.definiciones?.nivel2?.[0] || currentStudyWord.traduccion}
                  </p>
                  <p className="absolute bottom-6 text-slate-400 text-[10px] font-bold uppercase tracking-widest">
                    Toca para revelar
                  </p>
                </div>

                {/* BACK (Palabra) */}
                <div className="absolute inset-0 w-full h-full bg-rose-500 rounded-[2rem] p-8 flex flex-col justify-center items-center text-center shadow-xl" style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}>
                  <h3 className="text-4xl sm:text-5xl font-black text-white tracking-tighter">
                    {currentStudyWord.palabra}
                  </h3>
                </div>
              </div>
            </div>

            {/* CONTROLS */}
            <div className="flex gap-6 mt-8">
              <button onClick={prevCard} className="w-16 h-16 rounded-full bg-white border border-slate-200 text-slate-400 flex items-center justify-center text-2xl hover:bg-rose-50 hover:text-rose-500 shadow-sm transition-all active:scale-95">
                ←
              </button>
              <button onClick={nextCard} className="w-16 h-16 rounded-full bg-white border border-slate-200 text-slate-400 flex items-center justify-center text-2xl hover:bg-rose-50 hover:text-rose-500 shadow-sm transition-all active:scale-95">
                →
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}