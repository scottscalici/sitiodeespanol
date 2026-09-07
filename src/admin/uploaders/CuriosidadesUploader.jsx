import React, { useState } from 'react';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../../firebase'; // Adjust relative path to your firebase.js if needed

const CuriosidadesUploader = () => {
  const [jsonInput, setJsonInput] = useState('');
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(false);

  const handleUpload = async () => {
    if (!jsonInput.trim()) {
      setStatus('⚠️ Por favor pega el JSON primero.');
      return;
    }

    setLoading(true);
    setStatus('Subiendo a Firestore...');

    try {
      const parsedData = JSON.parse(jsonInput);

      if (!Array.isArray(parsedData)) {
        throw new Error('El JSON debe ser un arreglo [ ] de objetos.');
      }

      let count = 0;
      for (const item of parsedData) {
        if (!item.id) continue;

        // Write each curiosidad to the 'curiosidades' collection using its unique ID (e.g. cur-80)
        await setDoc(doc(db, 'curiosidades', String(item.id)), {
          title: item.title || '',
          img: item.img || '',
          student_note: item.student_note || '',
          teacher_notes: item.teacher_notes || '',
          s2_dia: item.s2_dia !== null ? Number(item.s2_dia) : null,
          s4_dia: item.s4_dia !== null ? Number(item.s4_dia) : null,
        });
        count++;
      }

      setStatus(`✅ ¡Éxito! Se subieron ${count} curiosidades a Firestore.`);
    } catch (error) {
      console.error('Error uploading JSON:', error);
      setStatus(`❌ Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6 md:p-12">
      <div className="max-w-4xl mx-auto bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
        <h1 className="text-3xl font-black text-slate-800 mb-2">
          Curiosidades Bulk Uploader
        </h1>
        <p className="text-slate-500 font-medium mb-6">
          Pega tu arreglo JSON completo abajo y haz clic en subir para migrarlo
          a Firestore.
        </p>

        <textarea
          rows="12"
          value={jsonInput}
          onChange={(e) => setJsonInput(e.target.value)}
          placeholder="[ { id: 'cur-80', title: '...', ... } ]"
          className="w-full font-mono text-xs bg-slate-100 border border-slate-200 rounded-xl p-4 mb-6 focus:ring-2 focus:ring-indigo-500 outline-none"
        ></textarea>

        <div className="flex items-center justify-between">
          <button
            onClick={handleUpload}
            disabled={loading}
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-black px-8 py-3 rounded-xl uppercase tracking-widest text-xs transition-colors disabled:opacity-50 shadow-sm"
          >
            {loading ? 'Subiendo...' : 'Subir Curiosidades a Firebase'}
          </button>

          {status && (
            <p className="text-sm font-bold text-slate-700">{status}</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default CuriosidadesUploader;
