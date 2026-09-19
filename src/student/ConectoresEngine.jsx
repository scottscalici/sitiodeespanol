import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { awardPoints } from '../utils/pointsHelper';

const ROUND_SIZE = 10;
const POINTS_PER_ROUND = 5;

const shuffle = (array) => [...array].sort(() => Math.random() - 0.5);

export default function ConectoresEngine({ onClose }) {
  const { currentUser, userData } = useAuth();
  const navigate = useNavigate();
  const course = (userData?.course || 's2').toLowerCase();

  const [bank, setBank] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [round, setRound] = useState([]);
  const [wordBank, setWordBank] = useState([]);
  const [answers, setAnswers] = useState({});
  const [results, setResults] = useState({});
  const [checked, setChecked] = useState(false);
  const [perfect, setPerfect] = useState(false);
  const [roundsCompleted, setRoundsCompleted] = useState(0);
  const [score, setScore] = useState(null);

  const generateRound = useCallback((sourceBank) => {
    const shuffledBank = shuffle(sourceBank);
    const usedAnswers = new Set();
    const nextRound = [];

    for (const item of shuffledBank) {
      if (!usedAnswers.has(item.respuesta)) {
        nextRound.push(item);
        usedAnswers.add(item.respuesta);
        if (nextRound.length === ROUND_SIZE) break;
      }
    }

    setRound(nextRound);
    setWordBank(shuffle(nextRound.map((q) => q.respuesta)));
    setAnswers({});
    setResults({});
    setChecked(false);
    setPerfect(false);
    setScore(null);
  }, []);

  useEffect(() => {
    const fetchBank = async () => {
      try {
        const docRef = doc(db, 'config', 'conectores_practica');
        const docSnap = await getDoc(docRef);
        const items = docSnap.exists() ? docSnap.data().items || [] : [];

        const filtered = items.filter(
          (item) =>
            Array.isArray(item.courses) &&
            item.courses.map((c) => String(c).toLowerCase()).includes(course)
        );

        setBank(filtered);
        if (filtered.length > 0) generateRound(filtered);
      } catch (err) {
        console.error('Error loading conectores bank:', err);
        setError('Error cargando los datos.');
      } finally {
        setLoading(false);
      }
    };
    fetchBank();
  }, [course, generateRound]);

  const handleSelect = (index, value) => {
    setAnswers((prev) => ({ ...prev, [index]: value }));
  };

  const checkAnswers = async () => {
    let correctCount = 0;
    const newResults = {};

    round.forEach((item, index) => {
      const isCorrect = answers[index] === item.respuesta;
      newResults[index] = isCorrect ? 'correct' : 'incorrect';
      if (isCorrect) correctCount++;
    });

    setResults(newResults);
    setChecked(true);
    setScore(correctCount);

    const isPerfect = correctCount === round.length;
    setPerfect(isPerfect);

    if (isPerfect) {
      setRoundsCompleted((prev) => prev + 1);

      if (currentUser?.uid) {
        try {
          await awardPoints(currentUser.uid, POINTS_PER_ROUND);
        } catch (err) {
          console.error('Error saving conectores points:', err);
        }
      }
    }
  };

  const handleClose = () => {
    if (onClose) onClose();
    else navigate('/');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <p className="text-slate-400 font-bold uppercase tracking-widest animate-pulse">
          Cargando Conectores...
        </p>
      </div>
    );
  }

  if (error || bank.length === 0) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center gap-4 p-6 text-center">
        <p className="text-rose-400 font-bold">
          {error || 'No hay preguntas de conectores disponibles para tu curso todavía.'}
        </p>
        <button
          onClick={handleClose}
          className="px-6 py-3 bg-slate-700 hover:bg-slate-600 text-white font-black rounded-xl text-xs uppercase tracking-widest"
        >
          ← Volver
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 text-white p-6 font-sans flex flex-col items-center pb-20">
      <header className="w-full max-w-4xl bg-slate-800 border border-slate-700 p-4 rounded-2xl flex justify-between items-center mb-6 shadow-md">
        <div>
          <span className="text-xs font-black text-sky-400 uppercase tracking-widest">
            Práctica
          </span>
          <h1 className="text-xl font-black text-white uppercase tracking-tight">
            Conectores Lógicos
          </h1>
        </div>
        <div className="text-center bg-slate-900 px-4 py-2 rounded-xl border border-slate-700">
          <p className="text-[9px] font-black text-slate-400 uppercase">Rondas</p>
          <p className="text-lg font-black text-sky-400 font-mono">{roundsCompleted}</p>
        </div>
        <button
          onClick={handleClose}
          className="text-slate-400 hover:text-white font-bold text-xl px-3 py-1 bg-slate-700 rounded-lg"
        >
          ✕
        </button>
      </header>

      <main className="w-full max-w-4xl bg-slate-800 border border-slate-700 p-8 rounded-2xl shadow-xl">
        <div className="mb-6 border-b border-slate-700 pb-4">
          <h2 className="text-lg font-black uppercase text-sky-400 mb-3">Banco de Palabras</h2>
          <div className="flex flex-wrap gap-2">
            {wordBank.map((word, i) => (
              <span
                key={i}
                className="px-3 py-1 bg-slate-900 border border-slate-700 text-white text-xs font-bold rounded-md"
              >
                {word}
              </span>
            ))}
          </div>
        </div>

        <div className="space-y-4 mb-6">
          {round.map((item, index) => {
            const status = results[index];
            const borderStyle =
              status === 'correct'
                ? 'border-2 border-emerald-500 bg-emerald-950/30'
                : status === 'incorrect'
                ? 'border-2 border-rose-500 bg-rose-950/30'
                : 'border border-slate-700 bg-slate-900';

            const parts = item.texto.split('_');

            return (
              <div key={index} className={`p-4 rounded-xl flex items-center gap-3 transition-all ${borderStyle}`}>
                <span className="text-xs font-black text-slate-500 shrink-0">{index + 1}.</span>
                <p className="text-slate-200 font-medium leading-loose text-sm w-full">
                  {parts[0]}
                  <select
                    value={answers[index] || ''}
                    onChange={(e) => handleSelect(index, e.target.value)}
                    disabled={perfect}
                    className="border-b-2 border-sky-400 bg-sky-950/50 text-sky-300 font-bold px-2 py-1 mx-1 outline-none text-sm cursor-pointer"
                  >
                    <option value="">[ Selecciona ]</option>
                    {wordBank.map((word, i) => (
                      <option key={i} value={word}>
                        {word}
                      </option>
                    ))}
                  </select>
                  {parts[1]}
                </p>
              </div>
            );
          })}
        </div>

        <div className="flex items-center justify-between pt-4 border-t border-slate-700">
          {!perfect ? (
            <button
              onClick={checkAnswers}
              className="px-8 py-4 bg-sky-600 hover:bg-sky-700 text-white font-black rounded-xl text-xs uppercase tracking-widest shadow-md transition-all"
            >
              Revisar Respuestas
            </button>
          ) : (
            <button
              onClick={() => generateRound(bank)}
              className="px-8 py-4 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-xl text-xs uppercase tracking-widest shadow-md transition-all animate-pulse"
            >
              Siguiente Ronda ➡ (+{POINTS_PER_ROUND} pts)
            </button>
          )}

          {checked && score !== null && (
            <p
              className={`text-sm font-black uppercase tracking-widest ${
                perfect ? 'text-emerald-400' : score >= round.length * 0.7 ? 'text-amber-400' : 'text-rose-400'
              }`}
            >
              {score} / {round.length}
            </p>
          )}
        </div>
      </main>
    </div>
  );
}