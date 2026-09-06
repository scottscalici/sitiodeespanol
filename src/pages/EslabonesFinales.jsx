import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { db } from '../firebase'; // Ensure your firebase config is here
import { doc, getDoc, collection, getDocs, query, where } from 'firebase/firestore';

const EslabonesFinales = () => {
  const [currentGame, setCurrentGame] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // 🧠 1. STICKY START: Persist S2 or S4 selection
  const [course, setCourse] = useState(localStorage.getItem('preferredCourse') || 's2');
  
  const [currentIndex, setCurrentIndex] = useState(1);
  const [revealedCount, setRevealedCount] = useState(1);
  const [inputValue, setInputValue] = useState("");
  const [isError, setIsError] = useState(false);
  const [gameWon, setGameWon] = useState(false);

  const inputRef = useRef(null);

  // Helper to reset game state for a new puzzle
  const initializeGame = (puzzle) => {
    if (puzzle) {
      setCurrentGame(puzzle);
      setCurrentIndex(1);
      setRevealedCount(1);
      setInputValue("");
      setGameWon(false);
    }
  };

  // EFFECT: Fetch Today's Chain from Firestore
  useEffect(() => {
    const fetchChainFromFirestore = async () => {
      setLoading(true);
      const todayStr = new Date().toLocaleDateString('en-CA');
      const docId = `es-${course}-${todayStr}`; // Matches the ID format in your JSON
      
      try {
        const docRef = doc(db, "juego_eslabones", docId);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          initializeGame(docSnap.data());
        } else {
          // Fallback: If today's puzzle isn't found, find the most recent one for that course
          const q = query(
            collection(db, "juego_eslabones"), 
            where("course", "==", course)
          );
          const querySnapshot = await getDocs(q);
          if (!querySnapshot.empty) {
            const all = querySnapshot.docs.map(d => d.data());
            // Sort by date descending
            all.sort((a, b) => b.fecha.localeCompare(a.fecha));
            initializeGame(all[0]);
          } else {
            setCurrentGame(null);
          }
        }
      } catch (error) {
        console.error("Firestore Load Error:", error);
      }
      setLoading(false);
    };

    fetchChainFromFirestore();
    localStorage.setItem('preferredCourse', course);
  }, [course]);

  const normalize = (str) => str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().trim();

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!inputValue.trim() || gameWon || !currentGame) return;

    const chain = currentGame.chain || [];
    const guess = normalize(inputValue);
    const target = normalize(chain[currentIndex]);

    if (guess === target) {
      if (currentIndex === chain.length - 1) {
        setGameWon(true);
      } else {
        setCurrentIndex(currentIndex + 1);
        setRevealedCount(1);
      }
      setInputValue("");
      setIsError(false);
    } else {
      setIsError(true);
      setInputValue("");
      // Add a letter hint if they fail
      if (revealedCount < chain[currentIndex].length) setRevealedCount(revealedCount + 1);
      setTimeout(() => setIsError(false), 500);
    }
  };

  if (loading) return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center text-cyan-400 font-black italic tracking-widest">
      SINCRONIZANDO CADENA...
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-900 text-white p-4 flex flex-col items-center">
      
      {/* Header Controls */}
      <div className="w-full max-w-xl flex justify-between items-center mb-8 relative z-10">
        <Link to="/recreo" className="bg-slate-800 border border-slate-700 px-4 py-2 rounded-full font-bold text-xs text-white hover:bg-slate-700 transition-colors">
          ← Volver al Arcade
        </Link>
        <div className="flex bg-slate-800 p-1 rounded-full border border-slate-700 shadow-xl">
          <button onClick={() => setCourse('s2')} className={`px-4 py-1.5 rounded-full text-xs font-black transition-all ${course === 's2' ? 'bg-cyan-600 text-white' : 'text-slate-500 hover:text-white'}`}>S2</button>
          <button onClick={() => setCourse('s4')} className={`px-4 py-1.5 rounded-full text-xs font-black transition-all ${course === 's4' ? 'bg-cyan-600 text-white' : 'text-slate-500 hover:text-white'}`}>S4</button>
        </div>
      </div>

      <div className="text-center mb-10 z-10">
        <h1 className="text-4xl md:text-5xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500">ESLABONES</h1>
        <p className="text-slate-500 text-[10px] font-black tracking-widest uppercase mt-2">Completa la cadena lógica</p>
      </div>

      {!currentGame ? (
        <div className="text-slate-400 font-bold mt-12 uppercase tracking-widest">No hay cadena disponible hoy.</div>
      ) : (
        <div className="w-full max-w-sm z-10 space-y-3">
          {currentGame.chain.map((word, index) => {
            // Solved words
            if (index < currentIndex || gameWon) {
              return (
                <div key={index} className="flex flex-col items-center animate-fade-in">
                  <div className="bg-cyan-600 text-white font-black text-center py-3 rounded-xl w-full uppercase tracking-widest shadow-md">
                    {word}
                  </div>
                  {index < currentGame.chain.length - 1 && <div className="text-cyan-900/50 font-black py-1">↓</div>}
                </div>
              );
            }
            // Active guessing word
            if (index === currentIndex) {
              return (
                <div key={index} className={`bg-slate-800 border-4 ${isError ? 'border-red-500 animate-shake' : 'border-cyan-500'} p-5 rounded-2xl text-center shadow-2xl transition-all`}>
                  <div className="text-2xl font-black tracking-[0.3em] text-cyan-400">
                    {word.split('').map((char, i) => (i < revealedCount ? char : "_")).join(" ")}
                  </div>
                </div>
              );
            }
            return null;
          })}

          {!gameWon && (
            <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-4">
              <input 
                ref={inputRef}
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="¿Cuál es el eslabón?"
                className="bg-slate-800 border-2 border-slate-700 rounded-2xl p-4 text-center font-bold text-white focus:border-cyan-500 focus:outline-none transition-all uppercase placeholder:text-slate-600 shadow-inner"
              />
              <button className="bg-cyan-600 hover:bg-cyan-500 py-4 rounded-2xl font-black uppercase tracking-widest shadow-lg shadow-cyan-900/20 active:scale-95 transition-all">
                Comprobar
              </button>
            </form>
          )}
          
          {gameWon && (
            <div className="bg-emerald-500/10 border-2 border-emerald-500 p-8 rounded-3xl text-center animate-bounce mt-6 shadow-xl">
              <div className="text-3xl mb-2">🏆</div>
              <span className="text-emerald-400 font-black uppercase tracking-widest">¡Cadena Completada!</span>
            </div>
          )}
        </div>
      )}

      <style>{`
        @keyframes shake { 0%, 100% {transform: translateX(0);} 25% {transform: translateX(-5px);} 75% {transform: translateX(5px);} }
        .animate-shake { animation: shake 0.2s ease-in-out 2; }
        .animate-fade-in { animation: fadeIn 0.5s ease-out; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(-10px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div>
  );
};

export default EslabonesFinales;