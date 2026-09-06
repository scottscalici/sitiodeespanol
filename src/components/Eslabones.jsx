import React, { useState, useRef, useEffect } from 'react';

const Eslabones = ({ gameData }) => {
  const fallbackData = {
    theme: "El Impacto",
    chain: ["PLATO", "FUERTE", "GOLPE", "BAJO", "PERFIL", "FALSO", "TECHO", "CORREDIZO"]
  };
  
  const data = gameData || fallbackData;
  const chain = data.chain;

  const [currentIndex, setCurrentIndex] = useState(1);
  const [revealedCount, setRevealedCount] = useState(1);
  const [inputValue, setInputValue] = useState("");
  const [isError, setIsError] = useState(false);
  const [gameWon, setGameWon] = useState(false);
  
  // Nuevo: Estado para darle feedback claro al estudiante
  const [feedbackMessage, setFeedbackMessage] = useState(""); 
  const [feedbackType, setFeedbackType] = useState(""); // "success" o "error"

  const inputRef = useRef(null);

  useEffect(() => {
    if (!gameWon) inputRef.current?.focus();
  }, [currentIndex, gameWon]);

  const normalize = (str) => {
    return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().trim();
  };

  const currentTarget = chain[currentIndex];

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!inputValue.trim() || gameWon) return;

    const guess = normalize(inputValue);
    const target = normalize(currentTarget);

    if (guess === target) {
      // 🟢 ACERTASTE
      if (currentIndex === chain.length - 1) {
        setGameWon(true);
        setFeedbackMessage("¡Completaste la cadena!");
        setFeedbackType("success");
      } else {
        setCurrentIndex(currentIndex + 1);
        setRevealedCount(1);
        setFeedbackMessage("¡Correcto!");
        setFeedbackType("success");
        setTimeout(() => setFeedbackMessage(""), 1500); // Ocultar mensaje después de 1.5s
      }
      setInputValue("");
      setIsError(false);
    } else {
      // 🔴 FALLASTE
      setIsError(true);
      setInputValue("");
      
      if (revealedCount < currentTarget.length) {
        setRevealedCount(revealedCount + 1);
        setFeedbackMessage("Incorrecto. ¡Aquí tienes una letra más!");
      } else {
        setFeedbackMessage("Incorrecto. ¡Sigue intentando!");
      }
      setFeedbackType("error");
      
      setTimeout(() => {
        setIsError(false);
        setFeedbackMessage("");
      }, 2000);
    }
  };

  const renderMaskedWord = (word) => {
    const chars = word.split('');
    return chars.map((char, i) => (i < revealedCount ? char : "_")).join(" ");
  };

  return (
    <div className="bg-slate-50 p-6 md:p-12 rounded-2xl border border-slate-200 max-w-lg mx-auto shadow-sm">
      
      <div className="text-center mb-10">
        <h4 className="text-[10px] font-black uppercase tracking-widest text-indigo-500 mb-1">
          El Eslabón Perdido BANANA
        </h4>
        <h2 className="text-3xl font-black text-slate-800 tracking-tighter">
          {data.theme}
        </h2>
      </div>

      <div className="flex flex-col items-center space-y-2 mb-10">
        {chain.map((word, index) => {
          if (index < currentIndex) {
            return (
              <React.Fragment key={index}>
                <div className="bg-indigo-600 text-white font-black text-lg px-6 py-3 rounded-xl shadow-md w-full max-w-[280px] text-center uppercase tracking-[0.2em] animate-fade-in">
                  {word}
                </div>
                {index < chain.length - 1 && (
                  <div className="text-indigo-300 text-xl font-black">↓</div>
                )}
              </React.Fragment>
            );
          }
          
          if (index === currentIndex && !gameWon) {
            return (
              <div key={index} className="w-full max-w-[280px]">
                <div className={`bg-white border-4 ${isError ? 'border-red-500 scale-105' : 'border-indigo-400'} text-indigo-900 font-black text-2xl px-4 py-3 rounded-xl shadow-lg w-full text-center tracking-[0.3em] transition-all duration-200`}>
                  {renderMaskedWord(word)}
                </div>
              </div>
            );
          }

          return null;
        })}

        {gameWon && (
          <div className="bg-emerald-500 text-white font-black text-2xl px-6 py-4 rounded-xl shadow-lg w-full max-w-[280px] text-center uppercase tracking-widest mt-4 animate-bounce">
            ¡COMPLETADO! 🎉
          </div>
        )}
      </div>

      {/* Mensaje de feedback para que el estudiante sepa exactamente qué pasó */}
      <div className="h-6 mb-4 text-center">
        {feedbackMessage && (
          <span className={`font-bold text-sm tracking-wide ${feedbackType === 'success' ? 'text-emerald-600' : 'text-red-500'}`}>
            {feedbackMessage}
          </span>
        )}
      </div>

      {!gameWon && (
        <form onSubmit={handleSubmit} className="flex flex-col items-center">
          <input 
            ref={inputRef}
            type="text" 
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => e.stopPropagation()}
            placeholder="Adivina el eslabón..."
            // "formNoValidate" ayuda a apagar validaciones raras del navegador
            formNoValidate 
            className="w-full max-w-[280px] text-center font-bold text-lg px-4 py-3 border-2 border-slate-300 rounded-lg focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 focus:outline-none uppercase transition-all shadow-inner"
            autoComplete="off"
            spellCheck="false"
          />
          <button 
            type="submit" 
            className="mt-4 bg-slate-800 hover:bg-black text-white font-bold text-xs uppercase tracking-widest px-8 py-3 rounded-lg transition-colors shadow-md w-full max-w-[280px]"
          >
            Comprobar
          </button>
        </form>
      )}

    </div>
  );
};

export default Eslabones;