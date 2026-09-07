import React, { useState, useEffect } from 'react';
import { doc, getDoc, collection, getDocs } from 'firebase/firestore';
import { db } from '../../../firebase'; 
import { Link } from 'react-router-dom';

const DailyPlanHub = () => {
  const [selectedDay, setSelectedDay] = useState(1);
  const [activeCourse, setActiveCourse] = useState('s2');
  const [loading, setLoading] = useState(true);

  // Master Data States
  const [calendarMap, setCalendarMap] = useState({});
  const [tareasS2, setTareasS2] = useState([]);
  const [tareasS4, setTareasS4] = useState([]);
  const [evaluacionesS2, setEvaluacionesS2] = useState([]);
  const [evaluacionesS4, setEvaluacionesS4] = useState([]);
  const [gramaticaS2, setGramaticaS2] = useState([]);
  const [gramaticaS4, setGramaticaS4] = useState([]);
  const [allDestacados, setAllDestacados] = useState([]);
  const [allMusica, setAllMusica] = useState([]);
  const [allVideos, setAllVideos] = useState([]);
  const [allCuriosidades, setAllCuriosidades] = useState([]);
  
  // NEW: Decoupled Calentamiento States
  const [allCalentamientos, setAllCalentamientos] = useState([]); // Verbs
  const [allVocabWarmups, setAllVocabWarmups] = useState([]); // Vocab

  const MAX_DAYS = 80;

  useEffect(() => {
    const fetchHubData = async () => {
      try {
        // 1. Fetch Calendar
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
                  if (parts.length === 3) formattedDate = `${parts[1]}/${parts[2]}`;
                }
                mapping[dayNum].push(`${formattedDate}${item.ciclo ? ` (${item.ciclo})` : ''}`);
              }
            });
          }
          setCalendarMap(mapping);
        }

        // Fetch Sequences & Collections
        const [
          tareasSnap, evalsSnap, gramSnap, destSnap, musSnap, vidSnap, curSnap, calSnap, vocabWarmupSnap
        ] = await Promise.all([
          getDoc(doc(db, 'curriculum_tracks', 'tareas_master')),
          getDoc(doc(db, 'curriculum_tracks', 'evaluaciones_master')),
          getDoc(doc(db, 'curriculum_tracks', 'gramatica_master')),
          getDocs(collection(db, 'destacado_diario')),
          getDocs(collection(db, 'musica')),
          getDocs(collection(db, 'videos')),
          getDocs(collection(db, 'curiosidades')),
          getDocs(collection(db, 'calentamientos')), // Verbs
          getDocs(collection(db, 'dailyVocabWarmups')) // Vocab
        ]);

        if (tareasSnap.exists()) {
          setTareasS2(tareasSnap.data().s2 || []);
          setTareasS4(tareasSnap.data().s4 || []);
        }
        if (evalsSnap.exists()) {
          setEvaluacionesS2(evalsSnap.data().s2 || []);
          setEvaluacionesS4(evalsSnap.data().s4 || []);
        }
        if (gramSnap.exists()) {
          setGramaticaS2(gramSnap.data().s2 || []);
          setGramaticaS4(gramSnap.data().s4 || []);
        }

        setAllDestacados(destSnap.docs.map(d => ({ id: d.id, ...d.data() })));
        setAllMusica(musSnap.docs.map(d => ({ id: d.id, ...d.data() })));
        setAllVideos(vidSnap.docs.map(d => ({ id: d.id, ...d.data() })));
        setAllCuriosidades(curSnap.docs.map(d => ({ id: d.id, ...d.data() })));
        setAllCalentamientos(calSnap.docs.map(d => ({ id: d.id, ...d.data() })));
        setAllVocabWarmups(vocabWarmupSnap.docs.map(d => ({ id: d.id, ...d.data() })));

      } catch (error) {
        console.error('Error loading Daily Hub data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchHubData();
  }, []);

  // --- LOCAL FILTERING ---
  const activeTareas = (activeCourse === 's2' ? tareasS2 : tareasS4).filter(t => t.day_assigned === selectedDay);
  const activeEvaluaciones = (activeCourse === 's2' ? evaluacionesS2 : evaluacionesS4).filter(e => e.dia === selectedDay && e.label && e.label !== 'Nada');
  const activeGramatica = (activeCourse === 's2' ? gramaticaS2 : gramaticaS4).filter(g => g.dia === selectedDay);
  
  const activeDestacados = allDestacados.filter(d => Number(d.dia) === selectedDay);
  const activeMusica = allMusica.filter(m => m.dias && m.dias.includes(selectedDay));
  const activeVideos = allVideos.filter(v => Number(v.dia) === selectedDay);
  
  // NEW: Filter BOTH Verbs and Vocab by Course and Day
  const activeCalentamientosVerbs = allCalentamientos.filter(c => c.course === activeCourse && Number(c.dia) === selectedDay);
  const activeCalentamientosVocab = allVocabWarmups.filter(v => v.course === activeCourse && Number(v.dia) === selectedDay);

  const activeCuriosidades = allCuriosidades.filter(c => {
    if (activeCourse === 's2') return c.s2_dia === selectedDay;
    if (activeCourse === 's4') return c.s4_dia === selectedDay;
    return false;
  });

  const dateStrings = calendarMap[selectedDay] || [];
  const activeDatesDisplay = dateStrings.length > 0 ? dateStrings.join(' & ') : 'Date TBD';

  if (loading) {
    return <div className="p-12 text-center text-slate-400 font-bold uppercase tracking-widest animate-pulse">Cargando Plan Diario...</div>;
  }

  return (
    <div className="min-h-screen bg-black text-white p-4 sm:p-8 font-sans">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* X-RAY DIAGNOSTIC BAR */}
        <div className="bg-neutral-900 border border-neutral-700 p-3 rounded-lg flex flex-wrap gap-4 text-[10px] font-mono uppercase tracking-widest text-neutral-400 items-center">
          <span className="font-bold text-amber-500">Diagnostic X-Ray:</span>
          <span>Gramática S2: {gramaticaS2.length}</span>
          <span>Tareas S2: {tareasS2.length}</span>
          <span>Evals S2: {evaluacionesS2.length}</span>
          <span>Destacados: {allDestacados.length}</span>
          <span>Calentamientos (V/Voc): {allCalentamientos.length}/{allVocabWarmups.length}</span>
          <span>Música: {allMusica.length}</span>
          <span>Videos: {allVideos.length}</span>
          <span>Curiosidades: {allCuriosidades.length}</span>
        </div>

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
            <div className="flex bg-neutral-900 border border-neutral-800 p-1 rounded-xl">
              <button
                onClick={() => setActiveCourse('s2')}
                className={`px-6 py-2 rounded-lg font-black text-xs uppercase tracking-widest transition-all ${activeCourse === 's2' ? 'bg-neutral-800 text-white shadow' : 'text-neutral-500 hover:text-white'}`}
              >
                Spanish 2
              </button>
              <button
                onClick={() => setActiveCourse('s4')}
                className={`px-6 py-2 rounded-lg font-black text-xs uppercase tracking-widest transition-all ${activeCourse === 's4' ? 'bg-cyan-400 text-black shadow' : 'text-neutral-500 hover:text-white'}`}
              >
                Spanish 4
              </button>
            </div>

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
                  <option key={d} value={d} className="bg-neutral-900">Día {d}</option>
                ))}
              </select>
              <button
                onClick={() => setSelectedDay(Math.min(MAX_DAYS, selectedDay + 1))}
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
            
            {/* Destacado Diario */}
            <div className="bg-neutral-900/60 border border-neutral-800 rounded-2xl p-5 shadow-sm group">
              <div className="border-b border-neutral-800 pb-3 mb-4 flex justify-between items-center">
                <h2 className="font-black text-lg text-rose-400 flex items-center gap-2">🔥 Destacado Diario</h2>
                <Link to="/admin-daily-plan-destacado" className="opacity-0 group-hover:opacity-100 transition-opacity bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-bold px-3 py-1.5 rounded-lg border border-neutral-700">⚙️ Editar</Link>
              </div>
              <div className="space-y-4">
                {activeDestacados.length === 0 ? (
                  <p className="text-neutral-500 text-sm italic">Sin Destacado asignado.</p>
                ) : (
                  activeDestacados.map(dest => (
                    <div key={dest.id} className="bg-neutral-950 p-4 rounded-xl border border-neutral-800">
                      <span className="text-[10px] font-black uppercase text-rose-500 bg-rose-950/50 px-2 py-0.5 rounded tracking-wider block w-fit mb-2">
                        {dest.type || 'Destacado'}
                      </span>
                      <h3 className="font-bold text-white text-lg">{dest.header}</h3>
                      <p className="text-sm text-neutral-400 mt-1">{dest.location}</p>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Calentamiento (Verbos & Vocab) - NOW DECOUPLED! */}
            <div className="bg-neutral-900/60 border border-neutral-800 rounded-2xl p-5 shadow-sm group">
              <div className="border-b border-neutral-800 pb-3 mb-4 flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <h2 className="font-black text-lg text-orange-400 flex items-center gap-2">⏱️ Calentamiento</h2>
                  <span className="bg-neutral-900 text-neutral-400 text-xs font-bold px-2 py-1 rounded">
                    {activeCalentamientosVerbs.length + activeCalentamientosVocab.length}
                  </span>
                </div>
                {/* Two distinct quick links to managing each half of the Warmup */}
                <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Link to="/admin-secret-portal-calentamiento" className="bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-[10px] font-bold px-2 py-1.5 rounded border border-neutral-700 uppercase tracking-widest">⚙️ Verbos</Link>
                  <Link to="/admin-secret-portal-vocabvault" className="bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-[10px] font-bold px-2 py-1.5 rounded border border-neutral-700 uppercase tracking-widest">⚙️ Vocab</Link>
                </div>
              </div>
              
              <div className="space-y-4">
                {activeCalentamientosVerbs.length === 0 && activeCalentamientosVocab.length === 0 ? (
                  <p className="text-neutral-500 text-sm italic">Sin calentamiento asignado para hoy.</p>
                ) : (
                  <div className="bg-neutral-950 p-4 rounded-xl border border-orange-900/30 flex flex-col gap-4">
                    
                    {/* Render Verbs if they exist for this day */}
                    {activeCalentamientosVerbs.map(cal => (
                      <div key={`verb-${cal.id}`} className="flex justify-between items-center border-b border-neutral-800 pb-3">
                        <div>
                          <p className="text-[10px] font-black uppercase text-orange-500 bg-orange-950/50 px-2 py-0.5 rounded tracking-wider block w-fit mb-1">
                            Sección: Verbos
                          </p>
                          <h3 className="font-bold text-white text-md">{cal.title}</h3>
                        </div>
                        <div className="text-right">
                          <span className="text-xs font-mono text-neutral-500">{cal.bakedQuestions?.length || 0} Preguntas</span>
                        </div>
                      </div>
                    ))}

                    {/* Render Vocab if it exists for this day */}
                    {activeCalentamientosVocab.map(voc => (
                      <div key={`voc-${voc.id}`} className="flex justify-between items-center">
                        <div>
                          <p className="text-[10px] font-black uppercase text-sky-500 bg-sky-950/50 px-2 py-0.5 rounded tracking-wider block w-fit mb-1">
                            Sección: Vocabulario
                          </p>
                          <h3 className="font-bold text-white text-md">{voc.name}</h3>
                        </div>
                        <div className="text-right">
                          <span className="text-xs font-mono text-neutral-500">{voc.sequence?.length || 0} Términos</span>
                        </div>
                      </div>
                    ))}
                    
                  </div>
                )}
              </div>
            </div>

            {/* Gramática */}
            <div className="bg-neutral-900/60 border border-neutral-800 rounded-2xl p-5 shadow-sm min-h-[150px] group">
              <div className="border-b border-neutral-800 pb-3 mb-4 flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <h2 className="font-black text-lg text-emerald-400 flex items-center gap-2">📚 Gramática & Lección</h2>
                  <span className="bg-neutral-900 text-neutral-400 text-xs font-bold px-2 py-1 rounded">{activeGramatica.length}</span>
                </div>
                <Link to="/admin-daily-plan-gramatica" className="opacity-0 group-hover:opacity-100 transition-opacity bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-bold px-3 py-1.5 rounded-lg border border-neutral-700">⚙️ Sequencer</Link>
              </div>
              <div className="space-y-4">
                {activeGramatica.length === 0 ? (
                  <p className="text-neutral-500 text-sm italic">Sin lección de gramática asignada.</p>
                ) : (
                  activeGramatica.map((gram, idx) => (
                    <div key={idx} className="bg-neutral-950 p-4 rounded-xl border border-emerald-900/30 flex flex-col gap-3">
                      {gram.introText && (
                        <div>
                          <span className="text-[10px] font-black uppercase text-emerald-500 bg-emerald-950/50 px-2 py-0.5 rounded tracking-wider mb-1 inline-block">Introducir</span>
                          <p className="text-sm text-white leading-relaxed">{gram.introText}</p>
                        </div>
                      )}
                      {gram.repasoText && (
                        <div>
                          <span className="text-[10px] font-black uppercase text-sky-500 bg-sky-950/50 px-2 py-0.5 rounded tracking-wider mb-1 inline-block">Repasar</span>
                          <p className="text-sm text-white leading-relaxed">{gram.repasoText}</p>
                        </div>
                      )}
                      {(gram.enlaces || gram.recursos) && (
                        <div className="flex flex-wrap gap-4 mt-2 pt-3 border-t border-neutral-800">
                          {gram.enlaces && (
                            <p className="text-xs font-mono text-indigo-400"><span className="text-neutral-500">Enlaces:</span> {gram.enlaces}</p>
                          )}
                          {gram.recursos && (
                            <p className="text-xs font-mono text-emerald-400"><span className="text-neutral-500">Recursos:</span> {gram.recursos}</p>
                          )}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
            
            {/* Media (Música & Videos) */}
            <div className="bg-neutral-900/60 border border-neutral-800 rounded-2xl p-5 shadow-sm group">
              <div className="border-b border-neutral-800 pb-3 mb-4 flex justify-between items-center">
                <h2 className="font-black text-lg text-purple-400 flex items-center gap-2">🎧 Música & Videos</h2>
                <Link to="/admin-daily-plan-videos" className="opacity-0 group-hover:opacity-100 transition-opacity bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-bold px-3 py-1.5 rounded-lg border border-neutral-700">⚙️ Manager</Link>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {activeMusica.map(m => (
                  <div key={m.id} className="bg-neutral-950 p-3 rounded-xl border border-purple-900/30 flex gap-3 items-center">
                    <div className="w-12 h-12 bg-purple-900/20 rounded flex items-center justify-center shrink-0">🎵</div>
                    <div>
                      <p className="font-bold text-sm text-white">{m.titulo}</p>
                      <p className="text-[10px] text-purple-400 uppercase tracking-widest">{m.artista}</p>
                    </div>
                  </div>
                ))}
                {activeVideos.map(v => (
                  <div key={v.id} className="bg-neutral-950 p-3 rounded-xl border border-purple-900/30 flex gap-3 items-center">
                    <div className="w-12 h-12 bg-purple-900/20 rounded flex items-center justify-center shrink-0 overflow-hidden">
                      {v.thumbnail_url ? <img src={v.thumbnail_url} alt="thumb" className="w-full h-full object-cover" /> : '🎬'}
                    </div>
                    <div>
                      <p className="font-bold text-sm text-white truncate w-32">{v.titulo}</p>
                      <p className="text-[10px] text-purple-400 uppercase tracking-widest">Video {v.is_short ? '(Short)' : ''}</p>
                    </div>
                  </div>
                ))}
                {activeMusica.length === 0 && activeVideos.length === 0 && (
                  <p className="text-neutral-500 text-sm italic col-span-2">Sin multimedia asignada.</p>
                )}
              </div>
            </div>

          </div>

          {/* RIGHT COLUMN: Tasks, Culture & Assessments */}
          <div className="space-y-6">
            
            {/* Evaluaciones */}
            <div className="bg-amber-950/20 border border-amber-900/30 rounded-2xl p-5 shadow-sm group">
              <div className="border-b border-amber-900/50 pb-3 mb-4 flex justify-between items-center">
                <h2 className="font-black text-lg text-amber-400 flex items-center gap-2">🎯 Evaluaciones</h2>
                <Link to="/admin-daily-plan-evals" className="opacity-0 group-hover:opacity-100 transition-opacity bg-amber-900/40 hover:bg-amber-900/80 text-amber-300 text-xs font-bold px-3 py-1.5 rounded-lg border border-amber-700/50">⚙️ Sequencer</Link>
              </div>
              <div className="space-y-3">
                {activeEvaluaciones.length === 0 ? (
                  <p className="text-amber-900/50 text-xs italic font-bold">No hay evaluaciones programadas.</p>
                ) : (
                  activeEvaluaciones.map((evalItem, idx) => (
                    <div key={idx} className="bg-amber-500 text-black p-3 rounded-xl flex items-center gap-3 font-bold shadow-md">
                      <span className="text-xl">⚠️</span>
                      <p className="text-sm leading-tight">{evalItem.label}</p>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Curiosidades */}
            <div className="bg-neutral-900/60 border border-neutral-800 rounded-2xl p-5 shadow-sm group">
              <div className="border-b border-neutral-800 pb-3 mb-4 flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <h2 className="font-black text-lg text-yellow-400 flex items-center gap-2">💡 Curiosidades</h2>
                  <span className="bg-neutral-900 text-neutral-400 text-xs font-bold px-2 py-1 rounded">{activeCuriosidades.length}</span>
                </div>
                <Link to="/admin-daily-plan-curiosidades" className="opacity-0 group-hover:opacity-100 transition-opacity bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-bold px-3 py-1.5 rounded-lg border border-neutral-700">⚙️ Manager</Link>
              </div>
              <div className="space-y-4">
                {activeCuriosidades.length === 0 ? (
                  <p className="text-neutral-500 text-xs italic">No hay curiosidades para este día.</p>
                ) : (
                  activeCuriosidades.map(cur => (
                    <div key={cur.id} className="bg-neutral-950 p-3 rounded-xl border border-neutral-800 flex gap-3">
                      <div className="w-16 h-16 bg-neutral-900 rounded-lg overflow-hidden shrink-0">
                        {cur.img ? <img src={cur.img} alt={cur.title} className="w-full h-full object-cover" /> : '💡'}
                      </div>
                      <div className="flex flex-col justify-center">
                        <p className="text-sm font-bold text-white leading-tight">{cur.title}</p>
                        {cur.teacher_notes && (
                          <p className="text-[10px] text-yellow-500 font-mono mt-1 border-l-2 border-yellow-500 pl-1">{cur.teacher_notes}</p>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Tareas */}
            <div className="bg-neutral-950 border border-cyan-900/30 rounded-2xl p-5 shadow-sm group">
              <div className="border-b border-neutral-800 pb-3 mb-4 flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <h2 className="font-black text-lg text-cyan-400 flex items-center gap-2">📝 Tareas Asignadas</h2>
                  <span className="bg-neutral-900 text-neutral-400 text-xs font-bold px-2 py-1 rounded">{activeTareas.length}</span>
                </div>
                <Link to="/admin-daily-plan-tareas" className="opacity-0 group-hover:opacity-100 transition-opacity bg-neutral-800 hover:bg-neutral-700 text-cyan-300 text-xs font-bold px-3 py-1.5 rounded-lg border border-neutral-700">⚙️ Sequencer</Link>
              </div>
              <div className="space-y-3">
                {activeTareas.length === 0 ? (
                  <p className="text-neutral-500 text-xs italic">No hay tareas para este día.</p>
                ) : (
                  activeTareas.map(tarea => (
                    <div key={tarea.id} className="bg-neutral-900 border border-neutral-800 p-3 rounded-xl flex flex-col gap-2">
                      <div className="flex justify-between items-start">
                        <span className="text-[10px] font-black uppercase tracking-wider bg-cyan-900/50 text-cyan-300 px-2 py-0.5 rounded">
                          {tarea.tipo}
                        </span>
                        <span className="text-[10px] text-neutral-500 font-mono">Due: Día {tarea.day_due}</span>
                      </div>
                      <p className="text-sm font-bold text-white">{tarea.titulo}</p>
                    </div>
                  ))
                )}
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
};

export default DailyPlanHub;