import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { getWeekKey, getMonthKey } from '../utils/pointsHelper';
import { useActiveTheme } from '../context/ThemeContext';

const TABS = [
  { key: 'total', label: 'Todo' },
  { key: 'monthly', label: 'Mes' },
  { key: 'weekly', label: 'Semana' },
];

const MEDALS = ['🥇', '🥈', '🥉'];

const LeaderboardCard = ({ course }) => {
  const { currentUser } = useAuth();
  const { theme } = useActiveTheme() || {};
  const themeColor = theme?.styles?.cardOverrides?.leaderboard;
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('total');

  useEffect(() => {
    if (!course) return;
    let cancelled = false;

    const fetchLeaders = async () => {
      setLoading(true);
      try {
        const q = query(
          collection(db, 'users'),
          where('role', '==', 'student'),
          where('course', '==', course)
        );
        const snap = await getDocs(q);
        const weekKey = getWeekKey();
        const monthKey = getMonthKey();

        // Independent accounts (former students using the site outside any
        // current class) share the course-wide leaderboard query but never
        // belong in a live class's ranking.
        const rows = snap.docs.filter((docSnap) => !docSnap.data().independent).map((docSnap) => {
          const d = docSnap.data();
          const lastInitial = d.lastName ? `${d.lastName.trim().charAt(0).toUpperCase()}.` : '';
          const name = [d.firstName, lastInitial].filter(Boolean).join(' ') || d.email || 'Estudiante';
          return {
            uid: docSnap.id,
            name,
            total: d.total_points || d.current_path_points || 0,
            monthly: d.monthKey === monthKey ? (d.monthly_points || 0) : 0,
            weekly: d.weekKey === weekKey ? (d.weekly_points || 0) : 0,
          };
        });

        if (!cancelled) setStudents(rows);
      } catch (err) {
        console.error('Error loading leaderboard:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchLeaders();
    return () => { cancelled = true; };
  }, [course]);

  const metricKey = activeTab === 'total' ? 'total' : activeTab === 'monthly' ? 'monthly' : 'weekly';
  const fullRanked = students
    .filter((s) => s[metricKey] > 0)
    .sort((a, b) => b[metricKey] - a[metricKey]);
  const topRanked = fullRanked.slice(0, 10);
  const myIndex = fullRanked.findIndex((s) => s.uid === currentUser?.uid);
  const myRank = myIndex >= 0 ? myIndex + 1 : null;
  const amInTop = myIndex >= 0 && myIndex < 10;

  return (
    <div
      className="bg-slate-900 border-2 border-slate-800 rounded-2xl p-5 shadow-lg"
      style={themeColor ? { borderColor: themeColor } : undefined}
    >
      <h3
        className="font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-yellow-300 uppercase tracking-widest text-lg mb-3"
        style={themeColor ? { backgroundImage: `linear-gradient(to right, ${themeColor}, ${theme?.styles?.accent || themeColor})` } : undefined}
      >
        🏆 Tabla de Líderes
      </h3>

      <div className="flex gap-1 mb-4 bg-slate-950/50 p-1 rounded-xl">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex-1 text-[10px] font-black uppercase tracking-widest py-2 rounded-lg transition-all ${
              activeTab === tab.key
                ? 'bg-amber-500 text-slate-900 shadow-md'
                : 'text-slate-500 hover:bg-slate-800'
            }`}
            style={activeTab === tab.key && themeColor ? { backgroundColor: themeColor } : undefined}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-xs text-slate-500 italic text-center py-4">Cargando...</p>
      ) : topRanked.length === 0 ? (
        <p className="text-xs text-slate-500 italic text-center py-4">
          Nadie ha ganado puntos todavía. ¡Sé el primero!
        </p>
      ) : (
        <>
          <ol className="space-y-2">
            {topRanked.map((student, idx) => {
              const isMe = currentUser?.uid === student.uid;
              return (
                <li
                  key={student.uid}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2 ${
                    isMe ? 'bg-amber-500/15 border border-amber-500/40' : 'bg-slate-800/50'
                  }`}
                >
                  <span className="w-6 text-center text-sm font-black text-slate-400 shrink-0">
                    {MEDALS[idx] || `#${idx + 1}`}
                  </span>
                  <span className={`flex-1 min-w-0 truncate text-xs font-bold ${isMe ? 'text-amber-300' : 'text-slate-200'}`}>
                    {student.name}{isMe && ' (Tú)'}
                  </span>
                  <span className="text-xs font-black text-amber-400 shrink-0">
                    {student[metricKey].toLocaleString()}
                  </span>
                </li>
              );
            })}
          </ol>

          {myRank && !amInTop && (
            <div className="mt-3 pt-3 border-t border-slate-800 flex items-center gap-3 px-3">
              <span className="w-6 text-center text-xs font-black text-slate-500 shrink-0">#{myRank}</span>
              <span className="flex-1 min-w-0 truncate text-xs font-bold text-amber-300">Tú</span>
              <span className="text-xs font-black text-amber-400 shrink-0">
                {fullRanked[myIndex][metricKey].toLocaleString()}
              </span>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default LeaderboardCard;
