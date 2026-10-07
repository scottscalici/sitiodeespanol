import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { extractDistractors, normalizeForCompare } from '../utils/lecturaDistractors';

// Anti-guessing gate: with a finite answer bank instead of free text, a
// student could otherwise just click through all 7 slots in a few seconds.
// Waived entirely once they've genuinely been through a reading before.
const MIN_SECONDS = 5 * 60;

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default function CulturalLecturaExercise({ lectura, lecturaId }) {
  const { currentUser } = useAuth() || {};
  const section = lectura.question_sections?.[0] || { questions: [] };
  const questions = useMemo(() => section.questions || [], [section]);

  // Real answers + a few on-topic distractors pulled from the passage
  // itself, shuffled once per mount so the bank doesn't reorder mid-attempt.
  // A final normalized-text dedup guards against a distractor slipping
  // through that reads the same as a real answer (accents/punctuation/
  // whitespace aside) even after extractDistractors' own filtering.
  const bankItems = useMemo(() => {
    const real = questions.map((q, i) => ({ id: `real_${i}`, text: q.answer }));
    const distractors = extractDistractors(lectura.paragraphs, questions.map((q) => q.answer), 3).map(
      (text, i) => ({ id: `distractor_${i}`, text })
    );
    const seen = new Set(real.map((item) => normalizeForCompare(item.text)));
    const uniqueDistractors = distractors.filter((item) => {
      const norm = normalizeForCompare(item.text);
      if (seen.has(norm)) return false;
      seen.add(norm);
      return true;
    });
    return shuffle([...real, ...uniqueDistractors]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lecturaId]);

  const [assignments, setAssignments] = useState({}); // { questionIdx: bankItemId }
  const [activeIdx, setActiveIdx] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const [alreadyCompletedBefore, setAlreadyCompletedBefore] = useState(false);
  const [checkingCompletion, setCheckingCompletion] = useState(true);
  const [secondsElapsed, setSecondsElapsed] = useState(0);
  const startRef = useRef(Date.now());

  useEffect(() => {
    if (!currentUser) {
      setCheckingCompletion(false);
      return;
    }
    let cancelled = false;
    getDoc(doc(db, 'lectura_completions', `${currentUser.uid}_${lecturaId}`))
      .then((snap) => {
        if (!cancelled && snap.exists()) setAlreadyCompletedBefore(true);
      })
      .catch((err) => console.error('Error checking lectura completion:', err))
      .finally(() => {
        if (!cancelled) setCheckingCompletion(false);
      });
    return () => {
      cancelled = true;
    };
  }, [currentUser, lecturaId]);

  useEffect(() => {
    if (alreadyCompletedBefore) return;
    const interval = setInterval(() => {
      setSecondsElapsed(Math.floor((Date.now() - startRef.current) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [alreadyCompletedBefore]);

  const timeGateActive = !alreadyCompletedBefore && secondsElapsed < MIN_SECONDS;
  const allAnswered = questions.length > 0 && Object.keys(assignments).length === questions.length;

  const handleAssign = (bankItemId) => {
    setAssignments((prev) => {
      const next = { ...prev, [activeIdx]: bankItemId };
      const nextUnanswered = questions.findIndex((_, i) => next[i] === undefined);
      setActiveIdx(nextUnanswered === -1 ? activeIdx : nextUnanswered);
      return next;
    });
  };

  const handleUnassign = (questionIdx) => {
    setAssignments((prev) => {
      const next = { ...prev };
      delete next[questionIdx];
      return next;
    });
    setActiveIdx(questionIdx);
  };

  const handleSubmit = async () => {
    setSubmitted(true);
    if (currentUser && !alreadyCompletedBefore) {
      try {
        await setDoc(doc(db, 'lectura_completions', `${currentUser.uid}_${lecturaId}`), {
          uid: currentUser.uid,
          lecturaId,
          completedAt: new Date().toISOString(),
        });
        setAlreadyCompletedBefore(true);
      } catch (err) {
        console.error('Error saving lectura completion:', err);
      }
    }
  };

  const score = questions.filter((q, i) => {
    const item = bankItems.find((b) => b.id === assignments[i]);
    return item && item.text === q.answer;
  }).length;

  const usedBankIds = new Set(Object.values(assignments));
  const availableBankItems = bankItems.filter((b) => !usedBankIds.has(b.id));

  const remaining = Math.max(0, MIN_SECONDS - secondsElapsed);
  const mm = Math.floor(remaining / 60);
  const ss = remaining % 60;

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 p-4 sm:p-8 font-sans pb-24">
      <div className="max-w-3xl mx-auto space-y-6">
        <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-slate-800 border border-slate-700 p-6 rounded-2xl shadow-xl gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="bg-cyan-950 text-cyan-400 border border-cyan-800 px-2.5 py-0.5 rounded text-[10px] font-black uppercase tracking-widest">
                Lectura Cultural • Texto {lectura.text_id || ''}
              </span>
            </div>
            <h1 className="text-2xl font-black uppercase tracking-tight text-white">
              {lectura.subtitulo || 'Comprensión de Lectura'}
            </h1>
          </div>
          <Link
            to="/"
            className="text-slate-400 hover:text-white font-bold text-xs bg-slate-700 px-4 py-2 rounded-xl border border-slate-600 transition-colors"
          >
            ← Volver al Dashboard
          </Link>
        </header>

        {/* Stacked layout: image, then passage, then questions, then the
            answer bank at the bottom — matches how this content type reads
            best (short, single-topic pieces) rather than the side-by-side
            split used for the longer IB exam texts. */}
        {lectura.imagen && (
          <img
            src={lectura.imagen}
            alt={lectura.subtitulo || ''}
            className="w-full max-h-80 object-cover rounded-2xl border border-slate-700 shadow-xl"
          />
        )}

        <div className="bg-slate-800 border border-slate-700 p-6 sm:p-8 rounded-2xl shadow-xl space-y-4">
          <h3 className="text-xs font-black uppercase tracking-widest text-cyan-400 border-b border-slate-700 pb-3">
            Texto de Lectura
          </h3>
          <div className="space-y-4 font-serif text-slate-300 leading-relaxed text-base">
            {(lectura.paragraphs || []).map((p, idx) => (
              <p key={idx} className="indent-6">
                {p}
              </p>
            ))}
          </div>
        </div>

        <div className="bg-slate-800 border border-slate-700 p-6 rounded-2xl shadow-xl space-y-4">
          {questions.map((q, i) => {
            const item = bankItems.find((b) => b.id === assignments[i]);
            const isCorrect = submitted && item && item.text === q.answer;
            const isActive = i === activeIdx && !item && !submitted;
            return (
              <div
                key={i}
                onClick={() => !item && !submitted && setActiveIdx(i)}
                className={`p-4 rounded-xl border space-y-2 transition-colors ${
                  isActive
                    ? 'border-cyan-400 bg-cyan-950/30 cursor-pointer'
                    : submitted
                    ? isCorrect
                      ? 'border-emerald-500 bg-emerald-950/20'
                      : 'border-rose-500 bg-rose-950/20'
                    : 'border-slate-700 bg-slate-900'
                }`}
              >
                <div className="flex items-start gap-3">
                  <span className="font-black text-rose-400 font-mono text-sm">{i + 1}.</span>
                  <p className="text-sm font-bold text-white flex-1">{q.prompt}</p>
                </div>
                {item ? (
                  <div className="flex items-center gap-2 pl-6">
                    <span className="text-sm text-cyan-200 bg-slate-950 border border-cyan-500/30 rounded-lg px-3 py-1.5 flex-1">
                      {item.text}
                    </span>
                    {!submitted && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleUnassign(i);
                        }}
                        className="text-rose-400 hover:text-rose-200 text-xs font-bold px-2"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-slate-500 italic pl-6">Elige una respuesta del banco de abajo...</p>
                )}
                {submitted && !isCorrect && (
                  <p className="text-xs font-mono pl-6 text-rose-300">
                    Respuesta oficial: <strong className="text-white">{q.answer}</strong>
                  </p>
                )}
              </div>
            );
          })}
        </div>

        {!submitted && (
          <div className="bg-slate-800 border border-slate-700 p-6 rounded-2xl shadow-xl space-y-3">
            <h4 className="text-xs font-black uppercase tracking-widest text-amber-400">Banco de Respuestas</h4>
            <div className="flex flex-wrap gap-2">
              {availableBankItems.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleAssign(item.id)}
                  className="text-xs text-left bg-slate-900 hover:bg-cyan-950 border border-slate-700 hover:border-cyan-500 text-slate-200 rounded-lg px-3 py-2 transition-colors"
                >
                  {item.text}
                </button>
              ))}
              {availableBankItems.length === 0 && (
                <p className="text-xs text-slate-500 italic">¡Todas las respuestas han sido asignadas!</p>
              )}
            </div>
          </div>
        )}

        {!submitted ? (
          <div className="space-y-2">
            {timeGateActive && !checkingCompletion && (
              <p className="text-center text-xs font-bold text-amber-400">
                ⏱ Lee con calma — podrás entregar en {mm}:{String(ss).padStart(2, '0')}
              </p>
            )}
            <button
              onClick={handleSubmit}
              disabled={!allAnswered || timeGateActive || checkingCompletion}
              className="w-full py-4 bg-cyan-600 hover:bg-cyan-500 disabled:bg-slate-700 disabled:cursor-not-allowed text-white font-black uppercase tracking-widest text-xs rounded-2xl shadow-lg transition-all active:scale-95"
            >
              Comprobar Respuestas
            </button>
          </div>
        ) : (
          <div className="text-center p-6 bg-slate-800 rounded-2xl border border-slate-700 space-y-2">
            <p className="text-lg font-black text-emerald-400">
              {score} / {questions.length} correctas
            </p>
            <button
              onClick={() => setSubmitted(false)}
              className="text-xs text-slate-400 underline hover:text-white font-bold uppercase tracking-widest"
            >
              Intentar de nuevo
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
