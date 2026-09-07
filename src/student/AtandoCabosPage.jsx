import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { db } from '../firebase'; // Ensure your firebase config is here
import { doc, getDoc, collection, getDocs, query, where } from 'firebase/firestore';

const AtandoCabosPage = () => {
  const [currentGame, setCurrentGame] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // 🧠 1. STICKY START: Persist S2 or S4 selection
  const [course, setCourse] = useState(localStorage.getItem('preferredCourse') || 's2');
  
  const [shuffledWords, setShuffledWords] = useState([]);
  const [selectedWords, setSelectedWords] = useState([]);
  const [solvedCategories, setSolvedCategories] = useState([]);
  const [mistakesLeft, setMistakesLeft] = useState(4);
  const [isShaking, setIsShaking] = useState(false);

  const solvedColors = [
    "bg-[#f9df6d] text-slate-900", // Yellow
    "bg-[#a0c35a] text-slate-900", // Green
    "bg-[#b0c4ef] text-slate-900", // Blue
    "bg-[#ba81c5] text-slate-900"  // Purple
  ];

  // Helper function to cleanly reset the board when loading a new puzzle
  const initializeBoard = (puzzle) => {
    setCurrentGame(puzzle);
    if (puzzle) {
      const allWords = puzzle.categories.flatMap(cat => cat.items || []);
      setShuffledWords([...allWords].sort(() => Math.random() - 0.5));
      setSelectedWords([]);
      setSolvedCategories([]);
      setMistakesLeft(4);
      setIsShaking(false);
    }
  };

  // EFFECT: Fetch Today's Puzzle from Firestore
  useEffect(() => {
    const fetchGameFromFirestore = async () => {
      setLoading(true);
      const todayStr = new Date().toLocaleDateString('en-CA');
      const docId = `ac-${course}-${todayStr}`; // Matches the ID format in your JSON
      
      try {
        const docRef = doc(db, "juego_atandocabos", docId);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          initializeBoard(docSnap.data());
        } else {
          // Fallback: If today's puzzle isn't found, find the most recent one for this course
          const q = query(
            collection(db, "juego_atandocabos"), 
            where("course", "==", course)
          );
          const querySnapshot = await getDocs(q);
          if (!querySnapshot.empty) {
            const all = querySnapshot.docs.map(d => d.data());
            // Sort by date descending
            all.sort((a, b) => b.fecha.localeCompare(a.fecha));
            initializeBoard(all[0]);
          } else {
            setCurrentGame(null);
          }
        }
      } catch (error) {
        console.error("Firestore Load Error:", error);
      }
      setLoading(false);
    };

    fetchGameFromFirestore();
    localStorage.setItem('preferredCourse', course);
  }, [course]);

  // 🎲 RANDOMIZER: Fetch available puzzles and pick one
  const loadRandomPastPuzzle = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, "juego_atandocabos"), where("course", "==", course));
      const snap = await getDocs(q);
      const puzzles = snap.docs.map(d => d.data());
      
      if (puzzles.length > 0) {
        const random = puzzles[Math.floor(Math.random() * puzzles.length)];
        initializeBoard(random);
      }
    } catch (err) { console.error(err); }
    setLoading(false);
  };

  const handleWordClick = (word) => {
    if (selectedWords.includes(word)) {
      setSelectedWords(selectedWords.filter(w => w !== word));
    } else if (selectedWords.length < 4) {
      setSelectedWords([...selectedWords, word]);
    }
  };

  const handleDesordenar = () => {
    setShuffledWords([...shuffledWords].sort(() => Math.random() - 0.5));
  };

  const handleSubmit = () => {
    if (selectedWords.length !== 4) return;
    const matchingCategory = currentGame.categories.find(cat => {
      const catItems = cat.items || [];
      return selectedWords.every(word => catItems.includes(word));
    });

    if (matchingCategory) {
      setSolvedCategories([...solvedCategories, matchingCategory]);
      setShuffledWords(shuffledWords.filter(w => !selectedWords.includes(w)));
      setSelectedWords([]);
    } else {
      setIsShaking(true);
      setMistakesLeft(prev => prev - 1);
      setTimeout(() => setIsShaking(false), 500);
    }
  };

  const gameWon = solvedCategories.length === 4;
  const gameOver = mistakesLeft === 0 && !gameWon;

  // Render Logic...
  if (loading) return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center">
      <div className="text-fuchsia-500 font-black animate-pulse uppercase">Conectando...</div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-900 font-sans p-4 md:p-8 flex flex-col items-center">
      {/* Background Glow */}
      <div className="fixed top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-fuchsia-600/10 rounded-full blur-[100px] pointer-events-none"></div>

      <div className="w-full max-w-2xl flex justify-between items-center mb-12 relative z-10">
        <Link to="/recreo" className="text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 px-4 py-2 rounded-full font-bold transition-all text-sm flex items-center gap-2">
          ← Volver al Arcade
        </Link>
        
        <div className="flex gap-2">
          <button 
            onClick={loadRandomPastPuzzle}
            className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-slate-800 border border-slate-700 text-fuchsia-400 text-xs font-black uppercase tracking-widest hover:bg-slate-700 hover:text-fuchsia-300 transition-colors"
          >
            <span className="text-sm">🎲</span> Aleatorio
          </button>

          <div className="flex bg-slate-800 p-1 rounded-full border border-slate-700">
            <button onClick={() => setCourse('s2')} className={`px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-widest transition-all ${course === 's2' ? 'bg-fuchsia-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'}`}>Español 2</button>
            <button onClick={() => setCourse('s4')} className={`px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-widest transition-all ${course === 's4' ? 'bg-fuchsia-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'}`}>Español 4</button>
          </div>
        </div>
      </div>

      {/* Main Title Section */}
      <div className="text-center mb-8 relative z-10">
        <div className="text-4xl mb-3">🧶</div>
        <h1 className="text-3xl md:text-5xl font-black text-white uppercase tracking-tighter drop-shadow-sm mb-2">Atando Cabos</h1>
        <p className="text-slate-400 font-medium uppercase tracking-widest text-xs md:text-sm">Encuentra 4 grupos de 4 palabras</p>
      </div>

      {!currentGame ? (
        <div className="text-slate-400 font-bold mt-12 uppercase tracking-tighter">No hay puzzle disponible hoy.</div>
      ) : (
        <div className="w-full max-w-2xl relative z-10 flex flex-col items-center">
          
          <div className="w-full flex flex-col gap-2 mb-2">
            {solvedCategories.map((cat, idx) => (
              <div key={idx} className={`${solvedColors[idx % 4]} rounded-xl p-4 text-center shadow-lg animate-[fade-in_0.5s_ease-out]`}>
                <h4 className="font-black text-sm uppercase tracking-widest mb-1">{cat.title}</h4>
                <p className="text-sm font-bold opacity-90">{(cat.items).join(", ")}</p>
              </div>
            ))}
          </div>

          {(!gameWon && !gameOver) && (
            <div className={`grid grid-cols-4 gap-2 w-full mb-8 ${isShaking ? 'animate-[shake_0.4s_ease-in-out]' : ''}`}>
              {shuffledWords.map((word, idx) => {
                const isSelected = selectedWords.includes(word);
                return (
                  <button key={idx} onClick={() => handleWordClick(word)} className={`aspect-square sm:aspect-auto sm:h-20 rounded-xl font-bold text-xs sm:text-sm uppercase transition-all duration-200 flex items-center justify-center p-2 text-center leading-tight select-none ${isSelected ? 'bg-fuchsia-700 text-white shadow-inner scale-95 border-2 border-fuchsia-400' : 'bg-slate-800 text-slate-200 hover:bg-slate-700 active:scale-95 border-2 border-slate-700'}`}>
                    {word}
                  </button>
                );
              })}
            </div>
          )}

          {/* Success / Failure States */}
          {(gameWon || gameOver) && (
             <div className="flex flex-col items-center w-full my-6 animate-[fade-in_0.5s_ease-out]">
                <div className={`font-black p-6 rounded-2xl w-full text-center uppercase tracking-widest mb-4 shadow-lg ${gameWon ? 'bg-emerald-900/50 text-emerald-400 border border-emerald-500/50' : 'bg-red-900/50 text-red-400 border border-red-500/50'}`}>
                  {gameWon ? "🏆 ¡Perfecto! Cabos atados." : "¡Uf! Casi. Inténtalo de nuevo."}
                </div>
                <button onClick={loadRandomPastPuzzle} className="px-8 py-4 rounded-full bg-fuchsia-600 hover:bg-fuchsia-500 text-white font-black uppercase tracking-widest transition-all shadow-lg hover:-translate-y-1">
                  🎲 Jugar Otro Puzzle
                </button>
             </div>
          )}

          {/* Controls Footer */}
          {(!gameWon && !gameOver) && (
            <div className="w-full flex flex-col items-center gap-6 mt-4">
              <div className="flex items-center gap-3 bg-slate-800 px-6 py-3 rounded-full border border-slate-700">
                <span className="text-xs font-black uppercase tracking-widest text-slate-400">Fallos:</span>
                <div className="flex gap-2">
                  {[...Array(4)].map((_, i) => (
                    <div key={i} className={`w-3.5 h-3.5 rounded-full transition-colors ${i < mistakesLeft ? 'bg-fuchsia-500 shadow-[0_0_10px_rgba(217,70,239,0.5)]' : 'bg-slate-700'}`} />
                  ))}
                </div>
              </div>
              <div className="flex gap-4">
                <button onClick={handleDesordenar} className="px-6 py-3.5 rounded-full font-black text-xs uppercase tracking-widest border-2 border-slate-600 text-slate-300 hover:bg-slate-800 transition-all active:scale-95">Desordenar</button>
                <button onClick={handleSubmit} disabled={selectedWords.length !== 4} className={`px-8 py-3.5 rounded-full font-black text-xs uppercase tracking-widest transition-all active:scale-95 ${selectedWords.length === 4 ? 'bg-fuchsia-600 text-white shadow-[0_0_20px_rgba(217,70,239,0.4)]' : 'bg-slate-800 text-slate-500 cursor-not-allowed border-2 border-slate-700'}`}>Enviar</button>
              </div>
            </div>
          )}
        </div>
      )}

      <style dangerouslySetInnerHTML={{__html: `
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-5px); }
          50% { transform: translateX(5px); }
          75% { transform: translateX(-5px); }
        }
      `}} />
    </div>
  );
};

export default AtandoCabosPage;