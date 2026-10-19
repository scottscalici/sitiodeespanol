import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { collection, getDocs, doc, setDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { invalidateCollectionCache } from '../../utils/firestoreCache';
import GrammarNoteBlocksModal from './GrammarNoteBlocksModal';
import GrammarLandingSubtopicsModal from './GrammarLandingSubtopicsModal';

// grammar_pages is a flat, one-document-per-note collection (no _bundle
// pattern) — see GrammarIndexPage/GrammarNoteViewer, the collection's only
// other readers. IDs here are meaningful and durable (other notes and the
// day-sequencer link to them directly), so unlike CuriosidadesManager this
// editor never auto-generates or silently changes an id — a new note's id
// is typed in by hand and locked once saved.
const emptyNote = () => ({
  id: '',
  title: '',
  category: '',
  topic: '',
  noteType: 'subtopic', // 'subtopic' | 'landing'
  blocks: [],
  subtopics: [],
  isNew: true,
});

const GrammarNotesManager = () => {
  const [items, setItems] = useState([]);
  const [legacyCount, setLegacyCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [blocksModalItem, setBlocksModalItem] = useState(null);
  const [subtopicsModalItem, setSubtopicsModalItem] = useState(null);

  useEffect(() => {
    const fetchNotes = async () => {
      try {
        const snap = await getDocs(collection(db, 'grammar_pages'));
        let legacy = 0;
        const fetched = snap.docs.map((d) => {
          const data = d.data();
          const isLegacy = data.htmlContent !== undefined && !Array.isArray(data.blocks) && data.type !== 'landing';
          if (isLegacy) legacy += 1;
          return {
            id: d.id,
            title: data.title || '',
            category: data.category || '',
            topic: data.topic || '',
            noteType: data.type === 'landing' ? 'landing' : 'subtopic',
            blocks: Array.isArray(data.blocks) ? data.blocks : [],
            subtopics: Array.isArray(data.subtopics) ? data.subtopics : [],
            isLegacy,
          };
        });
        fetched.sort((a, b) => (a.topic || a.id).localeCompare(b.topic || b.id) || a.id.localeCompare(b.id));
        setItems(fetched);
        setLegacyCount(legacy);
      } catch (err) {
        console.error('Error fetching grammar notes:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchNotes();
  }, []);

  const handleFieldChange = (idx, field, value) => {
    setItems((prev) => prev.map((item, i) => (i === idx ? { ...item, [field]: value } : item)));
  };

  const handleAddNote = () => setItems((prev) => [emptyNote(), ...prev]);

  const handleRemoveNote = async (idx) => {
    const item = items[idx];
    const confirmed = window.confirm(`¿Borrar "${item.title || item.id}"? Esto NO se puede deshacer — cualquier enlace a este ID quedará roto.`);
    if (!confirmed) return;
    if (!item.isNew) {
      try {
        await deleteDoc(doc(db, 'grammar_pages', item.id));
        invalidateCollectionCache('grammar_pages');
      } catch (err) {
        console.error('Error deleting grammar note:', err);
        alert('Error al borrar.');
        return;
      }
    }
    setItems((prev) => prev.filter((_, i) => i !== idx));
  };

  // Writes just this one note. `includeBlocks` gates whether `type`/
  // `blocks`/`subtopics` get written at all — a plain top-level "Guardar
  // Cambios" over EVERY row must never silently write `blocks: []` onto an
  // untouched legacy (htmlContent) note, since GrammarNoteViewer treats the
  // mere presence of a `blocks` array as "render the new system" and would
  // start showing a blank page instead of that note's real content. Only a
  // brand-new note (no prior doc to clobber) or an explicit save from the
  // blocks/subtopics modal (the deliberate "convert this note" action) is
  // allowed to write those fields.
  const writeNote = async (item, { includeBlocks = false } = {}) => {
    const payload = { title: item.title, category: item.category, topic: item.topic };
    if (!item.isLegacy || includeBlocks) {
      payload.type = item.noteType;
      payload.blocks = item.blocks;
      payload.subtopics = item.subtopics;
    }
    await setDoc(doc(db, 'grammar_pages', item.id), payload, { merge: !item.isNew });
    invalidateCollectionCache('grammar_pages');
  };

  const handleSaveBlocks = async (idx, blocks) => {
    const item = { ...items[idx], blocks };
    if (!item.id.trim()) throw new Error('Falta el ID de la nota.');
    await writeNote(item, { includeBlocks: true });
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, blocks, isNew: false, isLegacy: false } : it)));
  };

  const handleSaveSubtopics = async (idx, subtopics) => {
    const item = { ...items[idx], subtopics };
    if (!item.id.trim()) throw new Error('Falta el ID de la nota.');
    await writeNote(item, { includeBlocks: true });
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, subtopics, isNew: false, isLegacy: false } : it)));
  };

  const handleSaveAll = async () => {
    const newWithoutId = items.find((it) => it.isNew && !it.id.trim());
    if (newWithoutId) {
      alert('Cada nota nueva necesita un ID antes de guardar.');
      return;
    }
    setIsSaving(true);
    try {
      for (const item of items) {
        await writeNote(item);
      }
      setItems((prev) => prev.map((it) => ({ ...it, isNew: false })));
      alert('¡Notas guardadas exitosamente!');
    } catch (err) {
      console.error('Error saving grammar notes:', err);
      alert('Error al guardar.');
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) {
    return <div className="p-8 text-slate-400 font-bold uppercase tracking-widest animate-pulse">Cargando Notas de Gramática...</div>;
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 sm:p-8">
      <div className="max-w-[1500px] mx-auto bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="sticky top-0 bg-white border-b border-slate-200 p-6 flex justify-between items-center z-10 shadow-sm">
          <div>
            <h1 className="text-2xl font-black text-slate-800 tracking-tight">Grammar Notes Manager</h1>
            <p className="text-sm font-bold text-slate-400 uppercase tracking-widest mt-1">Gestor de notas de gramática (nuevo sistema de bloques)</p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              to="/admin-grammar-notes-upload"
              className="bg-white hover:bg-slate-50 text-slate-500 border border-slate-200 px-5 py-3 rounded-lg font-black uppercase tracking-widest text-xs transition-colors"
            >
              📤 Subir JSON
            </Link>
            <Link
              to="/admin-daily-plan-gramatica"
              className="bg-white hover:bg-slate-50 text-slate-500 border border-slate-200 px-5 py-3 rounded-lg font-black uppercase tracking-widest text-xs transition-colors"
            >
              ← Secuenciador
            </Link>
            <button
              onClick={handleAddNote}
              className="bg-white hover:bg-slate-50 text-indigo-600 border border-indigo-200 px-5 py-3 rounded-lg font-black uppercase tracking-widest text-xs transition-colors"
            >
              + Agregar Nota
            </button>
            <button
              onClick={handleSaveAll}
              disabled={isSaving}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-lg font-black uppercase tracking-widest text-xs transition-colors disabled:opacity-50"
            >
              {isSaving ? 'Guardando...' : 'Guardar Cambios'}
            </button>
          </div>
        </div>

        {legacyCount > 0 && (
          <div className="p-4 bg-amber-50 border-b-2 border-amber-300">
            <p className="text-xs font-black text-amber-800 uppercase tracking-widest">
              ℹ️ {legacyCount} nota(s) todavía en el formato antiguo (HTML)
            </p>
            <p className="text-xs text-amber-700 mt-1">
              Siguen funcionando exactamente igual — no es necesario migrarlas ahora. Para editarlas con el nuevo sistema de bloques, agrégales un bloque aquí (eso las convierte).
            </p>
          </div>
        )}

        <div className="grid grid-cols-[repeat(14,minmax(0,1fr))] gap-4 p-4 bg-slate-100 border-b border-slate-200 font-black text-[10px] uppercase tracking-widest text-slate-500 items-center">
          <div className="col-span-3 text-indigo-600">ID</div>
          <div className="col-span-2">Título</div>
          <div className="col-span-2">Categoría</div>
          <div className="col-span-2">Tema</div>
          <div className="col-span-1 text-center">Tipo</div>
          <div className="col-span-2 text-center">Contenido</div>
          <div className="col-span-1 text-center">Borrar</div>
        </div>

        <div className="divide-y divide-slate-100">
          {items.map((item, idx) => (
            <div key={item.isNew ? `new-${idx}` : item.id} className="grid grid-cols-[repeat(14,minmax(0,1fr))] gap-4 p-2 hover:bg-slate-50 transition-colors items-center">
              <div className="col-span-3">
                {item.isNew ? (
                  <input
                    type="text"
                    value={item.id}
                    onChange={(e) => handleFieldChange(idx, 'id', e.target.value)}
                    placeholder="topico:subtema"
                    className="w-full bg-white border border-indigo-300 focus:ring-2 focus:ring-indigo-500 rounded-md p-2 text-xs font-mono outline-none"
                  />
                ) : (
                  <span className="font-mono text-[10px] text-slate-400 font-bold truncate block px-2" title="El ID no se puede editar una vez guardado — los enlaces de otras notas dependen de él.">
                    {item.id} {item.isLegacy && <span className="text-amber-500">(HTML)</span>}
                  </span>
                )}
              </div>

              <div className="col-span-2">
                <input
                  type="text"
                  value={item.title}
                  onChange={(e) => handleFieldChange(idx, 'title', e.target.value)}
                  className="w-full bg-transparent border-none focus:ring-2 focus:ring-indigo-500 rounded-md p-2 text-xs font-medium outline-none"
                />
              </div>

              <div className="col-span-2">
                <input
                  type="text"
                  value={item.category}
                  onChange={(e) => handleFieldChange(idx, 'category', e.target.value)}
                  placeholder="Opcional"
                  className="w-full bg-transparent border-none focus:ring-2 focus:ring-indigo-500 rounded-md p-2 text-xs font-medium outline-none text-slate-500"
                />
              </div>

              <div className="col-span-2">
                <input
                  type="text"
                  value={item.topic}
                  onChange={(e) => handleFieldChange(idx, 'topic', e.target.value)}
                  placeholder="p. ej. imperfecto"
                  className="w-full bg-transparent border-none focus:ring-2 focus:ring-indigo-500 rounded-md p-2 text-xs font-medium outline-none text-slate-500"
                />
              </div>

              <div className="col-span-1 text-center">
                <select
                  value={item.noteType}
                  onChange={(e) => handleFieldChange(idx, 'noteType', e.target.value)}
                  className="w-full bg-slate-100 border-none rounded-md p-1.5 text-[10px] font-bold outline-none"
                >
                  <option value="subtopic">Subtema</option>
                  <option value="landing">Landing</option>
                </select>
              </div>

              <div className="col-span-2 flex items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={() => setBlocksModalItem(idx)}
                  className="text-[10px] font-black uppercase tracking-widest text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 rounded-lg px-2 py-1.5 border border-indigo-200 transition-colors"
                  title="Editar bloques de contenido"
                >
                  🧩 {item.blocks.length}
                </button>
                {item.noteType === 'landing' && (
                  <button
                    type="button"
                    onClick={() => setSubtopicsModalItem(idx)}
                    className="text-[10px] font-black uppercase tracking-widest text-emerald-600 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100 rounded-lg px-2 py-1.5 border border-emerald-200 transition-colors"
                    title="Editar lista de subtemas"
                  >
                    📑 {item.subtopics.length}
                  </button>
                )}
              </div>

              <div className="col-span-1 text-center">
                <button
                  type="button"
                  onClick={() => handleRemoveNote(idx)}
                  className="text-[10px] font-black uppercase tracking-widest text-rose-500 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-lg px-2 py-1.5 border border-rose-200 transition-colors"
                >
                  🗑️
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {blocksModalItem !== null && (
        <GrammarNoteBlocksModal
          note={items[blocksModalItem]}
          onClose={() => setBlocksModalItem(null)}
          onSave={(blocks) => handleSaveBlocks(blocksModalItem, blocks)}
        />
      )}
      {subtopicsModalItem !== null && (
        <GrammarLandingSubtopicsModal
          note={items[subtopicsModalItem]}
          onClose={() => setSubtopicsModalItem(null)}
          onSave={(subtopics) => handleSaveSubtopics(subtopicsModalItem, subtopics)}
        />
      )}
    </div>
  );
};

export default GrammarNotesManager;
