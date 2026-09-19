import React, { useState, useEffect } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { Link } from 'react-router-dom';

const parseLines = (text) =>
  text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

export default function ImpostorThemesManager() {
  const [s2Text, setS2Text] = useState('');
  const [s4Text, setS4Text] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState('');

  useEffect(() => {
    const fetchThemes = async () => {
      try {
        const docRef = doc(db, 'config', 'impostor_themes');
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          setS2Text((data.s2 || []).join('\n'));
          setS4Text((data.s4 || []).join('\n'));
        }
      } catch (error) {
        console.error('Error loading Impostor themes:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchThemes();
  }, []);

  const s2Themes = parseLines(s2Text);
  const s4Themes = parseLines(s4Text);

  const handleSave = async () => {
    setSaving(true);
    setStatus('');
    try {
      await setDoc(doc(db, 'config', 'impostor_themes'), {
        s2: s2Themes,
        s4: s4Themes,
        lastUpdated: new Date().toISOString(),
      });
      setStatus('✅ Temas guardados.');
    } catch (error) {
      console.error('Error saving Impostor themes:', error);
      setStatus('❌ Error al guardar en Firebase.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400 font-bold uppercase tracking-widest">Cargando...</div>;
  }

  return (
    <div className="min-h-screen bg-slate-950 flex items-start justify-center p-4 sm:p-8">
      <div className="max-w-3xl w-full bg-slate-800 p-6 rounded-2xl border border-slate-700 shadow-xl space-y-4">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-black text-white uppercase tracking-widest flex items-center gap-2">
            <span>🎭</span> Temas de Impostor
          </h2>
          <Link to="/admin-daily-plan-hub" className="text-slate-400 hover:text-white text-xs font-bold border border-slate-700 px-3 py-1.5 rounded-lg">
            ← Hub
          </Link>
        </div>

        <p className="text-slate-400 text-xs">
          Un tema por línea. No hay palabra secreta — solo el tema (ej. "La comida", "Los colores"). Cada sala elige un tema al azar de la lista de su curso.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-fuchsia-400 uppercase tracking-widest mb-1">
              Spanish 2 ({s2Themes.length} temas)
            </label>
            <textarea
              value={s2Text}
              onChange={(e) => setS2Text(e.target.value)}
              placeholder={'La comida\nLos colores\nLa familia\nEl clima'}
              rows={12}
              className="w-full bg-slate-900 border border-slate-700 text-white rounded-lg p-3 font-mono text-sm focus:outline-none focus:border-fuchsia-500 transition-colors"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-cyan-400 uppercase tracking-widest mb-1">
              Spanish 4 / IB ({s4Themes.length} temas)
            </label>
            <textarea
              value={s4Text}
              onChange={(e) => setS4Text(e.target.value)}
              placeholder={'El realismo mágico\nLos problemas globales\nLa identidad cultural'}
              rows={12}
              className="w-full bg-slate-900 border border-slate-700 text-white rounded-lg p-3 font-mono text-sm focus:outline-none focus:border-cyan-500 transition-colors"
            />
          </div>
        </div>

        {status && (
          <p className={`text-xs font-bold text-center ${status.includes('❌') ? 'text-rose-400' : 'text-emerald-400'}`}>{status}</p>
        )}

        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-black uppercase tracking-widest py-3 rounded-lg transition-colors shadow-lg"
        >
          {saving ? 'Guardando...' : 'Guardar Temas'}
        </button>
      </div>
    </div>
  );
}