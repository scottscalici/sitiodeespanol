import React, { useState, useEffect } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../../firebase'; // Using the fixed import path

const DailyPlanHub = () => {
  const [selectedDay, setSelectedDay] = useState(1);
  const [activeCourse, setActiveCourse] = useState('s2');
  const [loading, setLoading] = useState(true);

  // Data States
  const [calendarMap, setCalendarMap] = useState({});
  const [tareasS2, setTareasS2] = useState([]);
  const [tareasS4, setTareasS4] = useState([]);

  // Future Track States (Placeholders for now)
  const [gramatica, setGramatica] = useState([]);
  const [evaluaciones, setEvaluaciones] = useState([]);
  const [curiosidades, setCuriosidades] = useState([]);
  const [media, setMedia] = useState([]);

  const MAX_DAYS = 80;

  useEffect(() => {
    const fetchHubData = async () => {
      try {
        // 1. Fetch 2026-2027 Calendar
        const configRef = doc(db, 'config', 'academic_year_2026_2027');
        const configSnap = await getDoc(configRef);

        if (configSnap.exists()) {
          const configData = configSnap.data();
          const mapping = {};

          if (configData.map && Array.isArray(configData.map)) {
            configData.map.forEach((item) => {
              if (item.dia !== null && item.dia !== undefined) {
                const dayNum = Number(item.dia);
                if (!mapping[dayNum]) mapping[dayNum] = [];

                let formattedDate = item.fecha;
                if (item.fecha && item.fecha.includes('-')) {
                  const parts = item.fecha.split('-');
                  if (parts.length === 3)
                    formattedDate = `${parts[1]}/${parts[2]}`;
                }
                mapping[dayNum].push(
                  `${formattedDate}${item.ciclo ? ` (${item.ciclo})` : ''}`
                );
              }
            });
          }
          setCalendarMap(mapping);
        }

        // 2. Fetch Tareas Master
        const tareasRef = doc(db, 'curriculum_tracks', 'tareas_master');
        const tareasSnap = await getDoc(tareasRef);
        if (tareasSnap.exists()) {
          const tData = tareasSnap.data();
          setTareasS2(tData.s2 || []);
          setTareasS4(tData.s4 || []);
        }

        // Future: Fetch Gramática, Evaluaciones, Curiosidades here...
      } catch (error) {
        console.error('Error loading Daily Hub data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchHubData();
  }, []);

  // Filter data for the active day and course
  const activeTareas = (activeCourse === 's2' ? tareasS2 : tareasS4).filter(
    (t) => t.day_assigned === selectedDay
  );

  // Get calendar dates for the selected day
  const dateStrings = calendarMap[selectedDay] || [];
  const activeDatesDisplay =
    dateStrings.length > 0 ? dateStrings.join(' & ') : 'Date TBD';

  if (loading) {
    return (
      <div className="p-12 text-center text-slate-400 font-bold uppercase tracking-widest animate-pulse">
        Cargando Plan Diario...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white p-4 sm:p-8 font-sans">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* HEADER & CONTROLS */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-neutral-800 pb-6 gap-6">
          <div>
            <h1 className="text-3xl font-black tracking-tight text-white flex items-center gap-3">
              DAILY PLAN <span className="text-cyan-400">HUB</span>
            </h1>
            <p className="text-sm font-mono text-emerald-400 mt-2 font-bold bg-neutral-900 inline-block px-3 py-1 rounded border border-neutral-800">
              📅 {activeDatesDisplay}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            {/* Course Toggle */}
            <div className="flex bg-neutral-900 border border-neutral-800 p-1 rounded-xl">
              <button
                onClick={() => setActiveCourse('s2')}
                className={`px-6 py-2 rounded-lg font-black text-xs uppercase tracking-widest transition-all ${
                  activeCourse === 's2'
                    ? 'bg-neutral-800 text-white shadow'
                    : 'text-neutral-500 hover:text-white'
                }`}
              >
                Spanish 2
              </button>
              <button
                onClick={() => setActiveCourse('s4')}
                className={`px-6 py-2 rounded-lg font-black text-xs uppercase tracking-widest transition-all ${
                  activeCourse === 's4'
                    ? 'bg-cyan-400 text-black shadow'
                    : 'text-neutral-500 hover:text-white'
                }`}
              >
                Spanish 4
              </button>
            </div>

            {/* Day Selector */}
            <div className="flex items-center gap-3 bg-neutral-900 border border-neutral-800 p-2 rounded-xl">
              <button
                onClick={() => setSelectedDay(Math.max(1, selectedDay - 1))}
                className="w-8 h-8 flex items-center justify-center bg-neutral-800 hover:bg-neutral-700 rounded text-neutral-400 font-bold"
              >
                -
              </button>
              <select
                value={selectedDay}
                onChange={(e) => setSelectedDay(Number(e.target.value))}
                className="bg-transparent text-white font-black text-lg outline-none cursor-pointer appearance-none text-center"
              >
                {Array.from({ length: MAX_DAYS }, (_, i) => i + 1).map((d) => (
                  <option key={d} value={d} className="bg-neutral-900">
                    Día {d}
                  </option>
                ))}
              </select>
              <button
                onClick={() =>
                  setSelectedDay(Math.min(MAX_DAYS, selectedDay + 1))
                }
                className="w-8 h-8 flex items-center justify-center bg-neutral-800 hover:bg-neutral-700 rounded text-neutral-400 font-bold"
              >
                +
              </button>
            </div>
          </div>
        </div>

        {/* DASHBOARD GRID */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* LEFT COLUMN: The Core Lesson */}
          <div className="lg:col-span-2 space-y-6">
            {/* Calentamiento / Destacado */}
            <div className="bg-neutral-900/60 border border-neutral-800 rounded-2xl p-5 shadow-sm">
              <div className="border-b border-neutral-800 pb-3 mb-4 flex justify-between items-center">
                <h2 className="font-black text-lg text-rose-400 flex items-center gap-2">
                  🔥 Calentamiento & Destacado
                </h2>
              </div>
              <div className="text-neutral-500 text-sm italic">
                Pendiente: Sincronizar con destacado_diario...
              </div>
            </div>

            {/* Gramática */}
            <div className="bg-neutral-900/60 border border-neutral-800 rounded-2xl p-5 shadow-sm min-h-[200px]">
              <div className="border-b border-neutral-800 pb-3 mb-4 flex justify-between items-center">
                <h2 className="font-black text-lg text-emerald-400 flex items-center gap-2">
                  📚 Gramática & Lección
                </h2>
              </div>
              <div className="text-neutral-500 text-sm italic">
                Pendiente: Sincronizar con gramatica_master...
              </div>
            </div>

            {/* Media (Música & Videos) */}
            <div className="bg-neutral-900/60 border border-neutral-800 rounded-2xl p-5 shadow-sm">
              <div className="border-b border-neutral-800 pb-3 mb-4 flex justify-between items-center">
                <h2 className="font-black text-lg text-purple-400 flex items-center gap-2">
                  🎧 Música & Videos
                </h2>
              </div>
              <div className="text-neutral-500 text-sm italic">
                Pendiente: Sincronizar tracks de Bad Bunny y medios...
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN: Tasks, Culture & Assessments */}
          <div className="space-y-6">
            {/* Tareas (Live Connected) */}
            <div className="bg-neutral-950 border border-cyan-900/30 rounded-2xl p-5 shadow-sm">
              <div className="border-b border-neutral-800 pb-3 mb-4 flex justify-between items-center">
                <h2 className="font-black text-lg text-cyan-400 flex items-center gap-2">
                  📝 Tareas Asignadas
                </h2>
                <span className="bg-neutral-900 text-neutral-400 text-xs font-bold px-2 py-1 rounded">
                  {activeTareas.length}
                </span>
              </div>

              <div className="space-y-3">
                {activeTareas.length === 0 ? (
                  <p className="text-neutral-500 text-xs italic">
                    No hay tareas para este día.
                  </p>
                ) : (
                  activeTareas.map((tarea) => (
                    <div
                      key={tarea.id}
                      className="bg-neutral-900 border border-neutral-800 p-3 rounded-xl flex flex-col gap-2"
                    >
                      <div className="flex justify-between items-start">
                        <span className="text-[10px] font-black uppercase tracking-wider bg-cyan-900/50 text-cyan-300 px-2 py-0.5 rounded">
                          {tarea.tipo}
                        </span>
                        <span className="text-[10px] text-neutral-500 font-mono">
                          Due: Día {tarea.day_due}
                        </span>
                      </div>
                      <p className="text-sm font-bold text-white">
                        {tarea.titulo}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Evaluaciones */}
            <div className="bg-neutral-900/60 border border-neutral-800 rounded-2xl p-5 shadow-sm">
              <div className="border-b border-neutral-800 pb-3 mb-4 flex justify-between items-center">
                <h2 className="font-black text-lg text-amber-400 flex items-center gap-2">
                  🎯 Evaluaciones
                </h2>
              </div>
              <div className="text-neutral-500 text-sm italic">
                Pendiente: Sincronizar con evaluaciones_master...
              </div>
            </div>

            {/* Curiosidades */}
            <div className="bg-neutral-900/60 border border-neutral-800 rounded-2xl p-5 shadow-sm">
              <div className="border-b border-neutral-800 pb-3 mb-4 flex justify-between items-center">
                <h2 className="font-black text-lg text-yellow-400 flex items-center gap-2">
                  💡 Curiosidades
                </h2>
              </div>
              <div className="text-neutral-500 text-sm italic">
                Pendiente: Sincronizar datos (ej. Detroit Tigers)...
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DailyPlanHub;
