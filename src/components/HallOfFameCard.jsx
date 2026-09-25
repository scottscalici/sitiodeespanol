import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { formatWeekLabel, formatMonthLabel } from '../utils/pointsHelper';
import { useActiveTheme } from '../context/ThemeContext';

const MEDALS = ['🥇', '🥈', '🥉'];

const HallOfFameCard = ({ course }) => {
  const { theme } = useActiveTheme() || {};
  const themeColor = theme?.styles?.cardOverrides?.leaderboard;
  const [lastWeek, setLastWeek] = useState(null);
  const [lastMonth, setLastMonth] = useState(null);
  const [allTimeLeader, setAllTimeLeader] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!course) return;
    let cancelled = false;

    const fetchHallOfFame = async () => {
      setLoading(true);
      try {
        const [historySnap, usersSnap] = await Promise.all([
          getDocs(query(collection(db, 'leaderboard_history'), where('course', '==', course))),
          getDocs(query(collection(db, 'users'), where('role', '==', 'student'), where('course', '==', course))),
        ]);

        const weeklyDocs = historySnap.docs.filter((d) => d.data().period === 'weekly').map((d) => d.data());
        const monthlyDocs = historySnap.docs.filter((d) => d.data().period === 'monthly').map((d) => d.data());
        weeklyDocs.sort((a, b) => b.key.localeCompare(a.key));
        monthlyDocs.sort((a, b) => b.key.localeCompare(a.key));

        const leader = usersSnap.docs
          .filter((d) => !d.data().independent)
          .map((d) => {
            const s = d.data();
            const lastInitial = s.lastName ? `${s.lastName.trim().charAt(0).toUpperCase()}.` : '';
            const name = [s.firstName, lastInitial].filter(Boolean).join(' ') || s.email || 'Estudiante';
            return { name, points: s.total_points || s.current_path_points || 0 };
          })
          .filter((s) => s.points > 0)
          .sort((a, b) => b.points - a.points)[0] || null;

        if (!cancelled) {
          setLastWeek(weeklyDocs[0] || null);
          setLastMonth(monthlyDocs[0] || null);
          setAllTimeLeader(leader);
        }
      } catch (err) {
        console.error('Error loading hall of fame:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchHallOfFame();
    return () => { cancelled = true; };
  }, [course]);

  const hasContent = lastWeek || lastMonth || allTimeLeader;

  return (
    <Link
      to={`/salon-de-la-fama/${course}`}
      className="block bg-slate-900 border-2 border-slate-800 rounded-2xl p-5 shadow-lg hover:border-amber-500/50 transition-colors"
      style={themeColor ? { borderColor: themeColor } : undefined}
    >
      <div className="flex items-center justify-between mb-3">
        <h3
          className="font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-yellow-300 uppercase tracking-widest text-lg"
          style={themeColor ? { backgroundImage: `linear-gradient(to right, ${themeColor}, ${theme?.styles?.accent || themeColor})` } : undefined}
        >
          🏅 Salón de la Fama
        </h3>
        <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Ver todo →</span>
      </div>

      {loading ? (
        <p className="text-xs text-slate-500 italic text-center py-4">Cargando...</p>
      ) : !hasContent ? (
        <p className="text-xs text-slate-500 italic text-center py-4">
          Todavía no hay campeones. ¡Podrías ser el primero!
        </p>
      ) : (
        <div className="space-y-3">
          {allTimeLeader && (
            <div className="flex items-center gap-3 rounded-lg px-3 py-2 bg-amber-500/10 border border-amber-500/30">
              <span className="text-lg shrink-0">👑</span>
              <span className="flex-1 min-w-0 truncate text-xs font-bold text-amber-300">{allTimeLeader.name}</span>
              <span className="text-xs font-black text-amber-400 shrink-0">{allTimeLeader.points.toLocaleString()}</span>
            </div>
          )}

          {lastWeek && (
            <div>
              <p className="text-[9px] font-black uppercase tracking-widest text-slate-500 mb-1">
                Semana Pasada · {formatWeekLabel(lastWeek.key)}
              </p>
              <ul className="space-y-1">
                {lastWeek.top.map((s, i) => (
                  <li key={s.uid} className="flex items-center gap-2 text-xs">
                    <span className="w-4 text-center shrink-0">{MEDALS[i]}</span>
                    <span className="flex-1 min-w-0 truncate font-bold text-slate-200">{s.name}</span>
                    <span className="font-black text-slate-400 shrink-0">{s.points}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {lastMonth && (
            <div>
              <p className="text-[9px] font-black uppercase tracking-widest text-slate-500 mb-1">
                Mes Pasado · {formatMonthLabel(lastMonth.key)}
              </p>
              <ul className="space-y-1">
                {lastMonth.top.map((s, i) => (
                  <li key={s.uid} className="flex items-center gap-2 text-xs">
                    <span className="w-4 text-center shrink-0">{MEDALS[i]}</span>
                    <span className="flex-1 min-w-0 truncate font-bold text-slate-200">{s.name}</span>
                    <span className="font-black text-slate-400 shrink-0">{s.points}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </Link>
  );
};

export default HallOfFameCard;
