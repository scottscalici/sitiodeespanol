import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';

export default function FotosAzarPage() {
  const navigate = useNavigate();
  const baseUrl = "https://raw.githubusercontent.com/scottscalici/imagenes/main/randomimage/rondarelampago/";
  const jsonUrl = baseUrl + "images.json";

  const [images, setImages] = useState([]);
  const [currentImage, setCurrentImage] = useState('');
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState(null);

  const [secondsRemaining, setSecondsRemaining] = useState(0);
  const [timerInputVal, setTimerInputVal] = useState(180);
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);

  const timerRef = useRef(null);

  // Fetch image array from GitHub
  useEffect(() => {
    const loadImages = async () => {
      try {
        const response = await fetch(jsonUrl + "?t=" + new Date().getTime());
        const data = await response.json();
        setImages(data);
        setCurrentImage("https://placehold.co/600x400?text=¡Listo+para+hablar!");
      } catch (error) {
        console.error("Fetch error:", error);
        setErrorMsg("Error al cargar las imágenes. Revisa el enlace de GitHub.");
      } finally {
        setLoading(false);
      }
    };
    loadImages();
  }, []);

  // Timer tick effect
  useEffect(() => {
    if (isRunning && !isPaused) {
      timerRef.current = setInterval(() => {
        setSecondsRemaining(prev => {
          if (prev > 0) {
            return prev - 1;
          } else {
            loadNextRandomImage();
            return timerInputVal;
          }
        });
      }, 1000);
    } else {
      clearInterval(timerRef.current);
    }
    return () => clearInterval(timerRef.current);
  }, [isRunning, isPaused, images, timerInputVal]);

  const formatTime = (totalSeconds) => {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  const loadNextRandomImage = () => {
    if (images.length === 0) return;
    const randomIndex = Math.floor(Math.random() * images.length);
    const imgFileName = images[randomIndex];
    setCurrentImage(baseUrl + imgFileName);
    setSecondsRemaining(timerInputVal);
  };

  const startRonda = () => {
    clearInterval(timerRef.current);
    setIsPaused(false);
    setIsRunning(true);
    loadNextRandomImage();
  };

  const togglePause = () => {
    setIsPaused(prev => !prev);
  };

  const manualNextImage = () => {
    if (!isRunning) {
      startRonda();
    } else {
      loadNextRandomImage();
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans pb-24">
      
      {/* HEADER BAR */}
      <header className="bg-slate-900 border-b border-slate-800 p-6 shadow-xl sticky top-0 z-50">
        <div className="max-w-4xl mx-auto flex justify-between items-center">
          <div>
            <span className="bg-purple-950 text-purple-400 border border-purple-800 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest">
              Práctica Oral • IB IA Component
            </span>
            <h1 className="text-2xl sm:text-3xl font-black uppercase tracking-tight text-white mt-1">
              Fotos al Azar / Ronda Relámpago
            </h1>
          </div>
          <button onClick={() => navigate('/')} className="text-xs font-bold text-slate-400 hover:text-white bg-slate-800 px-4 py-2 rounded-xl border border-slate-700 transition-colors">
            ← Volver al Dashboard
          </button>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 mt-8 space-y-6">
        
        {/* TIMER & STATUS CARD */}
        <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl shadow-2xl text-center space-y-2">
          <div className="text-xs font-black uppercase tracking-widest text-slate-400">Tiempo restante</div>
          <div className="text-6xl font-mono font-black tracking-tighter text-emerald-400">
            {formatTime(secondsRemaining)}
          </div>
        </div>

        {/* IMAGE DISPLAY CONTAINER */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl flex items-center justify-center h-[420px] relative overflow-hidden">
          {loading ? (
            <p className="text-cyan-400 font-bold uppercase tracking-widest animate-pulse">Obteniendo imágenes...</p>
          ) : errorMsg ? (
            <p className="text-rose-400 font-bold">{errorMsg}</p>
          ) : (
            <img src={currentImage} alt="Estímulo visual para práctica oral" className="max-h-full max-w-full object-contain rounded-2xl shadow-inner bg-slate-950" />
          )}
        </div>

        {/* CONTROLS PANEL */}
        <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl shadow-2xl flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <label htmlFor="timer-input" className="text-xs font-bold text-slate-400 uppercase tracking-widest">Segundos:</label>
            <input 
              type="number" 
              id="timer-input" 
              value={timerInputVal} 
              onChange={(e) => setTimerInputVal(parseInt(e.target.value) || 60)} 
              className="w-20 bg-slate-950 border border-slate-800 text-center text-white font-bold py-2 rounded-xl outline-none focus:border-cyan-500" 
            />
          </div>

          <div className="flex flex-wrap gap-2 w-full sm:w-auto justify-end">
            <button 
              disabled={loading || images.length === 0}
              onClick={startRonda} 
              className="flex-1 sm:flex-none px-5 py-3 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white font-black uppercase tracking-widest text-xs rounded-xl shadow-lg transition-all active:scale-95 cursor-pointer"
            >
              Empezar / Reiniciar
            </button>
            <button 
              disabled={!isRunning}
              onClick={togglePause} 
              className={`flex-1 sm:flex-none px-5 py-3 disabled:opacity-50 font-black uppercase tracking-widest text-xs rounded-xl shadow-lg transition-all active:scale-95 cursor-pointer ${isPaused ? 'bg-emerald-600 hover:bg-emerald-500 text-white' : 'bg-amber-500 hover:bg-amber-400 text-slate-950'}`}
            >
              {isPaused ? 'Reanudar' : 'Pausar'}
            </button>
            <button 
              disabled={loading || images.length === 0}
              onClick={manualNextImage} 
              className="flex-1 sm:flex-none px-5 py-3 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-white font-black uppercase tracking-widest text-xs rounded-xl shadow-lg transition-all active:scale-95 cursor-pointer border border-slate-700"
            >
              Siguiente imagen →
            </button>
          </div>
        </div>

      </main>
    </div>
  );
}