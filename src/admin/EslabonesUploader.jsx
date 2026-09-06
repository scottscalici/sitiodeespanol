import React, { useState } from 'react';
import { db } from '../firebase'; 
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';

const EslabonesUploader = () => {
  const [jsonInput, setJsonInput] = useState('');
  const [status, setStatus] = useState('');

  const handleUpload = async () => {
    try {
      const dataArray = JSON.parse(jsonInput);
      setStatus(`⏳ Procesando ${dataArray.length} cadenas...`);

      for (const puzzle of dataArray) {
        // Usamos tu ID predefinido para evitar duplicados
        const docId = puzzle.id;

        console.log(`UPLOADING ESLABÓN: ${docId}`);

        await setDoc(doc(db, "juego_eslabones", docId), {
          ...puzzle,
          // Guardamos la cadena en mayúsculas para facilitar la validación en el juego
          chain: puzzle.chain.map(word => word.toUpperCase()),
          lastUpdated: serverTimestamp()
        });
      }

      setStatus(`✅ ÉXITO: ${dataArray.length} Cadenas en Firestore`);
    } catch (error) {
      console.error("ERROR DE CARGA:", error);
      setStatus('❌ Error: Revisa la consola');
    }
  };

  return (
    <div className="p-10 max-w-4xl mx-auto bg-slate-900 text-white rounded-2xl border-4 border-yellow-500">
      <h2 className="text-2xl font-black mb-4 uppercase text-yellow-500">🔗 Eslabón Perdido Architect</h2>
      <textarea
        className="w-full h-96 p-4 bg-slate-800 border border-slate-700 rounded-xl font-mono text-xs text-yellow-400 outline-none"
        value={jsonInput}
        onChange={(e) => setJsonInput(e.target.value)}
        placeholder="Pega el JSON de Eslabón Perdido aquí..."
      />
      <button onClick={handleUpload} className="mt-6 px-8 py-3 bg-yellow-600 hover:bg-yellow-500 font-bold rounded-xl uppercase text-sm text-slate-900">
        Subir a Firestore
      </button>
      <p className="mt-4 font-bold text-yellow-300">{status}</p>
    </div>
  );
};

export default EslabonesUploader;