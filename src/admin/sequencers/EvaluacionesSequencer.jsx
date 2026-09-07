import React, { useState, useEffect } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';

const EvaluacionesSequencer = () => {
  const [schedule, setSchedule] = useState([]);
  const [calendarMap, setCalendarMap] = useState({});
  const [isSaving, setIsSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  // Define the max days for your semester/year
  const MAX_DAYS = 85;

  useEffect(() => {
    const fetchData = async () => {
      try {
        // 1. Fetch Calendar Dates to group both A and B days
        const configRef = doc(db, 'config', 'academic_year_2026_2027');
        const configSnap = await getDoc(configRef);
        const mapping = {};

        if (configSnap.exists()) {
          const configData = configSnap.data();
          if (configData.map && Array.isArray(configData.map)) {
            configData.map.forEach((item) => {
              if (item.dia !== null && item.dia !== undefined && item.status === 'school') {
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

        // 2. Fetch Evaluaciones Track
        const docRef = doc(db, 'curriculum_tracks', 'evaluaciones_master');
        const docSnap = await getDoc(docRef);
        const data = docSnap.exists() ? docSnap.data() : null;

        // Fallback hardcoded lists
        const defaultS2 = [
          { dia: 1, label: 'Nada' },
          { dia: 2, label: 'Presente 1' },
          { dia: 3, label: 'Nada' },
          { dia: 4, label: 'Presente 2' },
          { dia: 5, label: 'Vocabulario 8.1' },
          { dia: 6, label: 'Presente 3' },
          { dia: 7, label: 'Vocabulario 8.2' },
          { dia: 8, label: 'Presente 4' },
          { dia: 9, label: 'Vocabulario 8.3' },
          { dia: 10, label: 'Nada' },
          { dia: 11, label: 'Vocabulario 1.1' },
          { dia: 12, label: 'Pretérito 1' },
          { dia: 13, label: 'Vocabulario 1.2' },
          { dia: 14, label: 'Pretérito 2' },
          { dia: 15, label: 'Nada' },
          { dia: 16, label: 'Vocabulario 1.3' },
          { dia: 17, label: 'Pretérito 3' },
          { dia: 18, label: 'Nada' },
          { dia: 19, label: 'Pretérito 4' },
          { dia: 20, label: 'Vocabulario 1.4' },
          { dia: 21, label: 'Nada' },
          { dia: 22, label: 'Nada' },
          { dia: 23, label: 'Imperfecto' },
          { dia: 24, label: 'Nada' },
          { dia: 25, label: 'Examen de lección 1' },
          { dia: 26, label: 'Nada' },
          { dia: 27, label: 'Vocabulario 2.1' },
          { dia: 28, label: 'Mandatos informales' },
          { dia: 29, label: 'Vocabulario 2.2' },
          { dia: 30, label: 'Nada' },
          { dia: 31, label: 'Vocabulario 2.3 y Mandatos: tú negativo' },
          { dia: 32, label: 'Vocabulario 2.4' },
          { dia: 33, label: 'Mandatos: tú afirmativos y negativos' },
          { dia: 34, label: 'Examen de lección 2' },
          { dia: 35, label: 'Examen del semestre' },
          { dia: 36, label: 'Nada' },
          { dia: 37, label: 'Vocabulario 3.1' },
          { dia: 38, label: 'Mandatos formales y plurales' },
          { dia: 39, label: 'Vocabulario 3.2' },
          { dia: 40, label: 'Nada' },
          { dia: 41, label: 'Vocabulario 3.3' },
          { dia: 42, label: 'Presente de subjuntivo 1' },
          { dia: 43, label: 'Vocabulario 3.4' },
          { dia: 44, label: 'Presente de subjuntivo 2' },
          { dia: 45, label: 'Vocabulario 4.1' },
          { dia: 46, label: 'Nada' },
          { dia: 47, label: 'Vocabulario 4.2' },
          { dia: 48, label: 'Nada' },
          { dia: 49, label: 'Vocabulario 4.3' },
          { dia: 50, label: 'Presente de subjuntivo 3' },
          { dia: 51, label: 'Vocabulario 4.4' },
          { dia: 52, label: 'Nada' },
          { dia: 53, label: 'Vocabulario 4.5' },
          { dia: 54, label: 'Nada' },
          { dia: 55, label: 'Vocabulario 5.1' },
          { dia: 56, label: 'Mandatos (nosotros y vosotros)' },
          { dia: 57, label: 'Vocabulario 5.2' },
          { dia: 58, label: 'Participios pasados 1 (regulares)' },
          { dia: 59, label: 'Nada' },
          { dia: 60, label: 'Vocabulario 6.1' },
          { dia: 61, label: 'Nada' },
          { dia: 62, label: 'Participios pasados 2' },
          { dia: 63, label: 'Vocabulario 6.2' },
          { dia: 64, label: 'Pretérito perfecto (indicativo y subjuntivo)' },
          { dia: 65, label: 'Nada' },
          { dia: 66, label: 'Nada' },
          { dia: 67, label: 'Vocabulario 7.1' },
          { dia: 68, label: 'Pluscuamperfecto' },
          { dia: 69, label: 'Vocabulario 7.2' },
          { dia: 70, label: 'Nada' },
          { dia: 71, label: 'Vocabulario 7.3' },
          { dia: 72, label: 'Nada' },
          { dia: 73, label: 'Nada' },
          { dia: 74, label: '9.1*' },
          { dia: 75, label: 'Nada' },
          { dia: 76, label: 'Nada' },
          { dia: 77, label: '9.2* (completar hasta Nivel 2) y Futuro Y Condicional' },
          { dia: 78, label: 'Nada' },
          { dia: 79, label: 'Nada' },
          { dia: 80, label: 'Imperfecto de subjuntivo*' },
          { dia: 81, label: 'Examen final' },
        ];

        const defaultS4 = [
          { dia: 1, label: 'Nada' },
          { dia: 2, label: 'Presente 1' },
          { dia: 3, label: 'Presente 2 y Vocabulario 1.1' },
          { dia: 4, label: 'Presente 3 y Vocabulario 1.2' },
          { dia: 5, label: 'Presente 4' },
          { dia: 6, label: 'Vocabulario 1.3' },
          { dia: 7, label: 'Nada' },
          { dia: 8, label: 'Vocabulario 2.1' },
          { dia: 9, label: 'Vocabulario 2.2' },
          { dia: 10, label: 'Pretérito 1' },
          { dia: 11, label: 'Vocabulario 2.3' },
          { dia: 12, label: 'Pretérito 2' },
          { dia: 13, label: 'Vocabulario 3.1' },
          { dia: 14, label: 'Vocabulario 3.2' },
          { dia: 15, label: 'Pretérito 3' },
          { dia: 16, label: 'Vocabulario 3.3' },
          { dia: 17, label: 'Imperfecto' },
          { dia: 18, label: 'Vocabulario 4.1' },
          { dia: 19, label: 'Vocabulario 4.2' },
          { dia: 20, label: 'Nada' },
          { dia: 21, label: 'Vocabulario 4.3' },
          { dia: 22, label: 'Nada' },
          { dia: 23, label: 'Nada' },
          { dia: 24, label: 'Vocabulario 5.1' },
          { dia: 25, label: 'Presente de subjuntivo 1' },
          { dia: 26, label: 'Vocabulario 5.2' },
          { dia: 27, label: 'Presente de subjuntivo 2' },
          { dia: 28, label: 'Vocabulario 5.3' },
          { dia: 29, label: 'Nada' },
          { dia: 30, label: 'Vocabulario 6.1' },
          { dia: 31, label: 'Mandatos' },
          { dia: 32, label: 'Vocabulario 6.2' },
          { dia: 33, label: 'Nada' },
          { dia: 34, label: 'Vocabulario 6.3' },
          { dia: 35, label: 'Examen del semestre' },
          { dia: 36, label: 'Nada' },
          { dia: 37, label: 'Vocabulario 7.1' },
          { dia: 38, label: 'Futuro y condicional' },
          { dia: 39, label: 'Vocabulario 7.2' },
          { dia: 40, label: 'Nada' },
          { dia: 41, label: 'Nada' },
          { dia: 42, label: 'Vocabulario 7.3' },
          { dia: 43, label: 'Imperfecto de subjuntivo' },
          { dia: 44, label: 'Nada' },
          { dia: 45, label: 'Vocabulario 8.1' },
          { dia: 46, label: 'Participios pasados' },
          { dia: 47, label: 'Vocabulario 8.2' },
          { dia: 48, label: 'Pretérito perfecto (indicativo y subjuntivo)' },
          { dia: 49, label: 'Vocabulario 8.3' },
          { dia: 50, label: 'Pluscuamperfecto' },
          { dia: 51, label: 'Pluscuamperfecto de subjuntivo' },
          { dia: 52, label: 'Vocabulario 9.1' },
          { dia: 53, label: 'Nada' },
          { dia: 54, label: 'Vocabulario 9.2' },
          { dia: 55, label: 'Nada' },
          { dia: 56, label: 'Vocabulario 9.3' },
          { dia: 57, label: 'Nada' },
          { dia: 58, label: 'Nada' },
          { dia: 59, label: 'Vocabulario 10.1' },
          { dia: 60, label: 'Nada' },
          { dia: 61, label: 'Vocabulario 10.2' },
          { dia: 62, label: 'Nada' },
          { dia: 63, label: 'Vocabulario 10.3' },
          { dia: 64, label: 'Nada' },
          { dia: 65, label: 'Nada' },
          { dia: 66, label: 'Nada' },
          { dia: 67, label: 'Nada' },
          { dia: 68, label: 'Nada' },
          { dia: 69, label: 'Nada' },
          { dia: 70, label: 'Examen final' },
        ];

        const rawS2 = data?.s2 && data.s2.length > 0 ? data.s2 : defaultS2;
        const rawS4 = data?.s4 && data.s4.length > 0 ? data.s4 : defaultS4;

        const s2Map = {};
        const s4Map = {};

        rawS2.forEach((item) => {
          if (item.dia) s2Map[Number(item.dia)] = item.label;
        });
        rawS4.forEach((item) => {
          if (item.dia) s4Map[Number(item.dia)] = item.label;
        });

        const combined = Array.from({ length: MAX_DAYS }, (_, i) => {
          const dia = i + 1;
          return {
            dia,
            s2: s2Map[dia] || 'Nada',
            s4: s4Map[dia] || 'Nada',
          };
        });

        setSchedule(combined);
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const handleInputChange = (dia, course, value) => {
    setSchedule((prev) =>
      prev.map((row) => (row.dia === dia ? { ...row, [course]: value } : row))
    );
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const payload = {
        s2: schedule.map((row) => ({ dia: row.dia, label: row.s2 })),
        s4: schedule.map((row) => ({ dia: row.dia, label: row.s4 })),
      };

      await setDoc(doc(db, 'curriculum_tracks', 'evaluaciones_master'), payload);
      alert('¡Guardado exitosamente!');
    } catch (error) {
      console.error('Error saving to Firestore:', error);
      alert('Error al guardar.');
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8 text-slate-400 font-bold uppercase tracking-widest animate-pulse">
        Cargando Secuencia...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 sm:p-8">
      <div className="max-w-5xl mx-auto bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        
        {/* Sticky Header */}
        <div className="sticky top-0 bg-white border-b border-slate-200 p-6 flex justify-between items-center z-10 shadow-sm">
          <div>
            <h1 className="text-2xl font-black text-slate-800 tracking-tight">
              Evaluaciones Sequencer
            </h1>
            <p className="text-sm font-bold text-slate-400 uppercase tracking-widest mt-1">
              S2 & S4 Master Track
            </p>
          </div>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-lg font-black uppercase tracking-widest text-xs transition-colors disabled:opacity-50"
          >
            {isSaving ? 'Guardando...' : 'Guardar Secuencia'}
          </button>
        </div>

        {/* Spreadsheet Header */}
        <div className="grid grid-cols-12 gap-4 p-4 bg-slate-100 border-b border-slate-200 font-black text-[10px] uppercase tracking-widest text-slate-500">
          <div className="col-span-2 text-center">Día / Fecha</div>
          <div className="col-span-5 text-indigo-600">Español II (S2)</div>
          <div className="col-span-5 text-emerald-600">IB Español B (S4)</div>
        </div>

        {/* Spreadsheet Rows */}
        <div className="divide-y divide-slate-100 pb-20">
          {schedule.map((row) => {
            const activeDates = calendarMap[row.dia] || [];
            
            return (
              <div
                key={row.dia}
                className="grid grid-cols-12 gap-4 p-3 hover:bg-slate-50 transition-colors items-center"
              >
                
                {/* Day & Dual-Date Column */}
                <div className="col-span-2 text-center flex flex-col items-center justify-center">
                  <span className="text-[10px] font-black text-slate-400 uppercase leading-none mb-1">Día</span>
                  <span className="font-black text-slate-700 text-2xl leading-none">{row.dia}</span>
                  
                  {/* Both A and B dates stack here */}
                  <div className="flex flex-col gap-1 mt-2">
                    {activeDates.length > 0 ? (
                      activeDates.map((dateStr, idx) => (
                        <span key={idx} className="block text-[9px] font-mono font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100 whitespace-nowrap">
                          {dateStr}
                        </span>
                      ))
                    ) : (
                      <span className="block text-[9px] font-mono font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded border border-slate-200 whitespace-nowrap">
                        Sin fecha
                      </span>
                    )}
                  </div>
                </div>

                <div className="col-span-5">
                  <input
                    type="text"
                    value={row.s2}
                    onChange={(e) => handleInputChange(row.dia, 's2', e.target.value)}
                    className={`w-full bg-transparent border-none focus:ring-2 focus:ring-indigo-500 rounded-md p-2 text-sm font-medium outline-none transition-all ${
                      row.s2 !== 'Nada' && row.s2 !== ''
                        ? 'text-indigo-900 bg-indigo-50 border border-indigo-100'
                        : 'text-slate-400 border border-transparent hover:border-slate-200'
                    }`}
                    placeholder="Nada"
                  />
                </div>

                <div className="col-span-5">
                  <input
                    type="text"
                    value={row.s4}
                    onChange={(e) => handleInputChange(row.dia, 's4', e.target.value)}
                    className={`w-full bg-transparent border-none focus:ring-2 focus:ring-emerald-500 rounded-md p-2 text-sm font-medium outline-none transition-all ${
                      row.s4 !== 'Nada' && row.s4 !== ''
                        ? 'text-emerald-900 bg-emerald-50 border border-emerald-100'
                        : 'text-slate-400 border border-transparent hover:border-slate-200'
                    }`}
                    placeholder="Nada"
                  />
                </div>

              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default EvaluacionesSequencer;