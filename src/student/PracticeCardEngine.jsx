import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { collection, query, where, getDocs, doc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { awardPoints } from '../utils/pointsHelper';
import { QUESTION_TYPES, getItemCount } from '../shared/questionTypes';
import { normalizeLegacyPracticeQuestion } from '../utils/legacyPracticeQuestion';

// A small, focused graded practice (e.g. Gustar, prepositional pronouns).
// Unlike Curiosidad's retry-until-correct flow, a Practice Card is answered
// in full — freely moving between questions with Anterior/Siguiente, no
// grading feedback at all — before a single Enviar grades the WHOLE card at
// once (every type's own `gradeState`, see src/shared/questionTypes/index.js)
// and shows a results screen, same submit-then-grade shape as Calentamiento's
// "Revisar Bloque". From there the student can go back in, see every item
// colored live as they fix things, and hit Enviar again for a better score —
// nothing ever locks. Its grade is folded into the same "Promedio
// Calentamientos" average students and teachers already see (see
// src/utils/warmupBreakdown.js), and completing it for the first time awards
// its point value as ordinary XP (never re-awarded on a later resubmit).
export default function PracticeCardEngine({ onClose }) {
  const { courseId, targetDia } = useParams();
  const { userData } = useAuth();
  const navigate = useNavigate();

  const [cardData, setCardData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [currentIndex, setCurrentIndex] = useState(0);

  // Whether Enviar has ever been clicked this session — gates the
  // deferred Renderers' live green/red coloring (see the `mode: 'deferred'`
  // contract) and whether Enviar stays available on every question (not
  // just the last) for a quick fix-and-resubmit loop.
  const [submitted, setSubmitted] = useState(false);
  // Shown right after Enviar; "Revisar y Mejorar" drops back into the
  // question flow (now colored) without losing any answers.
  const [showResults, setShowResults] = useState(false);

  // Every question's latest answer snapshot (from its Renderer's
  // onStateChange), keyed by question index — kept for the WHOLE card, not
  // just the current question, since Enviar grades everything at once from
  // whatever was last reported for each one, including questions the
  // student isn't currently looking at.
  const questionStatesRef = useRef({});

  const [saveState, setSaveState] = useState('idle'); // 'idle' | 'saving' | 'saved' | 'error'
  const [pointsAwarded, setPointsAwarded] = useState(0);
  const [grade, setGrade] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);

  const saveTimeoutRef = useRef(null);

  useEffect(() => {
    if (!targetDia || !courseId) return;
    const fetchCard = async () => {
      try {
        const formattedCourse = String(courseId).toLowerCase();
        const targetDiaNum = Number(targetDia);
        const q = query(
          collection(db, 'practice_cards'),
          where('dia', '==', targetDiaNum),
          where('course', '==', formattedCourse)
        );
        const snap = await getDocs(q);
        if (!snap.empty) {
          const cardId = snap.docs[0].id;
          const data = snap.docs[0].data();
          const loadedQuestions = (data.questions || []).map(normalizeLegacyPracticeQuestion);
          setCardData({ id: cardId, ...data, questions: loadedQuestions });

          // Restoring an interrupted session: applied here, synchronously
          // alongside setCardData (same batch, before the loading spinner
          // clears), so the UI never flashes question 1 before snapping to
          // a restored later question on a separate render.
          if (userData?.role !== 'admin') {
            const inProgress = userData?.progress?.practiceCards?.[cardId]?.inProgress;
            if (inProgress) {
              questionStatesRef.current = { ...(inProgress.questionStates || {}) };
              setSubmitted(!!inProgress.submitted);
              const idx = Math.max(0, Math.min(inProgress.currentIndex || 0, loadedQuestions.length - 1));
              setCurrentIndex(idx);
            }
          }
        } else {
          setNotFound(true);
        }
      } catch (err) {
        console.error('Error loading practice card:', err);
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    };
    fetchCard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetDia, courseId]);

  const questions = cardData?.questions || [];
  const currentQ = questions[currentIndex];
  const totalItems = questions.reduce((sum, q) => sum + getItemCount(q), 0);

  // Builds this card's in-progress snapshot and (debounced, or immediately
  // when flushed) saves it to progress.practiceCards[id].inProgress — read
  // back in the restore effect above. Never "cleared" on finishing: the
  // card stays resumable indefinitely, same as the saved high score itself,
  // since the student may always come back to try for a better one.
  const saveProgress = (payload) => {
    if (!cardData?.id || !userData?.uid || userData.role === 'admin') return;
    setDoc(
      doc(db, 'users', userData.uid),
      { progress: { practiceCards: { [cardData.id]: { inProgress: payload } } } },
      { merge: true }
    ).catch((err) => console.error('Error saving practice progress:', err));
  };

  const buildProgressPayload = (indexArg, submittedArg) => ({
    currentIndex: indexArg,
    submitted: submittedArg,
    questionStates: { ...questionStatesRef.current },
  });

  const scheduleSave = (indexArg, submittedArg) => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    const payload = buildProgressPayload(indexArg, submittedArg);
    saveTimeoutRef.current = setTimeout(() => {
      saveTimeoutRef.current = null;
      saveProgress(payload);
    }, 800);
  };

  const flushSave = () => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
    }
    saveProgress(buildProgressPayload(currentIndex, submitted));
  };

  const handleClose = () => {
    flushSave();
    if (onClose) onClose();
    else navigate('/');
  };

  const handleStateChange = (state) => {
    questionStatesRef.current = { ...questionStatesRef.current, [currentIndex]: state };
    scheduleSave(currentIndex, submitted);
  };

  const goTo = (nextIndex) => {
    setCurrentIndex(nextIndex);
    scheduleSave(nextIndex, submitted);
  };

  // Grades every question from its latest known state (this session's
  // onStateChange reports, or a restored one), via that type's own
  // gradeState — the single source of truth also driving each deferred
  // Renderer's own live coloring. Saved score only improves on a high
  // score (never regresses on a worse resubmit); points award once, ever,
  // from the FIRST submission's correct count.
  const handleSubmit = async () => {
    // Cancel any pending debounced save — otherwise a stale one scheduled
    // just before this click (e.g. an edit made less than 800ms earlier)
    // could still fire afterward and silently overwrite this submission's
    // authoritative record with the pre-submit snapshot it closed over.
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
    }
    const perQuestionResults = questions.map((question, idx) => {
      const mod = QUESTION_TYPES[question.type];
      const state = questionStatesRef.current[idx];
      return mod?.gradeState ? mod.gradeState(question, state) : [];
    });
    const newCorrectCount = perQuestionResults.flat().filter(Boolean).length;
    const newGrade = totalItems > 0 ? Math.round((newCorrectCount / totalItems) * 100) : 0;

    setCorrectCount(newCorrectCount);
    setGrade(newGrade);
    setSubmitted(true);
    setShowResults(true);
    setSaveState('saving');

    try {
      const alreadyCompleted = !!userData?.progress?.practiceCards?.[cardData.id]?.completed;
      const existingGrade = userData?.progress?.practiceCards?.[cardData.id]?.grade ?? -1;
      const isNewHighScore = newGrade > existingGrade;

      if (userData?.uid && userData.role !== 'admin') {
        if (isNewHighScore) {
          await setDoc(
            doc(db, 'users', userData.uid),
            {
              progress: {
                practiceCards: {
                  [cardData.id]: { completed: true, grade: newGrade, rawScore: `${newCorrectCount}/${totalItems}`, timestamp: new Date().toISOString() },
                },
              },
            },
            { merge: true }
          );
        }
        // Ranking/XP points = however many gradable items were answered
        // correctly on the FIRST-ever submission — one point per correct
        // item, awarded once no matter how many times the card is
        // resubmitted afterward. Independent of the card's grade-pool
        // weight (gradeWeight, used only by warmupBreakdown.js).
        if (!alreadyCompleted && newCorrectCount > 0) {
          await awardPoints(userData.uid, newCorrectCount);
          setPointsAwarded(newCorrectCount);
        }
        saveProgress(buildProgressPayload(currentIndex, true));
      }
      setSaveState('saved');
    } catch (err) {
      console.error('Error saving practice card result:', err);
      setSaveState('error');
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 z-[100] bg-slate-50 flex items-center justify-center">
        <div className="text-xl font-bold text-slate-500 animate-pulse">Cargando práctica...</div>
      </div>
    );
  }

  if (notFound || questions.length === 0) {
    return (
      <div className="fixed inset-0 z-[100] bg-slate-50 flex flex-col items-center justify-center gap-4">
        <p className="text-slate-500 font-bold">Práctica no encontrada.</p>
        <button onClick={handleClose} className="px-6 py-2 bg-slate-800 text-white rounded-xl font-bold">Volver</button>
      </div>
    );
  }

  if (showResults) {
    return (
      <div className="fixed inset-0 z-[100] bg-slate-50 flex flex-col items-center justify-center gap-4 p-6 text-center">
        <span className="text-5xl">{grade >= 70 ? '🎉' : '💪'}</span>
        <h1 className="text-2xl font-black text-slate-800">{cardData.title}</h1>
        <p className="text-4xl font-black text-emerald-600">{grade}%</p>
        <p className="text-slate-500 font-bold">{correctCount}/{totalItems} correctas</p>
        {pointsAwarded > 0 && (
          <p className="text-amber-600 font-black uppercase tracking-widest text-sm">+{pointsAwarded} puntos</p>
        )}
        {saveState === 'error' && (
          <p className="text-rose-500 text-xs font-bold">Hubo un error al guardar. Intenta de nuevo.</p>
        )}
        <div className="flex items-center justify-center gap-3 mt-2">
          <button
            onClick={() => setShowResults(false)}
            className="px-6 py-3 bg-slate-700 hover:bg-slate-600 text-white font-black rounded-2xl uppercase tracking-widest text-xs transition-all"
          >
            ✏️ Revisar y Mejorar
          </button>
          <button onClick={handleClose} className="px-8 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-2xl shadow-lg uppercase tracking-widest text-xs">
            🚀 Volver al Panel
          </button>
        </div>
      </div>
    );
  }

  const progressPercent = Math.round(((currentIndex + 1) / questions.length) * 100);
  const TypeRenderer = QUESTION_TYPES[currentQ.type]?.Renderer;
  // Always read from the ref, not just on a Firestore-restored session —
  // every question remounts (via its `key`) each time it's navigated away
  // from and back to, and without this it would reset to blank and the
  // Renderer's own mount-time onStateChange would silently wipe out
  // whatever was already captured for it.
  const initialState = questionStatesRef.current[currentIndex];
  const isLast = currentIndex === questions.length - 1;

  return (
    <div className="fixed inset-0 z-[100] bg-slate-50 flex flex-col font-sans">
      <div className="flex-none p-4 flex items-center justify-between gap-4 max-w-3xl mx-auto w-full bg-slate-50 z-10">
        <button onClick={handleClose} className="text-slate-400 hover:text-slate-600 font-bold text-xl px-2 transition-colors">✕</button>
        <div className="w-full bg-slate-200 rounded-full h-3 overflow-hidden shadow-inner">
          <div className="bg-emerald-500 h-3 transition-all duration-300" style={{ width: `${progressPercent}%` }}></div>
        </div>
        <span className="text-slate-500 font-black text-sm">{currentIndex + 1}/{questions.length}</span>
      </div>

      {/* justify-start always, never justify-center here: a flex container
          that both centers its content AND scrolls clips the content's own
          start edge when that content is taller than the viewport — the
          centered block overflows equally above and below, but scrollTop=0
          only reaches the natural top, not the extra space centering pushed
          above it. A short mc/write/listen question never overflowed, but a
          multi-row type like line_bank_cloze can, which cut off its first
          row or two behind the header above. */}
      <div className="flex-1 flex flex-col items-center justify-start overflow-y-auto p-4 md:p-6 w-full">
        <div className="w-full max-w-3xl mx-auto text-center pb-8">
          <span className="text-xs font-black uppercase tracking-widest text-emerald-600 mb-6 block">{cardData.title}</span>

          {TypeRenderer && (
            <TypeRenderer
              key={currentIndex}
              mode="deferred"
              question={currentQ}
              submitted={submitted}
              initialState={initialState}
              onStateChange={handleStateChange}
            />
          )}
        </div>
      </div>

      <div className="flex-none border-t-2 border-slate-200 bg-white p-4 md:p-6 z-10">
        <div className="max-w-3xl mx-auto w-full flex items-center justify-between gap-3">
          <button
            onClick={() => goTo(currentIndex - 1)}
            disabled={currentIndex === 0}
            className="px-6 py-3 rounded-2xl font-black uppercase tracking-widest text-xs bg-slate-200 text-slate-600 hover:bg-slate-300 disabled:opacity-0 disabled:pointer-events-none transition-all"
          >
            ⬅ Anterior
          </button>

          <div className="flex items-center gap-3">
            {submitted && (
              <button
                onClick={handleSubmit}
                className="px-6 py-3 rounded-2xl font-black uppercase tracking-widest text-xs shadow-lg bg-sky-600 hover:bg-sky-700 text-white transition-all"
              >
                Enviar
              </button>
            )}
            {!isLast && (
              <button
                onClick={() => goTo(currentIndex + 1)}
                className="px-8 py-3 rounded-2xl font-black uppercase tracking-widest text-xs shadow-lg bg-emerald-600 hover:bg-emerald-700 text-white transition-all"
              >
                Siguiente
              </button>
            )}
            {isLast && !submitted && (
              <button
                onClick={handleSubmit}
                className="px-8 py-3 rounded-2xl font-black uppercase tracking-widest text-xs shadow-lg bg-sky-600 hover:bg-sky-700 text-white transition-all animate-pulse"
              >
                Enviar
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
