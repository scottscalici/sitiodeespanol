import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getCachedCollection, invalidateCollectionCache } from '../../../utils/firestoreCache';
import { fetchEvaluacionOptions, resolveCurrentEvalDia } from '../../../utils/evaluaciones';
import { clearReassessmentAttempt } from '../../../utils/reassessmentData';

// Teacher-facing eligibility list: only who's PASSED the recuperación gate
// for a given quiz, grouped by course and quiz, most recent quiz first —
// never the reflection text itself, which is private to the student. Also
// shows each passed student's reassessment status (finished/in progress),
// since a finished reassessment is a one-shot the student can't retake on
// their own — "🔄 Reiniciar" here is the only way to let them try again
// (see clearReassessmentAttempt: it archives the old score instead of
// deleting it outright).
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
        byCourse[meta.course][key].students.push({
          uid: d.uid,
          circleId: d.circleId,
          studentName: d.studentName || d.uid,
          bestScore: d.bestScore,
          passedAt: d.passedAt,
          reassessment: attempt?.status ? { status: attempt.status, score: attempt.score } : null,
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
      await clearReassessmentAttempt(uid, circleId);
      invalidateCollectionCache('reassessment_attempts');
      await load();
    } catch (err) {
      console.error('Error resetting reassessment attempt:', err);
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
                        <span className="text-amber-400 font-black uppercase tracking-widest text-[10px]">⏳ En progreso</span>
                      )}
                      {s.reassessment?.status === 'finished' && (
                        <>
                          <span className="text-violet-400 font-black" title="Puntaje de la reevaluación">🎯 {s.reassessment.score}%</span>
                          <button
                            type="button"
                            onClick={() => handleReset(s.uid, s.circleId)}
                            disabled={resettingKey === key}
                            className="bg-slate-700 hover:bg-slate-600 text-slate-200 text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded disabled:opacity-50"
                            title="Permitir que el estudiante repita la reevaluación"
                          >
                            {resettingKey === key ? '...' : '🔄 Reiniciar'}
                          </button>
                        </>
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
