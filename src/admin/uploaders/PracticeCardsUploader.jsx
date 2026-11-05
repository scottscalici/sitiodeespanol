import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { doc, getDocs, collection, setDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { invalidateCollectionCache } from '../../utils/firestoreCache';
import { isNonEmptyString } from '../../utils/validateQuestion';
import { QUESTION_TYPES, finalizeQuestion } from '../../shared/questionTypes';

const COURSE_IDS = new Set(['s2', 's4']);

// Deliberately lighter than a full per-field schema check for every type —
// just enough to catch an obviously malformed question (wrong shape, a
// typo'd type key) before it's written. image_select/hotspot both need a
// real uploaded image this importer can't supply (a photo/PDF source has no
// hosted image URL to put there), so those two still need a manual image
// pass afterward in the regular editor — flagged below, not blocked.
const QUESTION_VALIDATORS = {
  multiple_choice: (q) => {
    const errs = [];
    if (!Array.isArray(q.options) || q.options.length < 2) errs.push('"options" debe tener al menos 2 elementos.');
    if (!isNonEmptyString(q.answer)) errs.push('falta "answer".');
    else if (Array.isArray(q.options) && !q.options.includes(q.answer)) errs.push('"answer" debe ser uno de los valores en "options".');
    return errs;
  },
  matching: (q) => {
    const errs = [];
    if (!Array.isArray(q.pairs) || q.pairs.length === 0) errs.push('"pairs" debe ser un arreglo no vacío.');
    else {
      q.pairs.forEach((p, i) => {
        if (!p.left || (!p.left.text && !p.left.image)) errs.push(`pairs[${i}].left necesita "text" o "image".`);
        if (!p.right || (!p.right.text && !p.right.image)) errs.push(`pairs[${i}].right necesita "text" o "image".`);
      });
    }
    return errs;
  },
  ordering: (q) => {
    const errs = [];
    if (!Array.isArray(q.items) || q.items.length < 2) errs.push('"items" debe tener al menos 2 elementos, YA en el orden correcto.');
    return errs;
  },
  write: (q) => {
    const errs = [];
    if (!isNonEmptyString(q.answer)) errs.push('falta "answer".');
    return errs;
  },
  listen: (q) => {
    const errs = [];
    if (!isNonEmptyString(q.prompt)) errs.push('falta "prompt" (el texto que se convierte en audio).');
    if (!isNonEmptyString(q.answer)) errs.push('falta "answer".');
    return errs;
  },
  dropdown_cloze: (q) => {
    const errs = [];
    const blankCount = (q.text || '').split('{{blank}}').length - 1;
    if (blankCount === 0) errs.push('"text" debe contener al menos un "{{blank}}".');
    if (!Array.isArray(q.blanks) || q.blanks.length !== blankCount) errs.push(`"blanks" debe tener ${blankCount} elemento(s), uno por cada "{{blank}}" en "text".`);
    else q.blanks.forEach((b, i) => {
      if (!isNonEmptyString(b.answer)) errs.push(`blanks[${i}] necesita "answer".`);
      if (!Array.isArray(b.options) || b.options.length < 2) errs.push(`blanks[${i}].options debe tener al menos 2 elementos.`);
    });
    return errs;
  },
  // Accepts the editor's raw authoring shape (rawText with inline {{answer}}
  // tokens + distractorsText) — finalizeQuestion converts it to the real
  // persisted shape at save time below, same as the admin editor does.
  word_bank_cloze: (q) => {
    const errs = [];
    if (!isNonEmptyString(q.rawText) || !/\{\{.+?\}\}/.test(q.rawText)) {
      errs.push('"rawText" debe contener al menos una respuesta marcada como {{así}}.');
    }
    return errs;
  },
  // Same raw rawText shape as word_bank_cloze, minus the word bank — every
  // blank is free-typed instead of picked.
  text_cloze: (q) => {
    const errs = [];
    if (!isNonEmptyString(q.rawText) || !/\{\{.+?\}\}/.test(q.rawText)) {
      errs.push('"rawText" debe contener al menos una respuesta marcada como {{así}}.');
    }
    return errs;
  },
  line_bank_cloze: (q) => {
    const errs = [];
    if (!Array.isArray(q.lines) || q.lines.length === 0) errs.push('"lines" debe ser un arreglo no vacío.');
    else q.lines.forEach((l, i) => {
      if (!isNonEmptyString(l.rawText) || !/\{\{.+?\}\}/.test(l.rawText)) errs.push(`lines[${i}].rawText debe contener al menos una respuesta marcada como {{así}}.`);
    });
    return errs;
  },
  image_select: (q) => {
    const errs = [];
    if (!Array.isArray(q.options) || q.options.length < 2) errs.push('"options" debe tener al menos 2 elementos.');
    if (!Array.isArray(q.correctIndices) || q.correctIndices.length === 0) errs.push('"correctIndices" debe ser un arreglo no vacío.');
    return errs;
  },
  hotspot: (q) => {
    const errs = [];
    if (!q.target) errs.push('falta "target".');
    return errs;
  },
};

const IMAGE_DEPENDENT_TYPES = new Set(['image_select', 'hotspot']);

const validateQuestion = (q, qNum, label) => {
  const tag = `${label}, pregunta ${qNum}`;
  if (!q || typeof q !== 'object') return [`${tag}: no es un objeto.`];
  const validator = QUESTION_VALIDATORS[q.type];
  if (!validator) return [`${tag}: "type" desconocido ("${q.type}"). Debe ser uno de: ${Object.keys(QUESTION_TYPES).join(', ')}.`];
  return validator(q).map((e) => `${tag}: ${e}`);
};

const validateCard = (item, idx) => {
  const label = `Tarjeta ${idx + 1}${item?.title ? ` ("${item.title}")` : ''}`;
  if (!item || typeof item !== 'object') return { errors: [`${label}: no es un objeto válido.`], needsImages: false };
  const errors = [];
  if (!isNonEmptyString(item.id)) errors.push(`${label}: falta "id" (requerido — este importador nunca genera ids automáticamente).`);
  if (!isNonEmptyString(item.title)) errors.push(`${label}: falta "title".`);
  if (!isNonEmptyString(item.course) || !COURSE_IDS.has(item.course)) errors.push(`${label}: "course" debe ser "s2" o "s4".`);
  if (item.dia !== null && item.dia !== undefined && typeof item.dia !== 'number') {
    errors.push(`${label}: "dia" debe ser un número, o null/omitido para guardarla en el 📦 Banco sin asignar.`);
  }
  let needsImages = false;
  if (!Array.isArray(item.questions) || item.questions.length === 0) {
    errors.push(`${label}: "questions" debe ser un arreglo no vacío.`);
  } else {
    item.questions.forEach((q, qi) => {
      errors.push(...validateQuestion(q, qi + 1, label));
      if (IMAGE_DEPENDENT_TYPES.has(q?.type)) needsImages = true;
    });
  }
  return { errors, needsImages };
};

const PracticeCardsUploader = () => {
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

    const validated = parsedData.map((item, idx) => validateCard(item, idx));
    const shapeErrors = validated.flatMap((v) => v.errors);
    if (shapeErrors.length > 0) {
      setErrors(shapeErrors);
      return;
    }
    const anyNeedsImages = validated.some((v) => v.needsImages);

    setLoading(true);
    try {
      setStatus('Revisando ids existentes...');
      const snap = await getDocs(collection(db, 'practice_cards'));
      const existingIds = new Set(snap.docs.map((d) => d.id));

      // Same never-overwrite rule as every other bulk importer here — unlike
      // Calentamientos, multiple practice cards sharing a (course, día) is
      // normal and already supported, so there's no day-collision check.
      const idErrors = [];
      const seenIds = new Map();
      parsedData.forEach((item, idx) => {
        if (seenIds.has(item.id)) {
          idErrors.push(`"${item.id}" aparece más de una vez en este lote (tarjetas ${seenIds.get(item.id) + 1} y ${idx + 1}).`);
        } else {
          seenIds.set(item.id, idx);
        }
        if (existingIds.has(item.id)) {
          idErrors.push(`"${item.id}" ya existe en Firestore — este importador no sobrescribe tarjetas existentes (edítala en el Creador si quieres cambiarla).`);
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
          gradeWeight: Number(item.gradeWeight) || 1,
          excused: !!item.excused,
          // Same transform the single-card editor runs at save time — lets a
          // question be authored in its more natural raw shape (e.g.
          // word_bank_cloze's {{answer}}-tagged rawText) instead of the
          // fully-computed persisted shape.
          questions: item.questions.map(finalizeQuestion),
          createdAt: new Date().toISOString(),
        };
        await setDoc(doc(db, 'practice_cards', item.id), payload);
      }
      invalidateCollectionCache('practice_cards');

      setStatus(
        `✅ ¡Éxito! Se subieron ${parsedData.length} tarjeta(s) a Firestore.` +
        (anyNeedsImages ? ' ⚠️ Una o más preguntas de imagen necesitan que subas la imagen real en el Creador antes de usarse.' : '')
      );
      setJsonInput('');
    } catch (error) {
      console.error('Error uploading practice cards:', error);
      setErrors([`Error al subir: ${error.message}`]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6 md:p-12">
      <div className="max-w-4xl mx-auto bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
        <div className="flex justify-between items-start mb-2">
          <h1 className="text-3xl font-black text-slate-800">Tarjetas de Práctica — Bulk Uploader</h1>
          <Link to="/admin-secret-portal-practice-cards" className="shrink-0 text-slate-500 hover:text-slate-800 text-xs font-bold border border-slate-200 px-3 py-1.5 rounded-lg">
            ← Creador de Tarjetas
          </Link>
        </div>
        <p className="text-slate-500 font-medium mb-6">
          Pega tu arreglo JSON completo abajo. Cada tarjeta necesita su propio <code className="bg-slate-100 px-1 rounded">"id"</code> explícito
          — este importador nunca sobrescribe una tarjeta existente ni genera ids automáticamente. Deja <code className="bg-slate-100 px-1 rounded">"dia"</code>{' '}
          en null/omitido para guardarla en el 📦 Banco sin asignar. Tipos de pregunta soportados: {Object.keys(QUESTION_TYPES).join(', ')}.
          Las preguntas de tipo <code className="bg-slate-100 px-1 rounded">image_select</code>/<code className="bg-slate-100 px-1 rounded">hotspot</code> se
          suben sin imagen real — hay que subirla a mano en el Creador después.
        </p>

        <textarea
          rows="14"
          value={jsonInput}
          onChange={(e) => setJsonInput(e.target.value)}
          placeholder={
            '[\n' +
            '  {\n' +
            '    "id": "practica_s2_imperfecto_1",\n' +
            '    "title": "Imperfecto — Repaso",\n' +
            '    "course": "s2",\n' +
            '    "dia": null,\n' +
            '    "questions": [\n' +
            '      { "type": "write", "prompt": "Escribe el imperfecto: yo (hablar)", "answer": "hablaba" }\n' +
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
            {loading ? 'Subiendo...' : 'Subir Tarjetas a Firebase'}
          </button>
          {status && <p className="text-sm font-bold text-slate-700">{status}</p>}
        </div>
      </div>
    </div>
  );
};

export default PracticeCardsUploader;
