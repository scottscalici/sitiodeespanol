import React, { useState, useEffect } from 'react';
import { collection, getDocs, doc, setDoc } from 'firebase/firestore';
import { db } from '../../firebase';

export default function CalentamientoAdmin() {
  const [calId, setCalId] = useState('cal_s2_d26');
  const [title, setTitle] = useState('Mandatos Informales (+)');
  const [dia, setDia] = useState(26);
  const [course, setCourse] = useState('s2');

  // Available groups and vocabulary loaded from Firestore
  const [verbGroups, setVerbGroups] = useState([]);
  const [selectedGroup, setSelectedGroup] = useState('');
  const [configBlocks, setConfigBlocks] = useState([]);

  // Vocab selection
  const [vocabItems, setVocabItems] = useState([]);
  const [selectedVocabIds, setSelectedVocabIds] = useState([]);

  // Master verb map cache for preview & baking
  const [masterVerbsMap, setMasterVerbsMap] = useState({});
  const [previewQuestions, setPreviewQuestions] = useState([]);

  // Verb Generator Advanced Controls
  const [includeVosotros, setIncludeVosotros] = useState(false);

  const [saving, setSaving] = useState(false);
  const [loadingMeta, setLoadingMeta] = useState(true);

  const availableTenses = [
    { id: 'presente', label: 'Presente' },
    { id: 'pretérito', label: 'Pretérito' },
    { id: 'imperfecto', label: 'Imperfecto' },
    { id: 'futuro', label: 'Futuro' },
    { id: 'condicional', label: 'Condicional' },
    { id: 'subjuntivo_presente', label: 'Subjuntivo (Presente)' },
    { id: 'subjuntivo_imperfecto_ra', label: 'Subjuntivo (Imperfecto -ra)' },
    { id: 'imperativo_afirmativo', label: 'Mandatos Afirmativos (Tú/Ud/Uds)' },
    { id: 'imperativo_negativo', label: 'Mandatos Negativos' },
    { id: 'presente_progresivo', label: 'Presente Progresivo' },
    { id: 'pluscuamperfecto', label: 'Pluscuamperfecto' },
  ];

  useEffect(() => {
    const fetchMetaData = async () => {
      try {
        const groupsSnap = await getDocs(collection(db, 'verbGroups'));
        const groups = groupsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setVerbGroups(groups);

        const vocabSnap = await getDocs(collection(db, 'vocabulary'));
        const vocab = vocabSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setVocabItems(vocab);

        const verbsSnap = await getDocs(collection(db, 'verbs'));
        const verbsMap = {};
        verbsSnap.forEach((d) => {
          verbsMap[d.id] = d.data();
        });
        setMasterVerbsMap(verbsMap);
      } catch (err) {
        console.error('Error loading metadata:', err);
      } finally {
        setLoadingMeta(false);
      }
    };
    fetchMetaData();
  }, []);

  const handleGroupSelect = (groupId) => {
    setSelectedGroup(groupId);
    const found = verbGroups.find((g) => g.id === groupId);
    if (found) {
      setConfigBlocks([
        ...configBlocks,
        {
          label: found.name,
          tense: 'presente',
          allowedVerbs: found.verbIds || [],
          count: 5,
          specificVerb: 'any',
          targetSubject: 'any',
        },
      ]);
    }
  };

  const updateBlockConfig = (index, field, value) => {
    const updated = [...configBlocks];
    updated[index][field] = value;
    setConfigBlocks(updated);
  };

  const removeBlockConfig = (index) => {
    setConfigBlocks(configBlocks.filter((_, i) => i !== index));
  };

  const cloneBlockConfig = (index) => {
    const blockToClone = configBlocks[index];
    const duplicated = {
      ...blockToClone,
      label: `${blockToClone.label} (Copia)`,
    };
    const updated = [...configBlocks];
    updated.splice(index + 1, 0, duplicated);
    setConfigBlocks(updated);
  };

  // --- SMART SUBJECT PICKER (70/30 Singular/Plural, Vosotros Controlled) ---
  const getRandomSubject = (targetPref) => {
    if (targetPref !== 'any') return targetPref;

    const singulars = ['yo', 'tú', 'él_ella_ud'];
    const plurals = includeVosotros
      ? ['nosotros', 'vosotros', 'ellos_ellas_uds']
      : ['nosotros', 'ellos_ellas_uds'];

    // 70% chance for singular, 30% for plural
    const isSingular = Math.random() < 0.7;
    if (isSingular) {
      return singulars[Math.floor(Math.random() * singulars.length)];
    } else {
      return plurals[Math.floor(Math.random() * plurals.length)];
    }
  };

 // --- HELPERS TO CLEAN UP 3RD PERSON SUBJECTS ---
 const formatSubjectAndTranslation = (rawSubject, rawEnglish) => {
  let sp = rawSubject;
  let en = rawEnglish || 'Sin traducción';

  if (rawSubject === 'él_ella_ud') {
    const choices = [
      { subj: 'él', enPrefix: 'he' },
      { subj: 'ella', enPrefix: 'she' },
      { subj: 'Ud.', enPrefix: 'you (formal)' }
    ];
    const choice = choices[Math.floor(Math.random() * choices.length)];
    sp = choice.subj;
    en = en.replace(/he\/she\/you/i, choice.enPrefix);
  } else if (rawSubject === 'ellos_ellas_uds') {
    const choices = [
      { subj: 'ellos', enPrefix: 'they' },
      { subj: 'ellas', enPrefix: 'they' },
      { subj: 'Uds.', enPrefix: 'you all' }
    ];
    const choice = choices[Math.floor(Math.random() * choices.length)];
    sp = choice.subj;
    en = en.replace(/they\/you all/i, choice.enPrefix);
  }
  
  return { sp, en };
};

// --- HELPER GENERATOR FUNCTION ---
const generateQuestionsArray = () => {
  let finalizedQuestions = [];

  for (const block of configBlocks) {
    let pool = block.allowedVerbs.map(vId => masterVerbsMap[vId]).filter(Boolean);
    
    if (block.specificVerb !== 'any') {
      pool = pool.filter(v => v.palabra === block.specificVerb);
    }

    for (let i = 0; i < block.count && pool.length > 0; i++) {
      const randomVerb = pool[Math.floor(Math.random() * pool.length)];
      const chosenTense = block.tense;
      
      const rawSubject = getRandomSubject(block.targetSubject);
      
      // Navigate nested structure
      const tenseMap = randomVerb.tenses?.[chosenTense] || {};
      const subjectData = tenseMap[rawSubject] || {};

      // Extract form and raw english
      const formAnswer = subjectData.target || '???';
      const rawEnglish = subjectData.english || randomVerb.translations?.infinitivo?.english || '';

      // Clean up 3rd person subjects & translations
      const { sp: finalSubject, en: finalEnglish } = formatSubjectAndTranslation(rawSubject, rawEnglish);

      finalizedQuestions.push({
        palabra: randomVerb.palabra,
        mostrar: randomVerb.palabra,
        tense: chosenTense,
        sujeto: finalSubject,
        traducción: finalEnglish,
        forma: formAnswer
      });
    }
  }
  return finalizedQuestions;
};

  const handlePreview = () => {
    const generated = generateQuestionsArray();
    setPreviewQuestions(generated);
  };

  // --- SHUFFLE PRESERVING QUESTION #1 ANCHOR ---
  const shufflePreviewPreserveFirst = () => {
    if (previewQuestions.length <= 1) return;
    const anchor = previewQuestions[0];
    const rest = [...previewQuestions.slice(1)];

    for (let i = rest.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [rest[i], rest[j]] = [rest[j], rest[i]];
    }

    setPreviewQuestions([anchor, ...rest]);
  };

  // --- MOVE PREVIEW ITEM (Locking index 0) ---
  const movePreviewIndex = (index, direction) => {
    if (index === 0) return; // Cannot move anchor Q1
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex === 0) return; // Cannot swap into Q1 position
    if (targetIndex >= previewQuestions.length) return;

    const updated = [...previewQuestions];
    const temp = updated[index];
    updated[index] = updated[targetIndex];
    updated[targetIndex] = temp;
    setPreviewQuestions(updated);
  };

  const handleSaveAndLockCalentamiento = async (e) => {
    e.preventDefault();
    setSaving(true);

    try {
      if (previewQuestions.length === 0) {
        alert(
          'Por favor genera o revisa la vista previa de preguntas antes de guardar.'
        );
        setSaving(false);
        return;
      }

      const selectedVocabData = vocabItems
        .filter((v) => selectedVocabIds.includes(v.id))
        .map((v) => ({
          es: v.palabra || v.spanish,
          en: v.english,
        }));

      const docRef = doc(db, 'calentamientos', calId);
      await setDoc(
        docRef,
        {
          id: calId,
          title,
          dia: Number(dia),
          course,
          configBlocks,
          bakedQuestions: previewQuestions,
          vocab: selectedVocabData,
          createdAt: new Date().toISOString(),
        },
        { merge: true }
      );

      alert(
        '¡Calentamiento creado y preguntas fijadas exitosamente en Firestore!'
      );
    } catch (error) {
      console.error('Error saving calentamiento:', error);
      alert(`Error: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  if (loadingMeta) {
    return (
      <div className="p-10 text-center font-bold text-slate-400">
        Cargando grupos de verbos y vocabulario...
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6 font-sans pb-20">
      <div className="mb-6 border-b border-slate-200 pb-4">
        <h1 className="text-3xl font-black text-slate-800 uppercase tracking-tight">
          Creador de Calentamientos con Vista Previa
        </h1>
        <p className="text-slate-500 font-bold text-sm mt-1">
          Elige los grupos, ajusta las reglas de sujeto, previsualiza y
          reorganiza antes de fijar.
        </p>
      </div>

      <form onSubmit={handleSaveAndLockCalentamiento} className="space-y-6">
        {/* METADATA */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs font-black text-slate-500 uppercase mb-1">
              ID Documento
            </label>
            <input
              type="text"
              value={calId}
              onChange={(e) => setCalId(e.target.value)}
              className="w-full p-2.5 border rounded-xl font-bold bg-slate-50"
              required
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-xs font-black text-slate-500 uppercase mb-1">
              Título
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full p-2.5 border rounded-xl font-bold"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-black text-slate-500 uppercase mb-1">
              Curso / Día
            </label>
            <div className="flex gap-2">
              <select
                value={course}
                onChange={(e) => setCourse(e.target.value)}
                className="w-1/2 p-2.5 border rounded-xl font-bold uppercase bg-slate-50"
              >
                <option value="s2">S2</option>
                <option value="s4">S4</option>
              </select>
              <input
                type="number"
                value={dia}
                onChange={(e) => setDia(e.target.value)}
                className="w-1/2 p-2.5 border rounded-xl font-bold text-center"
              />
            </div>
          </div>
        </div>

        {/* GLOBAL VERB SETTINGS (Vosotros Toggle) */}
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 flex items-center justify-between">
          <div>
            <h4 className="text-xs font-black text-slate-700 uppercase">
              Configuración Global de Sujetos
            </h4>
            <p className="text-[11px] text-slate-400">
              Los sujetos singulares tienen mayor probabilidad (70/30). Vosotros
              está excluido por defecto.
            </p>
          </div>
          <label className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer bg-slate-50 px-3 py-2 rounded-xl border">
            <input
              type="checkbox"
              checked={includeVosotros}
              onChange={(e) => setIncludeVosotros(e.target.checked)}
              className="rounded text-amber-500"
            />
            <span>Incluir "Vosotros" en selección aleatoria</span>
          </label>
        </div>

        {/* VERB GROUP SELECTION PANEL */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 space-y-4">
          <h2 className="text-lg font-black text-slate-800 uppercase">
            1. Configurar Bloques de Verbos y Tiempos
          </h2>

          <div className="max-w-md">
            <label className="block text-xs font-black text-slate-500 uppercase mb-1">
              Añadir Grupo desde la Base de Datos
            </label>
            <select
              value={selectedGroup}
              onChange={(e) => handleGroupSelect(e.target.value)}
              className="w-full p-2.5 border rounded-xl font-bold bg-slate-50"
            >
              <option value="">-- Selecciona un Grupo --</option>
              {verbGroups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name} ({g.level})
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-3 mt-4">
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-wider">
              Bloques Activos:
            </h3>
            {configBlocks.length === 0 && (
              <p className="text-slate-400 text-xs italic">
                Selecciona un grupo arriba para empezar a configurar bloques.
              </p>
            )}

            {configBlocks.map((block, idx) => (
              <div
                key={idx}
                className="p-4 bg-slate-50 rounded-xl border border-slate-200 grid grid-cols-1 md:grid-cols-7 gap-3 items-center"
              >
                <div>
                  <p className="text-xs font-black text-slate-700">
                    {block.label}
                  </p>
                  <p className="text-[10px] text-slate-400">
                    {block.allowedVerbs.length} verbos
                  </p>
                </div>
                <div>
                  <label className="block text-[9px] font-black text-slate-400 uppercase mb-1">
                    Tiempo
                  </label>
                  <select
                    value={block.tense}
                    onChange={(e) =>
                      updateBlockConfig(idx, 'tense', e.target.value)
                    }
                    className="w-full p-1.5 border rounded-lg text-xs font-bold bg-white"
                  >
                    {availableTenses.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[9px] font-black text-slate-400 uppercase mb-1">
                    Cantidad
                  </label>
                  <input
                    type="number"
                    value={block.count}
                    onChange={(e) =>
                      updateBlockConfig(idx, 'count', Number(e.target.value))
                    }
                    className="w-full p-1.5 border rounded-lg text-xs font-bold text-center bg-white"
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-black text-slate-400 uppercase mb-1">
                    Verbo Específico
                  </label>
                  <select
                    value={block.specificVerb}
                    onChange={(e) =>
                      updateBlockConfig(idx, 'specificVerb', e.target.value)
                    }
                    className="w-full p-1.5 border rounded-lg text-xs font-bold bg-white"
                  >
                    <option value="any">Cualquiera</option>
                    {block.allowedVerbs.map((v) => (
                      <option key={v} value={v}>
                        {v}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[9px] font-black text-slate-400 uppercase mb-1">
                    Sujeto
                  </label>
                  <select
                    value={block.targetSubject}
                    onChange={(e) =>
                      updateBlockConfig(idx, 'targetSubject', e.target.value)
                    }
                    className="w-full p-1.5 border rounded-lg text-xs font-bold bg-white"
                  >
                    <option value="any">Mix (70/30 Singulares)</option>
                    <option value="yo">Yo</option>
                    <option value="tú">Tú</option>
                    <option value="él_ella_ud">Él / Ella / Ud.</option>
                    <option value="nosotros">Nosotros</option>
                    {includeVosotros && (
                      <option value="vosotros">Vosotros</option>
                    )}
                    <option value="ellos_ellas_uds">Ellos / Uds.</option>
                  </select>
                </div>
                <div className="flex gap-1 justify-end">
                  <button
                    type="button"
                    onClick={() => cloneBlockConfig(idx)}
                    className="p-2 text-sky-600 font-bold text-sm"
                    title="Duplicar bloque"
                  >
                    📋
                  </button>
                  <button
                    type="button"
                    onClick={() => removeBlockConfig(idx)}
                    className="p-2 text-rose-500 font-bold text-sm"
                    title="Eliminar bloque"
                  >
                    🗑️
                  </button>
                </div>
              </div>
            ))}
          </div>

          {configBlocks.length > 0 && (
            <div className="pt-2">
              <button
                type="button"
                onClick={handlePreview}
                className="px-6 py-2.5 bg-amber-500 hover:bg-amber-600 text-white font-black rounded-xl text-xs uppercase tracking-wider shadow-sm transition-all"
              >
                👁️ Generar Vista Previa Aleatoria
              </button>
            </div>
          )}
        </div>

        {/* LIVE PREVIEW & REORDERING PANEL */}
        {previewQuestions.length > 0 && (
          <div className="bg-slate-900 text-white p-6 rounded-2xl shadow-md space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-black text-amber-400 uppercase tracking-widest">
                Vista Previa de Preguntas Generadas ({previewQuestions.length})
              </h3>
              <button
                type="button"
                onClick={shufflePreviewPreserveFirst}
                className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-amber-300 text-xs font-bold rounded-lg border border-slate-700"
              >
                🔀 Mezclar (Mantener #1 Fijo)
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-80 overflow-y-auto pr-2">
              {previewQuestions.map((q, i) => (
                <div
                  key={i}
                  className={`p-3 rounded-xl border text-xs ${
                    i === 0
                      ? 'bg-amber-950/40 border-amber-500/50'
                      : 'bg-slate-800 border-slate-700'
                  }`}
                >
                  <div className="flex justify-between text-[10px] text-slate-400 font-mono mb-1">
                    <span
                      className={i === 0 ? 'text-amber-400 font-black' : ''}
                    >
                      #{i + 1} {i === 0 ? '(ANCLA UNIVERSAL)' : ''} • {q.tense}
                    </span>
                    <div className="flex gap-1 items-center">
                      <span className="text-sky-400 mr-2">{q.sujeto}</span>
                      {i !== 0 && (
                        <>
                          <button
                            type="button"
                            onClick={() => movePreviewIndex(i, 'up')}
                            className="text-slate-400 hover:text-white px-1"
                          >
                            ▲
                          </button>
                          <button
                            type="button"
                            onClick={() => movePreviewIndex(i, 'down')}
                            className="text-slate-400 hover:text-white px-1"
                          >
                            ▼
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                  <p className="font-black text-white uppercase">{q.palabra}</p>
                  <p className="text-slate-300 italic text-[11px]">
                    {q.traducción}
                  </p>
                  <p className="text-emerald-400 font-mono font-bold mt-1">
                    ➡ {q.forma}
                  </p>
                </div>
              ))}
            </div>
            <p className="text-[10px] text-slate-400 italic">
              La pregunta #1 se mantiene anclada para asegurar la uniformidad de
              la clase. Puedes mover o mezclar el resto antes de guardar.
            </p>
          </div>
        )}

        {/* VOCABULARY SELECTION PANEL */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 space-y-4">
          <h2 className="text-lg font-black text-slate-800 uppercase">
            2. Seleccionar Vocabulario (Estación de Vocab)
          </h2>
          <div className="max-h-48 overflow-y-auto border border-slate-200 rounded-xl p-3 grid grid-cols-1 md:grid-cols-3 gap-2 bg-slate-50">
            {vocabItems.map((vocab) => (
              <label
                key={vocab.id}
                className="flex items-center gap-2 text-xs font-bold text-slate-700 bg-white p-2 rounded-lg border border-slate-100 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={selectedVocabIds.includes(vocab.id)}
                  onChange={(e) => {
                    if (e.target.checked)
                      setSelectedVocabIds([...selectedVocabIds, vocab.id]);
                    else
                      setSelectedVocabIds(
                        selectedVocabIds.filter((id) => id !== vocab.id)
                      );
                  }}
                  className="rounded text-sky-600"
                />
                <span className="truncate">
                  {vocab.palabra || vocab.spanish} ({vocab.english})
                </span>
              </label>
            ))}
          </div>
          <p className="text-xs font-bold text-sky-600">
            Términos seleccionados: {selectedVocabIds.length}
          </p>
        </div>

        {/* SUBMIT */}
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="px-8 py-4 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-2xl shadow-lg uppercase tracking-widest text-xs transition-transform hover:scale-105 disabled:opacity-50"
          >
            {saving
              ? 'Fijando y Guardando...'
              : '🔒 Fijar Preguntas y Guardar Calentamiento'}
          </button>
        </div>
      </form>
    </div>
  );
}
