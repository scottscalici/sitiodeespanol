import React, { useState, useEffect } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { Link } from 'react-router-dom';
import { parseBlankSentence } from '../../utils/sentenceBlanks';

const parseLines = (text) =>
  text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

export default function SampleSentencesManager() {
  const [s2Text, setS2Text] = useState('');
  const [s4Text, setS4Text] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState('');

  useEffect(() => {
    const fetchSentences = async () => {
      try {
        const docRef = doc(db, 'config', 'sample_sentences');
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          setS2Text((data.s2 || []).join('\n'));
          setS4Text((data.s4 || []).join('\n'));
        }
      } catch (error) {
        console.error('Error loading sample sentences:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchSentences();
  }, []);

  const s2Lines = parseLines(s2Text);
  const s4Lines = parseLines(s4Text);

  const handleSave = async () => {
    setSaving(true);
    setStatus('');
    try {
      await setDoc(doc(db, 'config', 'sample_sentences'), {
        s2: s2Lines,
        s4: s4Lines,
        lastUpdated: new Date().toISOString(),
      });
      setStatus('✅ Oraciones guardadas.');
    } catch (error) {
      console.error('Error saving sample sentences:', error);
      setStatus('❌ Error al guardar en Firebase.');
    } finally {
      setSaving(false);
    }
  };

  const renderColumn = (label, text, setText, lines, colorClass, focusClass) => (
    <div>
      <label className={`block text-xs font-bold uppercase tracking-widest mb-1 ${colorClass}`}>
        {label} ({lines.length} oraciones)
      </label>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={'Ella [[tiene]] veinte años.\nNosotros [[vamos]] a la playa.'}
        rows={12}
        className={`w-full bg-slate-900 border border-slate-700 text-white rounded-lg p-3 font-mono text-sm focus:outline-none ${focusClass} transition-colors`}
      />
      <div className="mt-2 space-y-1">
        {lines.map((line, i) => {
          const { display, answer } = parseBlankSentence(line);
          return (
            <p key={i} className={`text-xs ${answer ? 'text-slate-400' : 'text-rose-400'}`}>
              {answer ? (
                <>
                  {display} <span className="text-emerald-400 font-bold">({answer})</span>
                </>
              ) : (
                <>⚠️ Falta [[respuesta]]: {line}</>
              )}
            </p>
          );
        })}
      </div>
    </div>
  );

  if (loading) {
    return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400 font-bold uppercase tracking-widest">Cargando...</div>;
  }

  return (
    <div className="min-h-screen bg-slate-950 flex items-start justify-center p-4 sm:p-8">
      <div className="max-w-4xl w-full bg-slate-800 p-6 rounded-2xl border border-slate-700 shadow-xl space-y-4">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-black text-white uppercase tracking-widest flex items-center gap-2">
            <span>✍️</span> Oraciones de Práctica
          </h2>
          <Link to="/admin-daily-plan-hub" className="text-slate-400 hover:text-white text-xs font-bold border border-slate-700 px-3 py-1.5 rounded-lg">
            ← Hub
          </Link>
        </div>

        <p className="text-slate-400 text-xs">
          Una oración por línea. Marca la respuesta correcta con doble corchete, ej: <span className="font-mono text-teal-400">Ella [[tiene]] veinte años.</span>
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {renderColumn('Spanish 2', s2Text, setS2Text, s2Lines, 'text-fuchsia-400', 'focus:border-fuchsia-500')}
          {renderColumn('Spanish 4 / IB', s4Text, setS4Text, s4Lines, 'text-cyan-400', 'focus:border-cyan-500')}
        </div>

        {status && (
          <p className={`text-xs font-bold text-center ${status.includes('❌') ? 'text-rose-400' : 'text-emerald-400'}`}>{status}</p>
        )}

        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-white font-black uppercase tracking-widest py-3 rounded-lg transition-colors shadow-lg"
        >
          {saving ? 'Guardando...' : 'Guardar Oraciones'}
        </button>
      </div>
    </div>
  );
}
