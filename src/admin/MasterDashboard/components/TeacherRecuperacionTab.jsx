import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getCachedCollection, invalidateCollectionCache } from '../../../utils/firestoreCache';
import { fetchEvaluacionOptions, resolveCurrentEvalDia } from '../../../utils/evaluaciones';
import {
  clearReassessmentAttempt,
  grantReassessmentOverride,
  endReassessmentNow,
  unlockReassessmentAccess,
} from '../../../utils/reassessmentData';
import { resetRecuperacionForRetake } from '../../../utils/recuperacionData';

// Teacher-facing eligibility list: only who's PASSED the recuperación gate
// for a given quiz, grouped by course and quiz, most recent quiz first —
// never the reflection text itself, which is private to the student. Also
// shows each passed student's reassessment status (finished/in progress),
// since a finished reassessment is a one-shot the student can't retake on
// their own — "🔄 Reiniciar" is the only way back in, and it resets the
// FULL process (reflection + gate practice + reassessment), not just the
// reassessment: a retake means doing all of it again, never a shortcut
// straight back to the quiz (see resetRecuperacionForRetake and
// clearReassessmentAttempt — both archive the prior record, never discard it).
export default function TeacherRecuperacionTab() {
  const [isLoading, setIsLoading] = useState(true);
  const [groupsByCourse, setGroupsByCourse] = useState({ s2: [], s4: [] });
  const [resettingKey, setResettingKey] = useState(null);

  // No setIsLoading(true) here on purpose: `isLoading` starts true (see
  // useState above) and this same function is also called from
  // handleReset below, where flashing the full-page loading screen again
  // for a single row's reset would be a jarring regression — see the
  // effect below, which is the only caller that cares about that flag.
  const load = async () => {
    try {
      const [podDocs, recupDocs, reassessmentDocs, s2Options, s4Options] = await Promise.all([
        getCachedCollection('practice_pods'),
        getCachedCollection('recuperaciones'),
        getCachedCollection('reassessment_attempts', { force: true }),
        fetchEvaluacionOptions('s2'),
        fetchEvaluacionOptions('s4'),
      ]);
      const evalOptionsByCourse = { s2: s2Options, s4: s4Options };
      // doc id is already `${uid}__${circleId}` (see reassessmentData.js)
      const attemptsByKey = Object.fromEntries(reassessmentDocs.map((d) => [d.id, d]));

      // circleId -> { course, evalDia (live-resolved), evalLabel }
      const circleMeta = {};
      podDocs
        .filter((d) => Array.isArray(d.pods))
        .forEach((d) => {
          d.pods.forEach((pod) => {
            if (!pod.gateConfig || !pod.evalLink) return;
            const id = `${d.path_id}__${pod.id}`;
            circleMeta[id] = {
              course: d.course,
              evalLabel: pod.evalLink.label,
              evalDia: resolveCurrentEvalDia(evalOptionsByCourse[d.course] || [], pod.evalLink),
            };
          });
        });

      const passedDocs = recupDocs.filter((d) => d.passed);

      const byCourse = { s2: {}, s4: {} };
      passedDocs.forEach((d) => {
        const meta = circleMeta[d.circleId];
        if (!meta) return; // gate was since disabled/deleted — nothing to show
        const key = `${meta.evalDia}__${meta.evalLabel}`;
        if (!byCourse[meta.course][key]) {
          byCourse[meta.course][key] = { evalDia: meta.evalDia, evalLabel: meta.evalLabel, students: [] };
        }
        const attempt = attemptsByKey[`${d.uid}__${d.circleId}`];
        const overrideActive = attempt?.override?.openUntil && new Date(attempt.override.openUntil) > new Date();
        byCourse[meta.course][key].students.push({
          uid: d.uid,
          circleId: d.circleId,
          studentName: d.studentName || d.uid,
          bestScore: d.bestScore,
          passedAt: d.passedAt,
          reassessment: attempt?.status
            ? { status: attempt.status, score: attempt.score, tabSwitchCount: (attempt.tabSwitchLog || []).length }
            : null,
          overrideUntil: overrideActive ? attempt.override.openUntil : null,
        });
      });

      const sortGroups = (obj) => Object.values(obj).sort((a, b) => (b.evalDia || 0) - (a.evalDia || 0));
      setGroupsByCourse({ s2: sortGroups(byCourse.s2), s4: sortGroups(byCourse.s4) });
    } catch (err) {
      console.error('Error loading recuperación eligibility list:', err);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    // `load` is also called from handleReset below (so a reset refreshes
    // this same list without a full-page reload) — the lint rule flags any
    // shared loader called from an effect on principle, but there's no
    // actual re-render loop here: this only ever runs once, on mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, []);

  const handleReset = async (uid, circleId) => {
    const key = `${uid}__${circleId}`;
    setResettingKey(key);
    try {
      // Both together, always — a retake is the full process over again,
      // never just a fresh reassessment on top of an already-passed gate.
      await Promise.all([resetRecuperacionForRetake(uid, circleId), clearReassessmentAttempt(uid, circleId)]);
      invalidateCollectionCache('reassessment_attempts');
      await load();
    } catch (err) {
      console.error('Error resetting reassessment attempt:', err);
    } finally {
      setResettingKey(null);
    }
  };

  // "They're meeting me outside class" — bypasses the A/B window check for
  // 20 minutes for this one student/quiz, never the gate-pass check. Does
  // NOT need a reassessment doc to already exist (see firestore.rules —
  // admin can create one too).
  const handleOpenNow = async (uid, circleId) => {
    const key = `${uid}__${circleId}`;
    setResettingKey(key);
    try {
      await grantReassessmentOverride(uid, circleId, 20);
      invalidateCollectionCache('reassessment_attempts');
      await load();
    } catch (err) {
      console.error('Error granting reassessment override:', err);
    } finally {
      setResettingKey(null);
    }
  };

  // Glitch recovery for an attempt stuck `in_progress` (crash, lost
  // connection) — distinct from handleReset above, which is for a
  // cleanly-FINISHED attempt and deliberately forces the whole gate redo.
  // None of these three touch the gate: they only ever grade, clear, or
  // unstick the reassessment itself.
  const handleEndNow = async (uid, circleId) => {
    const key = `${uid}__${circleId}`;
    setResettingKey(key);
    try {
      await endReassessmentNow(uid, circleId);
      invalidateCollectionCache('reassessment_attempts');
      await load();
    } catch (err) {
      console.error('Error ending reassessment now:', err);
    } finally {
      setResettingKey(null);
    }
  };

  const handleResetStuckAttempt = async (uid, circleId) => {
    const key = `${uid}__${circleId}`;
    setResettingKey(key);
    try {
      await clearReassessmentAttempt(uid, circleId);
      invalidateCollectionCache('reassessment_attempts');
      await load();
    } catch (err) {
      console.error('Error resetting stuck reassessment attempt:', err);
    } finally {
      setResettingKey(null);
    }
  };

  const handleUnlockOnly = async (uid, circleId) => {
    const key = `${uid}__${circleId}`;
    setResettingKey(key);
    try {
      await unlockReassessmentAccess(uid);
      await load();
    } catch (err) {
      console.error('Error unlocking reassessment access:', err);
    } finally {
      setResettingKey(null);
    }
  };

  const renderCourseColumn = (label, groups) => (
    <div>
      <h3 className="text-sm font-black text-slate-300 uppercase tracking-widest mb-3 border-b border-slate-700 pb-2">{label}</h3>
      {groups.length === 0 && (
        <p className="text-slate-500 text-xs italic font-bold py-4">Nadie ha aprobado una recuperación todavía.</p>
      )}
      <div className="space-y-4">
        {groups.map((g) => (
          <div key={`${g.evalDia}__${g.evalLabel}`} className="bg-slate-900 border border-slate-700 rounded-xl p-4">
            <p className="text-[10px] font-black text-rose-400 uppercase tracking-widest mb-1">Día {g.evalDia ?? '?'}</p>
            <p className="font-bold text-white mb-2">{g.evalLabel}</p>
            <div className="space-y-1">
              {g.students.map((s, idx) => {
                const key = `${s.uid}__${s.circleId}`;
                return (
                  <div key={idx} className="flex justify-between items-center text-xs bg-slate-800 rounded-lg px-3 py-1.5 gap-2">
                    <span className="font-bold text-slate-200 truncate">✓ {s.studentName}</span>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-emerald-400 font-black" title="Mejor puntaje de la práctica (gate)">{s.bestScore}%</span>
                      {s.reassessment?.status === 'in_progress' && (
                        <>
                          <span className="text-amber-400 font-black uppercase tracking-widest text-[10px]">⏳ En progreso</span>
                          {s.reassessment.tabSwitchCount > 0 && (
                            <span
                              className="text-rose-400 font-black text-[10px]"
                              title="Veces que salió de la pestaña/ventana durante el intento"
                            >
                              ⚠️ {s.reassessment.tabSwitchCount}
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={() => handleEndNow(s.uid, s.circleId)}
                            disabled={resettingKey === key}
                            className="bg-emerald-700 hover:bg-emerald-600 text-white text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded disabled:opacity-50"
                            title="Califica con lo guardado hasta ahora y lo marca como terminado"
                          >
                            {resettingKey === key ? '...' : '✅ Finalizar Ahora'}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleResetStuckAttempt(s.uid, s.circleId)}
                            disabled={resettingKey === key}
                            className="bg-slate-700 hover:bg-slate-600 text-slate-200 text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded disabled:opacity-50"
                            title="Borra solo este intento atascado (no toca la recuperación) para que pueda empezar de nuevo"
                          >
                            {resettingKey === key ? '...' : '🛠️ Reiniciar Intento'}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleUnlockOnly(s.uid, s.circleId)}
                            disabled={resettingKey === key}
                            className="bg-slate-700 hover:bg-slate-600 text-slate-200 text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded disabled:opacity-50"
                            title="Solo quita el bloqueo del sitio, sin tocar el intento — para cuando el bloqueo se quedó pegado"
                          >
                            {resettingKey === key ? '...' : '🔓 Desbloquear'}
                          </button>
                        </>
                      )}
                      {s.reassessment?.status === 'finished' && (
                        <>
                          <span className="text-violet-400 font-black" title="Puntaje de la reevaluación">🎯 {s.reassessment.score}%</span>
                          {s.reassessment.tabSwitchCount > 0 && (
                            <span
                              className="text-rose-400 font-black text-[10px]"
                              title="Veces que salió de la pestaña/ventana durante el intento"
                            >
                              ⚠️ {s.reassessment.tabSwitchCount}
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={() => handleReset(s.uid, s.circleId)}
                            disabled={resettingKey === key}
                            className="bg-slate-700 hover:bg-slate-600 text-slate-200 text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded disabled:opacity-50"
                            title="Reinicia todo el proceso: reflexión, práctica, y reevaluación"
                          >
                            {resettingKey === key ? '...' : '🔄 Reiniciar'}
                          </button>
                        </>
                      )}
                      {!s.reassessment && (
                        s.overrideUntil ? (
                          <span className="text-violet-400 font-black uppercase tracking-widest text-[10px]" title="Puede empezar aunque esté fuera de su horario">
                            🔓 Abierto hasta {new Date(s.overrideUntil).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleOpenNow(s.uid, s.circleId)}
                            disabled={resettingKey === key}
                            className="bg-violet-700 hover:bg-violet-600 text-white text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded disabled:opacity-50"
                            title="Permite empezar la reevaluación ahora mismo, fuera de su horario normal (20 min)"
                          >
                            {resettingKey === key ? '...' : '🔓 Abrir Ahora'}
                          </button>
                        )
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  if (isLoading) {
    return <div className="p-8 text-slate-400 font-bold uppercase tracking-widest animate-pulse">Cargando...</div>;
  }

  return (
    <main className="max-w-6xl mx-auto bg-slate-800 rounded-2xl border border-slate-700 p-6 shadow-xl">
      <div className="mb-6 pb-4 border-b border-slate-700 flex justify-between items-start gap-4">
        <div>
          <h2 className="text-lg font-black text-white uppercase tracking-wider">📋 Recuperación — Elegibles</h2>
          <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mt-1">
            Estudiantes que completaron reflexión + práctica y están listos para repetir la evaluación en Schoology
          </p>
        </div>
        <Link
          to="/admin-reassessment-config"
          className="shrink-0 bg-violet-600 hover:bg-violet-500 text-white text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg"
        >
          🎲 Reevaluaciones
        </Link>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {renderCourseColumn('Español II (S2)', groupsByCourse.s2)}
        {renderCourseColumn('IB Español (S4)', groupsByCourse.s4)}
      </div>
    </main>
  );
}
