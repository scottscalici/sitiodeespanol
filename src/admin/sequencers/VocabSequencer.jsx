import React, { useState, useEffect } from 'react';
import { doc, getDoc, setDoc, collection, getDocs } from 'firebase/firestore';
import { db } from '../../firebase';

const VocabSequencer = () => {
  const [course, setCourse] = useState('s2');
  const [startDay, setStartDay] = useState('');
  const [endDay, setEndDay] = useState('');
  
  // Available bundles from Firestore
  const [availableBundles, setAvailableBundles] = useState([]);
  const [selectedBundles, setSelectedBundles] = useState([]);
  
  // Master schedule state
  const [masterSchedule, setMasterSchedule] = useState({ s2: {}, s4: {} });
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);

  // 1. Fetch Master Schedule and Available Bundles
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        // Fetch existing schedule
        const masterRef = doc(db, 'curriculum_tracks', 'vocab_master');
        const masterSnap = await getDoc(masterRef);
        
        if (masterSnap.exists()) {
          const data = masterSnap.data();
          setMasterSchedule({
            s2: data.s2 || {},
            s4: data.s4 || {}
          });
        }

        // Fetch bundle options (e.g., descubre_2_ch8)
        const bundlesRef = collection(db, 'vocab_bundles');
        const bundlesSnap = await getDocs(bundlesRef);
        const loadedBundles = bundlesSnap.docs.map(d => ({
          id: d.id,
          textbook: d.data().textbook || 'Libro',
          chapter: d.data().chapter || '?'
        }));
        
        // Sort bundles alphabetically for the checklist
        loadedBundles.sort((a, b) => a.id.localeCompare(b.id));
        setAvailableBundles(loadedBundles);

      } catch (error) {
        console.error("Error fetching vocab data:", error);
        setStatus('Error al cargar datos.');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // 2. Handle Checkbox Toggles
  const handleToggleBundle = (bundleId) => {
    setSelectedBundles(prev => {
      if (prev.includes(bundleId)) {
        return prev.filter(id => id !== bundleId);
      } else {
        return [...prev, bundleId];
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

    if (selectedBundles.length === 0) {
      setStatus('Advertencia: Estás borrando el vocabulario para estos días.');
    }

    // Clone the current schedule for the active course
    const updatedCourseSchedule = { ...masterSchedule[course] };

    // Apply the selected bundles array to every day in the range
    for (let i = start; i <= end; i++) {
      if (selectedBundles.length === 0) {
        delete updatedCourseSchedule[i.toString()]; // Clear the day if nothing is selected
      } else {
        updatedCourseSchedule[i.toString()] = [...selectedBundles];
      }
    }

    const updatedMaster = {
      ...masterSchedule,
      [course]: updatedCourseSchedule
    };

    try {
      setStatus('Guardando...');
      const masterRef = doc(db, 'curriculum_tracks', 'vocab_master');
      await setDoc(masterRef, updatedMaster, { merge: true });
      
      setMasterSchedule(updatedMaster);
      setStatus(`¡Éxito! Vocabulario actualizado del Día ${start} al ${end}.`);
      setStartDay('');
      setEndDay('');
      setSelectedBundles([]);
    } catch (error) {
      console.error("Error saving vocab schedule:", error);
      setStatus('Error al guardar en Firebase.');
    }
  };

  if (loading) {
    return <div className="text-white text-center p-10 font-bold animate-pulse uppercase tracking-widest">Cargando Sequencer...</div>;
  }

  return (
    <div className="max-w-6xl mx-auto p-6 text-white font-sans grid grid-cols-1 lg:grid-cols-2 gap-8">
      
      {/* LEFT COLUMN: THE CONTROLS */}
      <div className="bg-slate-800 p-8 rounded-2xl border border-slate-700 shadow-xl h-fit">
        <h2 className="text-2xl font-black uppercase tracking-widest text-indigo-400 mb-6 flex items-center gap-3">
          <span>⚙️</span> Vocab Sequencer
        </h2>

        <form onSubmit={handleSave} className="space-y-6">
          {/* Course Toggle */}
          <div className="flex gap-4">
            <label className="flex-1 cursor-pointer">
              <input type="radio" name="course" value="s2" checked={course === 's2'} onChange={(e) => setCourse(e.target.value)} className="peer sr-only" />
              <div className="text-center py-3 bg-slate-900 border border-slate-700 rounded-xl text-slate-400 font-bold peer-checked:bg-indigo-600 peer-checked:text-white transition-all uppercase tracking-widest text-xs">
                S2
              </div>
            </label>
            <label className="flex-1 cursor-pointer">
              <input type="radio" name="course" value="s4" checked={course === 's4'} onChange={(e) => setCourse(e.target.value)} className="peer sr-only" />
              <div className="text-center py-3 bg-slate-900 border border-slate-700 rounded-xl text-slate-400 font-bold peer-checked:bg-indigo-600 peer-checked:text-white transition-all uppercase tracking-widest text-xs">
                S4
              </div>
            </label>
          </div>

          {/* Day Range */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Día Inicial</label>
              <input type="number" min="1" max="80" value={startDay} onChange={(e) => setStartDay(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-center font-black focus:outline-none focus:border-indigo-500 transition-colors" placeholder="Ej: 1" />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Día Final</label>
              <input type="number" min="1" max="80" value={endDay} onChange={(e) => setEndDay(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-center font-black focus:outline-none focus:border-indigo-500 transition-colors" placeholder="Ej: 5" />
            </div>
          </div>

          {/* Bundle Checkboxes (Supports Overlaps!) */}
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">
              Capítulos Activos (Selecciona múltiples para superponer)
            </label>
            <div className="bg-slate-900 border border-slate-700 rounded-xl p-4 max-h-[250px] overflow-y-auto space-y-2">
              {availableBundles.map(bundle => (
                <label key={bundle.id} className="flex items-center gap-3 cursor-pointer p-2 hover:bg-slate-800 rounded-lg transition-colors">
                  <input 
                    type="checkbox" 
                    checked={selectedBundles.includes(bundle.id)}
                    onChange={() => handleToggleBundle(bundle.id)}
                    className="w-5 h-5 accent-indigo-500 rounded"
                  />
                  <div>
                    <p className="font-bold text-sm text-white">{bundle.textbook} • Cap. {bundle.chapter}</p>
                    <p className="text-[10px] text-slate-500 font-mono">{bundle.id}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {status && (
            <p className={`text-xs font-bold text-center ${status.includes('Error') ? 'text-rose-400' : status.includes('Advertencia') ? 'text-amber-400' : 'text-emerald-400'}`}>
              {status}
            </p>
          )}

          <button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-black uppercase tracking-widest py-4 rounded-xl transition-all shadow-lg active:scale-95">
            Guardar Secuencia
          </button>
        </form>
      </div>

      {/* RIGHT COLUMN: THE X-RAY VIEW */}
      <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 h-fit max-h-[800px] overflow-y-auto">
        <h3 className="text-sm font-black text-slate-500 uppercase tracking-widest border-b border-slate-800 pb-4 mb-4 sticky top-0 bg-slate-900">
          Vista Previa: Secuencia {course.toUpperCase()}
        </h3>
        <div className="space-y-2">
          {Array.from({ length: 80 }, (_, i) => i + 1).map(day => {
            const activeBundles = masterSchedule[course][day.toString()];
            if (!activeBundles || activeBundles.length === 0) return null;

            return (
              <div key={day} className="flex gap-4 p-3 bg-slate-800/50 rounded-xl border border-slate-700/50 items-center">
                <div className="w-12 h-12 shrink-0 bg-indigo-900/30 text-indigo-400 font-black rounded-lg flex items-center justify-center text-lg">
                  {day}
                </div>
                <div className="flex flex-wrap gap-2">
                  {activeBundles.map(bId => (
                    <span key={bId} className="bg-slate-950 border border-indigo-500/30 text-slate-300 text-[10px] font-bold px-3 py-1 rounded-full shadow-sm">
                      {bId}
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

export default VocabSequencer;