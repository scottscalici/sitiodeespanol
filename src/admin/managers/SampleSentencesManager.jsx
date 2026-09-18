import React, { useState, useEffect } from 'react';
import { collection, getDocs, doc, setDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { Link } from 'react-router-dom';
import { parseBlankSentence } from '../../utils/sentenceBlanks';

const parseLines = (text) =>
  text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

const emptyAssignment = () => ({ course: 's2', dia: '' });

export default function SampleSentencesManager() {
  const [sets, setSets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState('');

  const [editingId, setEditingId] = useState(null);
  const [linesText, setLinesText] = useState('');
  const [assignments, setAssignments] = useState([emptyAssignment()]);

  const fetchSets = async () => {
    try {
      const snap = await getDocs(collection(db, 'sentence_sets'));
      const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      items.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
      setSets(items);
    } catch (error) {
      console.error('Error loading sentence sets:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSets();
  }, []);

  const lines = parseLines(linesText);

  const resetEditor = () => {
    setEditingId(null);
    setLinesText('');
    setAssignments([emptyAssignment()]);
    setStatus('');
  };

  const loadIntoEditor = (set) => {
    setEditingId(set.id);
    setLinesText((set.lines || []).join('\n'));
    setAssignments(set.assignments?.length ? set.assignments.map((a) => ({ ...a })) : [emptyAssignment()]);
    setStatus('');
  };

  const updateAssignment = (index, field, value) => {
    setAssignments((prev) => prev.map((a, i) => (i === index ? { ...a, [field]: value } : a)));
  };

  const addAssignment = () => setAssignments((prev) => [...prev, emptyAssignment()]);
  const removeAssignment = (index) => setAssignments((prev) => prev.filter((_, i) => i !== index));

  const handleSave = async () => {
    const validAssignments = assignments
      .filter((a) => a.dia !== '' && a.dia != null)
      .map((a) => ({ course: a.course, dia: Number(a.dia) }));

    if (lines.length === 0) {
      setStatus('❌ Agrega al menos una oración.');
      return;
    }
    if (validAssignments.length === 0) {
      setStatus('❌ Agrega al menos una asignación de curso + día.');
      return;
    }

    setSaving(true);
    setStatus('');
    try {
      const id = editingId || `set-${crypto.randomUUID()}`;
      await setDoc(doc(db, 'sentence_sets', id), {
        lines,
        assignments: validAssignments,
        createdAt: editingId ? sets.find((s) => s.id === editingId)?.createdAt : new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      setStatus('✅ Conjunto guardado.');
      await fetchSets();
      if (!editingId) resetEditor();
      else setEditingId(id);
    } catch (error) {
      console.error('Error saving sentence set:', error);
      setStatus('❌ Error al guardar en Firebase.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      await deleteDoc(doc(db, 'sentence_sets', id));
      await fetchSets();
      if (editingId === id) resetEditor();
    } catch (error) {
      console.error('Error deleting sentence set:', error);
    }
  };

  if (loading) {
    return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400 font-bold uppercase tracking-widest">Cargando...</div>;
  }

  return (
    <div className="min-h-screen bg-slate-950 flex items-start justify-center p-4 sm:p-8">
      <div className="max-w-4xl w-full space-y-6">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-black text-white uppercase tracking-widest flex items-center gap-2">
            <span>✍️</span> Oraciones de Práctica
          </h2>
          <Link to="/admin-daily-plan-hub" className="text-slate-400 hover:text-white text-xs font-bold border border-slate-700 px-3 py-1.5 rounded-lg">
            ← Hub
          </Link>
        </div>

        {/* EDITOR */}
        <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700 shadow-xl space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-sm font-black text-teal-400 uppercase tracking-widest">
              {editingId ? 'Editando Conjunto' : 'Nuevo Conjunto'}
            </h3>
            {editingId && (
              <button onClick={resetEditor} className="text-[10px] font-bold text-slate-400 hover:text-white uppercase tracking-widest">
                + Empezar Conjunto Nuevo
              </button>
            )}
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">
              Oraciones ({lines.length}) — marca la respuesta con [[doble corchete]]
            </label>
            <textarea
              value={linesText}
              onChange={(e) => setLinesText(e.target.value)}
              placeholder={'Ella [[tiene]] veinte años.\nNosotros [[vamos]] a la playa.'}
              rows={8}
              className="w-full bg-slate-900 border border-slate-700 text-white rounded-lg p-3 font-mono text-sm focus:outline-none focus:border-teal-500 transition-colors"
            />
            <div className="mt-2 space-y-1">
              {lines.map((line, i) => {
                const { display, answer } = parseBlankSentence(line);
                return (
                  <p key={i} className={`text-xs ${answer ? 'text-slate-400' : 'text-rose-400'}`}>
                    {answer ? (
                      <>{display} <span className="text-emerald-400 font-bold">({answer})</span></>
                    ) : (
                      <>⚠️ Falta [[respuesta]]: {line}</>
                    )}
                  </p>
                );
              })}
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">
              ¿Dónde aparece este conjunto? (mismas oraciones, distinto curso + día)
            </label>
            <div className="space-y-2">
              {assignments.map((a, i) => (
                <div key={i} className="flex items-center gap-2">
                  <select
                    value={a.course}
                    onChange={(e) => updateAssignment(i, 'course', e.target.value)}
                    className="bg-slate-900 border border-slate-700 text-white rounded-lg px-3 py-2 text-sm font-bold"
                  >
                    <option value="s2">S2</option>
                    <option value="s4">S4</option>
                  </select>
                  <span className="text-slate-500 text-xs font-bold uppercase">Día</span>
                  <input
                    type="number"
                    min="1"
                    value={a.dia}
                    onChange={(e) => updateAssignment(i, 'dia', e.target.value)}
                    className="w-20 bg-slate-900 border border-slate-700 text-white rounded-lg px-3 py-2 text-sm font-bold"
                  />
                  <button
                    onClick={() => removeAssignment(i)}
                    disabled={assignments.length === 1}
                    className="text-rose-400 hover:text-rose-300 disabled:opacity-30 font-black px-2"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
            <button
              onClick={addAssignment}
              className="mt-2 text-teal-400 hover:text-teal-300 text-[10px] font-bold uppercase tracking-widest"
            >
              + Agregar Curso/Día
            </button>
          </div>

          {status && (
            <p className={`text-xs font-bold text-center ${status.includes('❌') ? 'text-rose-400' : 'text-emerald-400'}`}>{status}</p>
          )}

          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-white font-black uppercase tracking-widest py-3 rounded-lg transition-colors shadow-lg"
          >
            {saving ? 'Guardando...' : editingId ? 'Actualizar Conjunto' : 'Guardar Conjunto'}
          </button>
        </div>

        {/* LIST OF EXISTING SETS */}
        <div className="space-y-2">
          <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest">Conjuntos Guardados ({sets.length})</h3>
          {sets.length === 0 ? (
            <p className="text-slate-500 text-sm italic">Todavía no hay conjuntos.</p>
          ) : (
            sets.map((set) => (
              <div key={set.id} className="bg-slate-800 border border-slate-700 rounded-xl p-4 flex justify-between items-center gap-4">
                <div className="min-w-0">
                  <p className="text-white font-bold text-sm truncate">{(set.lines || []).length} oraciones</p>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {(set.assignments || []).map((a, i) => (
                      <span key={i} className="text-[10px] font-black uppercase bg-teal-900/50 text-teal-300 px-2 py-0.5 rounded">
                        {a.course.toUpperCase()} · Día {a.dia}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={() => loadIntoEditor(set)}
                    className="bg-slate-700 hover:bg-slate-600 text-white text-[10px] font-bold px-3 py-1.5 rounded-lg uppercase tracking-widest"
                  >
                    Editar
                  </button>
                  <button
                    onClick={() => handleDelete(set.id)}
                    className="bg-rose-900/50 hover:bg-rose-900/80 text-rose-300 text-[10px] font-bold px-3 py-1.5 rounded-lg uppercase tracking-widest"
                  >
                    Eliminar
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
