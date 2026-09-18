import React, { useState, useEffect, useMemo } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase.js';
import WorkoutEngine from './WorkoutEngine';
import { useAuth } from '../context/AuthContext';

// The base ID for the current unit
const BASE_PATH_ID = 's2_descubre2_preliminar';

// Configuration for the 3 distinct branches
const BRANCHES = [
  { id: 'vocab', label: 'Vocabulario', icon: '📖', theme: 'indigo', suffix: '_vocab' },
  { id: 'verbs', label: 'Verbos', icon: '⚡', theme: 'emerald', suffix: '_verbs' },
  { id: 'practical', label: 'Aplicación', icon: '🛠️', theme: 'amber', suffix: '_practical' }
];

export default function StudentLearningPath() {
  const { userData } = useAuth();
  const isAdmin = userData?.role === 'admin';

  // --- STATE ---
  const [activeBranch, setActiveBranch] = useState('vocab');
  const [branchData, setBranchData] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [activeWorkoutSegment, setActiveWorkoutSegment] = useState(null);

  // --- 1. FETCH ALL 3 BRANCHES ONCE ---
  useEffect(() => {
    const fetchAllPaths = async () => {
      setIsLoading(true);
      const newBranchData = {};

      try {
        await Promise.all(
          BRANCHES.map(async (branch) => {
            const fullPathId = `${BASE_PATH_ID}${branch.suffix}`;
            const docRef = doc(db, 'learning_paths', fullPathId);
            const docSnap = await getDoc(docRef);

            if (docSnap.exists()) {
              newBranchData[branch.id] = docSnap.data();
            } else {
              // Store empty state if the teacher hasn't built this branch yet
              newBranchData[branch.id] = { title: `Ruta de ${branch.label}`, pods: [] };
            }
          })
        );
        setBranchData(newBranchData);
      } catch (error) {
        console.error('Error fetching paths:', error);
      }
      setIsLoading(false);
    };

    fetchAllPaths();
  }, []);

  // --- DYNAMIC DATA FOR ACTIVE BRANCH ---
  const currentPathId = `${BASE_PATH_ID}_${activeBranch}`;
  const currentBranchConfig = BRANCHES.find(b => b.id === activeBranch);
  const pathTitle = branchData[activeBranch]?.title || 'Cargando...';
  const pods = branchData[activeBranch]?.pods || [];

  // --- PROGRESS SYNC (Derived from live userData) ---
  const activePodIndex = userData?.progress?.[currentPathId]?.podIndex || 0;
  const activeSegmentIndex = userData?.progress?.[currentPathId]?.segmentIndex || 0;

  // --- DYNAMIC COLOR DICTIONARIES ---
  const themeColors = {
    emerald: { bg: 'bg-emerald-50', active: 'bg-emerald-600', ring: 'ring-emerald-500', text: 'text-emerald-800', border: 'border-emerald-200', line: 'bg-emerald-400', tabHover: 'hover:bg-emerald-100', tabActive: 'bg-emerald-600 text-white shadow-md' },
    amber: { bg: 'bg-amber-50', active: 'bg-amber-500', ring: 'ring-amber-400', text: 'text-amber-900', border: 'border-amber-200', line: 'bg-amber-400', tabHover: 'hover:bg-amber-100', tabActive: 'bg-amber-500 text-white shadow-md' },
    indigo: { bg: 'bg-indigo-50', active: 'bg-indigo-600', ring: 'ring-indigo-500', text: 'text-indigo-800', border: 'border-indigo-200', line: 'bg-indigo-400', tabHover: 'hover:bg-indigo-100', tabActive: 'bg-indigo-600 text-white shadow-md' },
    rose: { bg: 'bg-rose-50', active: 'bg-rose-600', ring: 'ring-rose-500', text: 'text-rose-800', border: 'border-rose-200', line: 'bg-rose-400', tabHover: 'hover:bg-rose-100', tabActive: 'bg-rose-600 text-white shadow-md' },
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
  const monthlyPoints = userData?.monthly_points || 0;
  const weeklyPoints = userData?.weekly_points || 0;
  const dailyPoints = userData?.daily_points || 0;
  const pathPoints = userData?.progress?.[currentPathId]?.path_points || 0;

  if (isLoading) {
    return (
      <div className={`min-h-screen bg-slate-50 flex items-center justify-center`}>
        <div className="text-xl font-bold text-slate-500 animate-pulse">Preparando las rutas...</div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${theme.bg} font-sans flex flex-col pb-20 transition-colors duration-500`}>

      {/* FIXED TOP PROGRESS & POINTS BAR */}
      <div className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-slate-200 p-4 shadow-sm">
        <div className="max-w-3xl mx-auto flex flex-col gap-4">
          <div className="flex flex-col md:flex-row md:justify-between md:items-end gap-2">
            <h1 className="text-xl font-black text-slate-800">
              Ruta de Aprendizaje {isAdmin && <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full ml-2 align-middle">ADMIN</span>}
            </h1>

            {/* GAMIFICATION PILLS */}
            <div className="flex flex-wrap items-center gap-2 text-xs font-bold">
              <span className="bg-emerald-100 text-emerald-700 px-2.5 py-1 rounded-full border border-emerald-200 shadow-sm">
                📅 Hoy: {dailyPoints}
              </span>
              <span className="bg-amber-100 text-amber-700 px-2.5 py-1 rounded-full border border-amber-200 shadow-sm">
                🏆 Totales: {allTimePoints}
              </span>
              <span className={`px-2.5 py-1 rounded-full shadow-sm bg-white border border-slate-200 ${theme.text}`}>
                ⭐ {currentBranchConfig.icon} {pathPoints}
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

      {/* THE PYRAMID CLIMB */}
      <div className="flex-1 max-w-3xl mx-auto w-full p-6 flex flex-col-reverse justify-start gap-12 mt-4">

        {pods.length === 0 ? (
          <div className="text-center py-20">
            <span className="text-6xl">{currentBranchConfig.icon}</span>
            <h2 className="text-2xl font-black text-slate-800 mt-4 uppercase tracking-tighter">Próximamente</h2>
            <p className="text-slate-500 font-medium mt-2">Esta rama de la ruta aún está en construcción.</p>
          </div>
        ) : (
          pods.map((pod, pIdx) => {
            const isLocked = !isAdmin && pIdx > activePodIndex;
            const isCurrentPod = pIdx === activePodIndex;

            return (
              <div key={pod.id} className="relative flex flex-col flex-col-reverse items-center">
                <div className={`w-full max-w-md flex flex-col-reverse gap-4 relative z-10 ${isLocked ? 'opacity-50' : ''}`}>
                  {isLocked && (
                    <div className="absolute inset-0 z-20 backdrop-blur-[2px] bg-white/30 flex items-center justify-center rounded-2xl">
                      <span className="bg-white/90 px-4 py-2 rounded-xl text-slate-500 font-bold shadow-sm flex items-center gap-2">☁️ Bloqueado</span>
                    </div>
                  )}

                  {pod.segments?.map((seg, sIdx) => {
                    const isCurrentSegment = isCurrentPod && sIdx === activeSegmentIndex;
                    const isCompletedSegment = pIdx < activePodIndex || (isCurrentPod && sIdx < activeSegmentIndex);
                    const isFutureSegment = isAdmin && !isCurrentSegment && !isCompletedSegment;

                    return (
                      <div
                        key={seg.id}
                        className={`relative overflow-hidden rounded-2xl border-2 p-5 transition-all ${
                          isCurrentSegment
                            ? `bg-white border-transparent ${theme.ring} ring-4 shadow-lg transform scale-105 z-10 my-2`
                            : isCompletedSegment
                            ? `bg-white/60 ${theme.border} border-solid`
                            : 'bg-white/40 border-dashed border-slate-300'
                        }`}
                      >
                        <div className="flex justify-between items-center relative z-10">
                          <div className="flex items-center gap-4">
                            <div
                              className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg ${
                                isCurrentSegment ? `${theme.active} text-white` :
                                isCompletedSegment ? 'bg-slate-200 text-slate-400' : 'bg-slate-100 text-slate-300'
                              }`}
                            >
                              {isCompletedSegment ? '✓' : sIdx + 1}
                            </div>

                            <div>
                              <h3 className={`font-bold ${isCurrentSegment ? 'text-slate-900' : 'text-slate-500'}`}>Paso {sIdx + 1}</h3>
                              <p className="text-xs font-semibold text-slate-400">{seg.total_questions || seg.qs} Preguntas</p>
                            </div>
                          </div>

                          {/* ACTION BUTTONS */}
                          <div className="flex gap-2">
                            {isCompletedSegment && !isCurrentSegment && (
                              <button
                                onClick={() => setActiveWorkoutSegment(seg)}
                                className="bg-white text-slate-500 hover:text-slate-700 border-2 border-slate-200 hover:border-slate-300 px-4 py-2 rounded-xl font-bold text-xs shadow-sm transition-all active:scale-95"
                              >
                                Repasar
                              </button>
                            )}
                            {isCurrentSegment && (
                              <button
                                onClick={() => setActiveWorkoutSegment(seg)}
                                className={`${theme.active} hover:opacity-90 text-white px-5 py-2 rounded-xl font-bold text-sm shadow-md transition-all active:scale-95`}
                              >
                                Empezar
                              </button>
                            )}
                            {isFutureSegment && (
                              <button
                                onClick={() => setActiveWorkoutSegment(seg)}
                                className="bg-purple-50 text-purple-600 hover:bg-purple-100 border-2 border-purple-200 hover:border-purple-300 px-4 py-2 rounded-xl font-bold text-xs shadow-sm transition-all active:scale-95"
                              >
                                Modo Admin
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* POD HEADER */}
                <div className="mb-6 mt-12 text-center z-10 relative bg-white/80 backdrop-blur-sm px-6 py-2 rounded-2xl border border-white/50 shadow-sm inline-block">
                  <span className="text-xs font-black uppercase tracking-widest text-slate-400 bg-white px-3 py-1 rounded-full shadow-sm border border-slate-200">
                    Nivel {pIdx + 1}
                  </span>
                  <h2 className={`text-2xl font-black mt-2 ${!isAdmin && isLocked ? 'text-slate-400' : theme.text}`}>
                    {pod.title}
                  </h2>
                </div>

                {pIdx < pods.length - 1 && (
                  <div className={`absolute top-0 bottom-0 left-1/2 -ml-[2px] w-1 -mt-12 -mb-12 ${!isAdmin && isLocked ? 'bg-slate-200' : theme.line} z-0`}></div>
                )}
              </div>
            );
          })
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

              // Only update local state if we aren't relying strictly on the snapshot reload
              // setActivePodIndex(newPodIdx);
              // setActiveSegmentIndex(newSegIdx);
            }

            // --- 3. MULTI-BRACKET FIRESTORE SAVE ---
            if (userData && userData.uid) {
              try {
                const userRef = doc(db, 'users', userData.uid);
                const snap = await getDoc(userRef);

                let newTotal = totalPointsEarned;
                let newMonthly = totalPointsEarned;
                let newWeekly = totalPointsEarned;
                let newDaily = totalPointsEarned;
                let newPathPoints = totalPointsEarned;

                if (snap.exists()) {
                   const data = snap.data();
                   newTotal += (data.total_points || data.current_path_points || 0);
                   newMonthly += (data.monthly_points || 0);
                   newWeekly += (data.weekly_points || 0);
                   newDaily += (data.daily_points || 0);
                   newPathPoints += (data.progress?.[currentPathId]?.path_points || 0);
                }

                await setDoc(userRef, {
                  total_points: newTotal,
                  current_path_points: newTotal,
                  monthly_points: newMonthly,
                  weekly_points: newWeekly,
                  daily_points: newDaily,
                  progress: {
                    [currentPathId]: {
                      path_points: newPathPoints,
                      podIndex: newPodIdx,
                      segmentIndex: newSegIdx
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
