import React, { useState, useEffect } from 'react';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  setDoc,
} from 'firebase/firestore';
import { db } from '../firebase.js';
import { useAuth } from '../context/AuthContext';

export default function CalentamientoEngine({
  targetDia,
  courseId,
  warmupId,
  onClose,
}) {
  const { userData } = useAuth();

  const [warmupData, setWarmupData] = useState(null);
  const [loading, setLoading] = useState(true);

  // Engine States
  const [currentModule, setCurrentModule] = useState(1);
  const [completedModules, setCompletedModules] = useState(0);
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [isTimerRunning, setIsTimerRunning] = useState(false);

  // Verb Module States
  const [verbInputs, setVerbInputs] = useState({});
  const [verbResults, setVerbResults] = useState({});

  // Vocab Station States (New Flow)
  const [vocabPhase, setVocabPhase] = useState('preview'); // 'preview', 'match', 'done'
  const [shuffledEngAnswers, setShuffledEngAnswers] = useState([]);
  const [selectedSpanishCard, setSelectedSpanishCard] = useState(null);
  const [matchedPairs, setMatchedPairs] = useState([]);

  // Reset Vocab States when moving to a new module
  useEffect(() => {
    setVocabPhase('preview');
    setMatchedPairs([]);
    setSelectedSpanishCard(null);
    setShuffledEngAnswers([]);
  }, [currentModule]);

  // 1. Fetch the baked warmup documents dynamically from BOTH collections
  useEffect(() => {
    if (!targetDia || !courseId) return;

    const fetchCombinedWarmup = async () => {
      try {
        let verbsData = null;
        let vocabData = null;
        let mainDocId = null;

        const formattedCourse = String(courseId).toLowerCase();
        const targetDiaNum = Number(targetDia);

        const verbsQuery = query(
          collection(db, 'calentamientos'),
          where('dia', '==', targetDiaNum),
          where('course', '==', formattedCourse)
        );

        const vocabQuery = query(
          collection(db, 'dailyVocabWarmups'),
          where('dia', '==', targetDiaNum),
          where('course', '==', formattedCourse)
        );

        const [verbsSnap, vocabSnap] = await Promise.all([
          getDocs(verbsQuery),
          getDocs(vocabQuery),
        ]);

        if (!verbsSnap.empty) {
          verbsData = verbsSnap.docs[0].data();
          mainDocId = verbsSnap.docs[0].id;
        }

        if (!vocabSnap.empty) {
          vocabData = vocabSnap.docs[0].data();
        }

        if (verbsData || vocabData) {
          setWarmupData({
            dia: targetDiaNum,
            course: formattedCourse,
            title: verbsData?.title || vocabData?.name || `Día ${targetDiaNum}`,
            docId: mainDocId || 'combined_warmup',
            bakedQuestions: verbsData?.bakedQuestions || [],
            sequence: vocabData?.sequence || [],
          });
          setIsTimerRunning(true);
        } else {
          alert(
            `Práctica no encontrada para el Día ${targetDiaNum} (${formattedCourse.toUpperCase()}).`
          );
          onClose?.();
        }
      } catch (err) {
        console.error('Error fetching warmup:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchCombinedWarmup();
  }, [targetDia, courseId, onClose]);

  // 2. Session Timer Interval
  useEffect(() => {
    let interval = null;
    if (isTimerRunning) {
      interval = setInterval(() => {
        setTimerSeconds((prev) => prev + 1);
      }, 1000);
    } else {
      clearInterval(interval);
    }
    return () => clearInterval(interval);
  }, [isTimerRunning]);

  const formatTime = (secs) => {
    const mins = Math.floor(secs / 60);
    const remSecs = secs % 60;
    return `${mins.toString().padStart(2, '0')}:${remSecs
      .toString()
      .padStart(2, '0')}`;
  };

  if (loading || !warmupData) {
    return (
      <div className="p-10 text-center font-bold text-slate-400 animate-pulse">
        Cargando Calentamiento...
      </div>
    );
  }

  const bakedVerbs = warmupData.bakedQuestions || [];
  const bakedVocab = warmupData.sequence || [];

  const verbPages = Math.ceil(bakedVerbs.length / 5);
  const vocabPages = Math.ceil(bakedVocab.length / 10);
  const totalModules = verbPages + vocabPages + 1;

  // Handle Verb Checking
  const handleCheckVerbs = (pageIndex) => {
    const slice = bakedVerbs.slice((pageIndex - 1) * 5, pageIndex * 5);
    let allCorrect = true;
    const newResults = { ...verbResults };

    slice.forEach((v, idx) => {
      const globalIdx = (pageIndex - 1) * 5 + idx;
      const userVal = (verbInputs[globalIdx] || '').trim().toLowerCase();
      const expected = (v.forma || '').toLowerCase();

      const allowed = expected.split(/[/|;,]/).map((a) => a.trim());

      if (allowed.includes(userVal)) {
        newResults[globalIdx] = 'correct';
      } else {
        newResults[globalIdx] = 'incorrect';
        allCorrect = false;
      }
    });

    setVerbResults(newResults);
    setCompletedModules(Math.max(completedModules, pageIndex));

    if (allCorrect) {
      alert('¡Excelente! Módulo de verbos perfecto.');
    } else {
      alert(
        'Hay respuestas incorrectas. Puedes corregirlas o avanzar si estás satisfecho.'
      );
    }
  };

  // Vocab Flow: Start Match
  const handleStartVocabMatch = (slice) => {
    // Shuffle english answers exactly once
    setShuffledEngAnswers([...slice].sort(() => Math.random() - 0.5));
    setVocabPhase('match');
  };

  // Vocab Flow: Handle Match Click
  const handleMatchAttempt = (englishCard, totalSliceCount, vocabPageIndex) => {
    if (
      selectedSpanishCard &&
      selectedSpanishCard.palabra === englishCard.palabra
    ) {
      const newMatched = [...matchedPairs, englishCard.palabra];
      setMatchedPairs(newMatched);
      setSelectedSpanishCard(null);

      // Check if all are done
      if (newMatched.length === totalSliceCount) {
        setVocabPhase('done');
        setCompletedModules(
          Math.max(completedModules, verbPages + vocabPageIndex)
        );
      }
    } else {
      alert('Incorrecto, intenta de nuevo.');
      setSelectedSpanishCard(null);
    }
  };

  // Final Grade Calculation & Point Awarding
  const handleFinishSession = async () => {
    setIsTimerRunning(false);

    const correctVerbs = Object.values(verbResults).filter(
      (res) => res === 'correct'
    ).length;
    const verbAccuracy =
      bakedVerbs.length > 0 ? correctVerbs / bakedVerbs.length : 1;

    const verbGradePoints = verbAccuracy * 4;
    const vocabGradePoints = bakedVocab.length > 0 ? 1 : 0;
    const totalGrade = verbGradePoints + vocabGradePoints;
    const percentageGrade = (totalGrade / 5) * 100;
    const pointsEarned = 20;

    if (userData && userData.uid) {
      try {
        const userRef = doc(db, 'users', userData.uid);
        const snap = await getDoc(userRef);

        let newTotal = pointsEarned;
        let newMonthly = pointsEarned;
        let newWeekly = pointsEarned;
        let newDaily = pointsEarned;
        let highestGrade = percentageGrade;

        if (snap.exists()) {
          const data = snap.data();
          newTotal += data.total_points || data.current_path_points || 0;
          newMonthly += data.monthly_points || 0;
          newWeekly += data.weekly_points || 0;
          newDaily += data.daily_points || 0;

          const existingAttempt =
            data.progress?.warmups?.[warmupData.docId]?.grade || 0;
          if (existingAttempt > highestGrade) {
            highestGrade = existingAttempt;
          }
        }

        await setDoc(
          userRef,
          {
            total_points: newTotal,
            current_path_points: newTotal,
            monthly_points: newMonthly,
            weekly_points: newWeekly,
            daily_points: newDaily,
            progress: {
              ...userData.progress,
              warmups: {
                ...(userData.progress?.warmups || {}),
                [warmupData.docId]: {
                  completed: true,
                  grade: highestGrade,
                  rawScore: `${totalGrade.toFixed(1)}/5`,
                  timestamp: new Date().toISOString(),
                },
              },
            },
          },
          { merge: true }
        );

        alert(
          `¡Completado! Obtuviste ${totalGrade.toFixed(
            1
          )}/5 puntos académicos. (+${pointsEarned} puntos de juego).`
        );
      } catch (err) {
        console.error('Error saving calentamiento points:', err);
      }
    }

    onClose?.();
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white p-6 font-sans flex flex-col items-center pb-20">
      {/* HEADER BAR */}
      <header className="w-full max-w-4xl bg-slate-800 border border-slate-700 p-4 rounded-2xl flex justify-between items-center mb-6 shadow-md">
        <div>
          <span className="text-xs font-black text-sky-400 uppercase tracking-widest">
            Día {warmupData.dia} • {warmupData.course?.toUpperCase()}
          </span>
          <h1 className="text-xl font-black text-white uppercase tracking-tight">
            {warmupData.title}
          </h1>
        </div>
        <div className="flex items-center gap-6 bg-slate-900 px-4 py-2 rounded-xl border border-slate-700">
          <div className="text-center">
            <p className="text-[9px] font-black text-slate-400 uppercase">
              Tiempo
            </p>
            <p className="text-lg font-black text-sky-400 font-mono">
              {formatTime(timerSeconds)}
            </p>
          </div>
        </div>
        <button
          onClick={() => onClose?.()}
          className="text-slate-400 hover:text-white font-bold text-xl px-3 py-1 bg-slate-700 rounded-lg"
        >
          ✕
        </button>
      </header>

      {/* MODULE CONTAINER */}
      <main className="w-full max-w-4xl bg-slate-800 border border-slate-700 p-8 rounded-2xl shadow-xl min-h-[450px] flex flex-col justify-between">
        {/* --- VERB PAGES --- */}
        {currentModule <= verbPages && (
          <div>
            <div className="flex justify-between items-end border-b border-slate-700 pb-3 mb-6">
              <h2 className="text-lg font-black uppercase text-amber-400">
                Bloque de Verbos (Página {currentModule} de {verbPages})
              </h2>
              <span className="text-xs font-mono text-slate-400">
                5 Verbos por página
              </span>
            </div>

            <div className="space-y-4 mb-6">
              {bakedVerbs
                .slice((currentModule - 1) * 5, currentModule * 5)
                .map((v, idx) => {
                  const globalIdx = (currentModule - 1) * 5 + idx;
                  const status = verbResults[globalIdx];
                  const borderStyle =
                    status === 'correct'
                      ? 'border-2 border-emerald-500 bg-emerald-950/30'
                      : status === 'incorrect'
                      ? 'border-2 border-rose-500 bg-rose-950/30'
                      : 'border border-slate-700 bg-slate-900';

                  return (
                    <div
                      key={globalIdx}
                      className={`p-4 rounded-xl ${borderStyle} transition-all`}
                    >
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-xs font-black uppercase text-slate-300">
                          {globalIdx + 1}. {v.sujeto} ({v.palabra}) —{' '}
                          <span className="text-sky-400 italic">{v.tense}</span>
                        </span>
                        <span className="text-xs text-slate-400 font-medium">
                          {v.traducción}
                        </span>
                      </div>
                      <input
                        type="text"
                        placeholder="Escribe la forma conjugada..."
                        value={verbInputs[globalIdx] || ''}
                        onChange={(e) =>
                          setVerbInputs({
                            ...verbInputs,
                            [globalIdx]: e.target.value,
                          })
                        }
                        className="w-full p-2.5 bg-slate-950 border border-slate-700 rounded-lg text-sm font-bold text-white outline-none focus:ring-2 focus:ring-sky-400"
                      />
                    </div>
                  );
                })}
            </div>

            <div className="flex justify-between items-center pt-4 border-t border-slate-700">
              <button
                onClick={() => handleCheckVerbs(currentModule)}
                className="px-6 py-3 bg-sky-600 hover:bg-sky-700 text-white font-black rounded-xl text-xs uppercase tracking-widest shadow-md transition-all"
              >
                Revisar Bloque
              </button>

              {completedModules >= currentModule && (
                <button
                  onClick={() => setCurrentModule(currentModule + 1)}
                  className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-xl text-xs uppercase tracking-widest shadow-md transition-all animate-pulse"
                >
                  Siguiente ➡
                </button>
              )}
            </div>
          </div>
        )}

        {/* --- VOCABULARY PAGES (REDESIGNED) --- */}
        {currentModule > verbPages &&
          currentModule <= totalModules - 1 &&
          (() => {
            const vocabPageIndex = currentModule - verbPages;
            const slice = bakedVocab.slice(
              (vocabPageIndex - 1) * 10,
              vocabPageIndex * 10
            );

            return (
              <div>
                <div className="flex justify-between items-end border-b border-slate-700 pb-3 mb-6">
                  <h2 className="text-lg font-black uppercase text-sky-400">
                    Estación de Vocabulario (Parte {vocabPageIndex})
                  </h2>
                  <span className="text-xs font-mono text-slate-400">
                    {vocabPhase === 'preview' ? 'Revisión' : 'Emparejamiento'}
                  </span>
                </div>

                {/* PHASE 1: PREVIEW */}
                {vocabPhase === 'preview' && (
                  <div className="text-center">
                    <p className="text-sm text-slate-400 mb-6">
                      Revisa estos {slice.length} términos antes de comenzar la
                      prueba de memoria.
                    </p>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-8">
                      {slice.map((w, idx) => (
                        <div
                          key={idx}
                          className="bg-slate-900 border border-slate-700 p-4 rounded-xl flex flex-col items-center justify-center"
                        >
                          <span className="font-black text-white text-sm text-center">
                            {w.palabra}
                          </span>
                        </div>
                      ))}
                    </div>
                    <button
                      onClick={() => handleStartVocabMatch(slice)}
                      className="px-8 py-4 bg-sky-600 hover:bg-sky-700 text-white font-black rounded-xl uppercase tracking-widest shadow-md transition-all"
                    >
                      Emparejar Ahora
                    </button>
                  </div>
                )}

                {/* PHASE 2: MATCHING */}
                {vocabPhase === 'match' && (
                  <div>
                    <p className="text-xs text-slate-400 mb-4 text-center">
                      Selecciona un término en español y luego su significado
                      correcto en inglés.
                    </p>
                    <div className="grid grid-cols-2 gap-4">
                      {/* Spanish Side (Original Order) */}
                      <div className="space-y-2">
                        {slice.map((p, i) => (
                          <button
                            key={`es-${i}`}
                            onClick={() => setSelectedSpanishCard(p)}
                            disabled={matchedPairs.includes(p.palabra)}
                            className={`w-full p-3 border rounded-xl text-xs font-bold text-left transition-all 
                            ${
                              matchedPairs.includes(p.palabra)
                                ? 'opacity-20 pointer-events-none bg-slate-950 border-slate-900 text-slate-700'
                                : selectedSpanishCard?.palabra === p.palabra
                                ? 'border-sky-400 bg-sky-950 text-white'
                                : 'bg-slate-800 border-slate-700 text-slate-300 hover:border-slate-500'
                            }`}
                          >
                            {p.palabra}
                          </button>
                        ))}
                      </div>
                      {/* English Side (Shuffled Order, Locked in State) */}
                      <div className="space-y-2">
                        {shuffledEngAnswers.map((p, i) => (
                          <button
                            key={`en-${i}`}
                            onClick={() =>
                              handleMatchAttempt(
                                p,
                                slice.length,
                                vocabPageIndex
                              )
                            }
                            disabled={matchedPairs.includes(p.palabra)}
                            className={`w-full p-3 border rounded-xl text-xs font-bold text-left transition-all 
                            ${
                              matchedPairs.includes(p.palabra)
                                ? 'opacity-20 pointer-events-none bg-slate-950 border-slate-900 text-slate-700'
                                : 'bg-slate-800 border-slate-700 text-slate-300 hover:border-amber-400'
                            }`}
                          >
                            {p.traduccion}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* PHASE 3: DONE */}
                {vocabPhase === 'done' && (
                  <div className="text-center py-10">
                    <div className="text-5xl mb-4">✅</div>
                    <h3 className="text-2xl font-black text-emerald-400 uppercase tracking-tighter mb-6">
                      ¡Módulo Completado!
                    </h3>
                    <button
                      onClick={() => setCurrentModule(currentModule + 1)}
                      className="px-8 py-4 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-xl uppercase tracking-widest shadow-md transition-all animate-pulse"
                    >
                      Siguiente ➡
                    </button>
                  </div>
                )}
              </div>
            );
          })()}

        {/* --- FINAL COMPLETION SCREEN --- */}
        {currentModule === totalModules && (
          <div className="text-center py-10 space-y-6">
            <h2 className="text-4xl font-black text-emerald-400 uppercase tracking-tighter">
              ¡Calentamiento Terminado!
            </h2>
            <p className="text-slate-400 font-bold uppercase text-xs tracking-widest">
              Tiempo Total:{' '}
              <span className="text-sky-400 font-mono text-lg">
                {formatTime(timerSeconds)}
              </span>
            </p>

            <div className="p-6 bg-slate-900 rounded-2xl border border-slate-700 max-w-md mx-auto grid grid-cols-2 gap-4">
              <div className="col-span-2 pb-2 border-b border-slate-800">
                <p className="text-[10px] font-bold text-slate-500 uppercase">
                  Nota Académica
                </p>
                <p className="text-xl font-black text-emerald-400">
                  {(
                    (Object.values(verbResults).filter(
                      (res) => res === 'correct'
                    ).length /
                      (bakedVerbs.length || 1)) *
                      4 +
                    (bakedVocab.length > 0 ? 1 : 0)
                  ).toFixed(1)}{' '}
                  / 5.0
                </p>
              </div>
              <div className="pt-2">
                <p className="text-[10px] font-bold text-slate-500 uppercase">
                  Verbos (4 pts)
                </p>
                <p className="text-sm font-black text-white">
                  {
                    Object.values(verbResults).filter(
                      (res) => res === 'correct'
                    ).length
                  }{' '}
                  de {bakedVerbs.length} correctos
                </p>
              </div>
              <div className="pt-2">
                <p className="text-[10px] font-bold text-slate-500 uppercase">
                  Vocab (1 pt)
                </p>
                <p className="text-sm font-black text-white">
                  {bakedVocab.length > 0 ? 'Completado' : 'N/A'}
                </p>
              </div>
            </div>

            <div className="p-4 bg-amber-950/30 rounded-2xl border border-amber-900/50 max-w-md mx-auto">
              <p className="text-xs font-bold text-amber-500 uppercase mb-1">
                Recompensa Obtenida:
              </p>
              <p className="text-2xl font-black text-amber-400">
                🏆 +20 Puntos
              </p>
            </div>

            <button
              onClick={handleFinishSession}
              className="px-8 py-4 bg-sky-600 hover:bg-sky-700 text-white font-black rounded-2xl shadow-lg uppercase tracking-widest text-xs transition-transform hover:scale-105"
            >
              🚀 Guardar Nota y Volver
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
