import React, { useState } from 'react';
import { db } from '../../firebase';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { invalidateCollectionCache } from '../../utils/firestoreCache';

const BUNDLE_DOC_ID = '_bundle';

const DestacadoUploader = () => {
  const [jsonInput, setJsonInput] = useState('');
  const [status, setStatus] = useState('');

  const handleUpload = async () => {
    console.log("--- STARTING DESTACADO MASTER UPLOAD ---");
    try {
      const rawData = JSON.parse(jsonInput);
      const dataArray = Array.isArray(rawData) ? rawData : [rawData];
      
      setStatus(`⏳ Processing ${dataArray.length} highlights...`);

      // Once the "consolidate into one document" migration has run (see
      // DestacadoManager), destacado_diario should only ever hold that one
      // doc — so new uploads merge into it instead of creating fresh
      // individual docs, which would silently bring back the per-doc-read
      // cost that migration exists to remove. Falls back to the original
      // one-doc-per-item behavior if that migration hasn't run yet.
      const bundleRef = doc(db, 'destacado_diario', BUNDLE_DOC_ID);
      const bundleSnap = await getDoc(bundleRef);
      const isBundled = bundleSnap.exists();
      const newItemsMap = {};

      for (const item of dataArray) {
        // Create a permanent ID based on type and location
        // e.g., "persona_espana_miguel_de_cervantes"
        const cleanTopic = item.content.spanish
          .split(' ')[0] // Take the first word of the content for uniqueness
          .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
          .replace(/[^a-zA-Z0-9]/g, '')
          .toLowerCase();
      
        const cleanLocation = item.location
          .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
          .replace(/[^a-zA-Z0-9]/g, '_')
          .toLowerCase();
      
        // Permanent ID that doesn't change even if the Day changes
        const docId = `${item.type}_${cleanLocation}_${cleanTopic}`;
        const dataToSave = { ...item, lastUpdated: serverTimestamp() };

        if (isBundled) {
          newItemsMap[docId] = dataToSave;
        } else {
          await setDoc(doc(db, "destacado_diario", docId), dataToSave);
        }
      }

      if (isBundled) {
        const merged = {};
        Object.entries(newItemsMap).forEach(([id, data]) => {
          merged[`items.${id}`] = data;
        });
        await setDoc(bundleRef, merged, { merge: true });
      }
      invalidateCollectionCache('destacado_diario');

      setStatus(`✅ SUCCESS: ${dataArray.length} Highlights Synced`);
      setJsonInput(''); 
    } catch (error) {
      console.error("DESTACADO UPLOAD ERROR:", error);
      setStatus('❌ Error: Check Console');
    }
  };

  return (
    <div className="p-10 max-w-4xl mx-auto bg-slate-900 text-white rounded-2xl shadow-2xl border-4 border-blue-500">
      <h2 className="text-2xl font-black mb-4 uppercase text-blue-500">
        🌎 Destacado Diario Architect
      </h2>
      <p className="mb-4 text-sm text-slate-400">
        Populate the <code className="text-blue-300">destacado_diario</code> collection.
      </p>
      
      <textarea
        className="w-full h-96 p-4 bg-slate-800 border border-slate-700 rounded-xl font-mono text-xs text-blue-400 outline-none"
        value={jsonInput}
        onChange={(e) => setJsonInput(e.target.value)}
        placeholder='Paste Destacado JSON here...'
      />

      <div className="mt-6 flex items-center justify-between">
        <button
          onClick={handleUpload}
          className="px-8 py-3 bg-blue-600 hover:bg-blue-500 transition-all font-bold rounded-xl shadow-lg uppercase text-sm"
        >
          Push to Firestore
        </button>
        <span className="font-bold text-sm text-blue-300">{status}</span>
      </div>
    </div>
  );
};

export default DestacadoUploader;