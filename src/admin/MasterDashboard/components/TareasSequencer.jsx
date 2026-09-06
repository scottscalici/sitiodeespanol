import React, { useState, useEffect } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../../../firebase'; 

const TASK_TYPES = [
  "Dominio", 
  "VHL", 
  "Schoology", 
  "Escuchar", 
  "Leer", 
  "Hablar", 
  "Escribir", 
  "Proyecto", 
  "Práctica", 
  "Examen de IB", 
  "Señor+"
];

const TareasSequencer = () => {
  const [tareasS2, setTareasS2] = useState([]);
  const [tareasS4, setTareasS4] = useState([]);
  const [activeCourse, setActiveCourse] = useState('s2');
  const [isSaving, setIsSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [calendarMap, setCalendarMap] = useState({});
  const [debugStatus, setDebugStatus] = useState("Cargando calendario...");

  const MAX_DAYS = 80;

  useEffect(() => {
    const fetchAllData = async () => {
      try {
        // 1. Fetch Tareas Master data
        const trackRef = doc(db, 'curriculum_tracks', 'tareas_master');
        const trackSnap = await getDoc(trackRef);
        
        if (trackSnap.exists()) {
          const data = trackSnap.data();
          setTareasS2(data.s2 || []);
          setTareasS4(data.s4 || []);
        }

        // 2. Fetch 2026-2027 Academic Calendar from config collection
        const configRef = doc(db, 'config', 'academic_year_2026_2027');
        const configSnap = await getDoc(configRef);
        
        if (configSnap.exists()) {
          const configData = configSnap.data();
          const mapping = {};
          let count = 0;
          
          if (configData.map && Array.isArray(configData.map)) {
            configData.map.forEach(item => {
              if (item.dia !== null && item.dia !== undefined) {
                const dayNum = Number(item.dia);
                if (!mapping[dayNum]) mapping[dayNum] = [];
                
                let formattedDate = item.fecha;
                if (item.fecha && item.fecha.includes('-')) {
                  const parts = item.fecha.split('-');
                  if (parts.length === 3) {
                    formattedDate = `${parts[1]}/${parts[2]}`;
                  }
                }
                
                mapping[dayNum].push(`${formattedDate}${item.ciclo ? ` (${item.ciclo})` : ''}`);
                count++;
              }
            });
          }
          setCalendarMap(mapping);
          setDebugStatus(`✅ Conectado: ${count} fechas cargadas desde config/academic_year_2026_2027`);
        } else {
          setDebugStatus("⚠️ Error: Documento config/academic_year_2026_2027 no encontrado.");
        }
      } catch (error) {
        console.error("Error loading sequencer data:", error);
        setDebugStatus(`❌ Error de Firestore: ${error.message}`);
      } finally {
        setLoading(false);
      }
    };

    fetchAllData();
  }, []);

  const activeTasks = activeCourse === 's2' ? tareasS2 : tareasS4;

  const handleTaskChange = (index, field, value) => {
    const updated = [...activeTasks];
    if (field === 'day_assigned' || field === 'day_due') {
      updated[index][field] = Number(value) || 0;
    } else {
      updated[index][field] = value;
    }

    if (activeCourse === 's2') setTareasS2([...updated]);
    else setTareasS4([...updated]);
  };

  const handleCreateTask = (dayNum) => {
    const newTask = {
      id: `t${dayNum}-0${activeTasks.filter(t => t.day_assigned === dayNum).length + 1}`,
      day_assigned: dayNum,
      day_due: dayNum + 1,
      tipo: "Dominio",
      titulo: "Nueva tarea",
      notas_opcionales: ""
    };

    const updated = [...activeTasks, newTask];
    if (activeCourse === 's2') setTareasS2(updated);
    else setTareasS4(updated);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const payload = {
        s2: tareasS2,
        s4: tareasS4
      };
      await setDoc(doc(db, 'curriculum_tracks', 'tareas_master'), payload);
      alert("¡Tareas guardadas exitosamente!");
    } catch (error) {
      console.error("Error saving tareas:", error);
      alert("Error al guardar tareas.");
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) {
    return <div className="p-12 text-center text-slate-400 font-bold uppercase tracking-widest animate-pulse">Cargando Tareas Hub...</div>;
  }

  return (
    <div className="min-h-screen bg-black text-white p-4 sm:p-8 font-sans">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* HEADER WITH DEBUG STATUS */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-neutral-800 pb-6 gap-4">
          <div>
            <h1 className="text-3xl font-black tracking-tight text-white flex items-center gap-3">
              TAREAS <span className="text-cyan-400">HUB</span>
            </h1>
            <p className="text-xs font-mono text-neutral-400 mt-1 uppercase tracking-wider">
              {debugStatus}
            </p>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="flex bg-neutral-900 border border-neutral-800 p-1 rounded-xl">
              <button 
                onClick={() => setActiveCourse('s2')}
                className={`px-6 py-2 rounded-lg font-black text-xs uppercase tracking-widest transition-all ${activeCourse === 's2' ? 'bg-neutral-800 text-white shadow' : 'text-neutral-400 hover:text-white'}`}
              >
                Spanish 2
              </button>
              <button 
                onClick={() => setActiveCourse('s4')}
                className={`px-6 py-2 rounded-lg font-black text-xs uppercase tracking-widest transition-all ${activeCourse === 's4' ? 'bg-cyan-400 text-black shadow' : 'text-neutral-400 hover:text-white'}`}
              >
                Spanish 4
              </button>
            </div>
            
            <button 
              onClick={handleSave}
              disabled={isSaving}
              className="bg-neutral-900 hover:bg-neutral-800 text-white border border-neutral-700 px-6 py-3 rounded-xl font-black uppercase tracking-widest text-xs transition-colors disabled:opacity-50 shadow"
            >
              {isSaving ? 'Guardando...' : 'Guardar Cambios'}
            </button>
          </div>
        </div>

        {/* DAY-BY-DAY SEQUENCING LIST */}
        <div className="space-y-4">
          {Array.from({ length: MAX_DAYS }, (_, i) => i + 1).map((dayNum) => {
            const dayTasks = activeTasks.filter(t => t.day_assigned === dayNum);
            const dateStrings = calendarMap[dayNum] || [];
            const dateDisplay = dateStrings.length > 0 ? dateStrings.join(' & ') : 'Date TBD';
            const dueCalendarDates = calendarMap[dayNum + 1] ? calendarMap[dayNum + 1].join(' & ') : 'Date TBD';

            return (
              <div key={dayNum} className="bg-neutral-900/60 border border-neutral-800 rounded-2xl p-5 flex flex-col md:flex-row gap-6 items-center shadow-sm">
                
                {/* ASSIGNED DAY BADGE */}
                <div className="w-32 shrink-0 text-center md:border-r md:border-neutral-800 md:pr-6">
                  <span className="text-[10px] font-black uppercase tracking-widest text-neutral-500 block">Assigned Día</span>
                  <div className="text-3xl font-black text-white">{dayNum}</div>
                  <span className="text-[10px] font-mono text-cyan-400 mt-1 block leading-tight">
                    {dateDisplay}
                  </span>
                </div>

                {/* TASK CARDS CONTAINER */}
                <div className="flex-1 space-y-4 w-full">
                  {dayTasks.length === 0 ? (
                    <div className="flex justify-between items-center py-2">
                      <span className="text-xs text-neutral-600 italic">No hay tareas asignadas este día.</span>
                      <button 
                        onClick={() => handleCreateTask(dayNum)}
                        className="bg-neutral-800 hover:bg-neutral-700 text-neutral-300 border border-neutral-700 px-3 py-1.5 rounded-lg font-bold text-xs uppercase tracking-wider transition-colors"
                      >
                        + Añadir Tarea
                      </button>
                    </div>
                  ) : (
                    dayTasks.map((task) => {
                      const globalIndex = activeTasks.findIndex(t => t.id === task.id);
                      return (
                        <div key={task.id} className="bg-neutral-950 border border-neutral-800 p-4 rounded-xl space-y-3 relative group">
                          
                          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
                            
                            {/* TASK TYPE BUTTONS */}
                            <div className="flex flex-wrap gap-1.5 items-center max-w-xl">
                              <span className="text-[9px] font-black uppercase tracking-wider text-neutral-500 mr-1">Tipo:</span>
                              {TASK_TYPES.map((typeOption) => (
                                <button
                                  key={typeOption}
                                  type="button"
                                  onClick={() => handleTaskChange(globalIndex, 'tipo', typeOption)}
                                  className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider transition-all ${
                                    task.tipo === typeOption 
                                      ? 'bg-cyan-400 text-black shadow-sm font-black' 
                                      : 'bg-neutral-900 text-neutral-400 hover:bg-neutral-800 border border-neutral-800'
                                  }`}
                                >
                                  {typeOption}
                                </button>
                              ))}
                              <input 
                                type="text"
                                value={TASK_TYPES.includes(task.tipo) ? '' : task.tipo}
                                placeholder="Otro..."
                                onChange={(e) => handleTaskChange(globalIndex, 'tipo', e.target.value)}
                                className="bg-neutral-900 border border-neutral-800 text-white rounded px-2 py-0.5 text-[10px] w-20 outline-none focus:border-cyan-400"
                              />
                            </div>

                            {/* ID & DELETE */}
                            <div className="flex items-center gap-3 self-end sm:self-auto">
                              <span className="text-[10px] font-mono text-neutral-600">{task.id}</span>
                              <button 
                                onClick={() => {
                                  const updated = activeTasks.filter(t => t.id !== task.id);
                                  if (activeCourse === 's2') setTareasS2(updated);
                                  else setTareasS4(updated);
                                }}
                                className="text-neutral-500 hover:text-rose-500 transition-colors p-1"
                                title="Eliminar tarea"
                              >
                                ✕
                              </button>
                            </div>

                          </div>

                          {/* TITLE & DUE DATE CONTROLS */}
                          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center pt-1">
                            <div className="md:col-span-8">
                              <input 
                                type="text" 
                                value={task.titulo} 
                                onChange={(e) => handleTaskChange(globalIndex, 'titulo', e.target.value)}
                                className="w-full bg-neutral-900 border border-neutral-800 focus:border-cyan-400 rounded-lg p-2 text-sm font-bold text-white outline-none transition-all"
                                placeholder="Título o descripción de la tarea..."
                              />
                            </div>

                            <div className="md:col-span-4 flex items-center justify-between md:justify-end gap-3 bg-neutral-900/50 p-2 rounded-lg border border-neutral-800">
                              <div className="text-right">
                                <span className="text-[10px] font-black uppercase tracking-wider text-neutral-400 block">Due Day</span>
                                <span className="text-[10px] font-mono text-emerald-400">📅 {dueCalendarDates}</span>
                              </div>
                              <input 
                                type="number" 
                                value={task.day_due} 
                                onChange={(e) => handleTaskChange(globalIndex, 'day_due', e.target.value)}
                                className="w-14 bg-black border border-neutral-700 text-cyan-400 text-center font-black rounded-md p-1.5 text-xs outline-none"
                              />
                            </div>
                          </div>

                        </div>
                      );
                    })
                  )}

                  {dayTasks.length > 0 && (
                    <button 
                      onClick={() => handleCreateTask(dayNum)}
                      className="bg-neutral-900 hover:bg-neutral-800 text-neutral-400 border border-neutral-800 px-3 py-1.5 rounded-xl font-bold text-xs uppercase tracking-wider transition-colors"
                    >
                      + Añadir otra tarea para Día {dayNum}
                    </button>
                  )}
                </div>

              </div>
            );
          })}
        </div>

      </div>
    </div>
  );
};

export default TareasSequencer;