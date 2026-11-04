import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { getCachedCollection } from '../../utils/firestoreCache';
import { getMonthKey, formatMonthLabel } from '../../utils/pointsHelper';

// Read-only — never writes anything, and doesn't touch the real leaderboard
// components at all. Exists because monthly_points/monthKey on a student's
// own doc get overwritten the moment THEY earn points in a new month (see
// awardPoints in pointsHelper.js), and the only durable monthly record is
// leaderboard_history's course-wide top 3 — there's no per-section
// breakdown anywhere. This can't recover a past month's total for a
// student who's already rolled over to the current month unless they were
// in that top 3; it says so plainly instead of silently showing a 0.
const lastMonthKeyOf = (monthKey) => {
  const [y, m] = monthKey.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1, 1));
  d.setUTCMonth(d.getUTCMonth() - 1);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
};

const nameOf = (s) => {
  const lastInitial = s.lastName ? `${s.lastName.trim().charAt(0).toUpperCase()}.` : '';
  return [s.firstName, lastInitial].filter(Boolean).join(' ') || s.email || 'Estudiante';
};

const MonthlyLeadersReport = () => {
  const [course, setCourse] = useState('s2');
  const [students, setStudents] = useState([]);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  const thisMonthKey = useMemo(() => getMonthKey(), []);
  const lastMonthKey = useMemo(() => lastMonthKeyOf(thisMonthKey), [thisMonthKey]);

  useEffect(() => {
    Promise.all([getCachedCollection('users'), getCachedCollection('leaderboard_history')])
      .then(([allUsers, allHistory]) => {
        setStudents(allUsers.filter((u) => u.role === 'student' && !u.independent));
        setHistory(allHistory);
      })
      .catch((err) => console.error('Error loading monthly leaders report:', err))
      .finally(() => setLoading(false));
  }, []);

  const courseStudents = useMemo(() => students.filter((s) => s.course === course), [students, course]);

  const bySection = useMemo(() => {
    const groups = {};
    courseStudents.forEach((s) => {
      const key = s.section || '(sin sección)';
      if (!groups[key]) groups[key] = [];
      const lastMonthPoints = s.monthKey === lastMonthKey ? (s.monthly_points || 0) : null;
      groups[key].push({
        uid: s.id,
        name: nameOf(s),
        lastMonthPoints,
        thisMonthPoints: s.monthKey === thisMonthKey ? (s.monthly_points || 0) : 0,
        totalPoints: s.total_points || s.current_path_points || 0,
      });
    });
    Object.values(groups).forEach((rows) =>
      rows.sort((a, b) => (b.lastMonthPoints ?? -1) - (a.lastMonthPoints ?? -1))
    );
    return groups;
  }, [courseStudents, lastMonthKey, thisMonthKey]);

  const archivedTop3 = useMemo(() => {
    const entry = history.find((h) => h.course === course && h.period === 'monthly' && h.key === lastMonthKey);
    if (!entry) return null;
    const sectionByUid = Object.fromEntries(courseStudents.map((s) => [s.id, s.section || '(sin sección)']));
    return entry.top.map((t) => ({ ...t, section: sectionByUid[t.uid] || '?' }));
  }, [history, course, lastMonthKey, courseStudents]);

  if (loading) {
    return <div className="p-12 text-center text-slate-400 font-bold uppercase tracking-widest animate-pulse">Cargando...</div>;
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 sm:p-8">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex justify-between items-center">
          <Link to="/admin-daily-plan-hub" className="text-slate-500 hover:text-slate-800 text-xs font-bold">← Hub</Link>
          <div className="flex bg-white border border-slate-300 rounded-lg overflow-hidden">
            <button onClick={() => setCourse('s2')} className={`px-4 py-2 text-xs font-black uppercase tracking-widest ${course === 's2' ? 'bg-slate-800 text-white' : 'text-slate-500 hover:bg-slate-50'}`}>S2</button>
            <button onClick={() => setCourse('s4')} className={`px-4 py-2 text-xs font-black uppercase tracking-widest ${course === 's4' ? 'bg-slate-800 text-white' : 'text-slate-500 hover:bg-slate-50'}`}>S4</button>
          </div>
        </div>

        <div>
          <h1 className="text-2xl font-black text-slate-800">Líderes Mensuales por Clase</h1>
          <p className="text-sm text-slate-500 mt-1">
            Mes pasado: <span className="font-bold">{formatMonthLabel(lastMonthKey)}</span> · Este mes (en vivo): <span className="font-bold">{formatMonthLabel(thisMonthKey)}</span>
          </p>
          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3 mt-3">
            ⚠️ El puntaje de "mes pasado" de un estudiante se borra de su propio perfil en cuanto gana puntos en el mes nuevo —
            así que solo se puede recuperar con exactitud para quienes todavía no han ganado puntos este mes. Para los demás
            verás <span className="font-mono">"— ya pasó de mes"</span> en lugar de un número; su total histórico (siempre exacto)
            se muestra aparte como referencia.
          </p>
        </div>

        {archivedTop3 && (
          <div className="bg-amber-50 border-2 border-amber-300 rounded-2xl p-5">
            <h2 className="text-xs font-black text-amber-700 uppercase tracking-widest mb-3">🏆 Top 3 Archivado — {formatMonthLabel(lastMonthKey)} (curso completo)</h2>
            <ol className="space-y-1.5">
              {archivedTop3.map((t, i) => (
                <li key={t.uid} className="flex items-center gap-3 text-sm">
                  <span className="w-6 text-center shrink-0">{['🥇', '🥈', '🥉'][i]}</span>
                  <span className="flex-1 font-bold text-slate-800">{t.name}</span>
                  <span className="text-xs font-mono text-slate-500">Sección {t.section}</span>
                  <span className="font-black text-amber-700">{t.points.toLocaleString()} pts</span>
                </li>
              ))}
            </ol>
          </div>
        )}

        <div className="space-y-5">
          {Object.entries(bySection).sort(([a], [b]) => a.localeCompare(b)).map(([section, rows]) => (
            <div key={section} className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
              <h2 className="text-sm font-black text-slate-700 uppercase tracking-widest mb-3">Sección {section}</h2>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-200">
                    <th className="pb-2">Estudiante</th>
                    <th className="pb-2 text-right">{formatMonthLabel(lastMonthKey)}</th>
                    <th className="pb-2 text-right">{formatMonthLabel(thisMonthKey)} (en vivo)</th>
                    <th className="pb-2 text-right">Total Histórico</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, idx) => (
                    <tr key={r.uid} className={`border-b border-slate-100 last:border-0 ${idx === 0 && r.lastMonthPoints != null ? 'bg-emerald-50' : ''}`}>
                      <td className="py-2 font-bold text-slate-800">{idx === 0 && r.lastMonthPoints != null && '👑 '}{r.name}</td>
                      <td className="py-2 text-right font-mono">
                        {r.lastMonthPoints != null ? r.lastMonthPoints.toLocaleString() : <span className="text-slate-400 italic">— ya pasó de mes</span>}
                      </td>
                      <td className="py-2 text-right font-mono text-slate-500">{r.thisMonthPoints.toLocaleString()}</td>
                      <td className="py-2 text-right font-mono text-slate-500">{r.totalPoints.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
          {Object.keys(bySection).length === 0 && (
            <p className="text-center text-slate-400 italic py-8">No hay estudiantes en este curso.</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default MonthlyLeadersReport;
