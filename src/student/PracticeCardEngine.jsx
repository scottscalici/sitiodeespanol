import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { collection, query, where, getDocs, doc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { awardPoints } from '../utils/pointsHelper';
import { QUESTION_TYPES, getItemCount } from '../shared/questionTypes';
import { normalizeLegacyPracticeQuestion } from '../utils/legacyPracticeQuestion';

// A small, focused graded practice (e.g. Gustar, prepositional pronouns) —
// unlike Calentamiento (verb-conjugation tables) or WorkoutEngine's
// retry-until-correct Learning Path questions, its grade reflects
// FIRST-ATTEMPT accuracy, matching how a calentamiento's own grade is a
// first-attempt score. Its grade is folded into the SAME "Promedio
// Calentamientos" average students and teachers already see (see
// src/utils/warmupBreakdown.js), and completing it for the first time
// awards its point value as ordinary XP. Question rendering/interaction is
// shared with Curiosidades (src/shared/questionTypes) — only this grading
// wrapper (first-attempt accuracy %, high-score gate, flat point-per-
// correct, folded into the warmup average) is specific to Practice Cards.
export default function PracticeCardEngine({ onClose }) {
  const { courseId, targetDia } = useParams();
  const { userData } = useAuth();
  const navigate = useNavigate();

  const [cardData, setCardData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [currentIndex, setCurrentIndex] = useState(0);

  // Whether every gradable item in the CURRENT question has been answered
  // correctly (or, for one-shot types like write/listen, simply checked) —
  // reported by the active type's Renderer via onAllCorrect(), reset
  // whenever the question changes. Same pattern as CuriosidadQuizEngine.
  const [currentAllCorrect, setCurrentAllCorrect] = useState(false);

  // First-attempt correctness per gradable item, keyed `${questionIdx}-${itemIdx}`
  // — only ever set once per item, so a retry after a miss doesn't change
  // the recorded grade.
  const firstAttemptRef = useRef({});

  const [finished, setFinished] = useState(false);
  const [saveState, setSaveState] = useState('idle'); // 'idle' | 'saving' | 'saved' | 'error'
  const [pointsAwarded, setPointsAwarded] = useState(0);

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
          const data = snap.docs[0].data();
          setCardData({
            id: snap.docs[0].id,
            ...data,
            questions: (data.questions || []).map(normalizeLegacyPracticeQuestion),
          });
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
  }, [targetDia, courseId]);

  const questions = cardData?.questions || [];
  const currentQ = questions[currentIndex];
  const totalItems = questions.reduce((sum, q) => sum + getItemCount(q), 0);

  useEffect(() => {
    setCurrentAllCorrect(false);
  }, [currentIndex]);

  const handleClose = () => {
    if (onClose) onClose();
    else navigate('/');
  };

  const handleItemFirstAttempt = (itemIdx, isCorrect) => {
    const key = `${currentIndex}-${itemIdx}`;
    if (!(key in firstAttemptRef.current)) {
      firstAttemptRef.current[key] = isCorrect;
    }
  };

  const handleAllCorrect = () => setCurrentAllCorrect(true);

  const handleAdvance = () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex((prev) => prev + 1);
    } else {
      setFinished(true);
    }
  };

  // Auto-save the instant the final screen is reached, same as
  // Calentamiento — no extra click required to lock in a finished session.
  useEffect(() => {
    if (!finished || !cardData) return;

    const save = async () => {
      setSaveState('saving');
      const correctCount = Object.values(firstAttemptRef.current).filter(Boolean).length;
      const grade = totalItems > 0 ? Math.round((correctCount / totalItems) * 100) : 0;
      const rawScore = `${correctCount}/${totalItems}`;
      // Ranking/XP points = however many gradable items were answered
      // correctly on this (the first, since points only ever award once
      // below) attempt — one point per correct item, no admin-set rate or
      // multiplier. Independent of the card's grade-pool weight
      // (gradeWeight, used only by warmupBreakdown.js for the classwork average).
      const points = correctCount;

      try {
        const alreadyCompleted = !!userData?.progress?.practiceCards?.[cardData.id]?.completed;
        const existingGrade = userData?.progress?.practiceCards?.[cardData.id]?.grade ?? -1;
        const isNewHighScore = grade > existingGrade;

        if (userData?.uid && userData.role !== 'admin') {
          if (isNewHighScore) {
            await setDoc(
              doc(db, 'users', userData.uid),
              {
                progress: {
                  practiceCards: {
                    [cardData.id]: { completed: true, grade, rawScore, timestamp: new Date().toISOString() },
                  },
                },
              },
              { merge: true }
            );
          }
          if (!alreadyCompleted && points > 0) {
            await awardPoints(userData.uid, points);
            setPointsAwarded(points);
          }
        }
        setSaveState('saved');
      } catch (err) {
        console.error('Error saving practice card result:', err);
        setSaveState('error');
      }
    };
    save();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finished, cardData]);

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

  if (finished) {
    const correctCount = Object.values(firstAttemptRef.current).filter(Boolean).length;
    const grade = totalItems > 0 ? Math.round((correctCount / totalItems) * 100) : 0;
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
        <button onClick={handleClose} className="mt-2 px-8 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-2xl shadow-lg uppercase tracking-widest text-xs">
          Volver al Panel
        </button>
      </div>
    );
  }

  const progressPercent = Math.round((currentIndex / questions.length) * 100);
  const TypeRenderer = QUESTION_TYPES[currentQ.type]?.Renderer;

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
              question={currentQ}
              onItemFirstAttempt={handleItemFirstAttempt}
              onAllCorrect={handleAllCorrect}
            />
          )}
        </div>
      </div>

      <div className="flex-none border-t-2 border-slate-200 bg-white p-4 md:p-6 z-10">
        <div className="max-w-3xl mx-auto w-full flex items-center justify-end">
          {currentAllCorrect && (
            <button
              onClick={handleAdvance}
              className="px-8 py-3 rounded-2xl font-black uppercase tracking-widest text-xs shadow-lg bg-emerald-600 hover:bg-emerald-700 text-white transition-all animate-pulse"
            >
              {currentIndex < questions.length - 1 ? 'Siguiente' : 'Terminar'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
