import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../../../firebase';
import { invalidateCollectionCache } from '../../../utils/firestoreCache';
import { encodeWord } from '../../../utils/wordCipher';

const BUNDLE_DOC_ID = '_bundle';

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
    const wordData = {
      // Obfuscated at rest — see wordCipher.js — so the answer isn't sitting
      // in plain text in Firestore for a student to read directly.
      word: encodeWord(cleanWord),
      course: course,
      date: date,
      createdAt: new Date().toISOString()
    };

    // 3. Save to Firestore — merges into the consolidated single document
    // once that migration has run (see SenordleUploader), otherwise saves
    // its own individual doc as before.
    try {
      setStatus('Guardando...');
      const bundleRef = doc(db, 'juego_senordle', BUNDLE_DOC_ID);
      const bundleSnap = await getDoc(bundleRef);
      if (bundleSnap.exists()) {
        // A real nested key, not a `items.<id>` dot-string key — setDoc's
        // merge:true treats a dotted object key as one literal field name,
        // not a path into items, so a dot-string key here would silently
        // write to a bogus sibling field instead of the real items map.
        await setDoc(bundleRef, { items: { [docId]: wordData } }, { merge: true });
      } else {
        await setDoc(doc(db, 'juego_senordle', docId), wordData);
      }
      invalidateCollectionCache('juego_senordle');
      setStatus(`¡Éxito! "${cleanWord}" programada para S2 el ${date}.`);
      setWord(''); // Clear input for the next one
    } catch (error) {
      console.error("Error saving word:", error);
      setStatus('Error al guardar en Firebase.');
    }
  };

  return (
    <div className="max-w-md mx-auto bg-slate-800 p-6 rounded-2xl border border-slate-700 shadow-xl">
      <div className="flex justify-between items-start mb-6">
        <h2 className="text-xl font-black text-white uppercase tracking-widest flex items-center gap-2">
          <span>⚙️</span> Creador de Señordle
        </h2>
        <Link
          to="/admin-secret-portal-senordle"
          className="text-[10px] font-bold text-emerald-400 hover:text-emerald-300 border border-emerald-700/50 px-2 py-1 rounded uppercase tracking-widest whitespace-nowrap"
        >
          📅 Ver Calendario
        </Link>
      </div>

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