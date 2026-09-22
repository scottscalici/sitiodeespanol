import React, { useState, useEffect } from 'react';
import { getCachedCollection } from '../../../utils/firestoreCache';
import { fetchEvaluacionOptions, resolveCurrentEvalDia } from '../../../utils/evaluaciones';

// Teacher-facing eligibility list: only who's PASSED the recuperación gate
// for a given quiz, grouped by course and quiz, most recent quiz first —
// never the reflection text itself, which is private to the student.
export default function TeacherRecuperacionTab() {
  const [isLoading, setIsLoading] = useState(true);
  const [groupsByCourse, setGroupsByCourse] = useState({ s2: [], s4: [] });

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      try {
        const [podDocs, recupDocs, s2Options, s4Options] = await Promise.all([
          getCachedCollection('practice_pods'),
          getCachedCollection('recuperaciones'),
          fetchEvaluacionOptions('s2'),
          fetchEvaluacionOptions('s4'),
        ]);
        const evalOptionsByCourse = { s2: s2Options, s4: s4Options };

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
          byCourse[meta.course][key].students.push({
            studentName: d.studentName || d.uid,
            bestScore: d.bestScore,
            passedAt: d.passedAt,
          });
        });

        const sortGroups = (obj) => Object.values(obj).sort((a, b) => (b.evalDia || 0) - (a.evalDia || 0));
        setGroupsByCourse({ s2: sortGroups(byCourse.s2), s4: sortGroups(byCourse.s4) });
      } catch (err) {
        console.error('Error loading recuperación eligibility list:', err);
      }
      setIsLoading(false);
    };
    load();
  }, []);

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
              {g.students.map((s, idx) => (
                <div key={idx} className="flex justify-between items-center text-xs bg-slate-800 rounded-lg px-3 py-1.5">
                  <span className="font-bold text-slate-200">✓ {s.studentName}</span>
                  <span className="text-emerald-400 font-black">{s.bestScore}%</span>
                </div>
              ))}
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
      <div className="mb-6 pb-4 border-b border-slate-700">
        <h2 className="text-lg font-black text-white uppercase tracking-wider">📋 Recuperación — Elegibles</h2>
        <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mt-1">
          Estudiantes que completaron reflexión + práctica y están listos para repetir la evaluación en Schoology
        </p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {renderCourseColumn('Español II (S2)', groupsByCourse.s2)}
        {renderCourseColumn('IB Español (S4)', groupsByCourse.s4)}
      </div>
    </main>
  );
}
