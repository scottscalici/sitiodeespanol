import React, { useState, useEffect } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { db, app } from '../../firebase'; // 👈 Make sure 'app' is imported here!
import { getCachedCollection, invalidateCollectionCache } from '../../utils/firestoreCache';
import {
  fetchUnitTotalPods,
  getUnitCompletedPods,
  getAssignedDominioTasks,
} from '../../utils/learningPathProgress';

// Below 50 = flag red, below 70 = flag yellow, otherwise no flag.
const getFlagClasses = (percent) => {
  if (percent == null) return 'text-slate-400';
  if (percent < 50) return 'text-rose-400 bg-rose-950/40 border-rose-900/60';
  if (percent < 70) return 'text-amber-400 bg-amber-950/40 border-amber-900/60';
  return 'text-emerald-400 bg-slate-900 border-slate-700';
};

// Current quarter = the one whose date range contains today; null (no match,
// or no quarters configured yet) falls back to an all-time average.
const getCurrentQuarter = (quarters, todayStr) => {
  return (
    (quarters || []).find((q) => q.startDate && q.endDate && q.startDate <= todayStr && todayStr <= q.endDate) ||
    null
  );
};

export default function TeacherGradebook() {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('gradebook'); // 'gradebook' or 'diagnostics'
  const [unitColumns, setUnitColumns] = useState([]); // [{ path_id, titulo, day_due, courses: Set }]
  const [unitTotals, setUnitTotals] = useState({}); // { [path_id]: totalPods }

  // course -> today's assigned calentamiento docId (or null)
  const [todaysWarmupByCourse, setTodaysWarmupByCourse] = useState({});
  // calentamiento docId -> course, so warmup averages can be scoped by course
  const [calentamientoCourseById, setCalentamientoCourseById] = useState({});

  // Grading-period (quarter) config, editable from this page
  const [quarters, setQuarters] = useState([]);
  const [quarterModalOpen, setQuarterModalOpen] = useState(false);
  const [quarterDraft, setQuarterDraft] = useState([]);

  // Roster filter: 'all' or `${course}|${section}`
  const [rosterFilter, setRosterFilter] = useState('all');

  // Diagnostic specific states
  const [selectedWarmupId, setSelectedWarmupId] = useState('');
  const [aggregatedErrors, setAggregatedErrors] = useState([]);

  // 🔑 Password Reset Modal State
  const [resetModal, setResetModal] = useState(null); // { uid, email, newPassword, status }

  const [refreshing, setRefreshing] = useState(false);

  const loadGradebookData = async (force = false) => {
    // The roster is nothing else's cache to share (only this page reads
    // 'users' this way) and this tool exists specifically to check a
    // student's CURRENT state live in class — always pull fresh instead of
    // risking a stale in-memory snapshot from an earlier mount this tab.
    const fetchStudents = async () => {
      try {
        const allUsers = await getCachedCollection('users', { force: true });
        setStudents(allUsers.filter((u) => u.role === 'student'));
      } catch (error) {
        console.error('Error fetching gradebook data:', error);
      }
    };

    const fetchQuarters = async () => {
      try {
        const snap = await getDoc(doc(db, 'config', 'academic_quarters'));
        setQuarters(snap.exists() ? snap.data().quarters || [] : []);
      } catch (error) {
        console.error('Error fetching quarter config:', error);
      }
    };

    const fetchCalendarAndWarmups = async (liveDia) => {
      try {
        const calentamientos = await getCachedCollection('calentamientos', { force });
        const courseById = {};
        const todaysByCourse = {};
        calentamientos.forEach((c) => {
          courseById[c.id] = c.course;
          if (Number(c.dia) === liveDia && !todaysByCourse[c.course]) {
            todaysByCourse[c.course] = c.id;
          }
        });
        setCalentamientoCourseById(courseById);
        setTodaysWarmupByCourse(todaysByCourse);
      } catch (error) {
        console.error('Error fetching calentamientos for gradebook:', error);
      }
    };

    const fetchLearningPathColumns = async () => {
      try {
        const [calSnap, tareasSnap] = await Promise.all([
          getDoc(doc(db, 'config', 'academic_year_2026_2027')),
          getDoc(doc(db, 'curriculum_tracks', 'tareas_master')),
        ]);

        const calendarArray = calSnap.exists() ? (calSnap.data().map || []) : [];
        const todayStr = new Date().toLocaleDateString('en-CA');
        const pastEntries = calendarArray.filter((c) => c.fecha && c.fecha <= todayStr && c.dia != null);
        const liveDia = pastEntries.length > 0
          ? parseInt(pastEntries.sort((a, b) => b.fecha.localeCompare(a.fecha))[0].dia)
          : 1;

        await fetchCalendarAndWarmups(liveDia);

        const tareasData = tareasSnap.exists() ? tareasSnap.data() : {};
        const columnsByPathId = {};
        ['s2', 's4'].forEach((courseId) => {
          const assigned = getAssignedDominioTasks(tareasData[courseId] || [], liveDia);
          assigned.forEach((task) => {
            if (!columnsByPathId[task.path_id]) {
              columnsByPathId[task.path_id] = {
                path_id: task.path_id,
                titulo: task.titulo,
                day_due: task.day_due,
                courses: new Set(),
              };
            }
            columnsByPathId[task.path_id].courses.add(courseId);
          });
        });

        const columns = Object.values(columnsByPathId);
        setUnitColumns(columns);

        const totalsEntries = await Promise.all(
          columns.map(async (col) => [col.path_id, await fetchUnitTotalPods(col.path_id)])
        );
        setUnitTotals(Object.fromEntries(totalsEntries));
      } catch (error) {
        console.error('Error fetching learning path columns:', error);
      }
    };

    await Promise.all([fetchStudents(), fetchQuarters(), fetchLearningPathColumns()]);
  };

  useEffect(() => {
    loadGradebookData().finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Quietly re-pull the roster every 20s while this tab is on-screen, so a
  // teacher watching a student live doesn't have to remember to hit refresh.
  useEffect(() => {
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        getCachedCollection('users', { force: true })
          .then((allUsers) => setStudents(allUsers.filter((u) => u.role === 'student')))
          .catch((error) => console.error('Error auto-refreshing gradebook:', error));
      }
    }, 20000);
    return () => clearInterval(interval);
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    invalidateCollectionCache('users');
    invalidateCollectionCache('calentamientos');
    await loadGradebookData(true);
    setRefreshing(false);
  };

  // --- WARMUP AVERAGE (current quarter if configured, else all-time),
  // scoped to warmups that belong to the student's own course ---
  const getWarmupAverage = (student) => {
    const warmups = student.progress?.warmups || {};
    const todayStr = new Date().toLocaleDateString('en-CA');
    const quarter = getCurrentQuarter(quarters, todayStr);

    const grades = Object.entries(warmups)
      .filter(([warmupId, entry]) => {
        if (calentamientoCourseById[warmupId] !== student.course) return false;
        if (quarter && !(entry.timestamp && entry.timestamp.slice(0, 10) >= quarter.startDate && entry.timestamp.slice(0, 10) <= quarter.endDate)) {
          return false;
        }
        return typeof entry.grade === 'number';
      })
      .map(([, entry]) => entry.grade);

    if (grades.length === 0) return { percent: null, quarterLabel: quarter?.label || null };
    const avg = Math.round(grades.reduce((sum, g) => sum + g, 0) / grades.length);
    return { percent: avg, quarterLabel: quarter?.label || null };
  };

  // --- TODAY'S ASSIGNED WARMUP STATUS for this student's course ---
  const getTodaysWarmupStatus = (student) => {
    const todaysId = todaysWarmupByCourse[student.course];
    if (!todaysId) return { status: 'none' };
    const entry = student.progress?.warmups?.[todaysId];
    if (entry) return { status: 'done', percent: entry.grade ?? null, rawScore: entry.rawScore };
    const draft = student.progress?.warmups_draft?.[todaysId];
    if (draft) return { status: 'in_progress' };
    return { status: 'not_started' };
  };

  // --- AGGREGATE LEARNING PATH % across every Dominio unit assigned so far
  // for this student's course ---
  const getLearningPathPercent = (student) => {
    const relevantCols = unitColumns.filter((col) => col.courses.has(student.course));
    if (relevantCols.length === 0) return null;
    const totalPods = relevantCols.reduce((sum, col) => sum + (unitTotals[col.path_id] || 0), 0);
    if (totalPods === 0) return null;
    const completedPods = relevantCols.reduce(
      (sum, col) => sum + Math.min(getUnitCompletedPods(student.progress, col.path_id), unitTotals[col.path_id] || 0),
      0
    );
    return Math.round((completedPods / totalPods) * 100);
  };

  const saveQuarters = async () => {
    await setDoc(doc(db, 'config', 'academic_quarters'), { quarters: quarterDraft }, { merge: true });
    setQuarters(quarterDraft);
    setQuarterModalOpen(false);
  };

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

        {activeTab === 'gradebook' && (
          <div className="flex items-center gap-2 flex-wrap">
            <select
              value={rosterFilter}
              onChange={(e) => setRosterFilter(e.target.value)}
              className="bg-slate-800 border border-slate-700 text-white rounded-lg p-2.5 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-sky-500"
            >
              <option value="all">Todos los estudiantes</option>
              {Array.from(
                new Set(
                  students
                    .filter((s) => s.course && s.section)
                    .map((s) => `${s.course}|${s.section}`)
                )
              )
                .sort()
                .map((key) => {
                  const [course, section] = key.split('|');
                  return (
                    <option key={key} value={key}>
                      {course.toUpperCase()} — {section}
                    </option>
                  );
                })}
            </select>

            <button
              onClick={() => {
                setQuarterDraft(quarters.length ? quarters : [{ label: 'Trimestre 1', startDate: '', endDate: '' }]);
                setQuarterModalOpen(true);
              }}
              className="bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 px-3 py-2.5 rounded-lg text-xs font-black uppercase tracking-widest transition-colors"
              title="Configurar fechas de trimestres"
            >
              📅 Trimestres
            </button>

            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 px-3 py-2.5 rounded-lg text-xs font-black uppercase tracking-widest transition-colors disabled:opacity-50"
              title="Volver a cargar los datos más recientes"
            >
              {refreshing ? '⏳' : '🔄'} Actualizar
            </button>
          </div>
        )}
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

      {/* --- GRADEBOOK: NAME, SECTION, WARMUP AVERAGE, TODAY, LEARNING PATH --- */}
      {activeTab === 'gradebook' && (() => {
        const visibleStudents = students
          .filter((s) => rosterFilter === 'all' || `${s.course}|${s.section}` === rosterFilter)
          .sort((a, b) => {
            const lastCompare = (a.lastName || '').localeCompare(b.lastName || '');
            return lastCompare !== 0 ? lastCompare : (a.firstName || '').localeCompare(b.firstName || '');
          });

        return (
          <main className="max-w-6xl mx-auto bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden shadow-xl overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-950/50 border-b border-slate-700 text-xs font-black text-slate-400 uppercase tracking-widest">
                  <th className="p-4 pl-6 sticky left-0 bg-slate-950/50">Estudiante</th>
                  <th className="p-4">Sección</th>
                  <th className="p-4">Puntos</th>
                  <th className="p-4">
                    Promedio Calentamientos
                    <span className="block text-[9px] font-mono text-slate-500 normal-case">
                      {getCurrentQuarter(quarters, new Date().toLocaleDateString('en-CA'))?.label || 'Todo el año'}
                    </span>
                  </th>
                  <th className="p-4">Calentamiento de Hoy</th>
                  <th className="p-4">Camino de Aprendizaje</th>
                  <th className="p-4 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/50">
                {visibleStudents.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-slate-500 font-bold">
                      No hay estudiantes en este filtro.
                    </td>
                  </tr>
                ) : (
                  visibleStudents.map((student) => {
                    const displayName = student.firstName || student.lastName
                      ? `${student.firstName || ''} ${student.lastName || ''}`.trim()
                      : student.email;
                    const { percent: avgPercent } = getWarmupAverage(student);
                    const todays = getTodaysWarmupStatus(student);
                    const pathPercent = getLearningPathPercent(student);

                    return (
                      <tr key={student.uid} className="hover:bg-slate-700/20 transition-colors">
                        <td className="p-4 pl-6 sticky left-0 bg-slate-800">
                          <p className="font-bold text-white">{displayName}</p>
                          <p className="text-xs text-slate-500 mt-1">{student.email}</p>
                        </td>

                        <td className="p-4">
                          <span className="inline-block bg-slate-900 border border-slate-700 text-slate-300 font-bold px-2.5 py-1 rounded-lg text-xs">
                            {student.course?.toUpperCase() || '?'} {student.section || ''}
                          </span>
                        </td>

                        <td className="p-4">
                          <span className="inline-block bg-amber-950/50 border border-amber-900/50 text-amber-400 font-black px-3 py-1 rounded-lg text-sm">
                            🏆 {student.total_points || 0}
                          </span>
                        </td>

                        <td className="p-4">
                          {avgPercent == null ? (
                            <span className="text-slate-600 font-bold">—</span>
                          ) : (
                            <div className={`inline-block border rounded-lg px-3 py-1.5 text-center min-w-[70px] font-black text-sm ${getFlagClasses(avgPercent)}`}>
                              {avgPercent}%
                            </div>
                          )}
                        </td>

                        <td className="p-4">
                          {todays.status === 'none' && <span className="text-slate-600 font-bold">—</span>}
                          {todays.status === 'not_started' && (
                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 bg-slate-900 border border-slate-700 px-2.5 py-1.5 rounded-lg">
                              No iniciado
                            </span>
                          )}
                          {todays.status === 'in_progress' && (
                            <span className="text-[10px] font-black uppercase tracking-widest text-sky-400 bg-sky-950/40 border border-sky-900/60 px-2.5 py-1.5 rounded-lg">
                              En progreso
                            </span>
                          )}
                          {todays.status === 'done' && (
                            <div className={`inline-block border rounded-lg px-3 py-1.5 text-center min-w-[70px] font-black text-sm ${getFlagClasses(todays.percent ?? 0)}`}>
                              {todays.rawScore || `${todays.percent}%`}
                            </div>
                          )}
                        </td>

                        <td className="p-4">
                          {pathPercent == null ? (
                            <span className="text-slate-600 font-bold">—</span>
                          ) : (
                            <div className="w-full max-w-[140px]">
                              <div className={`text-xs font-black mb-1 ${getFlagClasses(pathPercent).split(' ')[0]}`}>
                                {pathPercent}%
                              </div>
                              <div className="w-full bg-slate-900 rounded-full h-2 border border-slate-700 overflow-hidden">
                                <div
                                  className="bg-emerald-500 h-2 rounded-full transition-all duration-500"
                                  style={{ width: `${pathPercent}%` }}
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
        );
      })()}

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

      {/* 📅 QUARTER (GRADING PERIOD) EDITOR MODAL */}
      {quarterModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 backdrop-blur-sm p-4">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 w-full max-w-lg shadow-2xl">
            <h3 className="text-lg font-black text-white uppercase tracking-wider mb-1 flex items-center gap-2">
              <span>📅</span> Fechas de Trimestres
            </h3>
            <p className="text-xs text-slate-400 mb-6">
              El promedio de calentamientos se calcula solo dentro del trimestre actual. Sin fechas configuradas, se usa el promedio de todo el año.
            </p>

            <div className="space-y-3 mb-4">
              {quarterDraft.map((q, idx) => (
                <div key={idx} className="flex gap-2 items-center bg-slate-900 border border-slate-700 rounded-lg p-3">
                  <input
                    type="text"
                    value={q.label}
                    onChange={(e) => {
                      const updated = [...quarterDraft];
                      updated[idx] = { ...updated[idx], label: e.target.value };
                      setQuarterDraft(updated);
                    }}
                    placeholder="Trimestre 1"
                    className="flex-1 bg-slate-950 border border-slate-700 rounded-lg p-2 text-white text-xs font-bold focus:outline-none focus:ring-1 focus:ring-sky-500"
                  />
                  <input
                    type="date"
                    value={q.startDate}
                    onChange={(e) => {
                      const updated = [...quarterDraft];
                      updated[idx] = { ...updated[idx], startDate: e.target.value };
                      setQuarterDraft(updated);
                    }}
                    className="bg-slate-950 border border-slate-700 rounded-lg p-2 text-white text-xs focus:outline-none focus:ring-1 focus:ring-sky-500"
                  />
                  <span className="text-slate-600 text-xs">a</span>
                  <input
                    type="date"
                    value={q.endDate}
                    onChange={(e) => {
                      const updated = [...quarterDraft];
                      updated[idx] = { ...updated[idx], endDate: e.target.value };
                      setQuarterDraft(updated);
                    }}
                    className="bg-slate-950 border border-slate-700 rounded-lg p-2 text-white text-xs focus:outline-none focus:ring-1 focus:ring-sky-500"
                  />
                  <button
                    onClick={() => setQuarterDraft(quarterDraft.filter((_, i) => i !== idx))}
                    className="text-rose-400 hover:text-rose-300 font-black px-2"
                    title="Eliminar"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>

            <button
              onClick={() =>
                setQuarterDraft([
                  ...quarterDraft,
                  { label: `Trimestre ${quarterDraft.length + 1}`, startDate: '', endDate: '' },
                ])
              }
              className="text-xs font-bold text-sky-400 hover:text-sky-300 mb-6"
            >
              + Agregar trimestre
            </button>

            <div className="flex justify-end gap-3 border-t border-slate-700 pt-4">
              <button
                onClick={() => setQuarterModalOpen(false)}
                className="px-4 py-2 rounded-lg text-xs font-bold text-slate-400 hover:text-white uppercase tracking-widest transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={saveQuarters}
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