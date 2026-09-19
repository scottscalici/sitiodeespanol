import React, { useState, useEffect } from 'react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { db, app } from '../../firebase'; // 👈 Make sure 'app' is imported here!
import { fetchLearningPathTotalPods, getLearningPathSummary } from '../../utils/learningPathProgress';

export default function TeacherGradebook() {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('gradebook'); // 'gradebook' or 'diagnostics'
  const [totalPods, setTotalPods] = useState(0);

  // Diagnostic specific states
  const [selectedWarmupId, setSelectedWarmupId] = useState('');
  const [aggregatedErrors, setAggregatedErrors] = useState([]);

  // 🔑 Password Reset Modal State
  const [resetModal, setResetModal] = useState(null); // { uid, email, newPassword, status }

  useEffect(() => {
    const fetchStudents = async () => {
      try {
        const usersRef = collection(db, 'users');
        const q = query(usersRef, where('role', '==', 'student'));
        const snap = await getDocs(q);

        const studentData = snap.docs.map((doc) => ({
          uid: doc.id,
          ...doc.data(),
        }));

        setStudents(studentData);
      } catch (error) {
        console.error('Error fetching gradebook data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchStudents();
    fetchLearningPathTotalPods()
      .then(setTotalPods)
      .catch((error) => console.error('Error fetching learning path totals:', error));
  }, []);

  // --- DIAGNOSTIC AGGREGATION LOGIC ---
  useEffect(() => {
    if (activeTab === 'diagnostics' && selectedWarmupId) {
      const errorList = [];

      students.forEach((student) => {
        const warmupData = student.progress?.warmups?.[selectedWarmupId];
        if (warmupData && warmupData.errors && warmupData.errors.length > 0) {
          warmupData.errors.forEach((err) => {
            errorList.push({
              studentName: student.firstName
                ? `${student.firstName} ${student.lastName}`
                : student.email.split('@')[0],
              verb: err.verb,
              subject: err.subject,
              tense: err.tense,
              expected: err.expected,
              studentInput: err.studentInput,
            });
          });
        }
      });

      errorList.sort((a, b) => a.verb.localeCompare(b.verb));
      setAggregatedErrors(errorList);
    } else {
      setAggregatedErrors([]);
    }
  }, [activeTab, selectedWarmupId, students]);

  const getAvailableWarmupIds = () => {
    const ids = new Set();
    students.forEach((student) => {
      if (student.progress?.warmups) {
        Object.keys(student.progress.warmups).forEach((id) => ids.add(id));
      }
    });
    return Array.from(ids).sort();
  };

  // 🚀 ADMIN PASSWORD OVERRIDE HANDLER
// 🚀 ADMIN PASSWORD OVERRIDE HANDLER
const handleResetPassword = async () => {
  if (!resetModal.newPassword || resetModal.newPassword.length < 6) {
    setResetModal({ ...resetModal, status: 'Error: Mínimo 6 caracteres' });
    return;
  }
  
  setResetModal({ ...resetModal, status: 'Actualizando en Firebase...' });
  
  try {
    const functions = getFunctions(app); // 👈 Pass the main app instance here!
    const adminResetPassword = httpsCallable(functions, 'adminResetPassword');
    
    await adminResetPassword({ 
      uid: resetModal.uid, 
      newPassword: resetModal.newPassword 
    });
    
    setResetModal({ ...resetModal, status: '¡Éxito! Contraseña actualizada.' });
    
    // Auto-close after success
    setTimeout(() => setResetModal(null), 2000);
  } catch (error) {
    console.error("Password reset error:", error);
    setResetModal({ ...resetModal, status: 'Error: Verifica tu conexión o permisos.' });
  }
};
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center text-white">
        <p className="animate-pulse font-bold text-slate-400 tracking-widest uppercase">
          Cargando Calificaciones...
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 p-8 font-sans pb-20 relative">
      <header className="max-w-6xl mx-auto mb-8 flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h1 className="text-3xl font-black text-white uppercase tracking-tight">
            Panel de Control
          </h1>
          <p className="text-sky-400 font-bold uppercase tracking-widest text-xs mt-1">
            Progreso de Estudiantes
          </p>
        </div>

        <div className="flex bg-slate-800 rounded-lg p-1 border border-slate-700">
          <button
            onClick={() => setActiveTab('gradebook')}
            className={`px-4 py-2 rounded-md text-xs font-bold uppercase tracking-widest transition-all ${
              activeTab === 'gradebook'
                ? 'bg-sky-600 text-white shadow'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Calificaciones
          </button>
          <button
            onClick={() => setActiveTab('diagnostics')}
            className={`px-4 py-2 rounded-md text-xs font-bold uppercase tracking-widest transition-all flex items-center gap-1 ${
              activeTab === 'diagnostics'
                ? 'bg-rose-600 text-white shadow'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <span>⚠️</span> Diagnósticos
          </button>
        </div>
      </header>

      {/* --- DIAGNOSTICS TAB CONTENT --- */}
      {activeTab === 'diagnostics' && (
        <main className="max-w-6xl mx-auto bg-slate-800 rounded-2xl border border-slate-700 p-6 shadow-xl">
          <div className="flex justify-between items-center mb-6 pb-4 border-b border-slate-700">
            <div>
              <h2 className="text-lg font-black text-white uppercase tracking-wider">
                X-Ray de Errores (Primer Intento)
              </h2>
              <p className="text-xs text-slate-400">
                Selecciona una práctica para ver las formas incorrectas que los
                estudiantes ingresaron inicialmente.
              </p>
            </div>
            <select
              value={selectedWarmupId}
              onChange={(e) => setSelectedWarmupId(e.target.value)}
              className="bg-slate-900 border border-slate-700 text-white rounded-lg p-2.5 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-rose-500 min-w-[250px]"
            >
              <option value="">-- Selecciona un Calentamiento --</option>
              {getAvailableWarmupIds().map((id) => (
                <option key={id} value={id}>
                  {id}
                </option>
              ))}
            </select>
          </div>

          {!selectedWarmupId ? (
            <div className="py-12 text-center text-slate-500 font-bold uppercase tracking-widest">
              Selecciona una práctica arriba para ver los errores
            </div>
          ) : aggregatedErrors.length === 0 ? (
            <div className="py-12 text-center text-emerald-500 font-bold uppercase tracking-widest">
              ¡No se registraron errores de primer intento para esta práctica!
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {aggregatedErrors.map((err, idx) => (
                <div
                  key={idx}
                  className="bg-slate-900 border border-rose-900/50 p-4 rounded-xl relative overflow-hidden"
                >
                  <div className="absolute top-0 right-0 bg-rose-950/50 text-rose-500 text-[9px] font-black uppercase px-2 py-1 rounded-bl-lg">
                    {err.tense}
                  </div>
                  <p className="text-xs text-slate-400 font-bold mb-1">
                    {err.studentName}
                  </p>
                  <div className="flex gap-2 items-end mb-3">
                    <span className="text-lg font-black text-white">
                      {err.verb}
                    </span>
                    <span className="text-xs text-sky-400 font-bold mb-1">
                      ({err.subject})
                    </span>
                  </div>
                  <div className="flex flex-col gap-1 text-sm bg-slate-950 p-2 rounded-lg border border-slate-800">
                    <div className="flex justify-between">
                      <span className="text-slate-500 text-[10px] uppercase font-bold">
                        Esperado:
                      </span>
                      <span className="text-emerald-400 font-mono font-bold">
                        {err.expected}
                      </span>
                    </div>
                    <div className="flex justify-between border-t border-slate-800 pt-1">
                      <span className="text-slate-500 text-[10px] uppercase font-bold">
                        Escribió:
                      </span>
                      <span className="text-rose-400 font-mono font-bold line-through">
                        {err.studentInput}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </main>
      )}

      {/* --- UNIFIED GRADEBOOK: FIXED COLUMNS, ONE PER ASSIGNMENT --- */}
      {activeTab === 'gradebook' && (
        <main className="max-w-6xl mx-auto bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden shadow-xl overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-950/50 border-b border-slate-700 text-xs font-black text-slate-400 uppercase tracking-widest">
                <th className="p-4 pl-6 sticky left-0 bg-slate-950/50">Estudiante</th>
                <th className="p-4">Puntos</th>
                {getAvailableWarmupIds().map((warmupId) => (
                  <th key={warmupId} className="p-4 whitespace-nowrap">{warmupId}</th>
                ))}
                <th className="p-4 whitespace-nowrap text-emerald-400">Learning Path</th>
                <th className="p-4 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50">
              {students.length === 0 ? (
                <tr>
                  <td
                    colSpan={getAvailableWarmupIds().length + 4}
                    className="p-8 text-center text-slate-500 font-bold"
                  >
                    No hay estudiantes registrados.
                  </td>
                </tr>
              ) : (
                students.map((student) => {
                  const warmups = student.progress?.warmups || {};
                  const { completedPods, percent, letterGrade } = getLearningPathSummary(student.progress, totalPods);

                  return (
                    <tr
                      key={student.uid}
                      className="hover:bg-slate-700/20 transition-colors"
                    >
                      <td className="p-4 pl-6 sticky left-0 bg-slate-800">
                        <p className="font-bold text-white">{student.email}</p>
                        <p className="text-xs text-slate-500 font-mono mt-1">
                          UID: {student.uid.slice(0, 6)}...
                        </p>
                      </td>

                      <td className="p-4">
                        <span className="inline-block bg-amber-950/50 border border-amber-900/50 text-amber-400 font-black px-3 py-1 rounded-lg text-sm">
                          🏆 {student.total_points || 0}
                        </span>
                      </td>

                      {getAvailableWarmupIds().map((warmupId) => {
                        const entry = warmups[warmupId];
                        return (
                          <td key={warmupId} className="p-4">
                            {entry ? (
                              <div className="bg-slate-900 border border-slate-700 rounded-lg p-2 text-center min-w-[80px]">
                                <p className="text-sm font-black text-sky-400">
                                  {entry.rawScore || `${entry.grade}%`}
                                </p>
                              </div>
                            ) : (
                              <span className="text-slate-600 font-bold">—</span>
                            )}
                          </td>
                        );
                      })}

                      <td className="p-4">
                        <div className="w-full max-w-xs">
                          <div className="flex justify-between text-xs font-bold mb-1">
                            <span className="text-slate-400">
                              {completedPods} / {totalPods} Pods
                            </span>
                            <span className="text-emerald-400">
                              {percent}% ({letterGrade})
                            </span>
                          </div>
                          <div className="w-full bg-slate-900 rounded-full h-2.5 border border-slate-700 overflow-hidden">
                            <div
                              className="bg-emerald-500 h-2.5 rounded-full transition-all duration-500"
                              style={{ width: `${percent}%` }}
                            ></div>
                          </div>
                        </div>
                      </td>

                      {/* 🔑 NEW PASSWORD RESET BUTTON */}
                      <td className="p-4 text-center">
                        <button
                          onClick={() => setResetModal({
                            uid: student.uid,
                            email: student.email,
                            newPassword: '',
                            status: ''
                          })}
                          className="bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-600 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-colors flex items-center justify-center gap-2 mx-auto shadow-sm"
                          title="Forzar nueva contraseña"
                        >
                          <span>🔑</span> Reset
                        </button>
                      </td>

                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </main>
      )}

      {/* 🔐 PASSWORD OVERRIDE MODAL */}
      {resetModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 backdrop-blur-sm p-4">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 w-full max-w-md shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <h3 className="text-lg font-black text-white uppercase tracking-wider mb-1 flex items-center gap-2">
              <span>🔐</span> Forzar Contraseña
            </h3>
            <p className="text-xs text-slate-400 mb-6">
              Estudiante: <span className="font-bold text-sky-400">{resetModal.email}</span>
            </p>

            <input
              type="text"
              placeholder="Nueva contraseña (mín. 6 caracteres)"
              value={resetModal.newPassword}
              onChange={(e) => setResetModal({ ...resetModal, newPassword: e.target.value, status: '' })}
              className="w-full bg-slate-900 border border-slate-600 rounded-lg p-3 text-white mb-4 font-mono focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
            />

            {resetModal.status && (
              <p className={`text-xs font-bold mb-4 ${resetModal.status.includes('Error') ? 'text-rose-400' : 'text-emerald-400'}`}>
                {resetModal.status}
              </p>
            )}

            <div className="flex justify-end gap-3 border-t border-slate-700 pt-4 mt-2">
              <button
                onClick={() => setResetModal(null)}
                className="px-4 py-2 rounded-lg text-xs font-bold text-slate-400 hover:text-white uppercase tracking-widest transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleResetPassword}
                className="px-6 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-lg text-xs font-black uppercase tracking-widest transition-colors shadow-md"
              >
                Actualizar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}