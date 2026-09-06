import React, { useState, useEffect } from 'react';

const AtandoCabos = ({ atandoData, todayStr, course }) => {
  
  // 🛡️ PARCHE DE SEGURIDAD: 
  // Si atandoData no es una lista (Array), la convertimos en una, o en una lista vacía.
  const safeData = Array.isArray(atandoData) ? atandoData : (atandoData?.categories ? [atandoData] : []);

  // 🌟 LÓGICA TIPO NYT CONNECTIONS:
  const currentGame = safeData.find(g => {
    const matchFecha = g.fecha === todayStr;
    const matchCourse = !g.course || g.course === "all" || g.course === course || (Array.isArray(g.course) && g.course.includes(course));
    return matchFecha && matchCourse;
  });

  const [shuffledWords, setShuffledWords] = useState([]);
  const [selectedWords, setSelectedWords] = useState([]);
  const [solvedCategories, setSolvedCategories] = useState([]);
  const [mistakesLeft, setMistakesLeft] = useState(4);
  const [isShaking, setIsShaking] = useState(false);

  useEffect(() => {
    if (currentGame) {
      const allWords = currentGame.categories.flatMap(cat => cat.words || cat.items || []);
      setShuffledWords([...allWords].sort(() => Math.random() - 0.5));
      setSelectedWords([]);
      setSolvedCategories([]);
      setMistakesLeft(4);
      setIsShaking(false);
    }
  }, [currentGame, todayStr]); // Se reinicia si cambia la fecha real

  if (!currentGame) return null; // Se oculta si no hay puzzle programado para hoy

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
      const catItems = cat.words || cat.items || [];
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

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex flex-col items-center mt-6">
      <div className="w-full flex justify-between items-end mb-2">
        <h3 className="font-black text-xl text-slate-800 flex items-center gap-2">
          <span>🧶</span> Atando Cabos
        </h3>
        <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 bg-slate-100 px-2 py-1 rounded">
          Puzzle Diario
        </span>
      </div>
      
      <p className="text-sm text-slate-500 mb-6 w-full font-medium">
        Encuentra 4 grupos de 4 palabras que compartan una conexión.
      </p>

      {/* CATEGORÍAS RESUELTAS */}
      <div className="w-full flex flex-col gap-2 mb-4">
        {solvedCategories.map((cat, idx) => (
          <div key={idx} className="bg-slate-100 rounded-lg p-4 text-center border border-slate-200 shadow-sm animate-fade-in">
            <h4 className="font-black text-sm uppercase tracking-widest text-slate-800 mb-1">{cat.title}</h4>
            <p className="text-xs font-bold text-slate-700">{(cat.words || cat.items).join(", ")}</p>
          </div>
        ))}
      </div>

      {/* CUADRÍCULA DE JUEGO */}
      {(!gameWon && !gameOver) && (
        <div className={`grid grid-cols-4 gap-2 w-full mb-6 ${isShaking ? 'row-shake' : ''}`}>
          {shuffledWords.map((word, idx) => {
            const isSelected = selectedWords.includes(word);
            return (
              <button
                key={idx}
                onClick={() => handleWordClick(word)}
                className={`aspect-square sm:aspect-auto sm:h-16 rounded-md font-bold text-[10px] sm:text-[11px] uppercase transition-all duration-200 flex items-center justify-center p-2 text-center leading-tight
                  ${isSelected 
                    ? 'bg-slate-700 text-white shadow-inner scale-95' 
                    : 'bg-slate-100 text-slate-800 hover:bg-slate-200 active:scale-95 border border-slate-200'
                  }`}
              >
                {word}
              </button>
            );
          })}
        </div>
      )}

      {/* ESTADOS FINALES */}
      {gameWon && (
        <div className="bg-emerald-100 text-emerald-700 font-bold p-4 rounded-lg w-full text-center uppercase tracking-widest my-4 border border-emerald-200">
          ¡Perfecto! Vuelve mañana para un nuevo reto. 🎉
        </div>
      )}
      {gameOver && (
        <div className="bg-red-100 text-red-700 font-bold p-4 rounded-lg w-full text-center uppercase tracking-widest my-4 border border-red-200">
          ¡Uf! Casi. Inténtalo de nuevo mañana.
        </div>
      )}

      {/* CONTROLES */}
      {(!gameWon && !gameOver) && (
        <div className="w-full flex flex-col items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-widest text-slate-400">Intentos restantes:</span>
            <div className="flex gap-1">
              {[...Array(4)].map((_, i) => (
                <div key={i} className={`w-3 h-3 rounded-full ${i < mistakesLeft ? 'bg-slate-700' : 'bg-slate-200'}`} />
              ))}
            </div>
          </div>

          <div className="flex gap-3">
            <button 
              onClick={handleDesordenar}
              className="px-6 py-3 rounded-full font-bold text-xs uppercase tracking-widest border-2 border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
            >
              Desordenar
            </button>
            <button 
              onClick={handleSubmit}
              disabled={selectedWords.length !== 4}
              className={`px-6 py-3 rounded-full font-bold text-xs uppercase tracking-widest transition-colors shadow-md ${
                selectedWords.length === 4 
                  ? 'bg-indigo-600 text-white hover:bg-indigo-700' 
                  : 'bg-slate-200 text-slate-400 cursor-not-allowed'
              }`}
            >
              Enviar
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AtandoCabos;