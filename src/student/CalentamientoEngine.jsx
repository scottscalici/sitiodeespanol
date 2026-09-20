import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useNavigate, useParams } from 'react-router-dom';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  setDoc,
  deleteField,
} from 'firebase/firestore';
import { db } from '../firebase.js';
import { useAuth } from '../context/AuthContext';
import { getWeekKey, getMonthKey, bumpStreak } from '../utils/pointsHelper';

export default function CalentamientoEngine({ onClose }) {
  const { courseId, targetDia } = useParams();
  const { userData } = useAuth();
  const navigate = useNavigate();
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
  
  // Diagnostic Tracking States
  const [checkedOnce, setCheckedOnce] = useState({}); 
  const [firstAttemptErrors, setFirstAttemptErrors] = useState([]);

  // Vocab Station States
  const [vocabPhase, setVocabPhase] = useState('preview'); // 'preview', 'match', 'done'
  const [shuffledEngAnswers, setShuffledEngAnswers] = useState([]);
  const [selectedSpanishCard, setSelectedSpanishCard] = useState(null);
  const [matchedPairs, setMatchedPairs] = useState([]);

  // Final-score auto-save tracking (fires once, no manual click required)
  const autoSavedRef = useRef(false);
  const [saveState, setSaveState] = useState('idle'); // 'idle' | 'saving' | 'saved' | 'error'
  const [pointsAwarded, setPointsAwarded] = useState(null);
  const [speedBonusAwarded, setSpeedBonusAwarded] = useState(0);
  const vocabSkippedAtStartRef = useRef(false);

  // In-app feedback modal (replaces native alert() popups)
  const [feedbackModal, setFeedbackModal] = useState(null); // { tone, emoji, title, message }
  const closeFeedbackModal = () => setFeedbackModal(null);

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
        let vocabDocId = null;

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
          vocabDocId = vocabSnap.docs[0].id;
        }

        if (verbsData || vocabData) {
          setWarmupData({
            dia: targetDiaNum,
            course: formattedCourse,
            title: verbsData?.title || vocabData?.name || `Día ${targetDiaNum}`,
            docId: mainDocId || 'combined_warmup',
            // Vocab is shared across verb-set redos for the same day, so its
            // own completion is tracked by this id, not the verb doc's id.
            vocabDocId: vocabDocId || `${formattedCourse}_dia${targetDiaNum}_vocab`,
            bakedQuestions: verbsData?.bakedQuestions || [],
            sequence: vocabData?.sequence || [],
          });
          setIsTimerRunning(true);
        } else {
          alert(
            `Práctica no encontrada para el Día ${targetDiaNum} (${formattedCourse.toUpperCase()}).`
          );
          if (onClose) onClose();
          else navigate('/');
        }
      } catch (err) {
        console.error('Error fetching warmup:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchCombinedWarmup();
  }, [targetDia, courseId, onClose, navigate]);

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

  // 3. Restore any saved draft progress once the warmup loads, so an
  // "accidental" close doesn't erase answers the student already submitted.
  useEffect(() => {
    if (!warmupData || !userData) return;

    // Snapshot whether vocab was already done BEFORE this session started —
    // used later to pick the speed-bonus threshold. Read directly here
    // (rather than the live hasCompletedVocabBefore) so a vocab completion
    // that happens DURING this session doesn't retroactively change it.
    vocabSkippedAtStartRef.current = !!userData?.progress?.vocab_completed?.[warmupData.vocabDocId];

    const draft = userData?.progress?.warmups_draft?.[warmupData.docId];
    if (!draft) return;

    const resume = window.confirm(
      'Encontramos respuestas guardadas de un intento anterior de este calentamiento. ¿Quieres continuar donde lo dejaste?'
    );

    if (resume) {
      if (draft.verbInputs) setVerbInputs(draft.verbInputs);
      if (draft.verbResults) setVerbResults(draft.verbResults);
      if (draft.checkedOnce) setCheckedOnce(draft.checkedOnce);
      if (draft.firstAttemptErrors) setFirstAttemptErrors(draft.firstAttemptErrors);
      if (typeof draft.completedModules === 'number') setCompletedModules(draft.completedModules);
      if (typeof draft.currentModule === 'number') setCurrentModule(draft.currentModule);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [warmupData]);

  const formatTime = (secs) => {
    const mins = Math.floor(secs / 60);
    const remSecs = secs % 60;
    return `${mins.toString().padStart(2, '0')}:${remSecs
      .toString()
      .padStart(2, '0')}`;
  };

  const bakedVerbs = warmupData?.bakedQuestions || [];
  const bakedVocab = warmupData?.sequence || [];

  const verbPages = Math.ceil(bakedVerbs.length / 5);
  const vocabPages = Math.ceil(bakedVocab.length / 10);
  const totalModules = verbPages + vocabPages + 1;

  // --- Check if the student has already completed this warmup before ---
  const hasCompletedBefore = !!userData?.progress?.warmups?.[warmupData?.docId]?.completed;

  // --- Vocab is shared across verb-set redos for the same day: once it's
  // done, it stays done regardless of which verb set is active. ---
  const hasCompletedVocabBefore = !!userData?.progress?.vocab_completed?.[warmupData?.vocabDocId];

  // Save partial progress at natural checkpoints, so it survives an
  // accidental close/refresh. Admins aren't tracked (they don't earn grades).
  // vocabDone permanently marks this day's vocab as complete, independent of
  // whichever verb set is active, so a redo with new verbs can skip it.
  const saveDraft = async (snapshot, { vocabDone = false } = {}) => {
    if (!userData || !userData.uid || userData.role === 'admin' || !warmupData?.docId) return;
    try {
      const userRef = doc(db, 'users', userData.uid);
      await setDoc(
        userRef,
        {
          progress: {
            warmups_draft: {
              [warmupData.docId]: {
                ...snapshot,
                savedAt: new Date().toISOString(),
              },
            },
            ...(vocabDone && warmupData.vocabDocId
              ? { vocab_completed: { [warmupData.vocabDocId]: true } }
              : {}),
          },
        },
        { merge: true }
      );
    } catch (err) {
      console.error('Error saving calentamiento draft:', err);
    }
  };

  // Handle Verb Checking (WITH DIAGNOSTIC ERROR TRACKING)
  const handleCheckVerbs = (pageIndex) => {
    const slice = bakedVerbs.slice((pageIndex - 1) * 5, pageIndex * 5);
    let allCorrect = true;
    const newResults = { ...verbResults };
    const newCheckedOnce = { ...checkedOnce };
    const newErrorsToLog = [];

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

        // DIAGNOSTIC LOGIC: Only save if this is their very first time checking this specific question.
        if (!newCheckedOnce[globalIdx]) {
          newErrorsToLog.push({
            index: globalIdx,
            verb: v.palabra,
            tense: v.tense,
            subject: v.sujeto,
            expected: expected,
            studentInput: userVal || "(en blanco)",
            timestamp: new Date().toISOString()
          });
        }
      }
      
      // Mark this question as having been checked at least once.
      newCheckedOnce[globalIdx] = true;
    });

    setVerbResults(newResults);
    setCheckedOnce(newCheckedOnce);

    // Add any new errors found during this check to our master list
    const mergedErrors =
      newErrorsToLog.length > 0
        ? [...firstAttemptErrors, ...newErrorsToLog]
        : firstAttemptErrors;
    if (newErrorsToLog.length > 0) {
      setFirstAttemptErrors(mergedErrors);
    }

    const newCompletedModules = Math.max(completedModules, pageIndex);
    setCompletedModules(newCompletedModules);

    saveDraft({
      verbInputs,
      verbResults: newResults,
      checkedOnce: newCheckedOnce,
      firstAttemptErrors: mergedErrors,
      completedModules: newCompletedModules,
      currentModule,
    });

    if (allCorrect) {
      setFeedbackModal({
        tone: 'success',
        emoji: '🎉',
        title: '¡Excelente! ¡Pura Vida!',
        message: 'Bloque de verbos perfecto.',
      });
    } else {
      setFeedbackModal({
        tone: 'warning',
        emoji: '🤔',
        title: 'Casi...',
        message: 'Hay respuestas incorrectas. Puedes corregirlas o avanzar si estás satisfecho.',
      });
    }
  };

  // Vocab is already done for the day (from a prior verb-set redo) — skip
  // straight past every vocab page without requiring a click. Gated on the
  // "at session start" ref rather than the live hasCompletedVocabBefore, so
  // finishing vocab JUST NOW in this session doesn't retroactively yank the
  // student off their own "¡Módulo Completado!" screen once the write lands.
  useEffect(() => {
    if (
      warmupData &&
      vocabSkippedAtStartRef.current &&
      currentModule > verbPages &&
      currentModule <= totalModules - 1
    ) {
      setCurrentModule(totalModules);
    }
  }, [currentModule, verbPages, totalModules, warmupData]);

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
        const newCompletedModules = Math.max(
          completedModules,
          verbPages + vocabPageIndex
        );
        setVocabPhase('done');
        setCompletedModules(newCompletedModules);

        saveDraft(
          {
            verbInputs,
            verbResults,
            checkedOnce,
            firstAttemptErrors,
            completedModules: newCompletedModules,
            currentModule,
          },
          { vocabDone: vocabPageIndex === vocabPages }
        );
      }
    } else {
      setFeedbackModal({
        tone: 'error',
        emoji: '❌',
        title: 'Incorrecto',
        message: 'Intenta de nuevo.',
      });
      setSelectedSpanishCard(null);
    }
  };

  // Final Grade Calculation & Point Awarding — fires automatically the
  // instant the student reaches the final screen (see auto-save effect
  // below), so nothing is lost if they close before clicking anything.
  const handleFinishSession = async () => {
    setIsTimerRunning(false);
    setSaveState('saving');

    const correctVerbs = Object.values(verbResults).filter(
      (res) => res === 'correct'
    ).length;
    const verbAccuracy =
      bakedVerbs.length > 0 ? correctVerbs / bakedVerbs.length : 1;

    const verbGradePoints = verbAccuracy * 4;
    const vocabGradePoints = bakedVocab.length > 0 ? 1 : 0;
    const totalGrade = verbGradePoints + vocabGradePoints;
    const percentageGrade = (totalGrade / 5) * 100;
    // Only the first time this exact verb set (docId) is completed earns
    // game points — redoing it can't be farmed for more. A fresh verb set
    // (a new docId, e.g. via the admin's "replace verbs" tool) starts clean.
    const pointsEarned = hasCompletedBefore ? 0 : 20;
    setPointsAwarded(pointsEarned);

    // Speed bonus: rewards a fast, accurate run. Vocab was part of THIS
    // session only if it wasn't already done before it started (checked via
    // a ref snapshotted at load, not the live flag, so finishing vocab just
    // now doesn't retroactively tighten the threshold on you).
    const hadVocabThisSession = bakedVocab.length > 0 && !vocabSkippedAtStartRef.current;
    const speedThresholdSeconds = hadVocabThisSession ? 120 : 60;
    let speedBonus = 0;
    if (
      timerSeconds > 0 &&
      timerSeconds <= speedThresholdSeconds &&
      verbAccuracy >= 0.8
    ) {
      speedBonus = 10;
      if (verbAccuracy === 1) speedBonus += 5; // perfect accuracy bonus on top
    }
    setSpeedBonusAwarded(speedBonus);

    const pointsEarnedThisSession = pointsEarned + speedBonus;

    // Admins testing content shouldn't rack up scores meant for students.
    if (userData && userData.uid && userData.role !== 'admin') {
      try {
        const userRef = doc(db, 'users', userData.uid);
        // We pull the ABSOLUTE FRESHEST data directly from the database
        const snap = await getDoc(userRef);

        const weekKey = getWeekKey();
        const monthKey = getMonthKey();

        let newTotal = pointsEarnedThisSession;
        let newMonthly = pointsEarnedThisSession;
        let newWeekly = pointsEarnedThisSession;
        let newDaily = pointsEarnedThisSession;
        let existingGrade = -1;
        let existingData = {};

        if (snap.exists()) {
          const data = snap.data();
          existingData = data;
          newTotal += data.total_points || data.current_path_points || 0;
          if (data.monthKey === monthKey) newMonthly += data.monthly_points || 0;
          if (data.weekKey === weekKey) newWeekly += data.weekly_points || 0;
          newDaily += data.daily_points || 0;

          // Safely grab the previous best grade, if it exists
          if (data.progress?.warmups?.[warmupData.docId]) {
             existingGrade = data.progress.warmups[warmupData.docId].grade ?? -1;
          }
        }

        const isNewHighScore = percentageGrade > existingGrade;

        console.log("🏁 --- CALENTAMIENTO SAVE DIAGNOSTICS ---");
        console.log("Warmup ID:", warmupData.docId);
        console.log("Previous High Score:", existingGrade);
        console.log("Just Scored:", percentageGrade);
        console.log("Is New High Score?:", isNewHighScore);

        // 1. ALWAYS award the XP Points for playing
        const updatePayload = {
          total_points: newTotal,
          current_path_points: newTotal,
          monthly_points: newMonthly,
          weekly_points: newWeekly,
          daily_points: newDaily,
          weekKey,
          monthKey,
          ...bumpStreak(existingData),
        };

        // 2. Always clear the in-progress draft now that the session is finished
        updatePayload.progress = {
          warmups_draft: {
            [warmupData.docId]: deleteField(),
          },
        };

        // 3. ONLY attach the graded progress object if we beat the high score
        if (isNewHighScore) {
          console.log("📈 Saving new academic high score!");
          updatePayload.progress.warmups = {
            [warmupData.docId]: {
              completed: true,
              grade: percentageGrade,
              rawScore: `${totalGrade.toFixed(1)}/5`,
              errors: firstAttemptErrors,
              timestamp: new Date().toISOString(),
            },
          };
        } else {
           console.log("🛡️ Score was lower. Keeping previous high score. Only saving XP.");
        }

        await setDoc(userRef, updatePayload, { merge: true });
        setSaveState('saved');
      } catch (err) {
        console.error('Error saving calentamiento points:', err);
        setSaveState('error');
      }
    } else {
      setSaveState('saved');
    }
  };

  // Just navigates away — the score is already auto-saved by the time this
  // screen is showing (see the auto-save effect below).
  const handleReturnHome = () => {
    if (onClose) {
      onClose();
    } else {
      navigate('/');
    }
  };

  // Auto-save the score the instant the final screen is reached — no click
  // required, so closing the tab here can't lose an already-finished session.
  useEffect(() => {
    if (warmupData && currentModule === totalModules && !autoSavedRef.current) {
      autoSavedRef.current = true;
      handleFinishSession();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentModule, warmupData, totalModules]);

  if (loading || !warmupData) {
    return (
      <div className="p-10 text-center font-bold text-slate-400 animate-pulse">
        Cargando Calentamiento...
      </div>
    );
  }

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
          onClick={() => {
            if (onClose) onClose();
            else navigate('/');
          }}
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
                    
                    <div className="flex flex-col items-center gap-4">
                      <button
                        onClick={() => handleStartVocabMatch(slice)}
                        className="px-8 py-4 bg-sky-600 hover:bg-sky-700 text-white font-black rounded-xl uppercase tracking-widest shadow-md transition-all"
                      >
                        Emparejar Ahora
                      </button>

                      {/* 🚀 NEW: SKIP BUTTON IF VOCAB ALREADY COMPLETED TODAY */}
                      {hasCompletedVocabBefore && (
                        <button
                          onClick={() => setCurrentModule(totalModules)}
                          className="px-6 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 font-bold rounded-xl uppercase tracking-widest text-xs transition-all border border-slate-600"
                        >
                          Saltar Vocabulario (Ya Completado) ⏭️
                        </button>
                      )}
                    </div>
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

            <div className="p-4 bg-amber-950/30 rounded-2xl border border-amber-900/50 max-w-md mx-auto space-y-1">
              <p className="text-xs font-bold text-amber-500 uppercase mb-1">
                Recompensa Obtenida:
              </p>
              {pointsAwarded === null ? (
                <p className="text-sm text-slate-400 italic animate-pulse">
                  Calculando recompensa...
                </p>
              ) : pointsAwarded === 0 && speedBonusAwarded === 0 ? (
                <>
                  <p className="text-lg font-black text-slate-400">
                    Ya ganaste tus puntos la primera vez
                  </p>
                  <p className="text-[10px] font-bold text-slate-500 uppercase mt-1">
                    Tu nota académica se sigue guardando si mejoras tu récord
                  </p>
                </>
              ) : (
                <>
                  <p className="text-2xl font-black text-amber-400">
                    🏆 +{pointsAwarded + speedBonusAwarded} Puntos
                  </p>
                  {pointsAwarded === 0 && speedBonusAwarded > 0 && (
                    <p className="text-[10px] font-bold text-slate-500 uppercase">
                      Ya ganaste tus puntos base — esto es solo el bono de velocidad
                    </p>
                  )}
                  {speedBonusAwarded > 0 && (
                    <p className="text-xs font-black text-sky-400 uppercase tracking-widest">
                      ⚡ Bono de velocidad: +{speedBonusAwarded}
                    </p>
                  )}
                </>
              )}
            </div>

            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
              {saveState === 'saving' && '💾 Guardando tu progreso...'}
              {saveState === 'saved' && '✅ Progreso guardado automáticamente'}
              {saveState === 'error' && '⚠️ Hubo un problema guardando. Intenta de nuevo antes de salir.'}
            </p>

            <button
              onClick={handleReturnHome}
              className="px-8 py-4 bg-sky-600 hover:bg-sky-700 text-white font-black rounded-2xl shadow-lg uppercase tracking-widest text-xs transition-transform hover:scale-105"
            >
              🚀 Volver
            </button>
          </div>
        )}
      </main>

      {/* FEEDBACK MODAL (replaces native alert() popups) */}
      {feedbackModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-6"
          onClick={closeFeedbackModal}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className={`w-full max-w-sm rounded-3xl border-2 bg-slate-800 p-8 text-center shadow-2xl ${
              feedbackModal.tone === 'success'
                ? 'border-emerald-500'
                : feedbackModal.tone === 'error'
                ? 'border-rose-500'
                : 'border-amber-500'
            }`}
          >
            <div className="text-6xl mb-4">{feedbackModal.emoji}</div>
            <h3
              className={`text-2xl font-black uppercase tracking-tight mb-2 ${
                feedbackModal.tone === 'success'
                  ? 'text-emerald-400'
                  : feedbackModal.tone === 'error'
                  ? 'text-rose-400'
                  : 'text-amber-400'
              }`}
            >
              {feedbackModal.title}
            </h3>
            <p className="text-sm text-slate-300 font-medium mb-6">
              {feedbackModal.message}
            </p>
            <button
              onClick={closeFeedbackModal}
              className={`px-8 py-3 rounded-xl font-black text-xs uppercase tracking-widest text-white shadow-md transition-all hover:scale-105 ${
                feedbackModal.tone === 'success'
                  ? 'bg-emerald-600 hover:bg-emerald-700'
                  : feedbackModal.tone === 'error'
                  ? 'bg-rose-600 hover:bg-rose-700'
                  : 'bg-amber-600 hover:bg-amber-700'
              }`}
            >
              Continuar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}