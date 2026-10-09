import React, { useState, useEffect, useMemo } from 'react';
import {
  listPoolQuestions,
  updatePoolQuestion,
  getCategoryImages,
  setCategoryImage,
  resolvePoolQuestionImage,
} from '../../utils/questionPool';
import ImageUploadField from '../shared/ImageUploadField';

// A generic placeholder shown whenever a pool question has neither its own
// image nor a category default — keeps the trivia game's board looking
// finished even for older entries nobody's gotten around to illustrating.
const PlaceholderThumb = () => (
  <div className="w-14 h-14 rounded-lg bg-slate-200 border border-slate-300 flex items-center justify-center text-2xl shrink-0">
    ❓
  </div>
);

// The editing surface for question_pool — browsing/picking is handled
// separately by QuestionPoolPickerModal. Editing a pool entry here never
// touches the curiosidad it may have been auto-created from
// (sourceCuriosidadId is just a breadcrumb) — the pool copy and the
// original question are deliberately independent after that first write.
const QuestionPoolManager = () => {
  const [entries, setEntries] = useState([]);
  const [categoryImages, setCategoryImagesState] = useState({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editDraft, setEditDraft] = useState(null);

  useEffect(() => {
    const load = async () => {
      try {
        const [list, images] = await Promise.all([listPoolQuestions(), getCategoryImages()]);
        setEntries(list);
        setCategoryImagesState(images);
      } catch (err) {
        console.error('Error loading question pool:', err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const categories = useMemo(
    () => [...new Set(entries.map((e) => e.category).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es')),
    [entries]
  );

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return entries;
    return entries.filter(
      (e) =>
        e.clue?.toLowerCase().includes(term) ||
        e.answer?.toLowerCase().includes(term) ||
        e.category?.toLowerCase().includes(term)
    );
  }, [entries, search]);

  const handleSetEntryImage = async (id, url) => {
    setEntries((prev) => prev.map((e) => (e.id === id ? { ...e, image: url } : e)));
    try {
      await updatePoolQuestion(id, { image: url });
    } catch (err) {
      console.error('Error saving question image:', err);
    }
  };

  const handleSetCategoryImage = async (category, url) => {
    setCategoryImagesState((prev) => ({ ...prev, [category]: url }));
    try {
      await setCategoryImage(category, url);
    } catch (err) {
      console.error('Error saving category image:', err);
    }
  };

  const startEditing = (entry) => {
    setEditingId(entry.id);
    setEditDraft({
      category: entry.category || '',
      clue: entry.clue || '',
      answer: entry.answer || '',
      distractorsText: (entry.distractors || []).join(', '),
    });
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditDraft(null);
  };

  const saveEditing = async (id) => {
    const patch = {
      category: editDraft.category.trim(),
      clue: editDraft.clue.trim(),
      answer: editDraft.answer.trim(),
      distractors: editDraft.distractorsText.split(',').map((d) => d.trim()).filter(Boolean),
    };
    setEntries((prev) => prev.map((e) => (e.id === id ? { ...e, ...patch } : e)));
    setEditingId(null);
    setEditDraft(null);
    try {
      await updatePoolQuestion(id, patch);
    } catch (err) {
      console.error('Error saving question edit:', err);
    }
  };

  if (loading) {
    return <div className="p-8 text-slate-400 font-bold uppercase tracking-widest animate-pulse">Cargando Reserva de Preguntas...</div>;
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 sm:p-8">
      <div className="max-w-5xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-black text-slate-800 tracking-tight">Reserva de Preguntas</h1>
          <p className="text-sm font-bold text-slate-400 uppercase tracking-widest mt-1">
            Usado por el juego de trivia (y cualquier otro que lea de question_pool)
          </p>
        </div>

        {categories.length > 0 && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5">
            <h2 className="text-sm font-black text-slate-700 uppercase tracking-widest mb-1">Imagen por Categoría</h2>
            <p className="text-xs text-slate-400 mb-4">
              Se aplica automáticamente a toda pregunta de esa categoría que no tenga su propia imagen — incluyendo preguntas que agregues después.
            </p>
            <div className="space-y-3">
              {categories.map((cat) => (
                <div key={cat} className="flex items-center gap-3">
                  {categoryImages[cat] ? (
                    <img src={categoryImages[cat]} alt="" className="w-14 h-14 rounded-lg object-cover border border-slate-300 shrink-0" />
                  ) : (
                    <PlaceholderThumb />
                  )}
                  <span className="text-xs font-black uppercase tracking-widest text-indigo-600 bg-indigo-100 rounded-full px-2 py-1 shrink-0 w-32 text-center truncate">
                    {cat}
                  </span>
                  <ImageUploadField
                    value={categoryImages[cat]}
                    onChange={(url) => handleSetCategoryImage(cat, url)}
                    folder="question_pool"
                    inputClassName="w-full bg-slate-50 border border-slate-200 rounded-md p-2 text-[10px] font-mono outline-none text-slate-500"
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-5 border-b border-slate-200">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por categoría, pregunta o respuesta..."
              className="w-full border border-slate-300 rounded-lg p-2 text-sm"
            />
          </div>

          {filtered.length === 0 ? (
            <p className="text-center text-slate-400 italic font-bold py-12">
              {entries.length === 0
                ? 'Todavía no hay preguntas en la reserva. Se agregan automáticamente al guardar preguntas de Opción Múltiple.'
                : 'Ninguna pregunta coincide con tu búsqueda.'}
            </p>
          ) : (
            <div className="divide-y divide-slate-100">
              {filtered.map((entry) => {
                const resolvedImage = resolvePoolQuestionImage(entry, categoryImages);
                const usingCategoryDefault = !entry.image && resolvedImage;
                const isEditing = editingId === entry.id;

                if (isEditing) {
                  return (
                    <div key={entry.id} className="p-4 space-y-3 bg-indigo-50/50">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <input
                          type="text"
                          value={editDraft.category}
                          onChange={(e) => setEditDraft((d) => ({ ...d, category: e.target.value }))}
                          placeholder="Categoría"
                          className="border border-slate-300 rounded-md p-2 text-sm"
                        />
                        <input
                          type="text"
                          value={editDraft.answer}
                          onChange={(e) => setEditDraft((d) => ({ ...d, answer: e.target.value }))}
                          placeholder="Respuesta correcta"
                          className="border border-slate-300 rounded-md p-2 text-sm font-bold"
                        />
                      </div>
                      <textarea
                        value={editDraft.clue}
                        onChange={(e) => setEditDraft((d) => ({ ...d, clue: e.target.value }))}
                        placeholder="Pregunta / pista"
                        rows={2}
                        className="w-full border border-slate-300 rounded-md p-2 text-sm"
                      />
                      <input
                        type="text"
                        value={editDraft.distractorsText}
                        onChange={(e) => setEditDraft((d) => ({ ...d, distractorsText: e.target.value }))}
                        placeholder="Distractores, separados por comas"
                        className="w-full border border-slate-300 rounded-md p-2 text-sm"
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={() => saveEditing(entry.id)}
                          className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black uppercase tracking-widest px-4 py-2 rounded-lg"
                        >
                          Guardar
                        </button>
                        <button
                          onClick={cancelEditing}
                          className="text-slate-500 text-xs font-black uppercase tracking-widest px-4 py-2"
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  );
                }

                return (
                  <div key={entry.id} className="p-4 flex items-center gap-4">
                    {resolvedImage ? (
                      <img src={resolvedImage} alt="" className="w-14 h-14 rounded-lg object-cover border border-slate-300 shrink-0" />
                    ) : (
                      <PlaceholderThumb />
                    )}
                    <div className="min-w-0 flex-1">
                      {entry.category && (
                        <span className="inline-block text-[9px] font-black uppercase tracking-widest text-indigo-600 bg-indigo-100 rounded-full px-2 py-0.5 mb-1">
                          {entry.category}
                        </span>
                      )}
                      <p className="text-sm font-bold text-slate-800 truncate">{entry.clue}</p>
                      <p className="text-xs text-slate-500">✓ {entry.answer}</p>
                    </div>
                    <button
                      onClick={() => startEditing(entry)}
                      className="text-[10px] font-black text-indigo-600 hover:text-indigo-500 uppercase tracking-widest shrink-0"
                    >
                      ✏️ Editar
                    </button>
                    <div className="w-64 shrink-0">
                      <ImageUploadField
                        value={entry.image}
                        onChange={(url) => handleSetEntryImage(entry.id, url)}
                        folder="question_pool"
                        placeholder={usingCategoryDefault ? 'Usando la imagen de la categoría...' : 'Imagen propia (opcional)'}
                        inputClassName="w-full bg-slate-50 border border-slate-200 rounded-md p-2 text-[10px] font-mono outline-none text-slate-500"
                      />
                      {usingCategoryDefault && (
                        <p className="text-[9px] text-slate-400 mt-1">Usando imagen de "{entry.category}"</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default QuestionPoolManager;
