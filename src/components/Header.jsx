import React, { useState, useEffect } from 'react';
import { signOut } from 'firebase/auth';
import { auth } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { getCachedCollection } from '../utils/firestoreCache';
import { getTitleForPoints, getAllEarnedBadges, isBadgeUpgrade, DEFAULT_TITLE_TIERS } from '../utils/gamification';
import BadgeIcon from './BadgeIcon';
import TrophyCase from './TrophyCase';
import RewardCelebration from './RewardCelebration';
import { useActiveTheme } from '../context/ThemeContext';

const Header = ({ liveDia, setLiveDia, maxAllowedDay, course, cal = [], isAdmin, onToggleCourse }) => {
  const { userData, currentUser } = useAuth();
  const { theme } = useActiveTheme() || {};
  const headerGradientClass = theme?.styles?.header || 'bg-gradient-to-r from-[#0f172a] via-[#1e3a8a] to-[#b91c1c]';
  const headingFont = theme?.styles?.fontHeading;
  const totalPoints = userData?.total_points || 0;
  const weeklyPoints = userData?.weekly_points || 0;
  const monthlyPoints = userData?.monthly_points || 0;
  const streakCount = userData?.streak_count || 0;
  const badgeText = course === 's2' ? 'ESPAÑOL II' : 'IB ESPAÑOL';

  // --- GAMIFICATION: title ladder + badges, computed from data we already have ---
  const [gamConfig, setGamConfig] = useState(null);
  const [learningPathsById, setLearningPathsById] = useState({});
  const [gamDataLoaded, setGamDataLoaded] = useState(false);
  const [showTrophyCase, setShowTrophyCase] = useState(false);
  const [celebrationQueue, setCelebrationQueue] = useState([]);

  useEffect(() => {
    const fetchGamificationData = async () => {
      try {
        const [configSnap, paths] = await Promise.all([
          getDoc(doc(db, 'config', 'gamification')),
          getCachedCollection('learning_paths'),
        ]);
        if (configSnap.exists()) setGamConfig(configSnap.data());
        setLearningPathsById(Object.fromEntries(paths.map((p) => [p.id, p])));
      } catch (error) {
        console.error('Error loading gamification data:', error);
      } finally {
        setGamDataLoaded(true);
      }
    };
    fetchGamificationData();
  }, []);

  const titleTiers = gamConfig?.titleTiers?.length ? gamConfig.titleTiers : DEFAULT_TITLE_TIERS;
  const currentTitle = getTitleForPoints(totalPoints, titleTiers);
  const earnedBadges = getAllEarnedBadges(userData, learningPathsById, gamConfig);
  const featuredBadgeId = userData?.featuredBadgeId;
  const featuredBadge = earnedBadges.find((b) => b.id === featuredBadgeId) || earnedBadges[0] || null;

  // --- SURPRISE REWARD DETECTION ---
  // No "X points to next level" is shown anywhere on purpose — this popup is
  // the only way a student finds out, right when it happens (or the next
  // time they open the app, if it happened while they were away). The first
  // time this ever runs for a student it just records a baseline instead of
  // celebrating, so nothing already-earned floods them with popups.
  const badgeSignature = earnedBadges.map((b) => `${b.id}:${b.tier || '1'}`).sort().join(',');
  useEffect(() => {
    if (!gamDataLoaded || !currentUser?.uid || !userData) return;

    const currentBadgeMap = Object.fromEntries(earnedBadges.map((b) => [b.id, b.tier || true]));
    const seen = userData.rewardsSeen;

    if (!seen) {
      setDoc(doc(db, 'users', currentUser.uid), { rewardsSeen: { title: currentTitle, badges: currentBadgeMap } }, { merge: true }).catch(
        (err) => console.error('Error seeding rewardsSeen baseline:', err)
      );
      return;
    }

    const newCelebrations = [];
    if (currentTitle && seen.title !== currentTitle) {
      newCelebrations.push({ kind: 'title', title: currentTitle });
    }
    earnedBadges.forEach((badge) => {
      const currentVal = badge.tier || true;
      if (isBadgeUpgrade(seen.badges?.[badge.id], currentVal)) {
        newCelebrations.push({ kind: 'badge', badge, tier: badge.tier });
      }
    });

    if (newCelebrations.length > 0) {
      setCelebrationQueue((prev) => [...prev, ...newCelebrations]);
      setDoc(doc(db, 'users', currentUser.uid), { rewardsSeen: { title: currentTitle, badges: currentBadgeMap } }, { merge: true }).catch(
        (err) => console.error('Error updating rewardsSeen:', err)
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gamDataLoaded, currentTitle, badgeSignature]);

  const formatSpanishDate = (dateStr) => {
    if (!dateStr) return '';
    return new Date(dateStr + 'T00:00:00')
      .toLocaleDateString('es-ES', {
        day: 'numeric',
        month: 'long',
      })
      .toUpperCase();
  };

  let displayDate = 'FECHA TBD';

  const entryA = cal.find((c) => c.dia == liveDia && c.ciclo === 'A');
  const entryB = cal.find((c) => c.dia == liveDia && c.ciclo === 'B');

  if (entryA && entryB) {
    displayDate = `${formatSpanishDate(entryA.fecha)} / ${formatSpanishDate(
      entryB.fecha
    )}`;
  } else if (entryA) {
    displayDate = formatSpanishDate(entryA.fecha);
  } else if (entryB) {
    displayDate = formatSpanishDate(entryB.fecha);
  } else {
    const anyEntry = cal.find((c) => c.dia == liveDia);
    if (anyEntry) displayDate = formatSpanishDate(anyEntry.fecha);
  }

  return (
    <header className={`${headerGradientClass} rounded-xl p-8 text-white shadow-lg flex flex-col gap-6`}>
      <div className="flex justify-between items-center">
      <div className="flex flex-col gap-1">
        <h1
          className="text-5xl font-black tracking-tight uppercase"
          style={{ textShadow: '2px 2px 4px rgba(0,0,0,0.3)', fontFamily: headingFont ? 'var(--font-heading)' : undefined }}
        >
          Día {liveDia}
        </h1>
        <p className="text-sm opacity-90 tracking-widest font-bold uppercase">
          {displayDate}
        </p>
      </div>

      <div className="hidden sm:flex flex-col items-end gap-3">
        
        {/* DAY SELECTOR WITH ADMIN OVERRIDE LOGIC */}
        <div className="flex items-center gap-3 bg-white/10 border border-white/20 shadow-sm px-4 py-1.5 rounded-xl backdrop-blur-sm">
          <label className="text-[10px] font-black uppercase tracking-wider text-slate-200">
            Ir al Día:
          </label>
          <input
            type="number"
            min="1"
            max={isAdmin ? undefined : maxAllowedDay} 
            value={liveDia}
            onChange={(e) => {
              const val = parseInt(e.target.value);
              if (!val) return;
              
              // 🛡️ Security Check: Prevent students from manually typing a future day
              if (!isAdmin && val > maxAllowedDay) {
                setLiveDia(maxAllowedDay); 
              } else {
                setLiveDia(val);
              }
            }}
            className="w-14 bg-black/30 text-white border border-white/30 rounded-md px-1 py-1 font-bold text-center outline-none focus:ring-2 focus:ring-sky-400 transition-all"
          />
        </div>

        <div className="flex items-center gap-4 mt-1">
          <span
            onClick={isAdmin ? onToggleCourse : undefined}
            title={isAdmin ? 'Cambiar de nivel' : ''}
            className={`text-[10px] font-black uppercase tracking-widest bg-white/20 px-4 py-1.5 rounded-full shadow-sm select-none ${
              isAdmin
                ? 'cursor-pointer hover:bg-white/30 hover:scale-105 active:scale-95 transition-all ring-1 ring-white/50'
                : ''
            }`}
          >
            {badgeText} {isAdmin && ' 🔄'}
          </span>

          <button
            onClick={() => signOut(auth)}
            className="text-[10px] font-bold uppercase tracking-widest opacity-60 hover:opacity-100 transition-opacity"
          >
            Cerrar Sesión ↗
          </button>
        </div>

      </div>
      </div>

      {/* PUNTOS: all-time is the headline number, weekly/monthly are secondary */}
      <div className="flex flex-wrap items-center gap-4 sm:gap-6 border-t border-white/10 pt-5">
        <div className="flex items-center gap-3">
          <span className="text-3xl">⭐</span>
          <div>
            <p className="text-3xl sm:text-4xl font-black leading-none">{totalPoints}</p>
            <p className="text-[9px] font-black uppercase tracking-widest text-white/60 mt-0.5">Puntos Totales</p>
          </div>
        </div>

        {/* TITLE PILL + FEATURED BADGE — click opens the full trophy case */}
        <button
          onClick={() => setShowTrophyCase(true)}
          className="flex items-center gap-2.5 bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl pl-2 py-1.5 pr-4 transition-colors"
          title="Ver mi vitrina de trofeos"
        >
          <BadgeIcon icon={featuredBadge?.icon} tier={featuredBadge?.tier} size="sm" />
          <span className="text-xs font-black uppercase tracking-wider">{currentTitle}</span>
        </button>

        <div className="flex items-center gap-3 bg-orange-500/20 border border-orange-400/30 rounded-xl px-4 py-2">
          <span className="text-2xl">🔥</span>
          <div>
            <p className="text-xl font-black leading-none">{streakCount}</p>
            <p className="text-[9px] font-black uppercase tracking-widest text-white/60 mt-0.5">Racha</p>
          </div>
        </div>

        <div className="flex items-center gap-2 bg-white/10 rounded-xl px-4 py-2">
          <span className="text-lg font-black">{weeklyPoints}</span>
          <span className="text-[9px] font-bold uppercase tracking-widest text-white/60">Esta Semana</span>
        </div>

        <div className="flex items-center gap-2 bg-white/10 rounded-xl px-4 py-2">
          <span className="text-lg font-black">{monthlyPoints}</span>
          <span className="text-[9px] font-bold uppercase tracking-widest text-white/60">Este Mes</span>
        </div>
      </div>

      {showTrophyCase && (
        <TrophyCase
          uid={currentUser?.uid}
          currentTitle={currentTitle}
          totalPoints={totalPoints}
          earnedBadges={earnedBadges}
          featuredBadgeId={featuredBadgeId}
          onClose={() => setShowTrophyCase(false)}
        />
      )}

      <RewardCelebration
        celebration={celebrationQueue[0]}
        onContinue={() => setCelebrationQueue((prev) => prev.slice(1))}
      />
    </header>
  );
};

export default Header;