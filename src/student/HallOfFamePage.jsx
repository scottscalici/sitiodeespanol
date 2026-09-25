import React, { useState, useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getCachedCollection } from '../utils/firestoreCache';
import { formatWeekLabel, formatMonthLabel } from '../utils/pointsHelper';

const MEDALS = ['🥇', '🥈', '🥉'];
const PERIOD_LABEL = { weekly: 'Semana', monthly: 'Mes' };

const HallOfFamePage = () => {
  const { courseId } = useParams();
  const [history, setHistory] = useState([]);
  const [allTimeTop, setAllTimeTop] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!courseId) return;
    let cancelled = false;

    const fetchData = async () => {
      setLoading(true);
      try {
        // Shared cache — see HallOfFameCard/LeaderboardCard, which read
        // these same collections on the Dashboard page this was linked
        // from, so this reuses that cached fetch instead of re-querying.
        const [allHistory, allUsers] = await Promise.all([
          getCachedCollection('leaderboard_history'),
          getCachedCollection('users'),
        ]);

        const rows = allHistory.filter((h) => h.course === courseId);
        rows.sort((a, b) => b.key.localeCompare(a.key));

        const leaders = allUsers
          .filter((s) => s.role === 'student' && s.course === courseId && !s.independent)
          .map((s) => {
            const lastInitial = s.lastName ? `${s.lastName.trim().charAt(0).toUpperCase()}.` : '';
            const name = [s.firstName, lastInitial].filter(Boolean).join(' ') || s.email || 'Estudiante';
            return { uid: s.id, name, points: s.total_points || s.current_path_points || 0 };
          })
          .filter((s) => s.points > 0)
          .sort((a, b) => b.points - a.points)
          .slice(0, 3);

        if (!cancelled) {
          setHistory(rows);
          setAllTimeTop(leaders);
        }
      } catch (err) {
        console.error('Error loading hall of fame:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchData();
    return () => { cancelled = true; };
  }, [courseId]);

  // "Récords": every individual (name, points) entry ever archived for a
  // period, flattened and ranked — the biggest single week/month anyone
  // has ever put up, independent of when it happened.
  const buildRecords = (period) =>
    history
      .filter((h) => h.period === period)
      .flatMap((h) => h.top.map((s) => ({ ...s, key: h.key })))
      .sort((a, b) => b.points - a.points)
      .slice(0, 5);

  const weeklyRecords = buildRecords('weekly');
  const monthlyRecords = buildRecords('monthly');

  return (
    <div className="min-h-screen bg-slate-950 text-white p-4 sm:p-8">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex justify-between items-center">
          <Link to="/" className="text-slate-400 hover:text-white text-sm font-bold flex items-center gap-2">
            ← Volver
          </Link>
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">
            {courseId?.toUpperCase()}
          </span>
        </div>

        <div className="text-center">
          <h1 className="text-3xl font-black uppercase tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-yellow-300">
            🏅 Salón de la Fama
          </h1>
        </div>

        {loading ? (
          <p className="text-center text-slate-500 font-bold py-8">Cargando...</p>
        ) : (
          <>
            {/* ALL-TIME LEADER */}
            {allTimeTop.length > 0 && (
              <div className="bg-gradient-to-br from-amber-900/40 to-slate-900 border-2 border-amber-500/40 rounded-2xl p-6 text-center">
                <p className="text-[10px] font-black uppercase tracking-widest text-amber-400 mb-2">
                  👑 Líder Histórico
                </p>
                <p className="text-2xl font-black text-white">{allTimeTop[0].name}</p>
                <p className="text-amber-400 font-black text-lg mt-1">{allTimeTop[0].points.toLocaleString()} pts</p>
              </div>
            )}

            {/* CAMPEONES — chronological, most recent first */}
            <div>
              <h2 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-3">Campeones</h2>
              {history.length === 0 ? (
                <p className="text-slate-500 text-sm italic text-center py-6">
                  Todavía no se ha cerrado ninguna semana o mes. ¡Vuelve pronto!
                </p>
              ) : (
                <div className="space-y-3">
                  {history.map((h) => (
                    <div key={`${h.period}-${h.key}`} className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                      <p className="text-[10px] font-black uppercase tracking-widest text-indigo-400 mb-2">
                        {PERIOD_LABEL[h.period]} · {h.period === 'weekly' ? formatWeekLabel(h.key) : formatMonthLabel(h.key)}
                      </p>
                      <ul className="space-y-1.5">
                        {h.top.map((s, i) => (
                          <li key={s.uid} className="flex items-center gap-3 text-sm">
                            <span className="w-6 text-center shrink-0">{MEDALS[i]}</span>
                            <span className="flex-1 min-w-0 truncate font-bold text-slate-200">{s.name}</span>
                            <span className="font-black text-amber-400 shrink-0">{s.points.toLocaleString()}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* RÉCORDS */}
            {(weeklyRecords.length > 0 || monthlyRecords.length > 0) && (
              <div>
                <h2 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-3">Récords</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {weeklyRecords.length > 0 && (
                    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                      <p className="text-[10px] font-black uppercase tracking-widest text-emerald-400 mb-2">
                        Mejor Semana
                      </p>
                      <ol className="space-y-1.5">
                        {weeklyRecords.map((s, i) => (
                          <li key={`${s.uid}-${s.key}`} className="flex items-center gap-2 text-xs">
                            <span className="w-4 text-center font-black text-slate-500 shrink-0">{i + 1}.</span>
                            <span className="flex-1 min-w-0 truncate font-bold text-slate-200">{s.name}</span>
                            <span className="font-black text-emerald-400 shrink-0">{s.points}</span>
                          </li>
                        ))}
                      </ol>
                    </div>
                  )}
                  {monthlyRecords.length > 0 && (
                    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                      <p className="text-[10px] font-black uppercase tracking-widest text-sky-400 mb-2">
                        Mejor Mes
                      </p>
                      <ol className="space-y-1.5">
                        {monthlyRecords.map((s, i) => (
                          <li key={`${s.uid}-${s.key}`} className="flex items-center gap-2 text-xs">
                            <span className="w-4 text-center font-black text-slate-500 shrink-0">{i + 1}.</span>
                            <span className="flex-1 min-w-0 truncate font-bold text-slate-200">{s.name}</span>
                            <span className="font-black text-sky-400 shrink-0">{s.points}</span>
                          </li>
                        ))}
                      </ol>
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default HallOfFamePage;
