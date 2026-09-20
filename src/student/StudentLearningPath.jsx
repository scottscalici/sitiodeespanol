import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase.js';
import WorkoutEngine from './WorkoutEngine';
import { useAuth } from '../context/AuthContext';
import { getWeekKey, getMonthKey, bumpStreak } from '../utils/pointsHelper';
import { getAssignedDominioTasks } from '../utils/learningPathProgress';

// Configuration for the 3 distinct branches
const BRANCHES = [
  { id: 'vocab', label: 'Vocabulario', icon: '📖', theme: 'indigo' },
  { id: 'verbs', label: 'Verbos', icon: '⚡', theme: 'emerald' },
  { id: 'practical', label: 'Aplicación', icon: '🛠️', theme: 'amber' }
];

// Zigzag path layout constants — a repeating offset pattern (as % from center)
// works for any number of segments without knowing the count ahead of time.
const PATH_X_PATTERN = [0, -15, 15];
const PATH_ROW_HEIGHT = 128;
const PATH_TOP_PAD = 70;
const NODE_SIZE = 76;
const CURRENT_NODE_SIZE = 92;
const CHECKPOINT_SIZE = 96;

const CheckIcon = ({ className, size = 28 }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} className={className} fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 13l4 4L19 7" /></svg>
);
const LockIcon = ({ className, size = 24 }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} className={className} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V7a4 4 0 018 0v4" /></svg>
);
const TrophyIcon = ({ className, size = 34 }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} className={className} fill="currentColor"><path d="M12 2l2.9 6.26L22 9.27l-5 4.87L18.18 21 12 17.27 5.82 21 7 14.14l-5-4.87 7.1-1.01L12 2z" /></svg>
);

export default function StudentLearningPath() {
  const { userData } = useAuth();
  const { targetDia } = useParams();
  const isAdmin = userData?.role === 'admin';
  const course = userData?.course || 's2';

  // --- STATE ---
  const [activeBranch, setActiveBranch] = useState('vocab');
  const [liveDia, setLiveDia] = useState(1);
  const [assignedTasks, setAssignedTasks] = useState([]);
  const [selectedPathId, setSelectedPathId] = useState('');
  const [unitData, setUnitData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeWorkoutSegment, setActiveWorkoutSegment] = useState(null);

  // --- 1. FIND EVERY DOMINIO UNIT ASSIGNED TO THIS STUDENT'S COURSE SO FAR ---
  useEffect(() => {
    const fetchAssignments = async () => {
      setIsLoading(true);
      try {
        const tareasSnap = await getDoc(doc(db, 'curriculum_tracks', 'tareas_master'));

        // A day carried in the URL (e.g. from the Dashboard's day-preview override)
        // always wins — otherwise fall back to today's real day from the calendar,
        // same as every other day-gated card computes on its own.
        const parsedTargetDia = parseInt(targetDia, 10);
        let currentDay = parsedTargetDia;
        if (!currentDay) {
          const calSnap = await getDoc(doc(db, 'config', 'academic_year_2026_2027'));
          const calendarArray = calSnap.exists() ? (calSnap.data().map || []) : [];
          const todayStr = new Date().toLocaleDateString('en-CA');
          const pastEntries = calendarArray.filter((c) => c.fecha && c.fecha <= todayStr && c.dia != null);
          currentDay = pastEntries.length > 0
            ? parseInt(pastEntries.sort((a, b) => b.fecha.localeCompare(a.fecha))[0].dia)
            : 1;
        }
        setLiveDia(currentDay);

        const tareasData = tareasSnap.exists() ? tareasSnap.data() : {};
        const assigned = getAssignedDominioTasks(tareasData[course] || [], currentDay);
        setAssignedTasks(assigned);
        setSelectedPathId((prev) => prev || assigned[0]?.path_id || '');
      } catch (error) {
        console.error('Error fetching assigned units:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchAssignments();
  }, [course, targetDia]);

  // --- 2. LOAD THE SELECTED UNIT'S DOCUMENT ---
  useEffect(() => {
    if (!selectedPathId) {
      setUnitData(null);
      return;
    }
    const fetchUnit = async () => {
      try {
        const snap = await getDoc(doc(db, 'learning_paths', selectedPathId));
        setUnitData(snap.exists() ? snap.data() : { title: 'Unidad', branches: {} });
      } catch (error) {
        console.error('Error fetching unit:', error);
      }
    };
    fetchUnit();
  }, [selectedPathId]);

  // --- DYNAMIC DATA FOR ACTIVE BRANCH ---
  const currentBranchConfig = BRANCHES.find(b => b.id === activeBranch);
  const pods = unitData?.branches?.[activeBranch]?.pods || [];
  const currentPodRef = useRef(null);

  // --- PROGRESS SYNC (Derived from live userData, nested under unit -> branch) ---
  const unitProgress = userData?.progress?.[selectedPathId];
  const activePodIndex = unitProgress?.[activeBranch]?.podIndex || 0;
  const activeSegmentIndex = unitProgress?.[activeBranch]?.segmentIndex || 0;

  // --- LAND ON CURRENT PROGRESS INSTEAD OF THE TOP OF THE PATH ---
  useEffect(() => {
    if (pods.length === 0) return;
    // A short delay lets the flex-col-reverse layout settle before measuring position.
    const t = setTimeout(() => {
      currentPodRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 150);
    return () => clearTimeout(t);
  }, [pods.length, activeBranch, activePodIndex, activeSegmentIndex]);

  // --- DYNAMIC COLOR DICTIONARIES ---
  const themeColors = {
    emerald: { bg: 'bg-emerald-50', active: 'bg-emerald-600', ring: 'ring-emerald-500', text: 'text-emerald-800', border: 'border-emerald-200', line: 'bg-emerald-400', tabHover: 'hover:bg-emerald-100', tabActive: 'bg-emerald-600 text-white shadow-md' },
    amber: { bg: 'bg-amber-50', active: 'bg-amber-500', ring: 'ring-amber-400', text: 'text-amber-900', border: 'border-amber-200', line: 'bg-amber-400', tabHover: 'hover:bg-amber-100', tabActive: 'bg-amber-500 text-white shadow-md' },
    indigo: { bg: 'bg-indigo-50', active: 'bg-indigo-600', ring: 'ring-indigo-500', text: 'text-indigo-800', border: 'border-indigo-200', line: 'bg-indigo-400', tabHover: 'hover:bg-indigo-100', tabActive: 'bg-indigo-600 text-white shadow-md' },
  };
  const theme = themeColors[currentBranchConfig.theme] || themeColors.emerald;

  // --- MATH: STANDARD PROGRESS & GRADES ---
  const totalSegments = pods.reduce((acc, pod) => acc + (pod.segments?.length || 0), 0);
  const completedSegments = pods.reduce((acc, pod, pIdx) => {
    if (pIdx < activePodIndex) return acc + (pod.segments?.length || 0);
    if (pIdx === activePodIndex) return acc + activeSegmentIndex;
    return acc;
  }, 0);

  const progressPercent = totalSegments > 0 ? Math.round((completedSegments / totalSegments) * 100) : 0;

  const getLetterGrade = (percent) => {
    if (percent >= 90) return 'A';
    if (percent >= 80) return 'B';
    if (percent >= 70) return 'C';
    if (percent >= 60) return 'D';
    return 'F';
  };
  const letterGrade = getLetterGrade(progressPercent);

  // Extract all time brackets safely from the live user profile
  const allTimePoints = userData?.total_points || userData?.current_path_points || 0;
  const dailyPoints = userData?.daily_points || 0;
  const pathPoints = unitProgress?.[activeBranch]?.path_points || 0;

  const selectedTask = assignedTasks.find((t) => t.path_id === selectedPathId);
  const isPastDue = selectedTask && Number(selectedTask.day_due) < liveDia;

  // --- ZIGZAG PATH LAYOUT: flatten pods into one climbable list of segment
  // nodes + a checkpoint node per pod, then give each a computed x/y position.
  // This works for any pod/segment count — nothing here is hardcoded to a
  // specific unit's length.
  const pathItemsRaw = [];
  pods.forEach((pod, pIdx) => {
    const podLocked = !isAdmin && pIdx > activePodIndex;
    (pod.segments || []).forEach((seg, sIdx) => {
      const isCompleted = pIdx < activePodIndex || (pIdx === activePodIndex && sIdx < activeSegmentIndex);
      const isCurrent = pIdx === activePodIndex && sIdx === activeSegmentIndex;
      pathItemsRaw.push({
        key: seg.id, kind: 'segment', pod, pIdx, seg, sIdx,
        isCompleted, isCurrent, isLocked: podLocked,
        canClick: isAdmin || isCompleted || isCurrent,
      });
    });
    pathItemsRaw.push({
      key: `${pod.id}_checkpoint`, kind: 'checkpoint', pod, pIdx,
      isCompleted: pIdx < activePodIndex, isLocked: podLocked,
    });
  });

  const pathTotalHeight = pathItemsRaw.length * PATH_ROW_HEIGHT + PATH_TOP_PAD + 50;
  const pathItems = pathItemsRaw.map((item, idx) => {
    const reverseIdx = pathItemsRaw.length - 1 - idx;
    return {
      ...item,
      x: item.kind === 'checkpoint' ? 50 : 50 + PATH_X_PATTERN[idx % PATH_X_PATTERN.length],
      y: PATH_TOP_PAD + reverseIdx * PATH_ROW_HEIGHT,
    };
  });
  const pathLineD = pathItems.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');

  if (isLoading) {
    return (
      <div className={`min-h-screen bg-slate-50 flex items-center justify-center`}>
        <div className="text-xl font-bold text-slate-500 animate-pulse">Preparando las rutas...</div>
      </div>
    );
  }

  if (assignedTasks.length === 0) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center gap-3">
        <span className="text-5xl">🗺️</span>
        <h1 className="text-xl font-black text-slate-800">Todavía no hay unidades asignadas</h1>
        <p className="text-slate-500 font-medium max-w-sm">Cuando tu profesor asigne una unidad de Learning Path, aparecerá aquí.</p>
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${theme.bg} font-sans flex flex-col pb-20 transition-colors duration-500`}>

      {/* FIXED TOP PROGRESS & POINTS BAR */}
      <div className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-slate-200 p-4 shadow-sm">
        <div className="max-w-3xl mx-auto flex flex-col gap-4">
          <div className="flex flex-col md:flex-row md:justify-between md:items-end gap-2">
            <div>
              <h1 className="text-xl font-black text-slate-800 flex items-center flex-wrap gap-2">
                {unitData?.title || 'Ruta de Aprendizaje'}
                {isAdmin && <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full align-middle">ADMIN</span>}
                {isPastDue && <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full align-middle">Vencido — Día {selectedTask.day_due}</span>}
              </h1>

              {/* UNIT SELECTOR — every unit assigned so far, due date doesn't gate access */}
              {assignedTasks.length > 1 && (
                <select
                  value={selectedPathId}
                  onChange={(e) => { setSelectedPathId(e.target.value); setActiveBranch('vocab'); }}
                  className="mt-1 text-xs font-bold text-slate-500 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 outline-none focus:border-indigo-400"
                >
                  {assignedTasks.map((task) => (
                    <option key={task.path_id} value={task.path_id}>
                      {task.titulo || task.path_id} {Number(task.day_due) < liveDia ? '(Vencido)' : ''}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* GAMIFICATION PILLS */}
            <div className="flex flex-wrap items-center gap-2 text-xs font-bold">
              <span className="bg-emerald-100 text-emerald-700 px-2.5 py-1 rounded-full border border-emerald-200 shadow-sm">
                📅 Hoy: {dailyPoints}
              </span>
              <span className="bg-amber-100 text-amber-700 px-2.5 py-1 rounded-full border border-amber-200 shadow-sm">
                🏆 Totales: {allTimePoints}
              </span>
              <span className={`px-2.5 py-1 rounded-full shadow-sm border ${theme.bg} ${theme.border} ${theme.text}`}>
                {currentBranchConfig.label}: {pathPoints}
              </span>

              {/* GRADE & PERCENTAGE PILL */}
              <span className="bg-slate-100 text-slate-700 px-3 py-1 rounded-full border border-slate-200 shadow-sm flex items-center gap-2">
                <span className={`text-sm font-black ${
                  letterGrade === 'A' ? 'text-emerald-600' :
                  letterGrade === 'B' ? 'text-blue-600' :
                  letterGrade === 'C' ? 'text-amber-600' : 'text-rose-600'
                }`}>{letterGrade}</span>
                <span className="text-slate-400">|</span>
                <span>{progressPercent}% <span className="hidden md:inline font-medium">Completado</span></span>
              </span>
            </div>
          </div>

          {/* --- BRANCH SELECTOR TABS --- */}
          <div className="flex justify-center sm:justify-start gap-2 border-b border-slate-200 pb-2">
            {BRANCHES.map(branch => {
              const isActive = activeBranch === branch.id;
              const branchTheme = themeColors[branch.theme];
              return (
                <button
                  key={branch.id}
                  onClick={() => setActiveBranch(branch.id)}
                  className={`px-4 py-2 rounded-xl text-sm font-black tracking-wider transition-all flex items-center gap-2
                    ${isActive ? branchTheme.tabActive : `bg-white text-slate-500 border border-slate-200 ${branchTheme.tabHover}`}`}
                >
                  <span>{branch.icon}</span>
                  <span className="hidden sm:inline uppercase">{branch.label}</span>
                </button>
              );
            })}
          </div>

          <div className="w-full bg-slate-200 rounded-full h-2.5 overflow-hidden">
            <div
              className={`h-2.5 rounded-full ${theme.active} transition-all duration-500`}
              style={{ width: `${progressPercent}%` }}
            ></div>
          </div>
        </div>
      </div>

      {/* THE ZIGZAG PATH */}
      <div className="flex-1 max-w-3xl mx-auto w-full px-4 pt-8 pb-6">
        {pods.length === 0 ? (
          <div className="text-center py-20">
            <span className="text-6xl">{currentBranchConfig.icon}</span>
            <h2 className="text-2xl font-black text-slate-800 mt-4 uppercase tracking-tighter">Próximamente</h2>
            <p className="text-slate-500 font-medium mt-2">Esta rama de la ruta aún está en construcción.</p>
          </div>
        ) : (
          <div className="relative w-full max-w-[420px] mx-auto" style={{ height: pathTotalHeight }}>
            <svg width="100%" height={pathTotalHeight} viewBox={`0 0 100 ${pathTotalHeight}`} preserveAspectRatio="none" className="absolute inset-0 pointer-events-none">
              <path d={pathLineD} fill="none" stroke="#e2e8f0" strokeWidth="3" strokeLinecap="round" strokeDasharray="0.5 5" vectorEffect="non-scaling-stroke" />
            </svg>

            {pathItems.map((item) => {
              if (item.kind === 'checkpoint') {
                const state = item.isCompleted ? 'done' : item.isLocked ? 'locked' : 'pending';
                const styles = {
                  done: { box: 'bg-amber-500', icon: 'text-white', label: 'text-amber-600', suffix: '· ¡Completo!' },
                  locked: { box: 'bg-slate-200 border-4 border-dashed border-slate-300', icon: 'text-slate-400', label: 'text-slate-400', suffix: '· Bloqueado' },
                  pending: { box: 'bg-white border-4 border-amber-300', icon: 'text-amber-400', label: 'text-amber-500', suffix: '' },
                }[state];
                return (
                  <div key={item.key}>
                    <div
                      className={`absolute rounded-full flex items-center justify-center shadow-md ${styles.box}`}
                      style={{ left: `calc(${item.x}% - ${CHECKPOINT_SIZE / 2}px)`, top: item.y - CHECKPOINT_SIZE / 2, width: CHECKPOINT_SIZE, height: CHECKPOINT_SIZE }}
                    >
                      <TrophyIcon className={styles.icon} />
                    </div>
                    <div
                      className={`absolute text-center text-[11px] font-black uppercase tracking-wide ${styles.label}`}
                      style={{ left: 0, right: 0, top: item.y + CHECKPOINT_SIZE / 2 + 8 }}
                    >
                      Nivel {item.pIdx + 1} {styles.suffix}
                    </div>
                  </div>
                );
              }

              const size = item.isCurrent ? CURRENT_NODE_SIZE : NODE_SIZE;
              const adminBypass = isAdmin && !item.isCompleted && !item.isCurrent;

              let bgClass, content, ringClass = '';
              if (item.isCompleted) {
                bgClass = 'bg-emerald-500';
                content = <CheckIcon className="text-white" />;
              } else if (item.isCurrent) {
                bgClass = theme.active;
                content = <span className="text-white font-black text-2xl">{item.sIdx + 1}</span>;
                ringClass = `ring-4 ${theme.ring} animate-pulse`;
              } else if (item.isLocked) {
                bgClass = 'bg-slate-200';
                content = <LockIcon className="text-slate-400" />;
              } else {
                bgClass = 'bg-slate-100 border-2 border-dashed border-slate-300';
                content = <span className="text-slate-300 font-black text-lg">{item.sIdx + 1}</span>;
              }
              if (adminBypass) ringClass += ' ring-2 ring-purple-400 ring-offset-2';

              const Tag = item.canClick ? 'button' : 'div';

              return (
                <React.Fragment key={item.key}>
                  {item.isCurrent && (
                    <div className="absolute text-center" style={{ left: `calc(${item.x}% - 90px)`, width: 180, top: item.y - size / 2 - 58 }}>
                      <span className={`inline-block bg-white border-2 ${theme.border} ${theme.text} text-xs font-black px-3 py-1.5 rounded-2xl shadow-sm whitespace-nowrap`}>
                        ¡Empieza aquí!
                      </span>
                      <div className={`w-0 h-0 mx-auto ${theme.text}`} style={{ borderLeft: '7px solid transparent', borderRight: '7px solid transparent', borderTop: '7px solid currentColor' }}></div>
                    </div>
                  )}
                  <Tag
                    type={Tag === 'button' ? 'button' : undefined}
                    onClick={item.canClick ? () => setActiveWorkoutSegment(item.seg) : undefined}
                    ref={item.isCurrent ? currentPodRef : null}
                    className={`absolute rounded-full flex items-center justify-center shadow-md transition-transform p-0 ${bgClass} ${ringClass} ${item.canClick ? 'hover:scale-105 active:scale-95 cursor-pointer' : 'cursor-default'}`}
                    style={{ left: `calc(${item.x}% - ${size / 2}px)`, top: item.y - size / 2, width: size, height: size }}
                  >
                    {content}
                  </Tag>
                </React.Fragment>
              );
            })}

            <div className="absolute text-center text-[11px] font-bold text-slate-400" style={{ left: 0, right: 0, top: pathTotalHeight - 24 }}>
              — Inicio de la ruta —
            </div>
          </div>
        )}
      </div>

      {/* RENDER THE WORKOUT ENGINE IF ACTIVE */}
      {activeWorkoutSegment && (
        <WorkoutEngine
          segment={activeWorkoutSegment}
          podIndex={pods.findIndex((p) => p.segments.some((s) => s.id === activeWorkoutSegment.id))}
          history={(() => {
            let hist = [];
            let found = false;
            for (const pod of pods) {
              for (const seg of pod.segments) {
                if (seg.id === activeWorkoutSegment.id) { found = true; break; }
                if (seg.introduced_concepts) hist = [...hist, ...seg.introduced_concepts];
              }
              if (found) break;
            }
            return hist;
          })()}
          onClose={() => setActiveWorkoutSegment(null)}
          onComplete={async (segId, score, numQs, regularCount = 0, sentenceCount = 0) => {
            setActiveWorkoutSegment(null);

            // --- 1. GAMIFICATION MATH: 1 pt/regular question, 2 pts/sentence question, tiered by accuracy ---
            const baseScore = (regularCount * 1) + (sentenceCount * 2);

            // Apply multipliers based on mastery threshold
            let multiplier = 1;
            if (score === 100) multiplier = 3;
            else if (score >= 90) multiplier = 2;
            else if (score >= 80) multiplier = 1.5;

            // 10-point floor applies to every activity
            const totalPointsEarned = Math.max(10, Math.round(baseScore * multiplier));

            // --- 2. CALCULATE NEW POSITION ---
            let newPodIdx = activePodIndex;
            let newSegIdx = activeSegmentIndex;

            const currentActiveSeg = pods[activePodIndex]?.segments[activeSegmentIndex];

            // Requires an 80% Mastery Threshold to advance
            if (score >= 80 && segId === currentActiveSeg?.id) {
              if (activeSegmentIndex < pods[activePodIndex].segments.length - 1) {
                newSegIdx = activeSegmentIndex + 1;
              } else {
                newPodIdx = activePodIndex + 1;
                newSegIdx = 0;
              }
            }

            // --- 3. MULTI-BRACKET FIRESTORE SAVE (nested under this unit -> this branch) ---
            // Admins can freely browse/test any pod already (see isLocked below) and
            // shouldn't rack up scores or progress meant for students.
            if (!isAdmin && userData && userData.uid && selectedPathId) {
              try {
                const userRef = doc(db, 'users', userData.uid);
                const snap = await getDoc(userRef);

                const weekKey = getWeekKey();
                const monthKey = getMonthKey();

                let newTotal = totalPointsEarned;
                let newMonthly = totalPointsEarned;
                let newWeekly = totalPointsEarned;
                let newDaily = totalPointsEarned;
                let newPathPoints = totalPointsEarned;
                let existingData = {};

                if (snap.exists()) {
                   const data = snap.data();
                   existingData = data;
                   newTotal += (data.total_points || data.current_path_points || 0);
                   if (data.monthKey === monthKey) newMonthly += (data.monthly_points || 0);
                   if (data.weekKey === weekKey) newWeekly += (data.weekly_points || 0);
                   newDaily += (data.daily_points || 0);
                   newPathPoints += (data.progress?.[selectedPathId]?.[activeBranch]?.path_points || 0);
                }

                await setDoc(userRef, {
                  total_points: newTotal,
                  current_path_points: newTotal,
                  monthly_points: newMonthly,
                  weekly_points: newWeekly,
                  daily_points: newDaily,
                  weekKey,
                  monthKey,
                  ...bumpStreak(existingData),
                  progress: {
                    [selectedPathId]: {
                      [activeBranch]: {
                        path_points: newPathPoints,
                        podIndex: newPodIdx,
                        segmentIndex: newSegIdx
                      }
                    }
                  }
                }, { merge: true });

              } catch (error) {
                console.error('Error saving to Firestore:', error);
                alert(`⚠️ Error de Firebase: ${error.message}`);
              }
            }

            // --- 4. ALERTS ---
            if (score >= 80) {
              alert(`¡Excelente! Aprobaste con un ${score}%. Multiplicador: ${multiplier}x (+${totalPointsEarned} pts)`);
            } else {
              alert(`Obtuviste un ${score}%. Necesitas al menos 80% para avanzar. \n(+${totalPointsEarned} pts de práctica)`);
            }
          }}
        />
      )}
    </div>
  );
}
