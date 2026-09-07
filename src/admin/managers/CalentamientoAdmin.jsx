import React, { useState, useEffect } from 'react';
import { collection, getDocs, doc, setDoc } from 'firebase/firestore';
import { db } from '../../firebase';

export default function CalentamientoAdmin() {
  const [calId, setCalId] = useState('cal_s2_d26');
  const [title, setTitle] = useState('Mandatos Informales (+)');
  const [dia, setDia] = useState(26);
  const [course, setCourse] = useState('s2');

  // Available groups and practices loaded from Firestore
  const [verbGroups, setVerbGroups] = useState([]);
  const [savedPractices, setSavedPractices] = useState([]);
  const [selectedGroup, setSelectedGroup] = useState('');
  const [configBlocks, setConfigBlocks] = useState([]);

  // Master verb map cache for preview & baking
  const [masterVerbsMap, setMasterVerbsMap] = useState({});
  const [previewQuestions, setPreviewQuestions] = useState([]);
  
  // State to track which preview card is being edited
  const [editingPreviewIndex, setEditingPreviewIndex] = useState(null);

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

        const calsSnap = await getDocs(collection(db, 'calentamientos'));
        const cals = calsSnap.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => a.dia - b.dia);
        setSavedPractices(cals);

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

  // --- LOADER ---
  const loadPractice = (practiceId) => {
    if (!practiceId) return;
    const p = savedPractices.find(x => x.id === practiceId);
    if (p) {
      setCalId(p.id);
      setTitle(p.title || '');
      setDia(p.dia || 1);
      setCourse(p.course || 's2');
      setConfigBlocks(p.configBlocks || []);
      setPreviewQuestions(p.bakedQuestions || []);
    }
  };

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
        rawSubject: rawSubject, // Keep the raw internal key so we can edit it later
        sujeto: finalSubject,
        traducción: finalEnglish,
        forma: formAnswer,
        allowedVerbs: block.allowedVerbs // Attach the group's verbs so the dropdown knows its limits
      });
    }
  }
  return finalizedQuestions;
};

  const handlePreview = () => {
    const generated = generateQuestionsArray();
    setPreviewQuestions(generated);
    setEditingPreviewIndex(null); // Reset any open edits
  };

  // --- INLINE PREVIEW EDITOR ---
  const handlePreviewEdit = (index, field, newValue) => {
    const updated = [...previewQuestions];
    const q = updated[index];
    
    let newRawSubject = q.rawSubject;
    let newPalabra = q.palabra;

    if (field === 'sujeto') newRawSubject = newValue;
    if (field === 'palabra') newPalabra = newValue;

    const verbData = masterVerbsMap[newPalabra];
    if (!verbData) return;

    // Recalculate target form and translation based on new selections
    const tenseMap = verbData.tenses?.[q.tense] || {};
    const subjectData = tenseMap[newRawSubject] || {};

    const formAnswer = subjectData.target || '???';
    const rawEnglish = subjectData.english || verbData.translations?.infinitivo?.english || '';

    const { sp: finalSubject, en: finalEnglish } = formatSubjectAndTranslation(newRawSubject, rawEnglish);

    updated[index] = {
      ...q,
      palabra: newPalabra,
      mostrar: newPalabra,
      rawSubject: newRawSubject,
      sujeto: finalSubject,
      traducción: finalEnglish,
      forma: formAnswer
    };

    setPreviewQuestions(updated);
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
    setEditingPreviewIndex(null);
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
    setEditingPreviewIndex(null);
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

      // We don't need to save the massive 'allowedVerbs' array inside the final payload
      const cleanQuestions = previewQuestions.map(({ allowedVerbs, ...rest }) => rest);

      const docRef = doc(db, 'calentamientos', calId);
      await setDoc(
        docRef,
        {
          id: calId,
          title,
          dia: Number(dia),
          course,
          configBlocks,
          bakedQuestions: cleanQuestions,
          createdAt: new Date().toISOString(),
        },
        { merge: true }
      );

      alert(
        '¡Calentamiento de verbos fijado exitosamente en Firestore!'
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
        Cargando grupos de verbos...
      </div>
    );
  }

  // Calculate live block verb count
  const totalVerbsCount = configBlocks.reduce((sum, block) => sum + (Number(block.count) || 0), 0);

  return (
    <div className="max-w-6xl mx-auto p-6 font-sans pb-20">
      
      {/* NEW: TOP BAR FILE CABINET */}
      <div className="bg-slate-900 p-4 rounded-2xl mb-6 shadow-sm border border-slate-700 flex justify-between items-center">
        <div className="flex items-center gap-3 w-full max-w-lg">
          <span className="text-white font-bold text-sm tracking-wider uppercase">Cargar Práctica:</span>
          <select 
            onChange={(e) => loadPractice(e.target.value)} 
            className="flex-1 p-2 rounded-xl bg-slate-800 text-sky-400 font-bold border border-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-500"
          >
            <option value="">-- Seleccionar Práctica Anterior --</option>
            {savedPractices.map(p => (
              <option key={p.id} value={p.id}>
                {p.course?.toUpperCase()} Día {p.dia}: {p.title}
              </option>
            ))}
          </select>
        </div>
        <p className="text-[10px] text-slate-400 uppercase tracking-widest text-right max-w-xs">
          Para duplicar una práctica para otro día, cárgala aquí y luego cambia el "Día" y el "ID Documento" abajo antes de guardar.
        </p>
      </div>

      <div className="mb-6 border-b border-slate-200 pb-4">
        <h1 className="text-3xl font-black text-slate-800 uppercase tracking-tight">
          Creador de Calentamientos (Verbos)
        </h1>
        <p className="text-slate-500 font-bold text-sm mt-1">
          Elige los grupos, ajusta las reglas de sujeto, previsualiza y
          reorganiza antes de fijar. El vocabulario es gestionado de manera automática e independiente.
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
          <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 border-b border-slate-100 pb-3">
            <h2 className="text-lg font-black text-slate-800 uppercase">
              1. Configurar Bloques de Verbos y Tiempos
            </h2>
            <span className="bg-sky-100 text-sky-800 font-black px-4 py-1.5 rounded-lg text-sm tracking-widest uppercase shadow-sm">
              Total Proyectado: {totalVerbsCount} verbos
            </span>
          </div>

          <div className="max-w-md mt-4">
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
            <div className="pt-2 border-t border-slate-100">
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
                Vista Previa de Preguntas ({previewQuestions.length})
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
                  <div className="flex justify-between text-[10px] text-slate-400 font-mono mb-1 border-b border-slate-700/50 pb-1">
                    <span className={i === 0 ? 'text-amber-400 font-black' : ''}>
                      #{i + 1} {i === 0 ? '(ANCLA UNIVERSAL)' : ''} • {q.tense}
                    </span>
                    <div className="flex gap-2 items-center">
                      {editingPreviewIndex !== i && (
                        <button
                          type="button"
                          onClick={() => setEditingPreviewIndex(i)}
                          className="text-slate-400 hover:text-sky-400 transition-colors"
                          title="Editar Sujeto/Verbo"
                        >
                          ✏️
                        </button>
                      )}
                      {i !== 0 && (
                        <div className="flex gap-1 border-l border-slate-700 pl-2">
                          <button type="button" onClick={() => movePreviewIndex(i, 'up')} className="text-slate-500 hover:text-white">▲</button>
                          <button type="button" onClick={() => movePreviewIndex(i, 'down')} className="text-slate-500 hover:text-white">▼</button>
                        </div>
                      )}
                    </div>
                  </div>

                  {editingPreviewIndex === i ? (
                    <div className="mt-2 space-y-2 bg-slate-950 p-2 rounded-lg border border-slate-700">
                      <div className="flex justify-between gap-2">
                        <select 
                          value={q.rawSubject}
                          onChange={(e) => handlePreviewEdit(i, 'sujeto', e.target.value)}
                          className="w-1/2 p-1 bg-slate-800 text-sky-400 font-bold rounded outline-none border border-slate-600"
                        >
                          <option value="yo">yo</option>
                          <option value="tú">tú</option>
                          <option value="él_ella_ud">él / ella / Ud.</option>
                          <option value="nosotros">nosotros</option>
                          <option value="vosotros">vosotros</option>
                          <option value="ellos_ellas_uds">ellos / ellas / Uds.</option>
                        </select>

                        <select
                          value={q.palabra}
                          onChange={(e) => handlePreviewEdit(i, 'palabra', e.target.value)}
                          className="w-1/2 p-1 bg-slate-800 text-white font-black uppercase rounded outline-none border border-slate-600"
                        >
                          {q.allowedVerbs?.map(v => <option key={v} value={v}>{v}</option>)}
                        </select>
                      </div>
                      <button 
                        type="button" 
                        onClick={() => setEditingPreviewIndex(null)}
                        className="w-full text-center bg-emerald-600/80 hover:bg-emerald-600 text-white font-bold rounded p-1 text-[10px] uppercase tracking-wider"
                      >
                        ✔ Hecho
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center gap-1 mt-1">
                        <span className="text-sky-400 mr-1 font-bold">{q.sujeto}</span>
                        <p className="font-black text-white uppercase">{q.palabra}</p>
                      </div>
                      <p className="text-slate-400 italic text-[11px] mt-0.5">
                        {q.traducción}
                      </p>
                      <p className="text-emerald-400 font-mono font-bold mt-1.5 bg-emerald-950/30 p-1.5 rounded-lg inline-block border border-emerald-900/50">
                        ➡ {q.forma}
                      </p>
                    </>
                  )}
                </div>
              ))}
            </div>
            <p className="text-[10px] text-slate-400 italic">
              La pregunta #1 se mantiene anclada para asegurar la uniformidad de
              la clase. Haz clic en ✏️ para alterar verbos específicos.
            </p>
          </div>
        )}

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