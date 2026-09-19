import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import PointsIndicator from '../components/PointsIndicator';
import { awardPoints } from '../utils/pointsHelper';

const ROUND_SIZE = 5;
const POINTS_PER_WORD = 5;

const shuffle = (arr) => [...arr].sort(() => Math.random() - 0.5);

const pickRoundWords = (bank, count) => shuffle(bank).slice(0, Math.min(count, bank.length));

const buildPool = (words) => {
  let idCounter = 0;
  const tiles = words.flatMap((w) =>
    (w.silabas || []).map((text) => ({ id: `tile-${idCounter++}`, text, wordId: w.id }))
  );
  return shuffle(tiles);
};

const SilabasPage = () => {
  const { currentUser } = useAuth();
  const [bank, setBank] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pointsFlash, setPointsFlash] = useState(null);

  const [roundWords, setRoundWords] = useState([]);
  const [solvedWords, setSolvedWords] = useState([]);
  const [pool, setPool] = useState([]);
  const [staging, setStaging] = useState([]);
  const [isError, setIsError] = useState(false);

  useEffect(() => {
    const fetchBank = async () => {
      try {
        const snap = await getDocs(collection(db, 'juego_silabas'));
        const words = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setBank(words);
        const round = pickRoundWords(words, ROUND_SIZE);
        setRoundWords(round);
        setPool(buildPool(round));
      } catch (err) {
        console.error('Error fetching syllable bank:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchBank();
  }, []);

  const startNewRound = () => {
    const round = pickRoundWords(bank, ROUND_SIZE);
    setRoundWords(round);
    setSolvedWords([]);
    setPool(buildPool(round));
    setStaging([]);
    setIsError(false);
  };

  const gameComplete = roundWords.length === 0 && solvedWords.length > 0;

  const handleTapPoolTile = (tile) => {
    if (isError) return;
    const nextStaging = [...staging, tile];
    const nextTexts = nextStaging.map((t) => t.text);

    setPool((prev) => prev.filter((t) => t.id !== tile.id));
    setStaging(nextStaging);

    const exactMatch = roundWords.find(
      (w) =>
        (w.silabas || []).length === nextTexts.length &&
        w.silabas.every((s, i) => s === nextTexts[i])
    );

    if (exactMatch) {
      setStaging([]);
      setRoundWords((prev) => prev.filter((w) => w.id !== exactMatch.id));
      setSolvedWords((prev) => [...prev, exactMatch]);
      if (currentUser) {
        awardPoints(currentUser.uid, POINTS_PER_WORD)
          .then(() => setPointsFlash({ amount: POINTS_PER_WORD }))
          .catch((err) => console.error('Error saving Sílabas points:', err));
      }
      return;
    }

    const validPrefix = roundWords.some(
      (w) =>
        (w.silabas || []).length >= nextTexts.length &&
        w.silabas.slice(0, nextTexts.length).every((s, i) => s === nextTexts[i])
    );

    if (!validPrefix) {
      setIsError(true);
      setTimeout(() => {
        setPool((prev) => [...prev, ...nextStaging]);
        setStaging([]);
        setIsError(false);
      }, 600);
    }
  };

  const handleUndoLastStaged = () => {
    if (isError || staging.length === 0) return;
    const last = staging[staging.length - 1];
    setStaging((prev) => prev.slice(0, -1));
    setPool((prev) => [...prev, last]);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center text-teal-400 font-black italic tracking-widest">
        SINCRONIZANDO SÍLABAS...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 text-white p-4 flex flex-col items-center">
      <PointsIndicator flash={pointsFlash} />

      <div className="w-full max-w-2xl flex justify-between items-center mb-8">
        <Link to="/recreo" className="bg-slate-800 border border-slate-700 px-4 py-2 rounded-full font-bold text-xs text-white hover:bg-slate-700 transition-colors">
          ← Volver al Arcade
        </Link>
      </div>

      <div className="text-center mb-10">
        <h1 className="text-4xl md:text-5xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-teal-400 to-cyan-500">SÍLABAS</h1>
        <p className="text-slate-500 text-[10px] font-black tracking-widest uppercase mt-2">Reconstruye las palabras con las sílabas correctas</p>
      </div>

      {bank.length < 2 ? (
        <div className="text-slate-400 font-bold mt-12 uppercase tracking-widest text-center max-w-sm">
          Todavía no hay suficientes palabras en el banco. Vuelve pronto.
        </div>
      ) : (
        <div className="w-full max-w-2xl space-y-8">
          {/* Clue cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {solvedWords.map((w) => (
              <div key={w.id} className="bg-teal-600 rounded-xl p-4 shadow-md animate-fade-in">
                <p className="text-white font-black uppercase tracking-widest text-center">{w.palabra}</p>
              </div>
            ))}
            {roundWords.map((w) => (
              <div key={w.id} className="bg-slate-800 border border-slate-700 rounded-xl p-4">
                <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest mb-2">Pista</p>
                <p className="text-slate-300 text-sm font-medium mb-3">{w.clue}</p>
                <div className="flex gap-1.5 justify-center">
                  {(w.silabas || []).map((_, i) => (
                    <div key={i} className="w-8 h-1.5 rounded-full bg-slate-600" />
                  ))}
                </div>
              </div>
            ))}
          </div>

          {!gameComplete && (
            <>
              {/* Staging row */}
              <div className={`bg-slate-800 border-4 ${isError ? 'border-red-500 animate-shake' : 'border-teal-500'} rounded-2xl p-5 min-h-[76px] flex flex-wrap gap-2 items-center justify-center transition-colors`}>
                {staging.length === 0 ? (
                  <p className="text-slate-600 text-xs font-bold uppercase tracking-widest">Toca las sílabas en orden</p>
                ) : (
                  staging.map((tile) => (
                    <span key={tile.id} className="bg-teal-500 text-white font-black uppercase px-4 py-2 rounded-lg shadow">
                      {tile.text}
                    </span>
                  ))
                )}
              </div>

              {staging.length > 0 && !isError && (
                <div className="flex justify-center -mt-4">
                  <button
                    onClick={handleUndoLastStaged}
                    className="text-slate-400 hover:text-white text-[10px] font-bold uppercase tracking-widest border border-slate-700 bg-slate-800 px-4 py-1.5 rounded-full"
                  >
                    ⌫ Deshacer
                  </button>
                </div>
              )}

              {/* Tile pool */}
              <div className="flex flex-wrap gap-3 justify-center">
                {pool.map((tile) => (
                  <button
                    key={tile.id}
                    onClick={() => handleTapPoolTile(tile)}
                    disabled={isError}
                    className="bg-slate-800 hover:bg-slate-700 border-2 border-slate-700 hover:border-teal-500 text-teal-300 font-black uppercase px-4 py-3 rounded-xl shadow-md transition-all active:scale-95 disabled:opacity-50"
                  >
                    {tile.text}
                  </button>
                ))}
              </div>
            </>
          )}

          {gameComplete && (
            <div className="bg-emerald-500/10 border-2 border-emerald-500 p-8 rounded-3xl text-center animate-bounce">
              <div className="text-3xl mb-2">🏆</div>
              <span className="text-emerald-400 font-black uppercase tracking-widest block mb-6">¡Ronda Completada!</span>
              <button
                onClick={startNewRound}
                className="bg-teal-600 hover:bg-teal-500 text-white font-black uppercase tracking-widest px-8 py-3 rounded-xl shadow-lg active:scale-95 transition-all"
              >
                🔄 Nueva Ronda
              </button>
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

export default SilabasPage;
