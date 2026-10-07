import React, { useState, useEffect, useRef } from 'react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../firebase.js';
import WorkoutEngine from './WorkoutEngine';

// A standalone, unlinked practice page — no login, no Dashboard, no course
// picker. Reuses the exact same pod/level zigzag-path UI and WorkoutEngine
// as StudentLearningPath.jsx, but:
//  - pulls every learning_paths doc tagged course === 'kpractice' (a
//    separate course value so these never show up for real students)
//  - has no concept of "assigned" units or due dates — every kpractice
//    path that exists is simply available
//  - progress/points live in localStorage instead of a Firestore user doc,
//    since there's no account to attach them to
//  - the mastery threshold to advance a segment is its own constant here
//    (not shared with StudentLearningPath.jsx's hardcoded 80), so it can be
//    tuned for her independently of what real students need — 70 for now,
//    change freely, or set FREE_ROAM to true to unlock every pod/segment
//    regardless of score (no locking at all).
const MASTERY_THRESHOLD = 70;
const FREE_ROAM = false;

const PROGRESS_KEY = 'kpractice_progress_v1';

const loadProgress = () => {
  try {
    return JSON.parse(localStorage.getItem(PROGRESS_KEY) || '{}');
  } catch {
    return {};
  }
};
const saveProgress = (progress) => {
  try {
    localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress));
  } catch (err) {
    console.error('Error saving kpractice progress to localStorage:', err);
  }
};

const CONTENT_TYPES = {
  vocab: { label: 'Vocabulario', icon: '📖', theme: 'indigo' },
  verb: { label: 'Verbos', icon: '⚡', theme: 'emerald' },
};

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

export default function KPracticePage() {
  const [paths, setPaths] = useState([]);
  const [selectedPathId, setSelectedPathId] = useState('');
  const [unitData, setUnitData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeWorkoutSegment, setActiveWorkoutSegment] = useState(null);
  const [progress, setProgress] = useState(loadProgress);
  const [feedbackModal, setFeedbackModal] = useState(null);
  const closeFeedbackModal = () => setFeedbackModal(null);

  useEffect(() => {
    const fetchPaths = async () => {
      setIsLoading(true);
      try {
        const snap = await getDocs(query(collection(db, 'learning_paths'), where('course', '==', 'kpractice')));
        const fetched = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setPaths(fetched);
        setSelectedPathId((prev) => prev || fetched[0]?.id || '');
      } catch (error) {
        console.error('Error fetching kpractice paths:', error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchPaths();
  }, []);

  useEffect(() => {
    setUnitData(paths.find((p) => p.id === selectedPathId) || null);
  }, [selectedPathId, paths]);

  const pods = unitData?.pods || [];
  const currentPodRef = useRef(null);
  const contentType = unitData?.contentType || 'vocab';
  const contentConfig = CONTENT_TYPES[contentType] || CONTENT_TYPES.vocab;

  const progressNode = progress[selectedPathId];
  const activePodIndex = progressNode?.podIndex || 0;
  const activeSegmentIndex = progressNode?.segmentIndex || 0;
  const pathPoints = progressNode?.path_points || 0;
  const totalPoints = Object.values(progress).reduce((acc, p) => acc + (p?.path_points || 0), 0);

  useEffect(() => {
    if (pods.length === 0) return;
    const t = setTimeout(() => {
      currentPodRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 150);
    return () => clearTimeout(t);
  }, [pods.length, selectedPathId, activePodIndex, activeSegmentIndex]);

  const themeColors = {
    emerald: { bg: 'bg-emerald-100', active: 'bg-emerald-600', ring: 'ring-emerald-500', text: 'text-emerald-800', border: 'border-emerald-200' },
    indigo: { bg: 'bg-indigo-100', active: 'bg-indigo-600', ring: 'ring-indigo-500', text: 'text-indigo-800', border: 'border-indigo-200' },
  };
  const theme = themeColors[contentConfig.theme] || themeColors.indigo;

  const totalSegments = pods.reduce((acc, pod) => acc + (pod.isBonus ? 0 : (pod.segments?.length || 0)), 0);
  const completedSegments = pods.reduce((acc, pod, pIdx) => {
    if (pod.isBonus) return acc;
    if (pIdx < activePodIndex) return acc + (pod.segments?.length || 0);
    if (pIdx === activePodIndex) return acc + activeSegmentIndex;
    return acc;
  }, 0);
  const progressPercent = totalSegments > 0 ? Math.min(100, Math.round((completedSegments / totalSegments) * 100)) : 0;
  const getLetterGrade = (percent) => (percent >= 90 ? 'A' : percent >= 80 ? 'B' : percent >= 70 ? 'C' : percent >= 60 ? 'D' : 'F');
  const letterGrade = getLetterGrade(progressPercent);

  const pathItemsRaw = [];
  pods.forEach((pod, pIdx) => {
    const podLocked = !FREE_ROAM && pIdx > activePodIndex;
    (pod.segments || []).forEach((seg, sIdx) => {
      const isCompleted = pIdx < activePodIndex || (pIdx === activePodIndex && sIdx < activeSegmentIndex);
      const isCurrent = pIdx === activePodIndex && sIdx === activeSegmentIndex;
      pathItemsRaw.push({ key: seg.id, kind: 'segment', pod, pIdx, seg, sIdx, isCompleted, isCurrent, isLocked: podLocked, canClick: FREE_ROAM || isCompleted || isCurrent });
    });
    pathItemsRaw.push({ key: `${pod.id}_checkpoint`, kind: 'checkpoint', pod, pIdx, isCompleted: pIdx < activePodIndex, isLocked: podLocked });
  });

  const pathTotalHeight = pathItemsRaw.length * PATH_ROW_HEIGHT + PATH_TOP_PAD + 50;
  const pathItems = pathItemsRaw.map((item, idx) => {
    const reverseIdx = pathItemsRaw.length - 1 - idx;
    return { ...item, x: item.kind === 'checkpoint' ? 50 : 50 + PATH_X_PATTERN[idx % PATH_X_PATTERN.length], y: PATH_TOP_PAD + reverseIdx * PATH_ROW_HEIGHT };
  });
  const pathLineD = pathItems.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');

  if (isLoading) {
    return <div className="min-h-screen bg-slate-50 flex items-center justify-center"><div className="text-xl font-bold text-slate-500 animate-pulse">Preparando...</div></div>;
  }

  if (paths.length === 0) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center gap-3">
        <span className="text-5xl">🗺️</span>
        <h1 className="text-xl font-black text-slate-800">Todavía no hay nada aquí</h1>
        <p className="text-slate-500 font-medium max-w-sm">Pronto habrá una unidad para practicar.</p>
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${theme.bg} font-sans flex flex-col pb-20 transition-colors duration-500`}>
      <div className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-slate-200 p-4 shadow-sm">
        <div className="max-w-3xl mx-auto flex flex-col gap-4">
          <div className="flex flex-col md:flex-row md:justify-between md:items-end gap-2">
            <div>
              <h1 className="text-xl font-black text-slate-800 flex items-center flex-wrap gap-2">
                <span>{contentConfig.icon}</span>
                {unitData?.title || 'Práctica'}
              </h1>
              {paths.length > 1 && (
                <select
                  value={selectedPathId}
                  onChange={(e) => setSelectedPathId(e.target.value)}
                  className="mt-1 text-xs font-bold text-slate-500 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 outline-none focus:border-indigo-400"
                >
                  {paths.map((p) => <option key={p.id} value={p.id}>{p.title || p.id}</option>)}
                </select>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs font-bold">
              <span className="bg-amber-100 text-amber-700 px-2.5 py-1 rounded-full border border-amber-200 shadow-sm">🏆 Totales: {totalPoints}</span>
              <span className={`px-2.5 py-1 rounded-full shadow-sm border ${theme.bg} ${theme.border} ${theme.text}`}>{contentConfig.label}: {pathPoints}</span>
              <span className="bg-slate-100 text-slate-700 px-3 py-1 rounded-full border border-slate-200 shadow-sm flex items-center gap-2">
                <span className={`text-sm font-black ${letterGrade === 'A' ? 'text-emerald-600' : letterGrade === 'B' ? 'text-blue-600' : letterGrade === 'C' ? 'text-amber-600' : 'text-rose-600'}`}>{letterGrade}</span>
                <span className="text-slate-400">|</span>
                <span>{progressPercent}% <span className="hidden md:inline font-medium">Completado</span></span>
              </span>
            </div>
          </div>
          <div className="w-full bg-slate-200 rounded-full h-2.5 overflow-hidden">
            <div className={`h-2.5 rounded-full ${theme.active} transition-all duration-500`} style={{ width: `${progressPercent}%` }}></div>
          </div>
        </div>
      </div>

      <div className="flex-1 max-w-3xl mx-auto w-full px-4 pt-8 pb-6">
        {pods.length === 0 ? (
          <div className="text-center py-20">
            <span className="text-6xl">{contentConfig.icon}</span>
            <h2 className="text-2xl font-black text-slate-800 mt-4 uppercase tracking-tighter">Próximamente</h2>
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
                  locked: { box: 'bg-slate-200 border-4 border-slate-300', icon: 'text-slate-400', label: 'text-slate-400', suffix: '· Bloqueado' },
                  pending: { box: 'bg-white border-4 border-amber-300', icon: 'text-amber-400', label: 'text-amber-500', suffix: '' },
                }[state];
                return (
                  <div key={item.key}>
                    <div className={`absolute rounded-full flex items-center justify-center shadow-md ${styles.box}`} style={{ left: `calc(${item.x}% - ${CHECKPOINT_SIZE / 2}px)`, top: item.y - CHECKPOINT_SIZE / 2, width: CHECKPOINT_SIZE, height: CHECKPOINT_SIZE }}>
                      <TrophyIcon className={styles.icon} />
                    </div>
                    <div className={`absolute text-center text-[11px] font-black uppercase tracking-wide ${styles.label}`} style={{ left: 0, right: 0, top: item.y + CHECKPOINT_SIZE / 2 + 8 }}>
                      Nivel {item.pIdx + 1} {styles.suffix}
                    </div>
                  </div>
                );
              }
              const size = item.isCurrent ? CURRENT_NODE_SIZE : NODE_SIZE;
              let bgClass, content, ringClass = '';
              if (item.isCompleted) { bgClass = 'bg-emerald-500'; content = <CheckIcon className="text-white" />; }
              else if (item.isCurrent) { bgClass = theme.active; content = <span className="text-white font-black text-2xl">{item.sIdx + 1}</span>; ringClass = `ring-4 ${theme.ring} animate-pulse`; }
              else if (item.isLocked) { bgClass = 'bg-slate-200'; content = <LockIcon className="text-slate-400" />; }
              else { bgClass = 'bg-slate-100 border-2 border-slate-300'; content = <span className="text-slate-300 font-black text-lg">{item.sIdx + 1}</span>; }
              const Tag = item.canClick ? 'button' : 'div';
              return (
                <React.Fragment key={item.key}>
                  {item.isCurrent && (
                    <div className="absolute text-center" style={{ left: `calc(${item.x}% - 90px)`, width: 180, top: item.y - size / 2 - 58 }}>
                      <span className={`inline-block bg-white border-2 ${theme.border} ${theme.text} text-xs font-black px-3 py-1.5 rounded-2xl shadow-sm whitespace-nowrap`}>¡Empieza aquí!</span>
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
            <div className="absolute text-center text-[11px] font-bold text-slate-400" style={{ left: 0, right: 0, top: pathTotalHeight - 24 }}>— Inicio de la ruta —</div>
          </div>
        )}
      </div>

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
          onComplete={(segId, score, numQs, regularCount = 0, sentenceCount = 0) => {
            setActiveWorkoutSegment(null);
            const baseScore = (regularCount * 1) + (sentenceCount * 2);
            let multiplier = 1;
            if (score === 100) multiplier = 3;
            else if (score >= 90) multiplier = 2;
            else if (score >= 80) multiplier = 1.5;
            const completedSegPodIdx = pods.findIndex((pod) => (pod.segments || []).some((s) => s.id === segId));
            const isBonusCompletion = completedSegPodIdx >= 0 && !!pods[completedSegPodIdx]?.isBonus;
            if (isBonusCompletion && multiplier >= 1.5) multiplier += 0.5;
            const totalPointsEarned = Math.max(10, Math.round(baseScore * multiplier));

            let newPodIdx = activePodIndex;
            let newSegIdx = activeSegmentIndex;
            const currentActiveSeg = pods[activePodIndex]?.segments[activeSegmentIndex];
            if (score >= MASTERY_THRESHOLD && segId === currentActiveSeg?.id) {
              if (activeSegmentIndex < pods[activePodIndex].segments.length - 1) newSegIdx = activeSegmentIndex + 1;
              else { newPodIdx = activePodIndex + 1; newSegIdx = 0; }
            }

            const nextProgress = {
              ...progress,
              [selectedPathId]: { path_points: pathPoints + totalPointsEarned, podIndex: newPodIdx, segmentIndex: newSegIdx },
            };
            setProgress(nextProgress);
            saveProgress(nextProgress);

            setFeedbackModal(
              score >= MASTERY_THRESHOLD
                ? { tone: 'success', emoji: '🎉', title: '¡Excelente! ¡Aprobaste!', message: `Obtuviste un ${score}%. Multiplicador: ${multiplier}x (+${totalPointsEarned} pts)` }
                : { tone: 'warning', emoji: '💪', title: '¡Buen esfuerzo!', message: `Obtuviste un ${score}%. Necesitas al menos ${MASTERY_THRESHOLD}% para avanzar — ¡puedes intentarlo de nuevo! (+${totalPointsEarned} pts de práctica)` }
            );
          }}
        />
      )}

      {feedbackModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-6" onClick={closeFeedbackModal}>
          <div onClick={(e) => e.stopPropagation()} className={`w-full max-w-sm rounded-3xl border-2 bg-slate-800 p-8 text-center shadow-2xl ${feedbackModal.tone === 'success' ? 'border-emerald-500' : 'border-amber-500'}`}>
            <div className="text-6xl mb-4">{feedbackModal.emoji}</div>
            <h3 className={`text-2xl font-black uppercase tracking-tight mb-2 ${feedbackModal.tone === 'success' ? 'text-emerald-400' : 'text-amber-400'}`}>{feedbackModal.title}</h3>
            <p className="text-sm text-slate-300 font-medium mb-6">{feedbackModal.message}</p>
            <button onClick={closeFeedbackModal} className={`px-8 py-3 rounded-xl font-black text-xs uppercase tracking-widest text-white shadow-md transition-all hover:scale-105 ${feedbackModal.tone === 'success' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-amber-600 hover:bg-amber-700'}`}>
              Continuar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
