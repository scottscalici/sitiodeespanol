import React, { useState } from 'react';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../../../firebase';

const FormSenordle = () => {
  const [course, setCourse] = useState('s2');
  const [date, setDate] = useState(new Date().toLocaleDateString('en-CA'));
  const [word, setWord] = useState('');
  const [status, setStatus] = useState('');

  const handleSaveWord = async (e) => {
    e.preventDefault();
    
    // 1. Validation
    const cleanWord = word.trim().toUpperCase();
    if (cleanWord.length !== 5) {
      setStatus('Error: La palabra debe tener exactamente 5 letras.');
      return;
    }

    // 2. Format the Document ID to match your SenordlePage logic
    const docId = `${course}_${date}`;
    const docRef = doc(db, 'juego_senordle', docId);

    // 3. Save to Firestore
    try {
      setStatus('Guardando...');
      await setDoc(docRef, {
        word: cleanWord,
        course: course,
        date: date,
        createdAt: new Date().toISOString()
      });
      setStatus(`¡Éxito! "${cleanWord}" programada para S2 el ${date}.`);
      setWord(''); // Clear input for the next one
    } catch (error) {
      console.error("Error saving word:", error);
      setStatus('Error al guardar en Firebase.');
    }
  };

  return (
    <div className="max-w-md mx-auto bg-slate-800 p-6 rounded-2xl border border-slate-700 shadow-xl">
      <h2 className="text-xl font-black text-white uppercase tracking-widest mb-6 flex items-center gap-2">
        <span>⚙️</span> Creador de Señordle
      </h2>

      <form onSubmit={handleSaveWord} className="space-y-4">
        {/* Course Selection */}
        <div className="flex gap-4">
          <label className="flex-1 cursor-pointer">
            <input 
              type="radio" 
              name="course" 
              value="s2" 
              checked={course === 's2'} 
              onChange={(e) => setCourse(e.target.value)}
              className="peer sr-only"
            />
            <div className="text-center py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-400 font-bold peer-checked:bg-emerald-600 peer-checked:text-white peer-checked:border-emerald-500 transition-all uppercase tracking-widest text-xs">
              S2
            </div>
          </label>
          <label className="flex-1 cursor-pointer">
            <input 
              type="radio" 
              name="course" 
              value="s4" 
              checked={course === 's4'} 
              onChange={(e) => setCourse(e.target.value)}
              className="peer sr-only"
            />
            <div className="text-center py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-400 font-bold peer-checked:bg-emerald-600 peer-checked:text-white peer-checked:border-emerald-500 transition-all uppercase tracking-widest text-xs">
              S4
            </div>
          </label>
        </div>

        {/* Date Picker */}
        <div>
          <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Fecha Programada</label>
          <input 
            type="date" 
            value={date} 
            onChange={(e) => setDate(e.target.value)}
            className="w-full bg-slate-900 border border-slate-700 text-white rounded-lg p-3 font-mono focus:outline-none focus:border-emerald-500 transition-colors"
          />
        </div>

        {/* Word Input */}
        <div>
          <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Palabra (5 Letras)</label>
          <input 
            type="text" 
            maxLength={5}
            value={word} 
            onChange={(e) => setWord(e.target.value.toUpperCase())}
            placeholder="EJ: LIBRO"
            className="w-full bg-slate-900 border border-slate-700 text-white rounded-lg p-3 font-black text-2xl tracking-[0.2em] text-center uppercase focus:outline-none focus:border-emerald-500 transition-colors"
          />
        </div>

        {/* Status Message */}
        {status && (
          <p className={`text-xs font-bold text-center ${status.includes('Error') ? 'text-rose-400' : 'text-emerald-400'}`}>
            {status}
          </p>
        )}

        {/* Submit Button */}
        <button 
          type="submit" 
          className="w-full bg-sky-600 hover:bg-sky-500 text-white font-black uppercase tracking-widest py-3 rounded-lg transition-colors shadow-lg mt-2"
        >
          Guardar Palabra
        </button>
      </form>
    </div>
  );
};

export default FormSenordle;