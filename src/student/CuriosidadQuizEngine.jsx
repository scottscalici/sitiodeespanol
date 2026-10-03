import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase.js';
import { useAuth } from '../context/AuthContext';
import { getWeekKey, getMonthKey, bumpStreak } from '../utils/pointsHelper';

// Shuffles a copy of the array (Fisher-Yates would be overkill here — a
// simple random sort is fine for a handful of answer tiles).
const shuffle = (arr) => [...arr].sort(() => Math.random() - 0.5);

// How many gradable "items" one question is worth — a 9-pair matching
// question is 9 items, not 1, so the final grade (and eventually the
// champion comparison) reflects how much was actually in it, not how many
// question blocks the admin happened to group them into. Every other type
// is a single yes/no unit.
const getItemCount = (q) => {
  if (q.type === 'matching') return q.pairs.length;
  if (q.type === 'dropdown_cloze') return q.blanks.length;
  return 1;
};

// Splits a cloze passage on its "{{blank}}" tokens, interleaving the plain
// text with one inline <select> per blank. Index-based keys are fine here —
// the segments never reorder within a render.
const renderClozeText = (text, blanks, selections, correctArr, wrongFlashIdx, onSelect) => {
  const parts = (text || '').split('{{blank}}');
  const nodes = [];
  parts.forEach((part, i) => {
    if (part) nodes.push(<span key={`t-${i}`}>{part}</span>);
    if (i < parts.length - 1) {
      const blank = blanks[i];
      const isCorrect = correctArr[i];
      const isWrong = wrongFlashIdx === i;
      nodes.push(
        <select
          key={`b-${i}`}
          value={selections[i] || ''}
          onChange={(e) => onSelect(i, e.target.value)}
          disabled={isCorrect}
          className={`mx-1 border-b-2 bg-slate-900 font-bold rounded px-2 py-1 text-sm align-middle ${
            isCorrect
              ? 'border-emerald-500 text-emerald-400'
              : isWrong
              ? 'border-rose-500 text-rose-300'
              : 'border-slate-500 text-sky-300'
          }`}
        >
          <option value="" disabled>
            ?
          </option>
          {(blank?.options || []).map((opt, oIdx) => (
            <option key={oIdx} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      );
    }
  });
  return nodes;
};

export default function CuriosidadQuizEngine() {
  const { curiosidadId } = useParams();
  const { userData } = useAuth();
  const navigate = useNavigate();

  const [curiosidad, setCuriosidad] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [currentQuestion, setCurrentQuestion] = useState(0);

  // --- Matching-type state ---
  const [matchedPairIdx, setMatchedPairIdx] = useState([]); // indices into pairs matched so far, this question
  const [selectedLeftIdx, setSelectedLeftIdx] = useState(null);
  const [shuffledAnswers, setShuffledAnswers] = useState([]);
  const [wrongFlashIdx, setWrongFlashIdx] = useState(null); // answer tile index to briefly flash red

  // --- Image-select-type state (also reused by multiple_choice below — both
  // are "click one option, lock in on correct" single-select interactions,
  // just over images vs. plain text) ---
  const [selectedImageIdx, setSelectedImageIdx] = useState([]); // currently toggled option indices
  const [imageSelectDone, setImageSelectDone] = useState(false); // locked in as correct
  const [imageWrongFlash, setImageWrongFlash] = useState(false);

  // --- Category picker (for curiosidades whose questions are tagged with a
  // `category`, e.g. a Jeopardy-style lightning round) ---
  const [selectedCategory, setSelectedCategory] = useState(null); // null = show the picker
  const [completedCategories, setCompletedCategories] = useState([]); // session-only, not persisted

  // --- Dropdown-cloze-type state ---
  const [clozeSelections, setClozeSelections] = useState([]); // current dropdown value per blank
  const [clozeCorrect, setClozeCorrect] = useState([]); // which blanks are locked in as correct
  const [clozeWrongFlash, setClozeWrongFlash] = useState(null); // blank index currently flashing red

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

  // 3. Reset per-question state whenever we land on a new question —
  // matching gets a freshly shuffled answer bank, image-select starts
  // unselected/unlocked.
  useEffect(() => {
    if (!curiosidad) return;
    const q = curiosidad.questions[currentQuestion];
    if (!q) return;

    if (q.type === 'matching') {
      const answers = q.pairs.map((p) => p.answer).concat(q.distractors || []);
      setShuffledAnswers(shuffle(answers));
    }
    setMatchedPairIdx([]);
    setSelectedLeftIdx(null);
    setSelectedImageIdx([]);
    setImageSelectDone(false);
    if (q.type === 'dropdown_cloze') {
      setClozeSelections(Array(q.blanks.length).fill(''));
      setClozeCorrect(Array(q.blanks.length).fill(false));
    }
    setClozeWrongFlash(null);
  }, [curiosidad, currentQuestion]);

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

  // Records (once) whether THIS attempt at the whole image-select question
  // was correct, then either locks it in (correct) or flashes an error so
  // the student can adjust their selection and try again.
  const recordImageSelectAttempt = (selection, question) => {
    const key = `${currentQuestion}-0`;
    const correct = [...question.correctIndices].sort().join(',') === [...selection].sort().join(',');

    if (!(key in firstAttemptRef.current)) {
      firstAttemptRef.current[key] = correct;
    }

    if (correct) {
      setImageSelectDone(true);
    } else {
      setImageWrongFlash(true);
      setTimeout(() => setImageWrongFlash(false), 400);
    }
  };

  // Single-correct-answer questions resolve the instant you click one
  // option — no separate confirm step needed.
  const handleSelectSingleImage = (oIdx, question) => {
    if (imageSelectDone) return;
    setSelectedImageIdx([oIdx]);
    recordImageSelectAttempt([oIdx], question);
  };

  // Multi-correct-answer questions let you toggle several options, then
  // confirm the whole set at once.
  const handleToggleImageOption = (oIdx) => {
    if (imageSelectDone) return;
    setSelectedImageIdx((prev) => (prev.includes(oIdx) ? prev.filter((i) => i !== oIdx) : [...prev, oIdx]));
  };

  const handleConfirmImageSelect = (question) => {
    if (imageSelectDone || selectedImageIdx.length === 0) return;
    recordImageSelectAttempt(selectedImageIdx, question);
  };

  // Multiple-choice resolves the instant you click an option, same as
  // image-select's single-correct-answer mode — reuses that same lock/flash
  // state since the interaction is identical, just over text instead of images.
  const handleSelectMC = (oIdx, question) => {
    if (imageSelectDone) return;
    const key = `${currentQuestion}-0`;
    const isCorrect = question.options[oIdx] === question.answer;

    if (!(key in firstAttemptRef.current)) {
      firstAttemptRef.current[key] = isCorrect;
    }

    setSelectedImageIdx([oIdx]);
    if (isCorrect) {
      setImageSelectDone(true);
    } else {
      setImageWrongFlash(true);
      setTimeout(() => setImageWrongFlash(false), 400);
    }
  };

  // Each blank grades independently and locks once correct, same first-
  // attempt-only principle as the other types (one key per blank index).
  const handleSelectClozeBlank = (blankIdx, value, question) => {
    if (clozeCorrect[blankIdx]) return;
    const key = `${currentQuestion}-${blankIdx}`;
    const isCorrect = question.blanks[blankIdx].answer === value;

    if (!(key in firstAttemptRef.current)) {
      firstAttemptRef.current[key] = isCorrect;
    }

    setClozeSelections((prev) => prev.map((v, i) => (i === blankIdx ? value : v)));

    if (isCorrect) {
      setClozeCorrect((prev) => prev.map((c, i) => (i === blankIdx ? true : c)));
    } else {
      setClozeWrongFlash(blankIdx);
      setTimeout(() => setClozeWrongFlash(null), 400);
    }
  };

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
  const isMatching = question.type === 'matching';
  const isImageSelect = question.type === 'image_select';
  const isDropdownCloze = question.type === 'dropdown_cloze';
  const isMultipleChoice = question.type === 'multiple_choice';
  const isMultiSelect = isImageSelect && (question.correctIndices || []).length > 1;

  const allMatched = isMatching
    ? matchedPairIdx.length === question.pairs.length
    : isImageSelect || isMultipleChoice
    ? imageSelectDone
    : isDropdownCloze
    ? clozeCorrect.length > 0 && clozeCorrect.every(Boolean)
    : false;

  return (
    <div className="min-h-screen bg-slate-900 text-white p-6 font-sans flex flex-col items-center pb-20">
      <header className="w-full max-w-3xl bg-slate-800 border border-slate-700 p-4 rounded-2xl flex justify-between items-center mb-6 shadow-md">
        <div>
          <span className="text-xs font-black text-sky-400 uppercase tracking-widest">
            {showCategoryPicker
              ? 'Curiosidad • Elige una categoría'
              : hasCategories
              ? `${selectedCategory} • Pregunta ${posInCategory + 1} de ${currentCategoryIndices.length}`
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

      <main className="w-full max-w-3xl bg-slate-800 border border-slate-700 p-8 rounded-2xl shadow-xl min-h-[400px] flex flex-col justify-between">
        <div>
          {showCategoryPicker && (
            <div>
              <p className="text-sm text-slate-300 font-bold mb-6 text-center">
                Elige una categoría para comenzar
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
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
                      className={`p-5 rounded-xl border-2 font-black uppercase tracking-wide text-xs text-center transition-all ${
                        isDone
                          ? 'opacity-30 pointer-events-none bg-slate-950 border-slate-900 text-slate-600'
                          : 'bg-slate-900 border-slate-700 hover:border-sky-400 text-slate-100'
                      }`}
                    >
                      {isDone && '✅ '}
                      {category}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {!showCategoryPicker && (
          <>
          <p className="text-sm text-slate-300 font-bold mb-2 text-center">{question.prompt}</p>
          {isMatching && question.pairs.length > 1 && (
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest text-center mb-6">
              {matchedPairIdx.length} de {question.pairs.length} emparejados
            </p>
          )}
          {isDropdownCloze && question.blanks.length > 1 && (
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest text-center mb-6">
              {clozeCorrect.filter(Boolean).length} de {question.blanks.length} completados
            </p>
          )}
          {!(isMatching && question.pairs.length > 1) && !(isDropdownCloze && question.blanks.length > 1) && (
            <div className="mb-6" />
          )}

          {isMatching && (
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
                      <img
                        src={pair.left.value}
                        alt=""
                        className="w-full h-32 object-contain bg-slate-950 rounded-lg"
                      />
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
          )}

          {isImageSelect && (
            <div>
              {(question.correctIndices || []).length > 1 && (
                <p className="text-xs text-slate-400 text-center mb-4">
                  (elige {question.correctIndices.length})
                </p>
              )}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {question.options.map((opt, oIdx) => {
                  const isSelected = selectedImageIdx.includes(oIdx);
                  const showWrong = imageWrongFlash && isSelected;
                  const showCorrect = imageSelectDone && isSelected;
                  return (
                    <button
                      key={oIdx}
                      onClick={() =>
                        isMultiSelect ? handleToggleImageOption(oIdx) : handleSelectSingleImage(oIdx, question)
                      }
                      disabled={imageSelectDone}
                      className={`border-2 rounded-xl overflow-hidden transition-all ${
                        showWrong
                          ? 'border-rose-500'
                          : showCorrect
                          ? 'border-emerald-500'
                          : isSelected
                          ? 'border-sky-400'
                          : 'border-slate-700 hover:border-slate-500'
                      } ${imageSelectDone && !isSelected ? 'opacity-40' : ''}`}
                    >
                      <img src={opt.img} alt={opt.label || ''} className="w-full h-28 object-cover" />
                      {opt.label && <p className="text-[10px] font-bold text-slate-300 p-1.5">{opt.label}</p>}
                    </button>
                  );
                })}
              </div>
              {isMultiSelect && !imageSelectDone && (
                <button
                  onClick={() => handleConfirmImageSelect(question)}
                  disabled={selectedImageIdx.length === 0}
                  className="mt-4 w-full py-3 bg-sky-600 hover:bg-sky-700 disabled:opacity-40 text-white font-black rounded-xl text-xs uppercase tracking-widest"
                >
                  Confirmar Selección
                </button>
              )}
            </div>
          )}

          {isDropdownCloze && (
            <div>
              {question.img && (
                <img
                  src={question.img}
                  alt=""
                  className="w-full max-h-64 object-contain bg-slate-950 rounded-lg mb-6"
                />
              )}
              <p className="text-base text-slate-200 leading-loose text-center">
                {renderClozeText(
                  question.text,
                  question.blanks,
                  clozeSelections,
                  clozeCorrect,
                  clozeWrongFlash,
                  (blankIdx, value) => handleSelectClozeBlank(blankIdx, value, question)
                )}
              </p>
            </div>
          )}

          {isMultipleChoice && (
            <div
              className={`grid gap-3 ${question.options.length === 3 ? 'grid-cols-3' : 'grid-cols-2'}`}
            >
              {question.options.map((opt, oIdx) => {
                const isSelected = selectedImageIdx.includes(oIdx);
                const showWrong = imageWrongFlash && isSelected;
                const showCorrect = imageSelectDone && isSelected;
                return (
                  <button
                    key={oIdx}
                    onClick={() => handleSelectMC(oIdx, question)}
                    disabled={imageSelectDone}
                    className={`p-4 border-2 rounded-xl font-bold text-sm transition-all ${
                      showWrong
                        ? 'border-rose-500 bg-rose-950 text-rose-300'
                        : showCorrect
                        ? 'border-emerald-500 bg-emerald-950 text-emerald-300'
                        : isSelected
                        ? 'border-sky-400 bg-sky-950 text-slate-100'
                        : 'bg-slate-900 border-slate-700 text-slate-200 hover:border-amber-400'
                    } ${imageSelectDone && !isSelected ? 'opacity-40' : ''}`}
                  >
                    {opt}
                  </button>
                );
              })}
            </div>
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

          {allMatched && (
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
