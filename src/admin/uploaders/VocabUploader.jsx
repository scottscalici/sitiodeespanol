import React, { useState } from 'react';
import { db } from '../../firebase';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';

const VocabUploader = () => {
  const [jsonInput, setJsonInput] = useState("");
  const [status, setStatus] = useState("");

  const handleUpload = async () => {
    try {
      const data = JSON.parse(jsonInput);
      setStatus('VERSION 5: Processing Nested JSON...');
      
      // Extract root variables from the new schema
      const textbookName = data.textbook;
      const cleanTextbook = textbookName.replace(/\s+/g, '_').toLowerCase();
      
      let uploadCount = 0;

      // Loop through the sections object
      for (const sectionKey in data.sections) {
        const wordsArray = data.sections[sectionKey];
        
        for (const item of wordsArray) {
          // Replicates your V4 slash and space fixes
          const cleanWord = item.palabra
            .replace(/\//g, '-')
            .replace(/\s+/g, '_')
            .replace(/[()]/g, '')
            .toLowerCase();
            
          const docId = `${cleanTextbook}_${cleanWord}`;
          
          // Re-inject textbook and section into the metadata so the rest of the app doesn't break
          const updatedItem = {
            ...item,
            metadata: {
              ...item.metadata,
              textbook: textbookName,
              secciones: [sectionKey]
            },
            lastUpdated: serverTimestamp()
          };

          await setDoc(doc(db, "vocabulary", docId), updatedItem);
          uploadCount++;
        }
      }
      
      setStatus(`SUCCESS: Version 5 Complete. Uploaded ${uploadCount} words.`);
      setJsonInput(""); 
    } catch (error) {
      console.error("V5 ERROR:", error);
      setStatus('❌ Error: Check Console (Ensure you pasted the entire wrapper object)');
    }
  };

  return (
    <div className="p-10 max-w-4xl mx-auto bg-slate-900 text-white rounded-2xl shadow-2xl border-4 border-indigo-500">
      <h2 className="text-2xl font-black mb-4 uppercase text-indigo-500">VOCAB UPLOADER (V5)</h2>
      <p className="mb-4 text-sm text-slate-400">Paste your nested Chapter/Section JSONs here.</p>
      <textarea 
        className="w-full h-96 p-4 bg-slate-800 border border-slate-700 rounded-xl font-mono text-xs text-indigo-400 outline-none"
        value={jsonInput}
        onChange={(e) => setJsonInput(e.target.value)}
        placeholder="Paste JSON here..."
      />
      <div className="mt-6 flex items-center justify-between">
        <button 
          onClick={handleUpload} 
          className="px-8 py-3 bg-indigo-600 hover:bg-indigo-500 font-bold rounded-xl shadow-lg uppercase text-sm"
        >
          Push to Firestore (V5)
        </button>
        <span className="font-bold text-sm text-indigo-300">{status}</span>
      </div>
    </div>
  );
};

export default VocabUploader;