import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { fetchUnitTotalPods, getUnitSummary, getAssignedDominioTasks } from '../utils/learningPathProgress';
import { getPathCardTheme } from '../utils/pathThemes';

// One assigned Dominio unit, oldest at the top — a student can have more than
// one active at once (e.g. a vocab unit and a verb-tense unit assigned
// separately), so every one gets its own card and progress bar instead of
// only ever showing the most recently assigned.
const LearningPathTile = ({ liveDia, course, courseTasks = [] }) => {
  const { userData } = useAuth();
  const [totalPodsByPath, setTotalPodsByPath] = useState({});

  // getAssignedDominioTasks sorts newest-first; reverse for oldest-on-top.
  const assignedTasks = [...getAssignedDominioTasks(courseTasks, liveDia)].reverse();

  useEffect(() => {
    let cancelled = false;
    Promise.all(
      assignedTasks.map((task) => fetchUnitTotalPods(task.path_id).then((total) => [task.path_id, total]))
    )
      .then((entries) => {
        if (!cancelled) setTotalPodsByPath(Object.fromEntries(entries));
      })
      .catch((error) => console.error('Error fetching unit totals:', error));
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assignedTasks.map((t) => t.path_id).join(',')]);

  // Nothing assigned yet for this course today — same pattern as other day-gated dashboard cards.
  if (assignedTasks.length === 0) return null;

  return (
    <div className="space-y-3">
      {assignedTasks.map((task, idx) => {
        const totalPods = totalPodsByPath[task.path_id] || 0;
        const { completedPods, percent } = getUnitSummary(userData?.progress, task.path_id, totalPods);
        const cardTheme = getPathCardTheme(idx);

        return (
          <Link
            key={task.path_id}
            to={`/student-learning-path/${liveDia}?${course ? `course=${course}&` : ''}path=${task.path_id}`}
            className={`group block bg-slate-900 border-2 border-slate-800 rounded-2xl p-5 shadow-lg ${cardTheme.hoverGlow} ${cardTheme.hoverBorder} transition-all duration-300 relative overflow-hidden`}
          >
            <div className="relative z-10">
              <h3 className={`font-black text-transparent bg-clip-text bg-gradient-to-r ${cardTheme.title} uppercase tracking-widest text-lg mb-1`}>
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
                  style={{ width: `${percent}%` }}
                ></div>
              </div>

              <div className={`w-full text-white text-[11px] font-black uppercase tracking-[0.2em] py-3 rounded-xl text-center transition-colors shadow-md ${cardTheme.button}`}>
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
