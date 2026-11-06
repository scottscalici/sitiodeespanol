import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { awardPoints } from '../utils/pointsHelper';
import { QUESTION_TYPES, getItemCount } from '../shared/questionTypes';

// A reading card: a passage (text, optional images/audio) that stays
// pinned beside its comprehension questions, all shown together (not paged
// one at a time like Practice Cards) since referring back to the passage
// while answering several questions in a row is the whole point. Submit-
// then-grade-the-whole-thing-at-once, same deferred-mode contract Practice
// Cards uses — see src/shared/questionTypes/index.js for the full Renderer
// contract. `open_ended` questions report getItemCount 0, so they're
// excluded from the auto-graded percentage entirely; a teacher grades
// those separately (a later addition) rather than folding them into this
// card's own score.
export default function ReadingCardEngine() {
  const { readingId } = useParams();
  const { userData } = useAuth();
  const navigate = useNavigate();

  const [cardData, setCardData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [submitted, setSubmitted] = useState(false);
  const [stackedLayout, setStackedLayout] = useState(false);

  const questionStatesRef = useRef({});
  const [saveState, setSaveState] = useState('idle');
  const [pointsAwarded, setPointsAwarded] = useState(0);
  const [grade, setGrade] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [openEndedCount, setOpenEndedCount] = useState(0);

  const saveTimeoutRef = useRef(null);

  useEffect(() => {
    if (!readingId) return;
    const fetchCard = async () => {
      try {
        const snap = await getDoc(doc(db, 'reading_cards', readingId));
        if (snap.exists()) {
          const data = { id: snap.id, ...snap.data() };
          setCardData(data);

          if (userData?.role !== 'admin') {
            const inProgress = userData?.progress?.readingCards?.[readingId]?.inProgress;
            if (inProgress) {
              questionStatesRef.current = { ...(inProgress.questionStates || {}) };
              setSubmitted(!!inProgress.submitted);
            }
          }
        } else {
          setNotFound(true);
        }
      } catch (err) {
        console.error('Error loading reading card:', err);
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    };
    fetchCard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [readingId]);

  const questions = cardData?.questions || [];
  const totalItems = questions.reduce((sum, q) => sum + getItemCount(q), 0);

  const saveProgress = (payload) => {
    if (!cardData?.id || !userData?.uid || userData.role === 'admin') return;
    setDoc(
      doc(db, 'users', userData.uid),
      { progress: { readingCards: { [cardData.id]: { inProgress: payload } } } },
      { merge: true }
    ).catch((err) => console.error('Error saving reading progress:', err));
  };

  const buildProgressPayload = (submittedArg) => ({
    submitted: submittedArg,
    questionStates: { ...questionStatesRef.current },
  });

  const scheduleSave = (submittedArg) => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    const payload = buildProgressPayload(submittedArg);
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
    saveProgress(buildProgressPayload(submitted));
  };

  const handleClose = () => {
    flushSave();
    navigate('/');
  };

  const handleStateChange = (qIdx, state) => {
    questionStatesRef.current = { ...questionStatesRef.current, [qIdx]: state };
    scheduleSave(submitted);
  };

  const handleSubmit = async () => {
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
    const newOpenEndedCount = questions.filter((q) => q.type === 'open_ended').length;

    setCorrectCount(newCorrectCount);
    setGrade(newGrade);
    setOpenEndedCount(newOpenEndedCount);
    setSubmitted(true);
    setSaveState('saving');

    try {
      const alreadyCompleted = !!userData?.progress?.readingCards?.[cardData.id]?.completed;
      const existingGrade = userData?.progress?.readingCards?.[cardData.id]?.grade ?? -1;
      const isNewHighScore = newGrade > existingGrade;

      if (userData?.uid && userData.role !== 'admin') {
        if (isNewHighScore) {
          await setDoc(
            doc(db, 'users', userData.uid),
            {
              progress: {
                readingCards: {
                  [cardData.id]: { completed: true, grade: newGrade, rawScore: `${newCorrectCount}/${totalItems}`, timestamp: new Date().toISOString() },
                },
              },
            },
            { merge: true }
          );
        }
        if (!alreadyCompleted && newCorrectCount > 0) {
          await awardPoints(userData.uid, newCorrectCount);
          setPointsAwarded(newCorrectCount);
        }
        saveProgress(buildProgressPayload(true));
      }
      setSaveState('saved');
    } catch (err) {
      console.error('Error saving reading card result:', err);
      setSaveState('error');
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 z-[100] bg-slate-50 flex items-center justify-center">
        <div className="text-xl font-bold text-slate-500 animate-pulse">Cargando lectura...</div>
      </div>
    );
  }

  if (notFound || questions.length === 0) {
    return (
      <div className="fixed inset-0 z-[100] bg-slate-50 flex flex-col items-center justify-center gap-4">
        <p className="text-slate-500 font-bold">Lectura no encontrada.</p>
        <button onClick={handleClose} className="px-6 py-2 bg-slate-800 text-white rounded-xl font-bold">Volver</button>
      </div>
    );
  }

  const passage = cardData.passage || {};
  const paragraphs = (passage.text || '').split(/\n\n+/).filter(Boolean);

  return (
    <div className="min-h-screen bg-slate-950 p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        <header className="flex flex-wrap justify-between items-center gap-3 mb-6">
          <div>
            <h1 className="text-xl font-black text-white">{cardData.title}</h1>
            {submitted && (
              <p className="text-sm font-bold mt-1">
                <span className="text-emerald-400">{grade}%</span>
                <span className="text-slate-400"> · {correctCount}/{totalItems} correctas</span>
                {pointsAwarded > 0 && <span className="text-amber-400"> · +{pointsAwarded} puntos</span>}
                {openEndedCount > 0 && (
                  <span className="text-amber-400"> · {openEndedCount} respuesta(s) abierta(s) pendiente(s) de revisión</span>
                )}
              </p>
            )}
            {saveState === 'error' && <p className="text-rose-400 text-xs font-bold mt-1">Hubo un error al guardar. Intenta de nuevo.</p>}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setStackedLayout((v) => !v)}
              className="text-slate-300 hover:text-white font-bold text-xs bg-slate-800 hover:bg-slate-700 px-4 py-2 rounded-xl border border-slate-700 transition-colors"
            >
              {stackedLayout ? '💻 Vista Lado a Lado' : '📱 Vista Apilada'}
            </button>
            <Link to="/" onClick={flushSave} className="text-slate-400 hover:text-white font-bold text-xs bg-slate-800 px-4 py-2 rounded-xl border border-slate-700 transition-colors">
              ← Volver
            </Link>
          </div>
        </header>

        <div className={stackedLayout ? 'space-y-6' : 'grid grid-cols-1 lg:grid-cols-12 gap-8'}>
          <div
            className={
              stackedLayout
                ? 'bg-slate-800 border border-slate-700 p-6 sm:p-8 rounded-2xl shadow-xl space-y-4'
                : 'lg:col-span-5 bg-slate-800 border border-slate-700 p-6 sm:p-8 rounded-2xl shadow-xl h-fit lg:sticky lg:top-6 space-y-4 max-h-[80vh] overflow-y-auto'
            }
          >
            <h3 className="text-xs font-black uppercase tracking-widest text-cyan-400 border-b border-slate-700 pb-3">
              Texto de Lectura
            </h3>
            {passage.audio && <audio src={passage.audio} controls className="w-full" />}
            {(passage.images || []).map((src, i) => (
              <img key={i} src={src} alt="" className="w-full rounded-xl" />
            ))}
            <div className="space-y-4 text-slate-200 text-sm leading-relaxed">
              {paragraphs.map((p, i) => (
                <p key={i}>{p}</p>
              ))}
            </div>
          </div>

          <div className={stackedLayout ? 'space-y-6' : 'lg:col-span-7 space-y-6'}>
            {questions.map((question, qIdx) => {
              const TypeRenderer = QUESTION_TYPES[question.type]?.Renderer;
              if (!TypeRenderer) return null;
              return (
                <div key={qIdx} className="bg-white p-6 sm:p-8 rounded-2xl shadow-xl">
                  <TypeRenderer
                    mode="deferred"
                    question={question}
                    submitted={submitted}
                    initialState={questionStatesRef.current[qIdx]}
                    onStateChange={(state) => handleStateChange(qIdx, state)}
                  />
                </div>
              );
            })}

            {!submitted ? (
              <button
                onClick={handleSubmit}
                className="w-full px-8 py-4 rounded-2xl font-black uppercase tracking-widest text-sm shadow-lg bg-sky-600 hover:bg-sky-700 text-white transition-all"
              >
                Enviar
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                className="w-full px-8 py-4 rounded-2xl font-black uppercase tracking-widest text-sm shadow-lg bg-slate-700 hover:bg-slate-600 text-white transition-all"
              >
                ✏️ Reenviar (mejorar puntaje)
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
