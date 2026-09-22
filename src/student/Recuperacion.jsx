import React, { useState, useEffect, useMemo } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { getCachedCollection } from '../utils/firestoreCache';
import { fetchEvaluacionOptions, resolveCurrentEvalDia } from '../utils/evaluaciones';
import { fetchRecuperacionDoc, submitReflection, recordGateAttempt } from '../utils/recuperacionData';
import WorkoutEngine from './WorkoutEngine';

// Recuperación is deliberately separate from every other point-earning
// system on the site: actual quizzes stay in Schoology, this only builds the
// reflection + practice gate that make a student's makeup work concrete and
// verifiable. Reflection is private (the teacher's list only ever sees the
// pass fact) and no points are ever awarded here — the gate exists to prove
// mastery, not to earn currency.
const REFLECTION_PROMPTS = [
  { key: 'q1', es: '¿Por qué crees que no hiciste muy bien en esta evaluación?', en: "Why do you think you didn't do well on this quiz?" },
  { key: 'q2', es: '¿Qué vas a hacer diferente esta vez para prepararte?', en: 'What will you do differently this time to prepare?' },
  { key: 'q3', es: '¿Qué tema o concepto te costó más trabajo?', en: 'What topic or concept gave you the most trouble?' },
];

export default function Recuperacion() {
  const { userData } = useAuth();
  const course = userData?.course || 's2';
  const uid = userData?.uid;
  const studentName = `${userData?.firstName || ''} ${userData?.lastName || ''}`.trim() || userData?.email || 'Estudiante';

  const [isLoading, setIsLoading] = useState(true);
  const [liveDia, setLiveDia] = useState(1);
  const [gateCircles, setGateCircles] = useState([]); // every gate-enabled circle for this course, with live-resolved día
  const [docsByCircle, setDocsByCircle] = useState({}); // circleId -> recuperacion doc (or null)

  const [selectedCircle, setSelectedCircle] = useState(null);
  const [phase, setPhase] = useState('list'); // 'list' | 'reflect' | 'gate' | 'session'
  const [reflectionAnswers, setReflectionAnswers] = useState({});
  const [isSubmittingReflection, setIsSubmittingReflection] = useState(false);
  const [sessionNonce, setSessionNonce] = useState(0);
  const [feedbackModal, setFeedbackModal] = useState(null);

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      try {
        const calSnap = await getDoc(doc(db, 'config', 'academic_year_2026_2027'));
        const calendarArray = calSnap.exists() ? (calSnap.data().map || []) : [];
        const todayStr = new Date().toLocaleDateString('en-CA');
        const pastEntries = calendarArray.filter((c) => c.fecha && c.fecha <= todayStr && c.dia != null);
        const currentDay = pastEntries.length > 0
          ? parseInt(pastEntries.sort((a, b) => b.fecha.localeCompare(a.fecha))[0].dia)
          : 1;
        setLiveDia(currentDay);

        const [podDocs, currentEvalOptions] = await Promise.all([
          getCachedCollection('practice_pods'),
          fetchEvaluacionOptions(course),
        ]);

        const circles = [];
        podDocs
          .filter((d) => d.course === course && Array.isArray(d.pods))
          .forEach((d) => {
            d.pods.forEach((pod) => {
              if (!pod.gateConfig || !pod.evalLink) return;
              const segment = pod.segments?.[0];
              if (!segment) return;
              const currentDia = resolveCurrentEvalDia(currentEvalOptions, pod.evalLink);
              circles.push({
                id: `${d.path_id}__${pod.id}`,
                title: pod.title,
                evalDia: currentDia,
                evalLabel: pod.evalLink.label,
                gateConfig: pod.gateConfig,
                segment,
              });
            });
          });
        setGateCircles(circles);

        if (uid) {
          const docsEntries = await Promise.all(
            circles.map(async (c) => [c.id, await fetchRecuperacionDoc(uid, c.id)])
          );
          setDocsByCircle(Object.fromEntries(docsEntries));
        }
      } catch (err) {
        console.error('Error loading recuperación:', err);
      }
      setIsLoading(false);
    };
    load();
  }, [course, uid]);

  // Only past quizzes make sense for recuperación — the newest one (closest
  // to today) is what a student most likely cares about right now, so it
  // sits at top, trailing off to older ones further down.
  const pastEntries = useMemo(() => {
    return gateCircles
      .filter((c) => c.evalDia != null && c.evalDia < liveDia)
      .sort((a, b) => b.evalDia - a.evalDia);
  }, [gateCircles, liveDia]);

  const openCircle = (circle) => {
    setSelectedCircle(circle);
    const existing = docsByCircle[circle.id];
    setReflectionAnswers(existing?.reflection || {});
    setPhase(existing?.reflection ? 'gate' : 'reflect');
  };

  const backToList = () => {
    setSelectedCircle(null);
    setPhase('list');
  };

  const handleSubmitReflection = async () => {
    if (!REFLECTION_PROMPTS.every((p) => (reflectionAnswers[p.key] || '').trim())) return;
    setIsSubmittingReflection(true);
    try {
      await submitReflection(uid, {
        course, studentName, circleId: selectedCircle.id, evalLabel: selectedCircle.evalLabel,
      }, reflectionAnswers);
      setDocsByCircle((prev) => ({
        ...prev,
        [selectedCircle.id]: { ...(prev[selectedCircle.id] || {}), reflection: reflectionAnswers, attempts: prev[selectedCircle.id]?.attempts || [], bestScore: prev[selectedCircle.id]?.bestScore || 0, passed: prev[selectedCircle.id]?.passed || false },
      }));
      setPhase('gate');
    } catch (err) {
      console.error('Error submitting reflection:', err);
    }
    setIsSubmittingReflection(false);
  };

  const startAttempt = () => {
    setSessionNonce((n) => n + 1);
    setPhase('session');
  };

  const handleGateComplete = async (segId, score) => {
    setPhase('gate');
    try {
      const updated = await recordGateAttempt(uid, selectedCircle.id, score, selectedCircle.gateConfig.passThreshold);
      setDocsByCircle((prev) => ({ ...prev, [selectedCircle.id]: updated }));
      setFeedbackModal({ score, passed: score >= selectedCircle.gateConfig.passThreshold, threshold: selectedCircle.gateConfig.passThreshold });
    } catch (err) {
      console.error('Error recording gate attempt:', err);
    }
  };

  // The gate's runtime segment: full coverage (every word tested at least
  // once, no random-with-replacement), speed-round timer reused as-is for
  // the time limit, question count bumped up to the concept count so
  // "full coverage" is a real guarantee rather than best-effort, and no
  // pinned sentences / history — a gate only tests this quiz's own concepts.
  const gateSegment = useMemo(() => {
    if (!selectedCircle) return null;
    const conceptCount = selectedCircle.segment.introduced_concepts?.length || 0;
    return {
      ...selectedCircle.segment,
      pinned_sentences: [],
      fullCoverage: true,
      isSpeedRound: true,
      timeLimit: selectedCircle.gateConfig.timeLimitSeconds,
      total_questions: Math.max(selectedCircle.gateConfig.questionCount, conceptCount),
    };
  }, [selectedCircle]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <h2 className="text-xl font-bold animate-pulse text-slate-400 uppercase tracking-widest">Cargando Recuperación...</h2>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 sm:p-8">
      <div className="max-w-3xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-black text-slate-800">📋 Recuperación</h1>
          <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">Reflexiona, practica, y prepárate para repetir la evaluación</p>
        </div>

        {phase === 'list' && (
          <div className="space-y-3">
            {pastEntries.length === 0 && (
              <div className="text-center py-20 text-slate-400 font-bold uppercase tracking-widest">
                Todavía no hay evaluaciones con recuperación disponible.
              </div>
            )}
            {pastEntries.map((c) => {
              const d = docsByCircle[c.id];
              const passed = d?.passed;
              const hasReflection = !!d?.reflection;
              const bestScore = d?.bestScore || 0;
              return (
                <button
                  key={c.id}
                  onClick={() => openCircle(c)}
                  className="w-full text-left bg-white border border-slate-200 rounded-2xl p-5 shadow-sm hover:shadow-md hover:border-rose-300 transition-all flex items-center justify-between"
                >
                  <div>
                    <p className="text-xs font-black text-rose-600 uppercase tracking-widest mb-1">Día {c.evalDia}</p>
                    <p className="font-bold text-slate-800">{c.evalLabel}</p>
                  </div>
                  <div>
                    {passed ? (
                      <span className="text-[10px] font-black uppercase tracking-widest bg-emerald-100 text-emerald-800 px-3 py-1.5 rounded-full">
                        ✓ Aprobado ({bestScore}%)
                      </span>
                    ) : hasReflection ? (
                      <span className="text-[10px] font-black uppercase tracking-widest bg-amber-100 text-amber-800 px-3 py-1.5 rounded-full">
                        Practicando (mejor: {bestScore}%)
                      </span>
                    ) : (
                      <span className="text-[10px] font-black uppercase tracking-widest bg-slate-100 text-slate-500 px-3 py-1.5 rounded-full">
                        Sin empezar
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {phase === 'reflect' && selectedCircle && (
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
            <button onClick={backToList} className="text-xs font-bold text-slate-400 hover:text-slate-600 mb-4">← Volver</button>
            <h2 className="text-xl font-black text-slate-800 mb-1">Reflexión — {selectedCircle.evalLabel}</h2>
            <p className="text-sm text-slate-500 font-bold mb-6">Completa esta reflexión antes de empezar a practicar.</p>
            <div className="space-y-5">
              {REFLECTION_PROMPTS.map((p) => (
                <div key={p.key}>
                  <label className="block font-bold text-slate-800 mb-0.5">{p.es}</label>
                  <p className="text-xs text-slate-400 italic mb-2">{p.en}</p>
                  <textarea
                    value={reflectionAnswers[p.key] || ''}
                    onChange={(e) => setReflectionAnswers((prev) => ({ ...prev, [p.key]: e.target.value }))}
                    rows={3}
                    className="w-full border border-slate-300 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-rose-400"
                  />
                </div>
              ))}
            </div>
            <button
              onClick={handleSubmitReflection}
              disabled={isSubmittingReflection || !REFLECTION_PROMPTS.every((p) => (reflectionAnswers[p.key] || '').trim())}
              className="mt-6 w-full bg-rose-600 hover:bg-rose-700 disabled:bg-rose-300 text-white font-black py-3 rounded-xl uppercase tracking-wide text-sm transition-colors"
            >
              {isSubmittingReflection ? 'Enviando...' : 'Enviar Reflexión y Continuar →'}
            </button>
          </div>
        )}

        {phase === 'gate' && selectedCircle && (
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
            <button onClick={backToList} className="text-xs font-bold text-slate-400 hover:text-slate-600 mb-4">← Volver</button>
            <h2 className="text-xl font-black text-slate-800 mb-1">{selectedCircle.evalLabel}</h2>
            <p className="text-sm text-slate-500 font-bold mb-4">
              {selectedCircle.gateConfig.questionCount} preguntas · {Math.round(selectedCircle.gateConfig.timeLimitSeconds / 60)} minutos · necesitas {selectedCircle.gateConfig.passThreshold}% para aprobar
            </p>

            {docsByCircle[selectedCircle.id]?.passed && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 mb-4 text-emerald-800 font-bold text-sm">
                ✓ Ya aprobaste esta recuperación ({docsByCircle[selectedCircle.id].bestScore}%). Habla con tu profesor para repetir la evaluación. Puedes seguir practicando si quieres.
              </div>
            )}

            {docsByCircle[selectedCircle.id]?.attempts?.length > 0 && (
              <div className="mb-4">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Intentos Anteriores</p>
                <div className="space-y-1">
                  {docsByCircle[selectedCircle.id].attempts.slice().reverse().map((a, idx) => (
                    <div key={idx} className={`text-xs font-bold px-3 py-1.5 rounded-lg ${a.passed ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-50 text-slate-500'}`}>
                      {a.passed ? '✓' : '✗'} {a.score}%
                    </div>
                  ))}
                </div>
              </div>
            )}

            <button
              onClick={startAttempt}
              className="w-full bg-rose-600 hover:bg-rose-700 text-white font-black py-3 rounded-xl uppercase tracking-wide text-sm transition-colors"
            >
              🎯 Comenzar Intento
            </button>
          </div>
        )}

        {phase === 'session' && gateSegment && (
          <WorkoutEngine
            key={`${selectedCircle.id}_${sessionNonce}`}
            segment={gateSegment}
            history={[]}
            podIndex={0}
            onClose={() => setPhase('gate')}
            onComplete={handleGateComplete}
          />
        )}

        {feedbackModal && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
            <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-sm w-full text-center border border-slate-200">
              <div className="text-5xl mb-3">{feedbackModal.passed ? '🎉' : '💪'}</div>
              <h3 className="text-xl font-black text-slate-800 mb-1">
                {feedbackModal.passed ? '¡Aprobaste!' : 'Todavía no'}
              </h3>
              <p className="text-sm text-slate-500 font-bold mb-6">
                Obtuviste un {feedbackModal.score}% (necesitas {feedbackModal.threshold}%)
              </p>
              <button
                onClick={() => setFeedbackModal(null)}
                className="w-full bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold py-3 rounded-xl uppercase tracking-wide text-sm transition-colors"
              >
                Continuar
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
