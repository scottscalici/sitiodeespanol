import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase.js';
import { useAuth } from '../context/AuthContext';

// Shuffles a copy of the array (Fisher-Yates would be overkill here — a
// simple random sort is fine for a handful of answer tiles).
const shuffle = (arr) => [...arr].sort(() => Math.random() - 0.5);

export default function CuriosidadQuizEngine() {
  const { curiosidadId } = useParams();
  const { userData } = useAuth();
  const navigate = useNavigate();

  const [curiosidad, setCuriosidad] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [matchedPairIdx, setMatchedPairIdx] = useState([]); // indices into pairs matched so far, this question
  const [selectedLeftIdx, setSelectedLeftIdx] = useState(null);
  const [shuffledAnswers, setShuffledAnswers] = useState([]);
  const [wrongFlashIdx, setWrongFlashIdx] = useState(null); // answer tile index to briefly flash red

  // First-attempt correctness per pair, keyed `${questionIdx}-${pairIdx}` —
  // only ever set once per pair, so a retry after a miss doesn't change the
  // recorded grade (same "first attempt" principle as Calentamiento).
  const firstAttemptRef = useRef({});

  const [timerSeconds, setTimerSeconds] = useState(0);
  const [finished, setFinished] = useState(false);
  const [waitingForMinTime, setWaitingForMinTime] = useState(false);
  const [saveState, setSaveState] = useState('idle'); // 'idle' | 'saving' | 'saved' | 'error'
  const [finalGrade, setFinalGrade] = useState(null);

  const isAdmin = userData?.role === 'admin';

  // 1. Fetch the curiosidad (bundle doc first, legacy standalone doc as a
  // fallback) and make sure it actually has interactive questions attached.
  useEffect(() => {
    if (!curiosidadId) return;
    const fetchCuriosidad = async () => {
      try {
        const bundleSnap = await getDoc(doc(db, 'curiosidades', '_bundle'));
        let data = bundleSnap.exists() ? bundleSnap.data()?.items?.[curiosidadId] : null;

        if (!data) {
          const legacySnap = await getDoc(doc(db, 'curiosidades', curiosidadId));
          if (legacySnap.exists()) data = legacySnap.data();
        }

        if (!data || !data.questions || data.questions.length === 0) {
          setNotFound(true);
        } else {
          setCuriosidad(data);
        }
      } catch (err) {
        console.error('Error fetching curiosidad quiz:', err);
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    };
    fetchCuriosidad();
  }, [curiosidadId]);

  // 2. Timer, running until finished
  useEffect(() => {
    if (finished) return;
    const interval = setInterval(() => setTimerSeconds((s) => s + 1), 1000);
    return () => clearInterval(interval);
  }, [finished]);

  // 3. Shuffle this question's answer bank whenever we land on a new question
  useEffect(() => {
    if (!curiosidad) return;
    const q = curiosidad.questions[currentQuestion];
    if (!q) return;
    const answers = q.pairs.map((p) => p.answer).concat(q.distractors || []);
    setShuffledAnswers(shuffle(answers));
    setMatchedPairIdx([]);
    setSelectedLeftIdx(null);
  }, [curiosidad, currentQuestion]);

  const totalPairs = curiosidad
    ? curiosidad.questions.reduce((sum, q) => sum + q.pairs.length, 0)
    : 0;

  const handleSelectLeft = (pairIdx) => {
    if (matchedPairIdx.includes(pairIdx)) return;
    setSelectedLeftIdx(pairIdx);
  };

  const handleAttemptAnswer = (answer, answerTileIdx) => {
    if (selectedLeftIdx === null) return;
    const q = curiosidad.questions[currentQuestion];
    const pair = q.pairs[selectedLeftIdx];
    const key = `${currentQuestion}-${selectedLeftIdx}`;
    const isCorrect = pair.answer === answer;

    if (!(key in firstAttemptRef.current)) {
      firstAttemptRef.current[key] = isCorrect;
    }

    if (isCorrect) {
      setMatchedPairIdx((prev) => [...prev, selectedLeftIdx]);
      setSelectedLeftIdx(null);
    } else {
      setWrongFlashIdx(answerTileIdx);
      setTimeout(() => setWrongFlashIdx(null), 400);
    }
  };

  const goToPreviousQuestion = () => {
    setCurrentQuestion((q) => Math.max(0, q - 1));
  };

  const handleFinishQuiz = async () => {
    const correctCount = Object.values(firstAttemptRef.current).filter(Boolean).length;
    const grade = totalPairs > 0 ? Math.round((correctCount / totalPairs) * 100) : 0;
    setFinalGrade(grade);

    if (!userData || !userData.uid || isAdmin) {
      setFinished(true);
      setSaveState('saved');
      return;
    }

    setSaveState('saving');
    try {
      const userRef = doc(db, 'users', userData.uid);
      const snap = await getDoc(userRef);
      const existingGrade = snap.exists() ? snap.data().progress?.curiosidades?.[curiosidadId]?.grade ?? -1 : -1;

      if (grade > existingGrade) {
        await setDoc(
          userRef,
          {
            progress: {
              curiosidades: {
                [curiosidadId]: { completed: true, grade, timestamp: new Date().toISOString() },
              },
            },
          },
          { merge: true }
        );
      }
      setSaveState('saved');
    } catch (err) {
      console.error('Error saving curiosidad quiz grade:', err);
      setSaveState('error');
    }
    setFinished(true);
  };

  const handleAdvance = () => {
    const isLastQuestion = currentQuestion === curiosidad.questions.length - 1;
    if (!isLastQuestion) {
      setCurrentQuestion((q) => q + 1);
      return;
    }

    const minSeconds = curiosidad.minSeconds ?? 60;
    if (!isAdmin && timerSeconds < minSeconds) {
      setWaitingForMinTime(true);
    } else {
      handleFinishQuiz();
    }
  };

  // Once the min-time wait is active, keep checking the ticking timer and
  // finish automatically the instant it's satisfied — no extra click needed.
  useEffect(() => {
    if (!waitingForMinTime || !curiosidad) return;
    const minSeconds = curiosidad.minSeconds ?? 60;
    if (timerSeconds >= minSeconds) {
      setWaitingForMinTime(false);
      handleFinishQuiz();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timerSeconds, waitingForMinTime]);

  const handleReturnHome = () => navigate('/');

  if (loading) {
    return (
      <div className="p-10 text-center font-bold text-slate-400 animate-pulse">
        Cargando Curiosidad...
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="min-h-screen bg-slate-900 text-white p-10 flex flex-col items-center justify-center gap-4">
        <p className="text-lg font-bold text-rose-400">
          No se encontró esta curiosidad interactiva.
        </p>
        <button
          onClick={handleReturnHome}
          className="px-6 py-3 bg-sky-600 hover:bg-sky-700 rounded-xl font-black uppercase tracking-widest text-xs"
        >
          🚀 Volver
        </button>
      </div>
    );
  }

  const formatTime = (secs) => {
    const mins = Math.floor(secs / 60);
    const remSecs = secs % 60;
    return `${mins.toString().padStart(2, '0')}:${remSecs.toString().padStart(2, '0')}`;
  };

  if (waitingForMinTime) {
    const minSeconds = curiosidad.minSeconds ?? 60;
    return (
      <div className="min-h-screen bg-slate-900 text-white p-10 flex flex-col items-center justify-center gap-4 text-center">
        <div className="text-5xl mb-2">⏳</div>
        <p className="text-lg font-bold text-amber-400">¡Tómate tu tiempo!</p>
        <p className="text-sm text-slate-400 max-w-sm">
          Para que cuente, espera un poco más antes de ver tus resultados.
        </p>
        <p className="text-3xl font-black text-sky-400 font-mono">
          {formatTime(Math.max(0, minSeconds - timerSeconds))}
        </p>
      </div>
    );
  }

  if (finished) {
    return (
      <div className="min-h-screen bg-slate-900 text-white p-6 flex flex-col items-center justify-center gap-6 text-center">
        <h2 className="text-3xl font-black text-emerald-400 uppercase tracking-tighter">
          ¡Curiosidad Completada!
        </h2>
        <p className="text-5xl font-black text-white">{finalGrade}%</p>
        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
          {saveState === 'saving' && '💾 Guardando tu progreso...'}
          {saveState === 'saved' && '✅ Progreso guardado'}
          {saveState === 'error' && '⚠️ Hubo un problema guardando. Intenta de nuevo antes de salir.'}
        </p>
        <button
          onClick={handleReturnHome}
          className="px-8 py-4 bg-sky-600 hover:bg-sky-700 text-white font-black rounded-2xl shadow-lg uppercase tracking-widest text-xs transition-transform hover:scale-105"
        >
          🚀 Volver
        </button>
      </div>
    );
  }

  const question = curiosidad.questions[currentQuestion];
  const allMatched = matchedPairIdx.length === question.pairs.length;
  const isLastQuestion = currentQuestion === curiosidad.questions.length - 1;

  return (
    <div className="min-h-screen bg-slate-900 text-white p-6 font-sans flex flex-col items-center pb-20">
      <header className="w-full max-w-3xl bg-slate-800 border border-slate-700 p-4 rounded-2xl flex justify-between items-center mb-6 shadow-md">
        <div>
          <span className="text-xs font-black text-sky-400 uppercase tracking-widest">
            Curiosidad • Pregunta {currentQuestion + 1} de {curiosidad.questions.length}
          </span>
          <h1 className="text-xl font-black text-white uppercase tracking-tight">
            {curiosidad.title}
          </h1>
        </div>
        <div className="flex items-center gap-6 bg-slate-900 px-4 py-2 rounded-xl border border-slate-700">
          <div className="text-center">
            <p className="text-[9px] font-black text-slate-400 uppercase">Tiempo</p>
            <p className="text-lg font-black text-sky-400 font-mono">{formatTime(timerSeconds)}</p>
          </div>
        </div>
        <button
          onClick={handleReturnHome}
          className="text-slate-400 hover:text-white font-bold text-xl px-3 py-1 bg-slate-700 rounded-lg"
        >
          ✕
        </button>
      </header>

      <main className="w-full max-w-3xl bg-slate-800 border border-slate-700 p-8 rounded-2xl shadow-xl min-h-[400px] flex flex-col justify-between">
        <div>
          <p className="text-sm text-slate-300 font-bold mb-6 text-center">{question.prompt}</p>

          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-2">
              {question.pairs.map((pair, pIdx) => (
                <button
                  key={pIdx}
                  onClick={() => handleSelectLeft(pIdx)}
                  disabled={matchedPairIdx.includes(pIdx)}
                  className={`w-full p-2 border rounded-xl text-left transition-all ${
                    matchedPairIdx.includes(pIdx)
                      ? 'opacity-20 pointer-events-none bg-slate-950 border-slate-900'
                      : selectedLeftIdx === pIdx
                      ? 'border-sky-400 bg-sky-950'
                      : 'bg-slate-900 border-slate-700 hover:border-slate-500'
                  }`}
                >
                  {pair.left.type === 'image' ? (
                    <img src={pair.left.value} alt="" className="w-full h-20 object-cover rounded-lg" />
                  ) : (
                    <span className="text-xs font-bold text-slate-200">{pair.left.value}</span>
                  )}
                </button>
              ))}
            </div>

            <div className="space-y-2">
              {shuffledAnswers.map((answer, aIdx) => {
                const alreadyUsed = matchedPairIdx.some((pIdx) => question.pairs[pIdx].answer === answer);
                return (
                  <button
                    key={aIdx}
                    onClick={() => handleAttemptAnswer(answer, aIdx)}
                    disabled={alreadyUsed}
                    className={`w-full p-3 border rounded-xl text-xs font-bold text-left transition-all ${
                      alreadyUsed
                        ? 'opacity-20 pointer-events-none bg-slate-950 border-slate-900 text-slate-700'
                        : wrongFlashIdx === aIdx
                        ? 'border-rose-500 bg-rose-950 text-rose-300'
                        : 'bg-slate-900 border-slate-700 text-slate-300 hover:border-amber-400'
                    }`}
                  >
                    {answer}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between pt-6 border-t border-slate-700 mt-6">
          {currentQuestion > 0 ? (
            <button
              onClick={goToPreviousQuestion}
              className="px-6 py-3 bg-slate-700 hover:bg-slate-600 text-white font-black rounded-xl text-xs uppercase tracking-widest"
            >
              ⬅ Anterior
            </button>
          ) : (
            <span />
          )}

          {allMatched && (
            <button
              onClick={handleAdvance}
              className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-xl text-xs uppercase tracking-widest shadow-md animate-pulse"
            >
              {isLastQuestion ? 'Terminar ✅' : 'Siguiente ➡'}
            </button>
          )}
        </div>
      </main>
    </div>
  );
}
