import React, { useState, useEffect } from 'react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../../firebase'; 

export default function TeacherGradebook() {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('warmups'); // 'warmups' or 'pods'

  // Set this to the total number of pods in your curriculum for accurate percentages
  const TOTAL_COURSE_PODS = 20; 

  useEffect(() => {
    const fetchStudents = async () => {
      try {
        const usersRef = collection(db, 'users');
        const q = query(usersRef, where('role', '==', 'student'));
        const snap = await getDocs(q);
        
        const studentData = snap.docs.map(doc => ({
          uid: doc.id,
          ...doc.data()
        }));

        setStudents(studentData);
      } catch (error) {
        console.error("Error fetching gradebook data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchStudents();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center text-white">
        <p className="animate-pulse font-bold text-slate-400 tracking-widest uppercase">Cargando Calificaciones...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 p-8 font-sans">
      <header className="max-w-6xl mx-auto mb-8 flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-black text-white uppercase tracking-tight">Panel de Control</h1>
          <p className="text-sky-400 font-bold uppercase tracking-widest text-xs mt-1">Progreso de Estudiantes</p>
        </div>
        
        <div className="flex bg-slate-800 rounded-lg p-1 border border-slate-700">
          <button 
            onClick={() => setActiveTab('warmups')}
            className={`px-4 py-2 rounded-md text-xs font-bold uppercase tracking-widest transition-all ${activeTab === 'warmups' ? 'bg-sky-600 text-white' : 'text-slate-400 hover:text-white'}`}
          >
            Calentamientos
          </button>
          <button 
            onClick={() => setActiveTab('pods')}
            className={`px-4 py-2 rounded-md text-xs font-bold uppercase tracking-widest transition-all ${activeTab === 'pods' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'}`}
          >
            Learning Path
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden shadow-xl">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-950/50 border-b border-slate-700 text-xs font-black text-slate-400 uppercase tracking-widest">
              <th className="p-4 pl-6">Estudiante</th>
              <th className="p-4">Puntos (Leaderboard)</th>
              {activeTab === 'warmups' ? (
                <th className="p-4">Últimos Calentamientos</th>
              ) : (
                <th className="p-4">Progreso de Pods</th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700/50">
            {students.length === 0 ? (
              <tr>
                <td colSpan="3" className="p-8 text-center text-slate-500 font-bold">No hay estudiantes registrados.</td>
              </tr>
            ) : (
              students.map((student) => {
                const warmups = student.progress?.warmups || {};
                const warmupKeys = Object.keys(warmups);
                
                // Array Method Calculation for Learning Path
                const completedPods = student.progress?.completedPods || [];
                const rawPercentage = (completedPods.length / TOTAL_COURSE_PODS) * 100;
                const podProgress = Math.min(Math.round(rawPercentage), 100); // Caps at 100%

                return (
                  <tr key={student.uid} className="hover:bg-slate-700/20 transition-colors">
                    <td className="p-4 pl-6">
                      <p className="font-bold text-white">{student.email}</p>
                      <p className="text-xs text-slate-500 font-mono mt-1">UID: {student.uid.slice(0, 6)}...</p>
                    </td>
                    
                    <td className="p-4">
                      <span className="inline-block bg-amber-950/50 border border-amber-900/50 text-amber-400 font-black px-3 py-1 rounded-lg text-sm">
                        🏆 {student.total_points || 0}
                      </span>
                    </td>
                    
                    <td className="p-4">
                      {activeTab === 'warmups' ? (
                        <div className="flex gap-2 flex-wrap">
                          {warmupKeys.length > 0 ? (
                            warmupKeys.map(key => (
                              <div key={key} className="bg-slate-900 border border-slate-700 rounded-lg p-2 text-center min-w-[80px]">
                                <p className="text-[9px] font-bold text-slate-400 uppercase">{key}</p>
                                <p className="text-sm font-black text-sky-400">{warmups[key].rawScore || `${warmups[key].grade}%`}</p>
                              </div>
                            ))
                          ) : (
                            <span className="text-xs text-slate-500 font-bold italic">Sin actividad</span>
                          )}
                        </div>
                      ) : (
                        <div className="w-full max-w-xs">
                          <div className="flex justify-between text-xs font-bold mb-1">
                            <span className="text-slate-400">{completedPods.length} / {TOTAL_COURSE_PODS} Pods</span>
                            <span className="text-emerald-400">{podProgress}%</span>
                          </div>
                          <div className="w-full bg-slate-900 rounded-full h-2.5 border border-slate-700 overflow-hidden">
                            <div 
                              className="bg-emerald-500 h-2.5 rounded-full transition-all duration-500" 
                              style={{ width: `${podProgress}%` }}
                            ></div>
                          </div>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </main>
    </div>
  );
}