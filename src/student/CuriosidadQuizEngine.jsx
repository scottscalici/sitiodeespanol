import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase.js';
import { useAuth } from '../context/AuthContext';
import { getWeekKey, getMonthKey, bumpStreak } from '../utils/pointsHelper';
import { QUESTION_TYPES, getItemCount } from '../shared/questionTypes';

export default function CuriosidadQuizEngine() {
  const { curiosidadId } = useParams();
  const { userData } = useAuth();
  const navigate = useNavigate();

  const [curiosidad, setCuriosidad] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [currentQuestion, setCurrentQuestion] = useState(0);

  // Whether every gradable item in the CURRENT question has been answered
  // correctly — reported by the active type's Renderer via onAllCorrect(),
  // reset whenever the question changes. This is all the parent needs to
  // know to decide whether to show the advance button; it never has to
  // reach into any type's own interaction state.
  const [currentAllCorrect, setCurrentAllCorrect] = useState(false);

  // --- Category picker (for curiosidades whose questions are tagged with a
  // `category`, e.g. a Jeopardy-style lightning round) ---
  const [selectedCategory, setSelectedCategory] = useState(null); // null = show the picker
  const [completedCategories, setCompletedCategories] = useState([]); // session-only, not persisted

  // First-attempt correctness per gradable item, keyed `${questionIdx}-${itemIdx}`
  // (itemIdx is the pair index for matching, always 0 for single-unit types)
  // — only ever set once per item, so a retry after a miss doesn't change
  // the recorded grade (same "first attempt" principle as Calentamiento).
  const firstAttemptRef = useRef({});

  const [timerSeconds, setTimerSeconds] = useState(0);
  const [finished, setFinished] = useState(false);
  const [waitingForMinTime, setWaitingForMinTime] = useState(false);
  const [saveState, setSaveState] = useState('idle'); // 'idle' | 'saving' | 'saved' | 'error'
  const [finalGrade, setFinalGrade] = useState(null);
  const [pointsAwarded, setPointsAwarded] = useState(null);
  const [attemptNumber, setAttemptNumber] = useState(null); // which attempt this finish was (1, 2, 3+)

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

  // 3. The active type's Renderer remounts fresh on every question change
  // (keyed by currentQuestion) and owns its own interaction state, so the
  // only thing this parent needs to reset itself is its own "is the current
  // question fully correct yet" flag.
  useEffect(() => {
    setCurrentAllCorrect(false);
  }, [currentQuestion]);

  const totalItems = curiosidad
    ? curiosidad.questions.reduce((sum, q) => sum + getItemCount(q), 0)
    : 0;

  // Groups question indices by `category` (first-seen order), uncategorized
  // questions falling into a shared "Otras" bucket so a curiosidad that
  // mixes tagged and untagged questions still works. Entirely absent when
  // no question carries a category — those curiosidades play exactly as
  // before, straight through in one sequence.
  const categoryGroups = curiosidad
    ? (() => {
        const indicesByCategory = {};
        curiosidad.questions.forEach((q, idx) => {
          const cat = q.category || 'Otras';
          (indicesByCategory[cat] = indicesByCategory[cat] || []).push(idx);
        });
        const orderedNames = [...new Set(curiosidad.questions.map((q) => q.category || 'Otras'))];
        return orderedNames.map((category) => ({ category, indices: indicesByCategory[category] }));
      })()
    : [];
  const hasCategories = curiosidad ? curiosidad.questions.some((q) => q.category) : false;
  const showCategoryPicker = hasCategories && selectedCategory === null;
  const currentCategoryIndices = hasCategories
    ? categoryGroups.find((g) => g.category === selectedCategory)?.indices || []
    : [];
  const posInCategory = currentCategoryIndices.indexOf(currentQuestion);

  // Passed down to the active type's Renderer — builds this engine's own
  // grading key from a bare item index, so no type needs to know about
  // "which question" it's part of.
  const handleItemFirstAttempt = (itemIdx, isCorrect) => {
    const key = `${currentQuestion}-${itemIdx}`;
    if (!(key in firstAttemptRef.current)) {
      firstAttemptRef.current[key] = isCorrect;
    }
  };

  const handleAllCorrect = () => setCurrentAllCorrect(true);

  const goToPreviousQuestion = () => {
    if (hasCategories) {
      if (posInCategory > 0) setCurrentQuestion(currentCategoryIndices[posInCategory - 1]);
      return;
    }
    setCurrentQuestion((q) => Math.max(0, q - 1));
  };

  const handleFinishQuiz = async () => {
    const correctCount = Object.values(firstAttemptRef.current).filter(Boolean).length;
    const grade = totalItems > 0 ? Math.round((correctCount / totalItems) * 100) : 0;
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
      const data = snap.exists() ? snap.data() : {};
      const existingEntry = data.progress?.curiosidades?.[curiosidadId];
      const existingGrade = existingEntry?.grade ?? -1;
      const attemptsSoFar = existingEntry?.attempts || 0;
      const bestGrade = Math.max(grade, existingGrade);
      // Frozen the very first time this is completed — this is what a
      // future "champion of the day" comparison reads, specifically so a
      // later catch-up attempt can't quietly outrank someone who nailed it
      // the first time (completion credit, separately, is a flat 1/1 the
      // instant `completed` is true, regardless of accuracy or attempt).
      const firstAttemptGrade = existingEntry?.firstAttemptGrade ?? grade;

      // Generous on purpose, and deliberately front-loaded: attempt 1 pays
      // half your percentage (100% -> 50, 50% -> 25) since the grade itself
      // is just a flat completion credit with no accuracy incentive built
      // in. Attempt 2 pays a SECOND-RATE bonus (half of attempt 1's rate)
      // on only the improvement over attempt 1 — e.g. 50% then 100% nets
      // round((100-50) * 0.25) = 13 more, for 38 total, not the full 50 —
      // so catching up later is worth something but never as much as
      // getting it right the first time. Nothing is ever earned (or lost)
      // on a third attempt or beyond.
      let pointsEarned = 0;
      if (attemptsSoFar === 0) {
        pointsEarned = Math.round(grade * 0.5);
      } else if (attemptsSoFar === 1) {
        const improvement = Math.max(0, grade - firstAttemptGrade);
        pointsEarned = Math.round(improvement * 0.25);
      }
      setPointsAwarded(pointsEarned);
      setAttemptNumber(attemptsSoFar + 1);

      const updatePayload = {
        progress: {
          curiosidades: {
            [curiosidadId]: {
              completed: true,
              grade: bestGrade,
              firstAttemptGrade,
              attempts: attemptsSoFar + 1,
              timestamp: new Date().toISOString(),
            },
          },
        },
      };

      if (pointsEarned > 0) {
        const weekKey = getWeekKey();
        const monthKey = getMonthKey();
        let newTotal = pointsEarned + (data.total_points || data.current_path_points || 0);
        let newMonthly = pointsEarned + (data.monthKey === monthKey ? data.monthly_points || 0 : 0);
        let newWeekly = pointsEarned + (data.weekKey === weekKey ? data.weekly_points || 0 : 0);
        let newDaily = pointsEarned + (data.daily_points || 0);

        updatePayload.total_points = newTotal;
        updatePayload.current_path_points = newTotal;
        updatePayload.monthly_points = newMonthly;
        updatePayload.weekly_points = newWeekly;
        updatePayload.daily_points = newDaily;
        updatePayload.weekKey = weekKey;
        updatePayload.monthKey = monthKey;
        Object.assign(updatePayload, bumpStreak(data));
      }

      await setDoc(userRef, updatePayload, { merge: true });
      setSaveState('saved');
    } catch (err) {
      console.error('Error saving curiosidad quiz grade:', err);
      setSaveState('error');
    }
    setFinished(true);
  };

  const handleAdvance = () => {
    if (hasCategories) {
      if (posInCategory < currentCategoryIndices.length - 1) {
        setCurrentQuestion(currentCategoryIndices[posInCategory + 1]);
        return;
      }
      // Finished every question in this category — lock it and go back to
      // the picker, unless that was the last category left, in which case
      // the whole curiosidad is done (fall through to the finish check below).
      const newCompleted = [...new Set([...completedCategories, selectedCategory])];
      setCompletedCategories(newCompleted);
      setSelectedCategory(null);
      if (newCompleted.length < categoryGroups.length) return;
    } else {
      const isLastQuestion = currentQuestion === curiosidad.questions.length - 1;
      if (!isLastQuestion) {
        setCurrentQuestion((q) => q + 1);
        return;
      }
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
    const correctCount = Object.values(firstAttemptRef.current).filter(Boolean).length;
    return (
      <div className="min-h-screen bg-slate-900 text-white p-6 flex flex-col items-center justify-center gap-6 text-center">
        <h2 className="text-3xl font-black text-emerald-400 uppercase tracking-tighter">
          ¡Curiosidad Completada!
        </h2>
        <p className="text-5xl font-black text-white">{finalGrade}%</p>
        <p className="text-xs font-bold text-slate-400">
          {correctCount} de {totalItems} correctas{attemptNumber === 1 ? ' en el primer intento' : ''}
        </p>

        {!isAdmin && (
          <div className="p-4 bg-amber-950/30 rounded-2xl border border-amber-900/50 max-w-xs mx-auto">
            {pointsAwarded === null ? (
              <p className="text-sm text-slate-400 italic animate-pulse">Calculando recompensa...</p>
            ) : pointsAwarded > 0 ? (
              <p className="text-2xl font-black text-amber-400">🏆 +{pointsAwarded} Puntos</p>
            ) : attemptNumber === 1 ? (
              <>
                <p className="text-sm font-black text-slate-400">0 puntos esta vez</p>
                <p className="text-[10px] font-bold text-slate-500 uppercase mt-1">
                  Puedes intentarlo una vez más para ganar algunos
                </p>
              </>
            ) : (
              <p className="text-sm font-black text-slate-400">Ya no hay más puntos disponibles aquí</p>
            )}
          </div>
        )}

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
  const isLastQuestion = currentQuestion === curiosidad.questions.length - 1;
  const isLastInCategory = hasCategories && posInCategory === currentCategoryIndices.length - 1;
  const isLastCategoryRemaining = hasCategories && completedCategories.length === categoryGroups.length - 1;
  const isMultipleChoice = question.type === 'multiple_choice';
  const TypeRenderer = QUESTION_TYPES[question.type]?.Renderer;

  return (
    <div className="min-h-screen bg-slate-900 text-white p-6 font-sans flex flex-col items-center pb-20">
      <header className={`w-full ${showCategoryPicker ? 'max-w-5xl' : 'max-w-3xl'} bg-slate-800 border border-slate-700 p-4 rounded-2xl flex justify-between items-center mb-6 shadow-md`}>
        <div>
          <span className="text-xs font-black text-sky-400 uppercase tracking-widest">
            {showCategoryPicker
              ? 'Curiosidad • Elige una categoría'
              : hasCategories
              ? `${selectedCategory} • ${(posInCategory + 1) * 100} puntos`
              : `Curiosidad • Pregunta ${currentQuestion + 1} de ${curiosidad.questions.length}`}
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

      <main className={`w-full ${showCategoryPicker ? 'max-w-5xl' : 'max-w-3xl'} bg-slate-800 border border-slate-700 p-8 rounded-2xl shadow-xl min-h-[400px] flex flex-col justify-between`}>
        <div>
          {showCategoryPicker && (
            <div>
              <p className="text-sm text-slate-300 font-bold mb-6 text-center">
                Elige una categoría para comenzar
              </p>
              {/* A real Jeopardy-style board: one column per category, its
                  name as a header and a stack of point-value cells below it
                  sized to however many questions that category actually has
                  (categories don't need to match in size — a "Potpourri"
                  catch-all with a different count works the same way). The
                  whole column is one click target — order within a category
                  is still fixed/sequential once inside, this is a visual
                  upgrade over the plain category list, not a cell-by-cell
                  pick-any-question board. */}
              <div className="flex flex-wrap justify-center items-start gap-3">
                {categoryGroups.map(({ category, indices }) => {
                  const isDone = completedCategories.includes(category);
                  return (
                    <button
                      key={category}
                      onClick={() => {
                        setSelectedCategory(category);
                        setCurrentQuestion(indices[0]);
                      }}
                      disabled={isDone}
                      className={`flex flex-col w-28 rounded-xl overflow-hidden border-2 transition-all ${
                        isDone
                          ? 'opacity-40 pointer-events-none border-slate-900'
                          : 'border-slate-700 hover:border-sky-400'
                      }`}
                    >
                      <div
                        className={`font-black uppercase tracking-wide text-[10px] text-center p-2 leading-tight ${
                          isDone ? 'bg-slate-900 text-slate-500' : 'bg-indigo-700 text-white'
                        }`}
                      >
                        {isDone && '✅ '}
                        {category}
                      </div>
                      <div className="flex flex-col divide-y divide-slate-700">
                        {indices.map((_, i) => (
                          <div
                            key={i}
                            className={`py-3 text-center font-black text-lg ${
                              isDone ? 'bg-slate-950 text-slate-700' : 'bg-slate-900 text-amber-400'
                            }`}
                          >
                            {isDone ? '✓' : (i + 1) * 100}
                          </div>
                        ))}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {!showCategoryPicker && (
          <>
          <p className="text-sm text-slate-300 font-bold mb-6 text-center">{question.prompt}</p>

          {TypeRenderer && (
            <TypeRenderer
              key={currentQuestion}
              question={question}
              onItemFirstAttempt={handleItemFirstAttempt}
              onAllCorrect={handleAllCorrect}
            />
          )}

          {/* Purely a fun flourish mirroring the board's point values — the
              real ranking points (pointsAwarded, shown on the results
              screen) are computed the same accuracy-based way as every
              other curiosidad type, completely independent of this number. */}
          {isMultipleChoice && hasCategories && currentAllCorrect && (
            <p className="text-center text-amber-400 font-black text-lg mt-4 animate-pulse">
              🎉 +{(posInCategory + 1) * 100} puntos
            </p>
          )}
          </>
          )}
        </div>

        {!showCategoryPicker && (
        <div className="flex items-center justify-between pt-6 border-t border-slate-700 mt-6">
          {(hasCategories ? posInCategory > 0 : currentQuestion > 0) ? (
            <button
              onClick={goToPreviousQuestion}
              className="px-6 py-3 bg-slate-700 hover:bg-slate-600 text-white font-black rounded-xl text-xs uppercase tracking-widest"
            >
              ⬅ Anterior
            </button>
          ) : (
            <span />
          )}

          {currentAllCorrect && (
            <button
              onClick={handleAdvance}
              className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-xl text-xs uppercase tracking-widest shadow-md animate-pulse"
            >
              {hasCategories
                ? isLastInCategory
                  ? isLastCategoryRemaining
                    ? 'Terminar ✅'
                    : 'Categoría Completa ✅'
                  : 'Siguiente ➡'
                : isLastQuestion
                ? 'Terminar ✅'
                : 'Siguiente ➡'}
            </button>
          )}
        </div>
        )}
      </main>
    </div>
  );
}
