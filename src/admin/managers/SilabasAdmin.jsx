import { useState, useEffect } from 'react';
import { collection, getDocs, doc, setDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { Link } from 'react-router-dom';

const parseSyllables = (text) =>
  text
    .split('-')
    .map((s) => s.trim())
    .filter(Boolean);

export default function SilabasAdmin() {
  const [words, setWords] = useState([]);
  const [loading, setLoading] = useState(true);

  const [editingId, setEditingId] = useState(null);
  const [palabra, setPalabra] = useState('');
  const [silabasText, setSilabasText] = useState('');
  const [clue, setClue] = useState('');
  const [status, setStatus] = useState('');
  const [saving, setSaving] = useState(false);

  const parsedSilabas = parseSyllables(silabasText);

  const fetchWords = async () => {
    try {
      const snap = await getDocs(collection(db, 'juego_silabas'));
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      list.sort((a, b) => (a.palabra || '').localeCompare(b.palabra || ''));
      setWords(list);
    } catch (err) {
      console.error('Error loading syllable bank:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const load = async () => {
      try {
        const snap = await getDocs(collection(db, 'juego_silabas'));
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        list.sort((a, b) => (a.palabra || '').localeCompare(b.palabra || ''));
        setWords(list);
      } catch (err) {
        console.error('Error loading syllable bank:', err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const resetForm = () => {
    setEditingId(null);
    setPalabra('');
    setSilabasText('');
    setClue('');
  };

  const handleEdit = (word) => {
    setEditingId(word.id);
    setPalabra(word.palabra || '');
    setSilabasText((word.silabas || []).join('-'));
    setClue(word.clue || '');
    setStatus('');
  };

  const handleDelete = async (id) => {
    try {
      await deleteDoc(doc(db, 'juego_silabas', id));
      setWords((prev) => prev.filter((w) => w.id !== id));
      if (editingId === id) resetForm();
    } catch (err) {
      console.error('Error deleting word:', err);
      setStatus('❌ Error al eliminar.');
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();

    if (!palabra.trim() || !clue.trim() || parsedSilabas.length < 2) {
      setStatus('❌ Se necesita la palabra, la pista, y al menos 2 sílabas.');
      return;
    }

    setSaving(true);
    setStatus('');
    try {
      const id = editingId || doc(collection(db, 'juego_silabas')).id;
      await setDoc(doc(db, 'juego_silabas', id), {
        palabra: palabra.trim(),
        silabas: parsedSilabas,
        clue: clue.trim(),
        createdAt: new Date().toISOString(),
      });
      setStatus(`✅ ¡Guardado! "${palabra.trim()}"`);
      resetForm();
      fetchWords();
    } catch (err) {
      console.error('Error saving word:', err);
      setStatus('❌ Error al guardar en Firebase.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 p-4 sm:p-8">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-black text-white uppercase tracking-widest flex items-center gap-2">
            <span>🔤</span> Creador de Sílabas
          </h2>
          <Link to="/admin-daily-plan-hub" className="text-slate-400 hover:text-white text-xs font-bold border border-slate-700 px-3 py-1.5 rounded-lg">
            ← Hub
          </Link>
        </div>

        <form onSubmit={handleSave} className="bg-slate-800 p-6 rounded-2xl border border-slate-700 shadow-xl space-y-4">
          {editingId && (
            <p className="text-[10px] font-black uppercase tracking-widest text-amber-400">Editando palabra existente</p>
          )}
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Palabra</label>
            <input
              value={palabra}
              onChange={(e) => setPalabra(e.target.value)}
              placeholder="biblioteca"
              className="w-full bg-slate-900 border border-slate-700 text-white rounded-lg p-3 font-mono focus:outline-none focus:border-teal-500 transition-colors"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">
              Sílabas (separadas por guion, en orden)
            </label>
            <input
              value={silabasText}
              onChange={(e) => setSilabasText(e.target.value)}
              placeholder="bi-blio-te-ca"
              className="w-full bg-slate-900 border border-slate-700 text-white rounded-lg p-3 font-mono uppercase focus:outline-none focus:border-teal-500 transition-colors"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Pista / Definición</label>
            <textarea
              value={clue}
              onChange={(e) => setClue(e.target.value)}
              placeholder="Lugar con muchos libros para leer o estudiar."
              rows={2}
              className="w-full bg-slate-900 border border-slate-700 text-white rounded-lg p-3 focus:outline-none focus:border-teal-500 transition-colors"
            />
          </div>

          {parsedSilabas.length > 0 && (
            <div className="bg-slate-900 border border-slate-700 rounded-lg p-3">
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Vista Previa ({parsedSilabas.length} sílabas)</p>
              <div className="flex flex-wrap gap-2">
                {parsedSilabas.map((s, i) => (
                  <span key={i} className="text-xs font-bold text-teal-400 bg-slate-950 border border-slate-700 px-2 py-1 rounded uppercase">
                    {s}
                  </span>
                ))}
              </div>
            </div>
          )}

          {status && (
            <p className={`text-xs font-bold text-center ${status.includes('❌') ? 'text-rose-400' : 'text-emerald-400'}`}>{status}</p>
          )}

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={saving}
              className="flex-1 bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-white font-black uppercase tracking-widest py-3 rounded-lg transition-colors shadow-lg"
            >
              {saving ? 'Guardando...' : editingId ? 'Actualizar Palabra' : 'Guardar Palabra'}
            </button>
            {editingId && (
              <button
                type="button"
                onClick={resetForm}
                className="px-4 bg-slate-700 hover:bg-slate-600 text-white font-black uppercase tracking-widest py-3 rounded-lg transition-colors"
              >
                Cancelar
              </button>
            )}
          </div>
        </form>

        <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700 shadow-xl">
          <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-4">
            Banco de Palabras {!loading && `(${words.length})`}
          </h3>
          {loading ? (
            <p className="text-slate-500 text-sm italic">Cargando...</p>
          ) : words.length === 0 ? (
            <p className="text-slate-500 text-sm italic">Todavía no hay palabras. Agrega la primera arriba.</p>
          ) : (
            <div className="space-y-3">
              {words.map((w) => (
                <div key={w.id} className="bg-slate-900 border border-slate-700 rounded-xl p-4 flex justify-between items-start gap-4">
                  <div className="min-w-0">
                    <p className="font-bold text-white">{w.palabra}</p>
                    <p className="text-xs font-mono text-teal-400 uppercase mt-1">{(w.silabas || []).join(' - ')}</p>
                    {w.clue && <p className="text-xs text-slate-400 mt-1">{w.clue}</p>}
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button
                      onClick={() => handleEdit(w)}
                      className="text-[10px] font-bold uppercase tracking-widest bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-1.5 rounded border border-slate-700"
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => handleDelete(w.id)}
                      className="text-[10px] font-bold uppercase tracking-widest bg-rose-950/50 hover:bg-rose-900 text-rose-300 px-3 py-1.5 rounded border border-rose-800/50"
                    >
                      Eliminar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
