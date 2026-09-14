import React, { useState, useEffect } from 'react';
import { doc, getDoc, setDoc, collection, getDocs } from 'firebase/firestore';
import { db } from '../../../firebase';

const LecturasSequencer = () => {
  const [course, setCourse] = useState('ib'); // Usually IB, but supports s2/s4 if needed
  const [startDay, setStartDay] = useState('');
  const [endDay, setEndDay] = useState('');
  
  // Available readings fetched from Firestore 'lecturas' collection
  const [availableLecturas, setAvailableLecturas] = useState([]);
  const [selectedLecturas, setSelectedLecturas] = useState([]);
  
  // Master schedule state
  const [masterSchedule, setMasterSchedule] = useState({ ib: {}, s2: {}, s4: {} });
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);

  // 1. Fetch Master Schedule and Available Readings
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const masterRef = doc(db, 'curriculum_tracks', 'lecturas_master');
        const masterSnap = await getDoc(masterRef);
        
        if (masterSnap.exists()) {
          const data = masterSnap.data();
          setMasterSchedule({
            ib: data.ib || {},
            s2: data.s2 || {},
            s4: data.s4 || {}
          });
        }

        // Fetch reading documents from 'lecturas' collection
        const lecturasRef = collection(db, 'lecturas');
        const lecturasSnap = await getDocs(lecturasRef);
        const loadedLecturas = lecturasSnap.docs.map(d => ({
          id: d.id,
          subtitulo: d.data().subtitulo || 'Sin Título',
          testId: d.data().test_id || 'Examen',
          textId: d.data().text_id || 'A'
        }));
        
        setAvailableLecturas(loadedLecturas);
      } catch (error) {
        console.error("Error fetching lecturas sequencer data:", error);
        setStatus('Error al cargar datos.');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // 2. Handle Checkbox Toggles
  const handleToggleLectura = (lecturaId) => {
    setSelectedLecturas(prev => {
      if (prev.includes(lecturaId)) {
        return prev.filter(id => id !== lecturaId);
      } else {
        return [...prev, lecturaId];
      }
    });
  };

  // 3. Save to Firebase
  const handleSave = async (e) => {
    e.preventDefault();
    setStatus('');

    const start = parseInt(startDay);
    const end = parseInt(endDay);

    if (!start || !end || start > end) {
      setStatus('Error: Rango de días inválido.');
      return;
    }

    const updatedCourseSchedule = { ...masterSchedule[course] };

    for (let i = start; i <= end; i++) {
      if (selectedLecturas.length === 0) {
        delete updatedCourseSchedule[i.toString()];
      } else {
        updatedCourseSchedule[i.toString()] = [...selectedLecturas];
      }
    }

    const updatedMaster = {
      ...masterSchedule,
      [course]: updatedCourseSchedule
    };

    try {
      setStatus('Guardando...');
      const masterRef = doc(db, 'curriculum_tracks', 'lecturas_master');
      await setDoc(masterRef, updatedMaster, { merge: true });
      
      setMasterSchedule(updatedMaster);
      setStatus(`¡Éxito! Lecturas actualizadas del Día ${start} al ${end}.`);
      setStartDay('');
      setEndDay('');
      setSelectedLecturas([]);
    } catch (error) {
      console.error("Error saving lecturas schedule:", error);
      setStatus('Error al guardar en Firebase.');
    }
  };

  if (loading) {
    return <div className="text-white text-center p-10 font-bold animate-pulse uppercase tracking-widest">Cargando Lecturas Sequencer...</div>;
  }

  return (
    <div className="max-w-6xl mx-auto p-6 text-white font-sans grid grid-cols-1 lg:grid-cols-2 gap-8">
      
      {/* LEFT COLUMN: CONTROLS */}
      <div className="bg-slate-800 p-8 rounded-2xl border border-slate-700 shadow-xl h-fit">
        <h2 className="text-2xl font-black uppercase tracking-widest text-cyan-400 mb-6 flex items-center gap-3">
          <span>📄</span> Lecturas Sequencer
        </h2>

        <form onSubmit={handleSave} className="space-y-6">
          {/* Course Selector */}
          <div className="flex gap-4">
            {['ib', 's2', 's4'].map((cOption) => (
              <label key={cOption} className="flex-1 cursor-pointer">
                <input type="radio" name="course" value={cOption} checked={course === cOption} onChange={(e) => setCourse(e.target.value)} className="peer sr-only" />
                <div className="text-center py-3 bg-slate-900 border border-slate-700 rounded-xl text-slate-400 font-bold peer-checked:bg-cyan-600 peer-checked:text-white transition-all uppercase tracking-widest text-xs">
                  {cOption.toUpperCase()}
                </div>
              </label>
            ))}
          </div>

          {/* Day Range */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Día Inicial</label>
              <input type="number" min="1" max="80" value={startDay} onChange={(e) => setStartDay(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-center font-black focus:outline-none focus:border-cyan-500 transition-colors" placeholder="Ej: 1" />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Día Final</label>
              <input type="number" min="1" max="80" value={endDay} onChange={(e) => setEndDay(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-center font-black focus:outline-none focus:border-cyan-500 transition-colors" placeholder="Ej: 5" />
            </div>
          </div>

          {/* Available Readings Checklist */}
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">
              Textos de Lectura Disponibles
            </label>
            <div className="bg-slate-900 border border-slate-700 rounded-xl p-4 max-h-[250px] overflow-y-auto space-y-2">
              {availableLecturas.length === 0 ? (
                <p className="text-xs text-slate-500 italic text-center py-4">No hay lecturas creadas todavía.</p>
              ) : (
                availableLecturas.map(lectura => (
                  <label key={lectura.id} className="flex items-center gap-3 cursor-pointer p-2 hover:bg-slate-800 rounded-lg transition-colors">
                    <input 
                      type="checkbox" 
                      checked={selectedLecturas.includes(lectura.id)}
                      onChange={() => handleToggleLectura(lectura.id)}
                      className="w-5 h-5 accent-cyan-500 rounded"
                    />
                    <div>
                      <p className="font-bold text-sm text-white">Texto {lectura.textId} — {lectura.subtitulo}</p>
                      <p className="text-[10px] text-slate-500 font-mono">{lectura.testId} ({lectura.id})</p>
                    </div>
                  </label>
                ))
              )}
            </div>
          </div>

          {status && (
            <p className={`text-xs font-bold text-center ${status.includes('Error') ? 'text-rose-400' : 'text-emerald-400'}`}>
              {status}
            </p>
          )}

          <button type="submit" className="w-full bg-cyan-600 hover:bg-cyan-500 text-white font-black uppercase tracking-widest py-4 rounded-xl transition-all shadow-lg active:scale-95">
            Guardar Secuencia de Lecturas
          </button>
        </form>
      </div>

      {/* RIGHT COLUMN: PREVIEW X-RAY */}
      <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 h-fit max-h-[800px] overflow-y-auto">
        <h3 className="text-sm font-black text-slate-500 uppercase tracking-widest border-b border-slate-800 pb-4 mb-4 sticky top-0 bg-slate-900">
          Vista Previa: Secuencia {course.toUpperCase()}
        </h3>
        <div className="space-y-2">
          {Array.from({ length: 80 }, (_, i) => i + 1).map(day => {
            const activeLecturas = masterSchedule[course]?.[day.toString()];
            if (!activeLecturas || activeLecturas.length === 0) return null;

            return (
              <div key={day} className="flex gap-4 p-3 bg-slate-800/50 rounded-xl border border-slate-700/50 items-center">
                <div className="w-12 h-12 shrink-0 bg-cyan-950 text-cyan-400 font-black rounded-lg flex items-center justify-center text-lg">
                  {day}
                </div>
                <div className="flex flex-wrap gap-2">
                  {activeLecturas.map(lId => (
                    <span key={lId} className="bg-slate-950 border border-cyan-500/30 text-slate-300 text-[10px] font-bold px-3 py-1 rounded-full shadow-sm">
                      {lId}
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

    </div>
  );
};

export default LecturasSequencer;