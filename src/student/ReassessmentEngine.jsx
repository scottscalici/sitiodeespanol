import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { getCachedCollection, getCachedBucketedCollection } from '../utils/firestoreCache';
import { fetchRecuperacionDoc } from '../utils/recuperacionData';
import {
  fetchReassessmentAttempt,
  startReassessmentAttempt,
  saveReassessmentAnswers,
  finishReassessmentAttempt,
} from '../utils/reassessmentData';
import { fetchClassSchedule, isReassessmentWindowOpen } from '../utils/classSchedule';
import { generateVerbQuestions } from '../utils/verbQuestionGenerator';

const gradeAnswers = (questions, answerMap) => {
  let correct = 0;
  (questions || []).forEach((q, idx) => {
    const userVal = (answerMap[idx] || '').trim().toLowerCase();
    const allowed = (q.forma || '').toLowerCase().split(/[/|;,]/).map((a) => a.trim());
    if (allowed.includes(userVal)) correct += 1;
  });
  const total = (questions || []).length;
  return { correct, total, score: total > 0 ? Math.round((correct / total) * 100) : 0 };
};

const Shell = ({ children }) => (
  <div className="min-h-screen bg-slate-950 p-4 md:p-8 text-white">
    <div className="max-w-2xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-xl font-black">🎯 Reevaluación</h1>
        <Link to="/recuperacion" className="text-slate-400 hover:text-white font-bold text-xs bg-slate-800 px-4 py-2 rounded-xl border border-slate-700">
          ← Volver
        </Link>
      </div>
      {children}
    </div>
  </div>
);

// Phase B of Reassessments: the actual timed, auto-graded quiz a student
// reaches after passing the recuperación gate (see Recuperacion.jsx, which
// links here once a circle is both `passed` and has a reassessment_configs
// doc). Two real checks gate starting an attempt — has this student passed
// THIS circle's gate, and is it currently their own class's A/B-day window
// (config/class_schedule, see classSchedule.js) — but there is no
// lockout/tab-switch enforcement yet and no override UI (later phases), so
// a closed window simply shows why rather than offering any way around it.
// No points are awarded here, same as the gate itself (see
// recuperacionData.js's own top comment) — a reassessment replaces an
// official Schoology grade, it isn't a points-earning activity. By design
// this is a single official attempt: once `finished`, it shows the result
// and does not offer a retake.
export default function ReassessmentEngine() {
  const { circleId } = useParams();
  const { currentUser, userData } = useAuth();
  const uid = currentUser?.uid;
  const studentName = `${userData?.firstName || ''} ${userData?.lastName || ''}`.trim() || userData?.email || 'Estudiante';

  const [phase, setPhase] = useState('loading'); // loading | gate_locked | no_config | window_closed | ready | in_progress | finished
  const [windowInfo, setWindowInfo] = useState(null);
  const [config, setConfig] = useState(null);
  const [verbGroupsById, setVerbGroupsById] = useState({});
  const [masterVerbsMap, setMasterVerbsMap] = useState({});
  const [attempt, setAttempt] = useState(null); // { questions, answers, expiresAt, ... }
  const [errorMessage, setErrorMessage] = useState('');

  const [answers, setAnswers] = useState({});
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [result, setResult] = useState(null); // { score, finishedAnswers }
  const saveTimeoutRef = useRef(null);

  useEffect(() => {
    const load = async () => {
      if (!uid || !circleId) return;
      try {
        const [recupDoc, configSnap, calSnap, scheduleBlocks, groups, verbsArray, existingAttempt] = await Promise.all([
          fetchRecuperacionDoc(uid, circleId),
          getDoc(doc(db, 'reassessment_configs', circleId)),
          getDoc(doc(db, 'config', 'academic_year_2026_2027')),
          fetchClassSchedule(),
          getCachedCollection('verbGroups'),
          getCachedBucketedCollection('verbs'),
          fetchReassessmentAttempt(uid, circleId),
        ]);

        setVerbGroupsById(Object.fromEntries(groups.map((g) => [g.id, g])));
        const verbsMap = {};
        verbsArray.forEach((v) => {
          verbsMap[v.id] = v;
        });
        setMasterVerbsMap(verbsMap);

        const cfg = configSnap.exists() ? configSnap.data() : null;
        setConfig(cfg);

        // Already has an attempt — its own state decides the phase,
        // regardless of gate/window (those only gate STARTING a new one).
        if (existingAttempt) {
          if (existingAttempt.status === 'finished') {
            setAttempt(existingAttempt);
            setResult({ score: existingAttempt.score, finishedAnswers: existingAttempt.answers || {} });
            setPhase('finished');
            return;
          }
          const expiresAt = new Date(existingAttempt.expiresAt);
          if (new Date() >= expiresAt) {
            // Time ran out while the student was away — finalize with
            // whatever was last autosaved rather than leave it stuck open.
            const graded = gradeAnswers(existingAttempt.questions, existingAttempt.answers || {});
            await finishReassessmentAttempt(uid, circleId, { answers: existingAttempt.answers || {}, score: graded.score });
            setAttempt(existingAttempt);
            setResult({ score: graded.score, finishedAnswers: existingAttempt.answers || {} });
            setPhase('finished');
            return;
          }
          setAttempt(existingAttempt);
          setAnswers(existingAttempt.answers || {});
          setRemainingSeconds(Math.max(0, Math.round((expiresAt - new Date()) / 1000)));
          setPhase('in_progress');
          return;
        }

        if (!recupDoc?.passed) {
          setPhase('gate_locked');
          return;
        }
        if (!cfg) {
          setPhase('no_config');
          return;
        }

        const calendarArray = calSnap.exists() ? calSnap.data().map || [] : [];
        const todayStr = new Date().toLocaleDateString('en-CA');
        const todaysEntry = calendarArray.find((c) => c.fecha === todayStr);
        const todaysCiclo = todaysEntry?.ciclo || null;

        const windowResult = isReassessmentWindowOpen(userData?.section, scheduleBlocks, todaysCiclo);
        setWindowInfo(windowResult);
        setPhase(windowResult.open ? 'ready' : 'window_closed');
      } catch (err) {
        console.error('Error loading reassessment:', err);
        setErrorMessage('Hubo un error al cargar la reevaluación.');
      }
    };
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid, circleId]);

  const handleStart = async () => {
    setErrorMessage('');
    try {
      const blocks = (config.groups || []).map((r) => {
        const group = verbGroupsById[r.groupId];
        return {
          label: group?.name || r.groupId,
          tense: r.tense,
          allowedVerbs: group?.verbIds || [],
          count: Number(r.count) || 0,
          specificVerb: 'any',
          targetSubject: 'any',
        };
      });
      const generated = generateVerbQuestions(blocks, masterVerbsMap, { withoutReplacement: true });
      if (generated.length === 0) {
        setErrorMessage('No se pudieron generar preguntas — avísale a tu profesor.');
        return;
      }
      const meta = { course: config.course, studentName, circleId, evalLabel: config.evalLabel };
      const newAttempt = await startReassessmentAttempt(uid, meta, generated, config.timeLimitSeconds);
      setAttempt(newAttempt);
      setAnswers({});
      setRemainingSeconds(config.timeLimitSeconds);
      setPhase('in_progress');
    } catch (err) {
      console.error('Error starting reassessment:', err);
      setErrorMessage('No se pudo empezar la reevaluación. Intenta de nuevo.');
    }
  };

  const updateAnswer = (idx, value) => {
    const next = { ...answers, [idx]: value };
    setAnswers(next);
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      saveTimeoutRef.current = null;
      saveReassessmentAnswers(uid, circleId, next).catch((err) => console.error('Error saving answers:', err));
    }, 800);
  };

  const handleSubmit = async () => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
    }
    const questions = attempt?.questions || [];
    const graded = gradeAnswers(questions, answers);
    try {
      await finishReassessmentAttempt(uid, circleId, { answers, score: graded.score });
    } catch (err) {
      console.error('Error finishing reassessment:', err);
    }
    setResult({ score: graded.score, finishedAnswers: answers });
    setPhase('finished');
  };

  // Countdown — ticks locally but the real deadline is the stored
  // expiresAt, so a refresh mid-attempt recomputes from that timestamp
  // rather than resetting a fresh 100%-of-the-limit clock.
  useEffect(() => {
    if (phase !== 'in_progress') return;
    const t = setTimeout(() => {
      if (remainingSeconds <= 0) {
        handleSubmit();
      } else {
        setRemainingSeconds((s) => s - 1);
      }
    }, remainingSeconds <= 0 ? 0 : 1000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, remainingSeconds]);

  const formatTime = (secs) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const WINDOW_REASON_LABEL = {
    no_section: 'Tu cuenta no tiene una sección de clase asignada — avísale a tu profesor.',
    no_ciclo_today: 'Hoy no es un día de clase regular.',
    wrong_day: 'Hoy no es el día de tu clase para esta reevaluación.',
    no_schedule: 'Tu profesor todavía no ha configurado el horario para tu sección.',
    outside_window: 'Fuera del horario de tu clase.',
  };

  if (phase === 'loading') {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <p className="text-slate-400 font-bold uppercase tracking-widest animate-pulse">Cargando reevaluación...</p>
      </div>
    );
  }

  if (phase === 'gate_locked') {
    return (
      <Shell>
        <div className="bg-slate-900 border border-slate-700 rounded-2xl p-8 text-center">
          <p className="text-lg font-bold text-amber-400 mb-2">🔒 Primero debes aprobar la recuperación</p>
          <p className="text-sm text-slate-400">Completa la reflexión y práctica para esta evaluación antes de intentar la reevaluación.</p>
        </div>
      </Shell>
    );
  }

  if (phase === 'no_config') {
    return (
      <Shell>
        <div className="bg-slate-900 border border-slate-700 rounded-2xl p-8 text-center">
          <p className="text-lg font-bold text-slate-300">Esta reevaluación todavía no está configurada.</p>
        </div>
      </Shell>
    );
  }

  if (phase === 'window_closed') {
    const block = windowInfo?.block;
    return (
      <Shell>
        <div className="bg-slate-900 border border-slate-700 rounded-2xl p-8 text-center">
          <p className="text-lg font-bold text-amber-400 mb-2">⏰ No disponible en este momento</p>
          <p className="text-sm text-slate-400 mb-3">{WINDOW_REASON_LABEL[windowInfo?.reason] || 'No disponible ahora mismo.'}</p>
          {block && (
            <p className="text-xs text-slate-500 font-mono">
              Disponible de {block.start} a {block.end} ({block.section})
            </p>
          )}
        </div>
      </Shell>
    );
  }

  if (phase === 'ready') {
    const totalQuestions = (config.groups || []).reduce((sum, r) => sum + (Number(r.count) || 0), 0);
    return (
      <Shell>
        <div className="bg-slate-900 border border-slate-700 rounded-2xl p-8 text-center space-y-4">
          <p className="text-lg font-bold text-emerald-400">✅ Disponible ahora</p>
          <p className="text-sm text-slate-400">{config.evalLabel}</p>
          <p className="text-xs text-slate-500 font-mono">
            {totalQuestions} preguntas · {Math.round(config.timeLimitSeconds / 60)} minutos
          </p>
          <p className="text-xs text-amber-400 font-bold">
            Una vez que empieces, el tiempo corre — no podrás pausar.
          </p>
          {errorMessage && <p className="text-xs text-rose-400 font-bold">{errorMessage}</p>}
          <button
            onClick={handleStart}
            className="w-full px-8 py-4 rounded-2xl font-black uppercase tracking-widest text-sm shadow-lg bg-violet-600 hover:bg-violet-700 text-white transition-all"
          >
            Comenzar Reevaluación
          </button>
        </div>
      </Shell>
    );
  }

  if (phase === 'in_progress') {
    const questions = attempt?.questions || [];
    return (
      <Shell>
        <div className="sticky top-0 z-10 bg-slate-900 border border-slate-700 rounded-2xl p-4 mb-4 flex justify-between items-center">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">{config.evalLabel}</span>
          <span className={`font-mono font-black text-lg ${remainingSeconds <= 30 ? 'text-rose-400' : 'text-sky-400'}`}>
            ⏱ {formatTime(remainingSeconds)}
          </span>
        </div>
        <div className="space-y-3">
          {questions.map((q, idx) => (
            <div key={idx} className="bg-white text-slate-900 p-4 rounded-xl">
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs font-black uppercase text-slate-600">
                  {idx + 1}. {q.sujeto} ({q.palabra}) — <span className="text-sky-600 italic">{q.tense}</span>
                </span>
                <span className="text-xs text-slate-500 font-medium">{q.traducción}</span>
              </div>
              <input
                type="text"
                value={answers[idx] || ''}
                onChange={(e) => updateAnswer(idx, e.target.value)}
                placeholder="Escribe la forma conjugada..."
                className="w-full p-2.5 border-2 border-slate-300 rounded-lg text-sm font-bold outline-none focus:border-violet-500"
              />
            </div>
          ))}
        </div>
        <button
          onClick={handleSubmit}
          className="w-full mt-4 px-8 py-4 rounded-2xl font-black uppercase tracking-widest text-sm shadow-lg bg-violet-600 hover:bg-violet-700 text-white transition-all"
        >
          Enviar Reevaluación
        </button>
      </Shell>
    );
  }

  // phase === 'finished'
  const questions = attempt?.questions || [];
  const finishedAnswers = result?.finishedAnswers || {};
  return (
    <Shell>
      <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 text-center mb-4">
        <p className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-1">Resultado</p>
        <p className="text-4xl font-black text-emerald-400">{result?.score}%</p>
      </div>
      <div className="space-y-2">
        {questions.map((q, idx) => {
          const userVal = (finishedAnswers[idx] || '').trim().toLowerCase();
          const allowed = (q.forma || '').toLowerCase().split(/[/|;,]/).map((a) => a.trim());
          const correct = allowed.includes(userVal);
          return (
            <div
              key={idx}
              className={`p-3 rounded-xl border ${correct ? 'bg-emerald-950/30 border-emerald-700' : 'bg-rose-950/30 border-rose-700'}`}
            >
              <p className="text-xs font-bold text-slate-300">
                {q.sujeto} ({q.palabra}, {q.tense})
              </p>
              <p className="text-sm">
                Tu respuesta: <span className="font-bold">{finishedAnswers[idx] || '—'}</span>
                {!correct && <span className="text-emerald-400 font-bold"> · Correcta: {q.forma}</span>}
              </p>
            </div>
          );
        })}
      </div>
    </Shell>
  );
}
