import React, { useState } from 'react';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../../../firebase';
import { Link } from 'react-router-dom';

const EXAMPLE = `PAN
PANADERO
PANADERÍA
CERCANÍA
CERCA`;

const parseChain = (text) =>
  text
    .split('\n')
    .map((w) => w.trim().toUpperCase())
    .filter(Boolean);

export default function FormEslabones() {
  const [course, setCourse] = useState('s2');
  const [date, setDate] = useState(new Date().toLocaleDateString('en-CA'));
  const [chainText, setChainText] = useState('');
  const [status, setStatus] = useState('');
  const [saving, setSaving] = useState(false);

  const parsedChain = parseChain(chainText);

  const handleSave = async (e) => {
    e.preventDefault();

    if (parsedChain.length < 2) {
      setStatus('❌ La cadena necesita al menos 2 palabras.');
      return;
    }

    const docId = `es-${course}-${date}`;
    setSaving(true);
    setStatus('');
    try {
      await setDoc(doc(db, 'juego_eslabones', docId), {
        id: docId,
        course,
        fecha: date,
        chain: parsedChain,
        createdAt: new Date().toISOString(),
      });
      setStatus(`✅ ¡Éxito! Cadena programada para ${course.toUpperCase()} el ${date}.`);
      setChainText('');
    } catch (error) {
      console.error('Error saving Eslabones chain:', error);
      setStatus('❌ Error al guardar en Firebase.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-start justify-center p-4 sm:p-8">
      <div className="max-w-2xl w-full bg-slate-800 p-6 rounded-2xl border border-slate-700 shadow-xl space-y-4">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-black text-white uppercase tracking-widest flex items-center gap-2">
            <span>🔗</span> Creador de Eslabones
          </h2>
          <Link to="/admin-daily-plan-hub" className="text-slate-400 hover:text-white text-xs font-bold border border-slate-700 px-3 py-1.5 rounded-lg">
            ← Hub
          </Link>
        </div>

        <form onSubmit={handleSave} className="space-y-4">
          <div className="flex gap-4">
            <label className="flex-1 cursor-pointer">
              <input type="radio" name="course" value="s2" checked={course === 's2'} onChange={(e) => setCourse(e.target.value)} className="peer sr-only" />
              <div className="text-center py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-400 font-bold peer-checked:bg-cyan-600 peer-checked:text-white peer-checked:border-cyan-500 transition-all uppercase tracking-widest text-xs">S2</div>
            </label>
            <label className="flex-1 cursor-pointer">
              <input type="radio" name="course" value="s4" checked={course === 's4'} onChange={(e) => setCourse(e.target.value)} className="peer sr-only" />
              <div className="text-center py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-400 font-bold peer-checked:bg-cyan-600 peer-checked:text-white peer-checked:border-cyan-500 transition-all uppercase tracking-widest text-xs">S4</div>
            </label>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Fecha Programada</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 text-white rounded-lg p-3 font-mono focus:outline-none focus:border-cyan-500 transition-colors"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">
              Cadena de Palabras (una por línea, en orden)
            </label>
            <textarea
              value={chainText}
              onChange={(e) => setChainText(e.target.value)}
              placeholder={EXAMPLE}
              rows={6}
              className="w-full bg-slate-900 border border-slate-700 text-white rounded-lg p-3 font-mono text-sm uppercase focus:outline-none focus:border-cyan-500 transition-colors"
            />
          </div>

          {chainText.trim() && (
            <div className="bg-slate-900 border border-slate-700 rounded-lg p-3">
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Vista Previa ({parsedChain.length} palabras)</p>
              <div className="flex flex-wrap gap-2">
                {parsedChain.map((word, i) => (
                  <span key={i} className="text-xs font-bold text-cyan-400 bg-slate-950 border border-slate-700 px-2 py-1 rounded">
                    {i + 1}. {word}
                  </span>
                ))}
              </div>
            </div>
          )}

          {status && (
            <p className={`text-xs font-bold text-center ${status.includes('❌') ? 'text-rose-400' : 'text-emerald-400'}`}>{status}</p>
          )}

          <button
            type="submit"
            disabled={saving}
            className="w-full bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white font-black uppercase tracking-widest py-3 rounded-lg transition-colors shadow-lg"
          >
            {saving ? 'Guardando...' : 'Guardar Cadena'}
          </button>
        </form>
      </div>
    </div>
  );
}