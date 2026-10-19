import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { fetchUnitProgressMeta, getUnitSummary, getAssignedDominioTasks, computeGradedPercent, isPastEffectiveDueDate } from '../utils/learningPathProgress';
import { getPathCardTheme } from '../utils/pathThemes';
import { useActiveTheme } from '../context/ThemeContext';

// One assigned Dominio unit, oldest at the top — a student can have more than
// one active at once (e.g. a vocab unit and a verb-tense unit assigned
// separately), so every one gets its own card and progress bar instead of
// only ever showing the most recently assigned.
//
// `variant`: 'active' (default) shows every task whose (possibly
// teacher-extended) due date hasn't passed yet, as the normal full card.
// 'archived' shows only past-due enforced tasks, as a slimmer, still fully
// clickable row — opening one for extra practice can only ever raise its
// locked grade, never lower it (see computeGradedPercent/buildGradedProgressNode).
// An un-enforced task (no `enforceDueDate`) is always 'active', matching
// today's behavior exactly.
const LearningPathTile = ({ liveDia, course, courseTasks = [], fechaByDia = {}, variant = 'active' }) => {
  const { userData } = useAuth();
  const { theme } = useActiveTheme() || {};
  const [progressMetaByPath, setProgressMetaByPath] = useState({});

  // getAssignedDominioTasks sorts newest-first; reverse for oldest-on-top.
  const allAssignedTasks = [...getAssignedDominioTasks(courseTasks, liveDia)].reverse();
  const assignedTasks = allAssignedTasks.filter((task) => {
    const teacherOverride = userData?.progress?.[task.path_id]?.teacherOverride;
    const isPastDue = isPastEffectiveDueDate(task, fechaByDia, teacherOverride);
    return variant === 'archived' ? isPastDue : !isPastDue;
  });

  // The per-unit color rotation (cardTheme below) exists to tell multiple
  // simultaneously-assigned units apart — a seasonal theme only takes over
  // when there's exactly one active unit, so it never fights that purpose.
  const themeColor = assignedTasks.length === 1 ? theme?.styles?.cardOverrides?.learningPath : null;

  useEffect(() => {
    let cancelled = false;
    Promise.all(
      assignedTasks.map((task) => fetchUnitProgressMeta(task.path_id).then((meta) => [task.path_id, meta]))
    )
      .then((entries) => {
        if (!cancelled) setProgressMetaByPath(Object.fromEntries(entries));
      })
      .catch((error) => console.error('Error fetching unit totals:', error));
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assignedTasks.map((t) => t.path_id).join(',')]);

  // Nothing assigned yet for this course today — same pattern as other day-gated dashboard cards.
  if (assignedTasks.length === 0) return null;

  if (variant === 'archived') {
    return (
      <div className="space-y-2">
        {assignedTasks.map((task) => {
          const meta = progressMetaByPath[task.path_id] || { isFlat: true, pods: [], totalPods: 0 };
          const { percent: livePercent } = getUnitSummary(userData?.progress, task.path_id, meta);
          const percent = computeGradedPercent(userData?.progress?.[task.path_id], livePercent, task, fechaByDia);

          return (
            <Link
              key={task.path_id}
              to={`/student-learning-path/${liveDia}?${course ? `course=${course}&` : ''}path=${task.path_id}`}
              className="flex items-center justify-between gap-3 bg-slate-900/70 border border-slate-800 rounded-lg px-3 py-2 hover:bg-slate-800 transition-colors"
            >
              <span className="text-slate-300 text-[11px] font-bold truncate">{task.titulo || task.path_id}</span>
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 shrink-0">{percent}% →</span>
            </Link>
          );
        })}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {assignedTasks.map((task, idx) => {
        const meta = progressMetaByPath[task.path_id] || { isFlat: true, pods: [], totalPods: 0 };
        const { completedPods, totalPods, percent } = getUnitSummary(userData?.progress, task.path_id, meta);
        const cardTheme = getPathCardTheme(idx);

        return (
          <Link
            key={task.path_id}
            to={`/student-learning-path/${liveDia}?${course ? `course=${course}&` : ''}path=${task.path_id}`}
            className={`group block bg-slate-900 border-2 border-slate-800 rounded-2xl p-5 shadow-lg ${cardTheme.hoverGlow} ${cardTheme.hoverBorder} transition-all duration-300 relative overflow-hidden`}
            style={themeColor ? { borderColor: themeColor } : undefined}
          >
            <div className="relative z-10">
              <h3
                className={`font-black text-transparent bg-clip-text bg-gradient-to-r ${cardTheme.title} uppercase tracking-widest text-lg mb-1`}
                style={themeColor ? { backgroundImage: `linear-gradient(to right, ${themeColor}, ${theme?.styles?.accent || themeColor})` } : undefined}
              >
                Ruta de Aprendizaje
              </h3>
              <p className="text-white text-base font-black uppercase tracking-wide mb-1">
                {task.titulo || task.path_id}
              </p>
              <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest mb-4">
                {completedPods} / {totalPods} Pods Completados
              </p>

              <div className="w-full bg-slate-800 rounded-full h-3 border border-slate-700 overflow-hidden mb-4">
                <div
                  className={`bg-gradient-to-r ${cardTheme.bar} h-full rounded-full transition-all duration-500`}
                  style={{ width: `${percent}%`, ...(themeColor ? { backgroundImage: 'none', backgroundColor: themeColor } : {}) }}
                ></div>
              </div>

              <div
                className={`w-full text-white text-[11px] font-black uppercase tracking-[0.2em] py-3 rounded-xl text-center transition-colors shadow-md ${cardTheme.button}`}
                style={themeColor ? { backgroundColor: themeColor } : undefined}
              >
                {percent}% Completado →
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
};

export default LearningPathTile;
