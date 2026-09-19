import React, { useState, useEffect, useMemo } from 'react';
import { collection, getDocs, query, where, doc, updateDoc } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { db, app } from '../../firebase';

export default function TeacherGradebook() {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Navigation States
  const [activeTab, setActiveTab] = useState('warmups'); // 'warmups', 'pods', or 'diagnostics'
  const [activeBlock, setActiveBlock] = useState('Todos'); // 'Todos', '1B', '4A', '4B'

  // Diagnostic specific states
  const [selectedWarmupId, setSelectedWarmupId] = useState('');
  const [aggregatedErrors, setAggregatedErrors] = useState([]);

  // Modals
  const [resetModal, setResetModal] = useState(null);
  const [editScoreModal, setEditScoreModal] = useState(null);

  const TOTAL_COURSE_PODS = 20;

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
  }, []);

  // --- 🚀 NEW: DYNAMIC BLOCK FILTER & ALPHABETICAL SORT ---
  const filteredStudents = useMemo(() => {
    let filtered = students;
    if (activeBlock !== 'Todos') {
      filtered = students.filter(s => s.section && s.section.includes(activeBlock));
    }
    // Sort alphabetically by last name
    return filtered.sort((a, b) => (a.lastName || '').localeCompare(b.lastName || ''));
  }, [students, activeBlock]);

  // --- 🚀 NEW: RECENT CALENTAMIENTO AVERAGE ---
  const globalRecentKey = useMemo(() => {
    const keys = new Set();
    filteredStudents.forEach(s => {
      if(s.progress?.warmups) Object.keys(s.progress.warmups).forEach(k => keys.add(k));
    });
    const sorted = Array.from(keys).sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));
    return sorted.length > 0 ? sorted[0] : null;
  }, [filteredStudents]);

  const classRecentAverage = useMemo(() => {
    if (!globalRecentKey) return null;
    let total = 0;
    let count = 0;
    filteredStudents.forEach(s => {
      const w = s.progress?.warmups?.[globalRecentKey];
      if (w) {
        if (w.grade !== undefined) {
          total += Number(w.grade);
          count++;
        } else if (w.rawScore && String(w.rawScore).includes('/')) {
          const parts = String(w.rawScore).split('/');
          total += Math.round((Number(parts[0]) / Number(parts[1])) * 100);
          count++;
        }
      }
    });
    return count > 0 ? Math.round(total / count) : 0;
  }, [filteredStudents, globalRecentKey]);


  // --- DIAGNOSTIC AGGREGATION LOGIC ---
  useEffect(() => {
    if (activeTab === 'diagnostics' && selectedWarmupId) {
      const errorList = [];

      filteredStudents.forEach((student) => {
        const warmupData = student.progress?.warmups?.[selectedWarmupId];
        if (warmupData && warmupData.errors && warmupData.errors.length > 0) {
          warmupData.errors.forEach((err) => {
            errorList.push({
              studentName: student.firstName
                ? `${student.firstName} ${student.lastName ? student.lastName.charAt(0) + '.' : ''}`
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
  }, [activeTab, selectedWarmupId, filteredStudents]);

  const getAvailableWarmupIds = () => {
    const ids = new Set();
    filteredStudents.forEach((student) => {
      if (student.progress?.warmups) {
        Object.keys(student.progress.warmups).forEach((id) => ids.add(id));
      }
    });
    return Array.from(ids).sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));
  };

  // --- HELPER: FORMAT STUDENT NAME ---
  const formatName = (student) => {
    if (student.firstName) {
      return `${student.firstName} ${student.lastName ? student.lastName.charAt(0) + '.' : ''}`;
    }
    return student.email.split('@')[0];
  };

  // --- HANDLERS ---
  const handleResetPassword = async () => {
    if (!resetModal.newPassword || resetModal.newPassword.length < 6) {
      setResetModal({ ...resetModal, status: 'Error: Mínimo 6 caracteres' });
      return;
    }
    
    setResetModal({ ...resetModal, status: 'Actualizando en Firebase...' });
    
    try {
      const functions = getFunctions(app);
      const adminResetPassword = httpsCallable(functions, 'adminResetPassword');
      
      await adminResetPassword({ 
        uid: resetModal.uid, 
        newPassword: resetModal.newPassword 
      });
      
      setResetModal({ ...resetModal, status: '¡Éxito! Contraseña actualizada.' });
      setTimeout(() => setResetModal(null), 2000);
    } catch (error) {
      console.error("Password reset error:", error);
      setResetModal({ ...resetModal, status: 'Error: Verifica tu conexión o permisos.' });
    }
  };

  const handleUpdateScore = async () => {
    if (!editScoreModal.newValue) return;
    setEditScoreModal(prev => ({ ...prev, status: 'Guardando...' }));
    
    try {
      let newGrade = parseInt(editScoreModal.newValue);
      let newRaw = editScoreModal.newValue;
      
      // If teacher typed "9/10", calculate the percentage automatically
      if (String(editScoreModal.newValue).includes('/')) {
        const [earned, possible] = editScoreModal.newValue.split('/');
        newGrade = Math.round((Number(earned) / Number(possible)) * 100);
      } else {
        // If they just typed "90", append a % to the raw score for display consistency
        newRaw = `${newGrade}%`;
      }
      
      await updateDoc(doc(db, 'users', editScoreModal.uid), {
        [`progress.warmups.${editScoreModal.warmupKey}.rawScore`]: newRaw,
        [`progress.warmups.${editScoreModal.warmupKey}.grade`]: newGrade
      });

      // Update UI instantly
      setStudents(prev => prev.map(s => {
        if (s.uid === editScoreModal.uid) {
          return {
            ...s,
            progress: {
              ...s.progress,
              warmups: {
                ...s.progress?.warmups,
                [editScoreModal.warmupKey]: {
                  ...s.progress?.warmups?.[editScoreModal.warmupKey],
                  rawScore: newRaw,
                  grade: newGrade
                }
              }
            }
          };
        }
        return s;
      }));

      setEditScoreModal(null);
    } catch (error) {
      console.error("Error updating score:", error);
      setEditScoreModal(prev => ({ ...prev, status: 'Error al guardar.' }));
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

        <div className="flex flex-col sm:flex-row gap-4 items-end">
          {/* --- BLOCK FILTER TOGGLES --- */}
          <div className="flex bg-slate-950 rounded-lg p-1 border border-slate-800 shadow-inner">
            {['Todos', '1B', '4A', '4B'].map(block => (
              <button
                key={block}
                onClick={() => setActiveBlock(block)}
                className={`px-4 py-1.5 rounded-md text-[10px] font-black uppercase tracking-widest transition-all ${
                  activeBlock === block
                    ? 'bg-indigo-600 text-white shadow-md'
                    : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                {block}
              </button>
            ))}
          </div>

          {/* --- VIEW TABS --- */}
          <div className="flex bg-slate-800 rounded-lg p-1 border border-slate-700">
            <button
              onClick={() => setActiveTab('warmups')}
              className={`px-4 py-2 rounded-md text-xs font-bold uppercase tracking-widest transition-all ${
                activeTab === 'warmups' ? 'bg-sky-600 text-white shadow' : 'text-slate-400 hover:text-white'
              }`}
            >
              Calentamientos
            </button>
            <button
              onClick={() => setActiveTab('pods')}
              className={`px-4 py-2 rounded-md text-xs font-bold uppercase tracking-widest transition-all ${
                activeTab === 'pods' ? 'bg-emerald-600 text-white shadow' : 'text-slate-400 hover:text-white'
              }`}
            >
              Learning Path
            </button>
            <button
              onClick={() => setActiveTab('diagnostics')}
              className={`px-4 py-2 rounded-md text-xs font-bold uppercase tracking-widest transition-all flex items-center gap-1 ${
                activeTab === 'diagnostics' ? 'bg-rose-600 text-white shadow' : 'text-slate-400 hover:text-white'
              }`}
            >
              <span>⚠️</span> Diagnósticos
            </button>
          </div>
        </div>
      </header>

      {/* --- DIAGNOSTICS TAB CONTENT --- */}
      {activeTab === 'diagnostics' && (
        <main className="max-w-6xl mx-auto bg-slate-800 rounded-2xl border border-slate-700 p-6 shadow-xl">
          <div className="flex justify-between items-center mb-6 pb-4 border-b border-slate-700">
            <div>
              <h2 className="text-lg font-black text-white uppercase tracking-wider">
                X-Ray de Errores <span className="text-rose-400">({activeBlock})</span>
              </h2>
              <p className="text-xs text-slate-400">
                Selecciona una práctica para ver las formas incorrectas que los estudiantes ingresaron inicialmente.
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
              ¡No se registraron errores de primer intento para esta práctica en este bloque!
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {aggregatedErrors.map((err, idx) => (
                <div key={idx} className="bg-slate-900 border border-rose-900/50 p-4 rounded-xl relative overflow-hidden">
                  <div className="absolute top-0 right-0 bg-rose-950/50 text-rose-500 text-[9px] font-black uppercase px-2 py-1 rounded-bl-lg">
                    {err.tense}
                  </div>
                  <p className="text-xs text-slate-400 font-bold mb-1">
                    {err.studentName}
                  </p>
                  <div className="flex gap-2 items-end mb-3">
                    <span className="text-lg font-black text-white">{err.verb}</span>
                    <span className="text-xs text-sky-400 font-bold mb-1">({err.subject})</span>
                  </div>
                  <div className="flex flex-col gap-1 text-sm bg-slate-950 p-2 rounded-lg border border-slate-800">
                    <div className="flex justify-between">
                      <span className="text-slate-500 text-[10px] uppercase font-bold">Esperado:</span>
                      <span className="text-emerald-400 font-mono font-bold">{err.expected}</span>
                    </div>
                    <div className="flex justify-between border-t border-slate-800 pt-1">
                      <span className="text-slate-500 text-[10px] uppercase font-bold">Escribió:</span>
                      <span className="text-rose-400 font-mono font-bold line-through">{err.studentInput}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </main>
      )}

      {/* --- STANDARD GRADEBOOK CONTENT (WARMUPS & PODS) --- */}
      {activeTab !== 'diagnostics' && (
        <main className="max-w-6xl mx-auto bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden shadow-xl">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-950/50 border-b border-slate-700 text-xs font-black text-slate-400 uppercase tracking-widest">
                <th className="p-4 pl-6 w-1/3">Estudiante</th>
                <th className="p-4 w-1/4">Promedio (Trimestre)</th>
                {activeTab === 'warmups' ? (
                  <th className="p-4">
                    Último: {globalRecentKey ? globalRecentKey : '--'} 
                    {classRecentAverage !== null && (
                      <span className="text-sky-400 ml-2">({classRecentAverage}%)</span>
                    )}
                  </th>
                ) : (
                  <th className="p-4">Progreso de Pods</th>
                )}
                <th className="p-4 text-center w-24">Reset</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50">
              {filteredStudents.length === 0 ? (
                <tr>
                  <td colSpan="4" className="p-8 text-center text-slate-500 font-bold">
                    No hay estudiantes registrados en este bloque.
                  </td>
                </tr>
              ) : (
                filteredStudents.map((student) => {
                  const warmups = student.progress?.warmups || {};
                  
                  // Sort keys descending so the most recent day is at index 0
                  const warmupKeys = Object.keys(warmups).sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));
                  const recentKey = warmupKeys.length > 0 ? warmupKeys[0] : null;

                  // Calculate Overall Average based on total earned / total possible
                  let earnedPoints = 0;
                  let possiblePoints = 0;
                  
                  Object.values(warmups).forEach(w => {
                    if (w.rawScore && String(w.rawScore).includes('/')) {
                      const parts = String(w.rawScore).split('/');
                      earnedPoints += Number(parts[0]);
                      possiblePoints += Number(parts[1]);
                    } else if (w.grade !== undefined) {
                      earnedPoints += Number(w.grade);
                      possiblePoints += 100;
                    }
                  });
                  
                  const quarterAvg = possiblePoints > 0 ? Math.round((earnedPoints / possiblePoints) * 100) : 0;

                  // Pod Progress
                  const completedPods = student.progress?.completedPods || [];
                  const podProgress = Math.min(Math.round((completedPods.length / TOTAL_COURSE_PODS) * 100), 100);

                  return (
                    <tr key={student.uid} className="hover:bg-slate-700/20 transition-colors">
                      <td className="p-4 pl-6">
                        <p className="font-bold text-white text-sm">{formatName(student)}</p>
                        <div className="flex gap-2 items-center mt-1">
                          <span className="text-[9px] font-black uppercase tracking-widest bg-slate-700 text-slate-300 px-2 py-0.5 rounded">
                            {student.section || 'N/A'}
                          </span>
                        </div>
                      </td>

                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <span className={`inline-block font-black px-3 py-1 rounded-lg text-sm border ${
                            quarterAvg >= 90 ? 'bg-emerald-950/50 border-emerald-900/50 text-emerald-400' :
                            quarterAvg >= 70 ? 'bg-amber-950/50 border-amber-900/50 text-amber-400' :
                            quarterAvg > 0 ? 'bg-rose-950/50 border-rose-900/50 text-rose-400' :
                            'bg-slate-900 border-slate-700 text-slate-500'
                          }`}>
                            {quarterAvg > 0 ? `${quarterAvg}%` : '--'}
                          </span>
                        </div>
                      </td>

                      <td className="p-4">
                        {activeTab === 'warmups' ? (
                          <div className="flex gap-2 flex-wrap">
                            {recentKey ? (
                              <div 
                                onClick={() => setEditScoreModal({
                                  uid: student.uid,
                                  studentName: formatName(student),
                                  warmupKey: recentKey,
                                  newValue: warmups[recentKey].rawScore || warmups[recentKey].grade,
                                  status: ''
                                })}
                                className="group bg-slate-900 border border-slate-700 hover:border-sky-500 rounded-lg p-2 text-center min-w-[90px] cursor-pointer transition-all relative"
                                title="Editar calificación"
                              >
                                {/* Edit hover icon */}
                                <div className="absolute -top-2 -right-2 bg-sky-500 text-white rounded-full p-1 w-5 h-5 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-lg">
                                  <span className="text-[10px]">✏️</span>
                                </div>
                                
                                <p className="text-[9px] font-bold text-slate-400 uppercase">{recentKey}</p>
                                <p className="text-sm font-black text-sky-400">
                                  {warmups[recentKey].rawScore || `${warmups[recentKey].grade}%`}
                                </p>
                              </div>
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
                      
                      <td className="p-4 text-center">
                        <button
                          onClick={() => setResetModal({ 
                            uid: student.uid, 
                            email: student.email, 
                            newPassword: '', 
                            status: '' 
                          })}
                          className="text-slate-600 hover:text-slate-300 p-2 rounded-lg transition-colors flex items-center justify-center mx-auto"
                          title="Forzar nueva contraseña"
                        >
                          <span className="opacity-50 hover:opacity-100 transition-opacity">🔑</span>
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

      {/* ✏️ EDIT SCORE MODAL */}
      {editScoreModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 backdrop-blur-sm p-4">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 w-full max-w-sm shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <h3 className="text-lg font-black text-white uppercase tracking-wider mb-1">
              Sobrescribir Nota
            </h3>
            <p className="text-xs text-slate-400 mb-4">
              Estudiante: <span className="font-bold text-sky-400">{editScoreModal.studentName}</span><br/>
              Día: <span className="font-bold text-white">{editScoreModal.warmupKey}</span>
            </p>

            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-2 tracking-widest">
              Nueva Nota (Ej. "9/10" o "90")
            </label>
            <input
              type="text"
              value={editScoreModal.newValue}
              onChange={(e) => setEditScoreModal({ ...editScoreModal, newValue: e.target.value, status: '' })}
              className="w-full bg-slate-900 border border-slate-600 rounded-lg p-3 text-white mb-4 font-mono focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
            />

            {editScoreModal.status && (
              <p className={`text-xs font-bold mb-4 ${editScoreModal.status.includes('Error') ? 'text-rose-400' : 'text-emerald-400'}`}>
                {editScoreModal.status}
              </p>
            )}

            <div className="flex justify-end gap-3 border-t border-slate-700 pt-4">
              <button
                onClick={() => setEditScoreModal(null)}
                className="px-4 py-2 rounded-lg text-xs font-bold text-slate-400 hover:text-white uppercase tracking-widest transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleUpdateScore}
                className="px-6 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-lg text-xs font-black uppercase tracking-widest transition-colors shadow-md"
              >
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}