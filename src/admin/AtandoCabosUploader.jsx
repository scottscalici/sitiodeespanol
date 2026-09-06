import React, { useState } from 'react';
import { db } from '../firebase'; 
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';

const AtandoCabosUploader = () => {
  const [jsonInput, setJsonInput] = useState('');
  const [status, setStatus] = useState('');

  const handleUpload = async () => {
    try {
      const dataArray = JSON.parse(jsonInput);
      setStatus(`⏳ Processing ${dataArray.length} puzzles...`);

      for (const puzzle of dataArray) {
        // Use the existing ID from your JSON (e.g., "ac-s2-2026-03-01")
        // This is safe because these IDs are already unique by course and date
        const docId = puzzle.id;

        console.log(`UPLOADING PUZZLE: ${docId}`);

        await setDoc(doc(db, "juego_atandocabos", docId), {
          ...puzzle,
          lastUpdated: serverTimestamp()
        });
      }

      setStatus(`✅ SUCCESS: ${dataArray.length} Puzzles Synced`);
    } catch (error) {
      console.error("UPLOAD ERROR:", error);
      setStatus('❌ Error: Check Console');
    }
  };

  return (
    <div className="p-10 max-w-4xl mx-auto bg-slate-900 text-white rounded-2xl border-4 border-fuchsia-500">
      <h2 className="text-2xl font-black mb-4 uppercase text-fuchsia-500">🧶 Atando Cabos Architect</h2>
      <textarea
        className="w-full h-96 p-4 bg-slate-800 border border-slate-700 rounded-xl font-mono text-xs text-fuchsia-400 outline-none"
        value={jsonInput}
        onChange={(e) => setJsonInput(e.target.value)}
        placeholder="Paste Atando Cabos JSON array here..."
      />
      <button onClick={handleUpload} className="mt-6 px-8 py-3 bg-fuchsia-600 hover:bg-fuchsia-500 font-bold rounded-xl uppercase text-sm">
        Push to Firestore
      </button>
      <p className="mt-4 font-bold text-fuchsia-300">{status}</p>
    </div>
  );
};

export default AtandoCabosUploader;