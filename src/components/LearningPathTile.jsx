import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { fetchLearningPathTotalPods, getLearningPathSummary } from '../utils/learningPathProgress';

const LearningPathTile = () => {
  const { userData } = useAuth();
  const [totalPods, setTotalPods] = useState(0);

  useEffect(() => {
    fetchLearningPathTotalPods()
      .then(setTotalPods)
      .catch((error) => console.error('Error fetching learning path totals:', error));
  }, []);

  const { completedPods, percent } = getLearningPathSummary(userData?.progress, totalPods);

  return (
    <Link
      to="/student-learning-path"
      className="group block bg-slate-900 border-2 border-slate-800 rounded-2xl p-5 shadow-lg hover:shadow-blue-500/20 hover:border-blue-500 transition-all duration-300 relative overflow-hidden"
    >
      <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-cyan-500/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>

      <div className="relative z-10">
        <h3 className="font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-400 uppercase tracking-widest text-lg mb-1">
          Ruta de Aprendizaje
        </h3>
        <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mb-4">
          {completedPods} / {totalPods} Pods Completados
        </p>

        <div className="w-full bg-slate-800 rounded-full h-3 border border-slate-700 overflow-hidden mb-4">
          <div
            className="bg-gradient-to-r from-blue-500 to-cyan-400 h-full rounded-full transition-all duration-500"
            style={{ width: `${percent}%` }}
          ></div>
        </div>

        <div className="w-full bg-blue-600 text-white text-[11px] font-black uppercase tracking-[0.2em] py-3 rounded-xl text-center group-hover:bg-blue-500 transition-colors shadow-md">
          {percent}% Completado →
        </div>
      </div>
    </Link>
  );
};

export default LearningPathTile;
