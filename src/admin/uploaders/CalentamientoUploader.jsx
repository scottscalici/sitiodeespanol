import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { doc, getDocs, collection, setDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { invalidateCollectionCache } from '../../utils/firestoreCache';
import { isNonEmptyString } from '../../utils/validateQuestion';
import { VERB_TENSES, VERB_SUBJECTS } from '../../utils/verbTenses';

// Same bulk-JSON pattern as GrammarNotesUploader: paste an array, validate its
// shape locally first (cheap, instant feedback), then check it against
// Firestore before writing anything. This importer deliberately never writes
// `configBlocks` — a bulk-imported warm-up has no "redo draws a fresh random
// set" behavior (see WorkoutEngine/CalentamientoEngine), which is an
// intentional simplification: Practice Circles now cover "keep practicing
// this," so the calentamiento itself only needs its curated, first-attempt
// `bakedQuestions`.
const TENSE_IDS = new Set(VERB_TENSES.map((t) => t.id));
const SUBJECT_IDS = new Set(VERB_SUBJECTS.map((s) => s.id));
const COURSE_IDS = new Set(['s2', 's4']);

const validateBakedQuestion = (q, qNum, label) => {
  const tag = `${label}, pregunta ${qNum}`;
  const errs = [];
  if (!q || typeof q !== 'object') return [`${tag}: no es un objeto.`];
  if (!isNonEmptyString(q.palabra)) errs.push(`${tag}: falta "palabra" (el infinitivo).`);
  if (!isNonEmptyString(q.tense) || !TENSE_IDS.has(q.tense)) {
    errs.push(`${tag}: "tense" debe ser uno de los tiempos válidos (ver VERB_TENSES, p. ej. "presente", "pretérito", "subjuntivo_presente").`);
  }
  if (!isNonEmptyString(q.rawSubject) || !SUBJECT_IDS.has(q.rawSubject)) {
    errs.push(`${tag}: "rawSubject" debe ser uno de yo / tú / él_ella_ud / nosotros / vosotros / ellos_ellas_uds.`);
  }
  if (!isNonEmptyString(q.sujeto)) errs.push(`${tag}: falta "sujeto" (la forma mostrada al estudiante, p. ej. "él" o "Uds.").`);
  if (!isNonEmptyString(q.forma)) errs.push(`${tag}: falta "forma" (la respuesta correcta conjugada).`);
  if (!isNonEmptyString(q.traducción)) errs.push(`${tag}: falta "traducción".`);
  return errs;
};

const validateCalentamiento = (item, idx) => {
  const label = `Calentamiento ${idx + 1}${item?.title ? ` ("${item.title}")` : ''}`;
  if (!item || typeof item !== 'object') return [`${label}: no es un objeto válido.`];
  const errs = [];
  if (!isNonEmptyString(item.id)) {
    errs.push(`${label}: falta "id" (requerido — este importador nunca genera ids automáticamente).`);
  }
  if (!isNonEmptyString(item.title)) errs.push(`${label}: falta "title".`);
  if (!isNonEmptyString(item.course) || !COURSE_IDS.has(item.course)) {
    errs.push(`${label}: "course" debe ser "s2" o "s4".`);
  }
  if (item.dia !== null && item.dia !== undefined && typeof item.dia !== 'number') {
    errs.push(`${label}: "dia" debe ser un número, o null/omitido para guardarlo en el 📦 Banco sin asignar.`);
  }
  if (!Array.isArray(item.bakedQuestions) || item.bakedQuestions.length === 0) {
    errs.push(`${label}: "bakedQuestions" debe ser un arreglo no vacío.`);
  } else {
    item.bakedQuestions.forEach((q, qi) => errs.push(...validateBakedQuestion(q, qi + 1, label)));
  }
  return errs;
};

const CalentamientoUploader = () => {
  const [jsonInput, setJsonInput] = useState('');
  const [status, setStatus] = useState('');
  const [errors, setErrors] = useState([]);
  const [loading, setLoading] = useState(false);

  const handleUpload = async () => {
    setStatus('');
    setErrors([]);

    if (!jsonInput.trim()) {
      setErrors(['Pega el JSON primero.']);
      return;
    }
    let parsedData;
    try {
      parsedData = JSON.parse(jsonInput);
    } catch (e) {
      setErrors([`JSON inválido: ${e.message}`]);
      return;
    }
    if (!Array.isArray(parsedData)) {
      setErrors(['El JSON debe ser un arreglo [ ] de objetos.']);
      return;
    }

    const shapeErrors = parsedData.flatMap((item, idx) => validateCalentamiento(item, idx));
    if (shapeErrors.length > 0) {
      setErrors(shapeErrors);
      return;
    }

    setLoading(true);
    try {
      setStatus('Revisando ids y días existentes...');
      const snap = await getDocs(collection(db, 'calentamientos'));
      const existingIds = new Set();
      const existingCourseDia = new Set();
      snap.forEach((d) => {
        existingIds.add(d.id);
        const data = d.data();
        if (data.dia !== null && data.dia !== undefined) {
          existingCourseDia.add(`${data.course}|${data.dia}`);
        }
      });

      // Two kinds of collision matter here: the id itself (never overwrite —
      // same rule as Grammar Notes), and the (course, día) pair, since
      // nothing in the schema stops two different ids from both claiming the
      // same course+día — exactly how the real s4/día-4 triple-duplicate
      // happened before the Creator had a delete button.
      const idErrors = [];
      const seenIds = new Map();
      const seenCourseDia = new Map();
      parsedData.forEach((item, idx) => {
        const id = item.id;
        if (seenIds.has(id)) {
          idErrors.push(`"${id}" aparece más de una vez en este lote (calentamientos ${seenIds.get(id) + 1} y ${idx + 1}).`);
        } else {
          seenIds.set(id, idx);
        }
        if (existingIds.has(id)) {
          idErrors.push(`"${id}" ya existe en Firestore — este importador no sobrescribe calentamientos existentes (edítalo en el Creador si quieres cambiarlo).`);
        }

        if (item.dia !== null && item.dia !== undefined) {
          const key = `${item.course}|${item.dia}`;
          if (seenCourseDia.has(key)) {
            idErrors.push(`${item.course?.toUpperCase()} día ${item.dia} aparece más de una vez en este lote (calentamientos ${seenCourseDia.get(key) + 1} y ${idx + 1}).`);
          } else {
            seenCourseDia.set(key, idx);
          }
          if (existingCourseDia.has(key)) {
            idErrors.push(`Ya existe un calentamiento guardado para ${item.course?.toUpperCase()} día ${item.dia} — este importador no crea duplicados de día. Usa un día distinto, o deja "dia" en null/omitido para guardarlo en el Banco.`);
          }
        }
      });

      if (idErrors.length > 0) {
        setErrors(idErrors);
        return;
      }

      setStatus('Subiendo a Firestore...');
      for (const item of parsedData) {
        const payload = {
          id: item.id,
          title: item.title,
          course: item.course,
          dia: item.dia ?? null,
          includeVosotros: !!item.includeVosotros,
          excused: !!item.excused,
          bakedQuestions: item.bakedQuestions.map((q) => ({
            palabra: q.palabra,
            mostrar: q.mostrar || q.palabra,
            tense: q.tense,
            rawSubject: q.rawSubject,
            sujeto: q.sujeto,
            traducción: q.traducción,
            forma: q.forma,
          })),
          createdAt: new Date().toISOString(),
        };
        await setDoc(doc(db, 'calentamientos', item.id), payload);
      }
      invalidateCollectionCache('calentamientos');

      setStatus(`✅ ¡Éxito! Se subieron ${parsedData.length} calentamiento(s) a Firestore.`);
      setJsonInput('');
    } catch (error) {
      console.error('Error uploading calentamientos:', error);
      setErrors([`Error al subir: ${error.message}`]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6 md:p-12">
      <div className="max-w-4xl mx-auto bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
        <div className="flex justify-between items-start mb-2">
          <h1 className="text-3xl font-black text-slate-800">Calentamientos Bulk Uploader</h1>
          <Link to="/admin-secret-portal-calentamiento" className="shrink-0 text-slate-500 hover:text-slate-800 text-xs font-bold border border-slate-200 px-3 py-1.5 rounded-lg">
            ← Creador de Calentamientos
          </Link>
        </div>
        <p className="text-slate-500 font-medium mb-6">
          Pega tu arreglo JSON completo abajo. Cada calentamiento necesita su propio <code className="bg-slate-100 px-1 rounded">"id"</code> explícito
          — este importador nunca sobrescribe uno existente ni genera ids automáticamente, y tampoco permite dos calentamientos para el mismo
          curso+día. No escribe <code className="bg-slate-100 px-1 rounded">configBlocks</code> — cada pregunta en{' '}
          <code className="bg-slate-100 px-1 rounded">bakedQuestions</code> debe traer ya su respuesta correcta (<code className="bg-slate-100 px-1 rounded">forma</code>),
          así que un "redo" del estudiante vuelve a mostrar el mismo set en vez de generar uno nuevo al azar — usa Círculos de Práctica para esa
          repetición variada.
        </p>

        <textarea
          rows="14"
          value={jsonInput}
          onChange={(e) => setJsonInput(e.target.value)}
          placeholder={
            '[\n' +
            '  {\n' +
            '    "id": "s2subjuntivo1",\n' +
            '    "title": "Subjuntivo 1",\n' +
            '    "course": "s2",\n' +
            '    "dia": 25,\n' +
            '    "bakedQuestions": [\n' +
            '      { "palabra": "hablar", "tense": "subjuntivo_presente", "rawSubject": "yo", "sujeto": "yo", "traducción": "that I speak", "forma": "hable" }\n' +
            '    ]\n' +
            '  }\n' +
            ']'
          }
          className="w-full font-mono text-xs bg-slate-100 border border-slate-200 rounded-xl p-4 mb-4 focus:ring-2 focus:ring-indigo-500 outline-none"
        ></textarea>

        {errors.length > 0 && (
          <div className="mb-6 p-4 bg-rose-50 border border-rose-300 rounded-xl max-h-64 overflow-y-auto">
            <p className="text-xs font-black text-rose-800 uppercase tracking-widest mb-2">❌ {errors.length} error(es) — nada se ha subido todavía</p>
            <ul className="list-disc list-inside space-y-1">
              {errors.map((e, i) => (
                <li key={i} className="text-xs text-rose-700 font-mono">
                  {e}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex items-center justify-between">
          <button
            onClick={handleUpload}
            disabled={loading}
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-black px-8 py-3 rounded-xl uppercase tracking-widest text-xs transition-colors disabled:opacity-50 shadow-sm"
          >
            {loading ? 'Subiendo...' : 'Subir Calentamientos a Firebase'}
          </button>
          {status && <p className="text-sm font-bold text-slate-700">{status}</p>}
        </div>
      </div>
    </div>
  );
};

export default CalentamientoUploader;
