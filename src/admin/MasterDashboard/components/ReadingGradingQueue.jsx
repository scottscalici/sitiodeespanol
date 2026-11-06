import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../../firebase';
import { getCachedCollection } from '../../../utils/firestoreCache';
import { gradeOpenEndedResponse } from '../../../utils/gradeOpenEnded';

// Grading queue for `open_ended` reading-card questions — the one question
// type no engine can auto-grade (getItemCount is 0 for it, see
// src/shared/questionTypes/openEnded.jsx). A student's answer lives at
// progress.readingCards.{cardId}.inProgress.questionStates.{qIdx}.text on
// their own user doc (written by ReadingCardEngine); the grade this page
// assigns is written to a SEPARATE sibling path,
// progress.readingCards.{cardId}.grades.{qIdx}, so it can never collide
// with the student's own resave of their in-progress answer.
const ReadingGradingQueue = () => {
  const [cards, setCards] = useState([]);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCardId, setSelectedCardId] = useState(null);
  const [drafts, setDrafts] = useState({}); // `${qIdx}:${uid}` -> { points, comment }
  const [savingKey, setSavingKey] = useState(null);
  const [statusByKey, setStatusByKey] = useState({});

  useEffect(() => {
    const load = async () => {
      try {
        const [cardsSnap, allUsers] = await Promise.all([
          getDocs(collection(db, 'reading_cards')),
          getCachedCollection('users', { force: true }),
        ]);
        const allCards = cardsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setCards(allCards.filter((c) => (c.questions || []).some((q) => q.type === 'open_ended')));
        setStudents(allUsers.filter((u) => u.role === 'student' && !u.independent));
      } catch (err) {
        console.error('Error loading grading queue:', err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const selectedCard = cards.find((c) => c.id === selectedCardId) || null;

  const openEndedIndices = useMemo(() => {
    if (!selectedCard) return [];
    return (selectedCard.questions || [])
      .map((q, idx) => ({ q, idx }))
      .filter(({ q }) => q.type === 'open_ended');
  }, [selectedCard]);

  const courseStudents = useMemo(() => {
    if (!selectedCard) return [];
    return students
      .filter((s) => s.course === selectedCard.course)
      .sort((a, b) => (a.lastName || '').localeCompare(b.lastName || ''));
  }, [students, selectedCard]);

  // Pending-first: a submitted-but-ungraded answer is the actual work to
  // do here, so it sorts above both "already graded" and "hasn't submitted
  // yet" (nothing to grade there at all).
  const rowsFor = (qIdx) =>
    [...courseStudents].sort((a, b) => {
      const rank = (s) => {
        const inProgress = s.progress?.readingCards?.[selectedCard.id]?.inProgress;
        const graded = s.progress?.readingCards?.[selectedCard.id]?.grades?.[qIdx];
        if (!inProgress?.submitted) return 2;
        return graded ? 1 : 0;
      };
      return rank(a) - rank(b);
    });

  const draftKey = (qIdx, uid) => `${qIdx}:${uid}`;

  const getDraft = (qIdx, uid, existingGrade) =>
    drafts[draftKey(qIdx, uid)] || { points: existingGrade?.points ?? '', comment: existingGrade?.comment ?? '' };

  const updateDraft = (qIdx, uid, patch) => {
    const key = draftKey(qIdx, uid);
    setDrafts((prev) => ({ ...prev, [key]: { ...getDraft(qIdx, uid, null), ...patch } }));
  };

  const handleSave = async (qIdx, uid) => {
    const key = draftKey(qIdx, uid);
    const draft = drafts[key];
    const points = Number(draft?.points);
    if (!draft || Number.isNaN(points)) return;
    setSavingKey(key);
    setStatusByKey((prev) => ({ ...prev, [key]: '' }));
    try {
      await gradeOpenEndedResponse(uid, selectedCard.id, qIdx, { points, comment: draft.comment || '' });
      setStudents((prev) =>
        prev.map((s) =>
          s.id === uid
            ? {
                ...s,
                progress: {
                  ...s.progress,
                  readingCards: {
                    ...s.progress?.readingCards,
                    [selectedCard.id]: {
                      ...s.progress?.readingCards?.[selectedCard.id],
                      grades: {
                        ...s.progress?.readingCards?.[selectedCard.id]?.grades,
                        [qIdx]: { points, comment: draft.comment || '', gradedAt: new Date().toISOString() },
                      },
                    },
                  },
                },
              }
            : s
        )
      );
      setStatusByKey((prev) => ({ ...prev, [key]: '✅ Guardado' }));
    } catch (err) {
      console.error('Error saving grade:', err);
      setStatusByKey((prev) => ({ ...prev, [key]: '❌ Error al guardar' }));
    } finally {
      setSavingKey(null);
    }
  };

  if (loading) {
    return <div className="text-white text-center p-10 font-bold animate-pulse uppercase tracking-widest">Cargando respuestas...</div>;
  }

  return (
    <div className="max-w-6xl mx-auto p-6 text-white font-sans">
      <div className="flex justify-between items-start mb-6">
        <h2 className="text-2xl font-black uppercase tracking-widest text-amber-400 flex items-center gap-3">
          <span>📝</span> Calificar Respuestas Abiertas
        </h2>
        <Link to="/admin-reading-cards-sequencer" className="bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold px-3 py-1.5 rounded-lg border border-slate-700">
          ⚙️ Sequencer
        </Link>
      </div>

      {cards.length === 0 ? (
        <p className="text-sm text-slate-500 italic text-center py-10">
          Ninguna lectura tiene preguntas de respuesta abierta todavía.
        </p>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-4 space-y-2">
            {cards.map((card) => {
              const indices = (card.questions || []).map((q, idx) => ({ q, idx })).filter(({ q }) => q.type === 'open_ended');
              const pendingCount = students
                .filter((s) => s.course === card.course)
                .reduce((sum, s) => {
                  const inProgress = s.progress?.readingCards?.[card.id]?.inProgress;
                  if (!inProgress?.submitted) return sum;
                  const graded = s.progress?.readingCards?.[card.id]?.grades || {};
                  return sum + indices.filter(({ idx }) => !graded[idx]).length;
                }, 0);
              return (
                <button
                  key={card.id}
                  type="button"
                  onClick={() => setSelectedCardId(card.id)}
                  className={`w-full text-left bg-slate-900 border rounded-xl p-4 transition-colors ${
                    selectedCardId === card.id ? 'border-amber-500' : 'border-slate-700 hover:border-slate-600'
                  }`}
                >
                  <h3 className="font-bold text-white text-sm">{card.title}</h3>
                  <p className="text-[10px] text-slate-500 font-mono mt-1">
                    {card.course?.toUpperCase()} · Día {card.dia ?? '📦'} · {indices.length} abierta(s)
                  </p>
                  {pendingCount > 0 && (
                    <span className="inline-block mt-2 bg-amber-500/20 text-amber-400 text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest">
                      {pendingCount} pendiente(s)
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <div className="lg:col-span-8 space-y-6">
            {!selectedCard ? (
              <p className="text-sm text-slate-500 italic text-center py-10">Elige una lectura para ver sus respuestas.</p>
            ) : (
              openEndedIndices.map(({ q, idx }) => (
                <div key={idx} className="bg-slate-900 border border-slate-700 rounded-xl p-5">
                  <h4 className="text-sm font-bold text-white mb-4">{q.prompt}</h4>
                  <div className="space-y-3">
                    {rowsFor(idx).map((student) => {
                      const inProgress = student.progress?.readingCards?.[selectedCard.id]?.inProgress;
                      const existingGrade = student.progress?.readingCards?.[selectedCard.id]?.grades?.[idx];
                      const answerText = inProgress?.questionStates?.[idx]?.text || '';
                      const key = draftKey(idx, student.id);
                      const draft = getDraft(idx, student.id, existingGrade);
                      const name = [student.firstName, student.lastName].filter(Boolean).join(' ') || student.email;

                      if (!inProgress?.submitted) {
                        return (
                          <div key={student.id} className="flex items-center justify-between bg-slate-950/50 rounded-lg p-3 opacity-50">
                            <span className="text-xs font-bold text-slate-400">{name}</span>
                            <span className="text-[10px] text-slate-500 italic">Sin enviar</span>
                          </div>
                        );
                      }

                      return (
                        <div key={student.id} className="bg-slate-950 border border-slate-800 rounded-lg p-3 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-black text-white">{name}</span>
                            {existingGrade && <span className="text-[10px] font-bold text-emerald-400">✅ {existingGrade.points} pts</span>}
                          </div>
                          <p className="text-sm text-slate-300 bg-slate-900 rounded-md p-2 whitespace-pre-wrap">{answerText || '—'}</p>
                          <div className="flex flex-wrap items-center gap-2">
                            <input
                              type="number"
                              min="0"
                              value={draft.points}
                              onChange={(e) => updateDraft(idx, student.id, { points: e.target.value })}
                              placeholder="pts"
                              className="w-16 bg-slate-800 border border-slate-700 rounded-md p-1.5 text-center text-sm font-bold focus:outline-none focus:border-amber-500"
                            />
                            <input
                              type="text"
                              value={draft.comment}
                              onChange={(e) => updateDraft(idx, student.id, { comment: e.target.value })}
                              placeholder="Comentario (opcional)"
                              className="flex-1 min-w-[140px] bg-slate-800 border border-slate-700 rounded-md p-1.5 text-xs focus:outline-none focus:border-amber-500"
                            />
                            <button
                              type="button"
                              onClick={() => handleSave(idx, student.id)}
                              disabled={savingKey === key || draft.points === ''}
                              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-black uppercase tracking-widest rounded-md disabled:opacity-50"
                            >
                              {savingKey === key ? '...' : 'Guardar'}
                            </button>
                            {statusByKey[key] && <span className="text-[10px] font-bold text-slate-400">{statusByKey[key]}</span>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ReadingGradingQueue;
