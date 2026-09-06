import React, { useState, useEffect } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore'; 
import { db } from '../firebase.js';
import WorkoutEngine from './WorkoutEngine';
import { useAuth } from '../AuthContext';

const PATH_ID = 's2_descubre2_preliminar';

export default function StudentLearningPath() {
  const { userData } = useAuth(); 
  
  // --- ADMIN CHECK ---
  const isAdmin = userData?.role === 'admin';

  // --- STATE ---
  const [pathTitle, setPathTitle] = useState('Cargando ruta...');
  const [unitTheme, setUnitTheme] = useState('emerald');
  const [pods, setPods] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeWorkoutSegment, setActiveWorkoutSegment] = useState(null);

  // Progress State
  const [activePodIndex, setActivePodIndex] = useState(0);
  const [activeSegmentIndex, setActiveSegmentIndex] = useState(0);

  // --- 1. FETCH STATIC PATH DATA ONCE ---
  useEffect(() => {
    const fetchPath = async () => {
      setIsLoading(true);
      try {
        const docRef = doc(db, 'learning_paths', PATH_ID);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          const data = docSnap.data();
          setPathTitle(data.title || 'Ruta sin título');
          setPods(data.pods || []);
          if (data.theme) setUnitTheme(data.theme);
        } else {
          console.error('No such path found!');
          setPathTitle('Error: Ruta no encontrada');
        }
      } catch (error) {
        console.error('Error fetching path:', error);
        setPathTitle('Error de conexión');
      }
      setIsLoading(false);
    };

    fetchPath();
  }, []); 

  // --- 2. SYNC PROGRESS WHENEVER LIVE DATA ARRIVES ---
  useEffect(() => {
    if (userData?.progress?.[PATH_ID]) {
      setActivePodIndex(userData.progress[PATH_ID].podIndex || 0);
      setActiveSegmentIndex(userData.progress[PATH_ID].segmentIndex || 0);
    }
  }, [userData]); 

  // --- DYNAMIC COLOR DICTIONARIES ---
  const themeColors = {
    emerald: { bg: 'bg-emerald-50', active: 'bg-emerald-600', ring: 'ring-emerald-500', text: 'text-emerald-800', border: 'border-emerald-200', line: 'bg-emerald-400' },
    amber: { bg: 'bg-amber-50', active: 'bg-amber-500', ring: 'ring-amber-400', text: 'text-amber-900', border: 'border-amber-200', line: 'bg-amber-400' },
    indigo: { bg: 'bg-indigo-50', active: 'bg-indigo-600', ring: 'ring-indigo-500', text: 'text-indigo-800', border: 'border-indigo-200', line: 'bg-indigo-400' },
    rose: { bg: 'bg-rose-50', active: 'bg-rose-600', ring: 'ring-rose-500', text: 'text-rose-800', border: 'border-rose-200', line: 'bg-rose-400' },
  };
  const theme = themeColors[unitTheme] || themeColors.emerald;

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
  const pathPoints = userData?.progress?.[PATH_ID]?.path_points || 0;

  if (isLoading) {
    return (
      <div className={`min-h-screen ${theme.bg} flex items-center justify-center`}>
        <div className="text-xl font-bold text-slate-500 animate-pulse">Preparando la ruta...</div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${theme.bg} font-sans flex flex-col pb-20`}>
      {/* FIXED TOP PROGRESS & POINTS BAR */}
      <div className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-slate-200 p-4 shadow-sm">
        <div className="max-w-3xl mx-auto flex flex-col gap-3">
          <div className="flex flex-col md:flex-row md:justify-between md:items-end gap-2">
            <h1 className="text-xl font-black text-slate-800">
              {pathTitle} {isAdmin && <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full ml-2 align-middle">ADMIN</span>}
            </h1>

            {/* GAMIFICATION PILLS (Daily, Weekly, Monthly, Totales, En Ruta) */}
            <div className="flex flex-wrap items-center gap-2 text-xs font-bold">
              <span className="bg-emerald-100 text-emerald-700 px-2.5 py-1 rounded-full border border-emerald-200 shadow-sm">
                📅 Hoy: {dailyPoints}
              </span>
              <span className="bg-blue-100 text-blue-700 px-2.5 py-1 rounded-full border border-blue-200 shadow-sm">
                📊 Semanal: {weeklyPoints}
              </span>
              <span className="bg-sky-100 text-sky-700 px-2.5 py-1 rounded-full border border-sky-200 shadow-sm">
                🗓️ Mensual: {monthlyPoints}
              </span>
              <span className="bg-amber-100 text-amber-700 px-2.5 py-1 rounded-full border border-amber-200 shadow-sm">
                🏆 Totales: {allTimePoints}
              </span>
              <span className="bg-indigo-100 text-indigo-700 px-2.5 py-1 rounded-full border border-indigo-200 shadow-sm">
                ⭐ En Ruta: {pathPoints}
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

          <div className="w-full bg-slate-200 rounded-full h-2.5 overflow-hidden">
            <div
              className={`h-2.5 rounded-full ${theme.active} transition-all duration-500`}
              style={{ width: `${progressPercent}%` }}
            ></div>
          </div>
        </div>
      </div>

      {/* THE PYRAMID CLIMB */}
      <div className="flex-1 max-w-3xl mx-auto w-full p-6 flex flex-col-reverse justify-start gap-12 mt-10">
        {pods.map((pod, pIdx) => {
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
                  Nivel {pIdx + 1} (Base: {10 + (pIdx + 1)} pts)
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
        })}
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
          onComplete={async (segId, score, numQs) => {
            setActiveWorkoutSegment(null);

            // --- 1. GAMIFICATION MATH (10 + Pod # formula) ---
            const playedPodIndex = pods.findIndex((p) => p.segments.some((s) => s.id === segId));
            const podLevelBonus = playedPodIndex + 1; // Pod 1 = 1, Pod 2 = 2, etc.
            const totalPointsEarned = 10 + podLevelBonus;

            // --- 2. CALCULATE NEW POSITION ---
            let newPodIdx = activePodIndex;
            let newSegIdx = activeSegmentIndex;

            const currentActiveSeg = pods[activePodIndex]?.segments[activeSegmentIndex];
            
            if (score >= 70 && segId === currentActiveSeg?.id) {
              if (activeSegmentIndex < pods[activePodIndex].segments.length - 1) {
                newSegIdx = activeSegmentIndex + 1;
              } else {
                newPodIdx = activePodIndex + 1;
                newSegIdx = 0;
              }
              setActivePodIndex(newPodIdx);
              setActiveSegmentIndex(newSegIdx);
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
                   newPathPoints += (data.progress?.[PATH_ID]?.path_points || 0);
                }

                await setDoc(userRef, {
                  total_points: newTotal,
                  current_path_points: newTotal, 
                  monthly_points: newMonthly,
                  weekly_points: newWeekly,
                  daily_points: newDaily,
                  progress: {
                    [PATH_ID]: {
                      path_points: newPathPoints,
                      podIndex: newPodIdx,
                      segmentIndex: newSegIdx
                    }
                  }
                }, { merge: true });
                
                console.log(`Saved ${totalPointsEarned} points across all time brackets and locked position!`);
              } catch (error) {
                console.error('Error saving to Firestore:', error);
                alert(`⚠️ Error de Firebase: ${error.message}`);
              }
            }

            // --- 4. ALERTS ---
            if (score >= 70) {
              alert(`¡Excelente! Aprobaste con un ${score}%. (+${totalPointsEarned} pts)`);
            } else {
              alert(`Obtuviste un ${score}%. Necesitas al menos 70% para avanzar. \n(+${totalPointsEarned} pts de consolación)`);
            }
          }}
        />
      )}
    </div>
  );
}