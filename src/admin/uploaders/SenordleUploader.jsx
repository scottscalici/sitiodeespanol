import React, { useState } from 'react';
import { db } from '../firebase'; 
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';

const SenordleUploader = () => {
  const [jsonInput, setJsonInput] = useState('');
  const [status, setStatus] = useState('');

  const handleUpload = async () => {
    console.log("--- STARTING SEÑORDLE DICTIONARY UPLOAD ---");
    try {
      const data = JSON.parse(jsonInput);
      let totalCount = 0;
  
      // Iterate through all keys in the JSON (s2, s4, dictionary, etc.)
      for (const courseKey in data) {
        const wordMap = data[courseKey];
        
        // 🛡️ Safety Check: Ensure this is a date-word map and not the 'dictionary' array
        if (wordMap && typeof wordMap === 'object' && !Array.isArray(wordMap)) {
          
          for (const [date, word] of Object.entries(wordMap)) {
            // Unique ID: course_date (e.g., "s2_2026-01-01")
            const docId = `${courseKey}_${date}`;
  
            console.log(`UPLOADING SEÑORDLE WORD: ${docId} -> ${word}`);
  
            await setDoc(doc(db, "juego_senordle", docId), {
              word: word.toUpperCase(),
              date: date,
              course: courseKey,
              lastUpdated: serverTimestamp()
            });
            totalCount++;
          }
        } else {
          console.log(`Skipping key: ${courseKey} (not a valid word map)`);
        }
      }
  
      setStatus(`✅ SUCCESS: ${totalCount} Words Synced`);
    } catch (error) {
      console.error("SEÑORDLE UPLOAD ERROR:", error);
      setStatus('❌ Error: Check Console');
    }
  };

  return (
    <div className="p-10 max-w-4xl mx-auto bg-slate-900 text-white rounded-2xl shadow-2xl border-4 border-emerald-500">
      <h2 className="text-2xl font-black mb-4 uppercase text-emerald-500">
        🧩 SEÑORDLE ARCHITECT
      </h2>
      <p className="mb-4 text-sm text-slate-400">Migrate word-to-date mappings to the <code className="text-emerald-300">juego_senordle</code> collection.</p>
      
      <textarea
        className="w-full h-96 p-4 bg-slate-800 border border-slate-700 rounded-xl font-mono text-xs text-emerald-400 outline-none"
        value={jsonInput}
        onChange={(e) => setJsonInput(e.target.value)}
        placeholder="Paste Señordle JSON here..."
      />

      <div className="mt-6 flex items-center justify-between">
        <button
          onClick={handleUpload}
          className="px-8 py-3 bg-emerald-600 hover:bg-emerald-500 font-bold rounded-xl shadow-lg uppercase text-sm"
        >
          Push to Firestore
        </button>
        <span className="font-bold text-sm text-emerald-300">{status}</span>
      </div>
    </div>
  );
};

export default SenordleUploader;