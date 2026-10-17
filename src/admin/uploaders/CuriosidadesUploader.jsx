import React, { useState } from 'react';
import { doc, getDocs, collection, setDoc } from 'firebase/firestore';
import { db } from '../../firebase'; // Adjust relative path to your firebase.js if needed
import { invalidateCollectionCache } from '../../utils/firestoreCache';
import { uploadAdminImage } from '../../utils/imageUpload';
import { finalizeQuestion } from '../../shared/questionTypes';

const BUNDLE_DOC_ID = '_bundle';

// Same slug-from-title convention as CuriosidadesManager's generateCuriosidadId
// (e.g. "Las Fallas" -> "las-fallas-k3j9f2") — the importer generates an id
// for any item that doesn't supply one, so an external tool producing this
// JSON (e.g. a Schoology-scraping skill) never has to think about ids or
// collisions at all; ensureUniqueId below guarantees the final id is unique
// even if the generated or supplied one collides with something that
// already exists or with another item earlier in the same batch.
const slugify = (text) =>
  (text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

const generateId = (title) => `${slugify(title) || 'curiosidad'}-${Date.now().toString(36)}`;

const ensureUniqueId = (candidate, existingIds) => {
  let id = candidate;
  let n = 2;
  while (existingIds.has(id)) {
    id = `${candidate}-${n}`;
    n += 1;
  }
  existingIds.add(id);
  return id;
};

const isNonEmptyString = (v) => typeof v === 'string' && v.trim() !== '';
const isUrl = (v) => typeof v === 'string' && /^https?:\/\//i.test(v);

// --- Per-question-type shape validation ---------------------------------
// Mirrors each type's own emptyQuestion()/Editor contract in
// src/shared/questionTypes/*.jsx. Types whose finalizeQuestion is an
// identity function (multiple_choice, ordering, write, listen, image_select,
// dropdown_cloze) are validated in their FINAL/persisted shape — the JSON
// you write is exactly what gets saved. Types with a real raw→finalized
// conversion (matching, word_bank_cloze, line_bank_cloze) are validated in
// their RAW/editing shape (distractorsText/rawText, not distractors/text) —
// finalizeQuestion() is run on them automatically before saving.
const validateQuestion = (q, qNum, curiosidadLabel) => {
  const tag = `${curiosidadLabel}, pregunta ${qNum}`;
  const errs = [];
  if (!q || typeof q !== 'object') return [`${tag}: no es un objeto.`];
  if (!isNonEmptyString(q.type)) return [`${tag}: falta "type".`];

  switch (q.type) {
    case 'multiple_choice': {
      if (!isNonEmptyString(q.prompt)) errs.push(`${tag}: falta "prompt".`);
      if (!Array.isArray(q.options) || q.options.length < 2 || q.options.length > 4) {
        errs.push(`${tag}: "options" debe ser un arreglo de 2 a 4 textos.`);
      } else if (q.options.some((o) => !isNonEmptyString(o))) {
        errs.push(`${tag}: cada elemento de "options" debe ser un texto no vacío.`);
      } else if (!q.options.includes(q.answer)) {
        errs.push(`${tag}: "answer" debe coincidir exactamente con una de las "options".`);
      }
      break;
    }
    case 'ordering': {
      if (!Array.isArray(q.items) || q.items.length < 2) {
        errs.push(`${tag}: "items" debe ser un arreglo de al menos 2 elementos, en el ORDEN CORRECTO.`);
      } else if (q.items.some((it) => !it || (!isNonEmptyString(it.text) && !isNonEmptyString(it.image)))) {
        errs.push(`${tag}: cada elemento de "items" necesita "text" y/o "image".`);
      }
      break;
    }
    case 'write':
    case 'listen': {
      if (!isNonEmptyString(q.prompt)) errs.push(`${tag}: falta "prompt".`);
      if (!isNonEmptyString(q.answer)) errs.push(`${tag}: falta "answer".`);
      break;
    }
    case 'matching': {
      if (!Array.isArray(q.pairs) || q.pairs.length < 1) {
        errs.push(`${tag}: "pairs" debe ser un arreglo de al menos 1 par {left, right}.`);
      } else {
        q.pairs.forEach((p, i) => {
          const leftOk = p?.left && (isNonEmptyString(p.left.text) || isNonEmptyString(p.left.image));
          const rightOk = p?.right && (isNonEmptyString(p.right.text) || isNonEmptyString(p.right.image));
          if (!leftOk || !rightOk) errs.push(`${tag}, par ${i + 1}: "left" y "right" necesitan cada uno "text" y/o "image".`);
        });
      }
      if (q.distractorsText !== undefined && typeof q.distractorsText !== 'string') {
        errs.push(`${tag}: "distractorsText" debe ser un string (una línea por distractor).`);
      }
      break;
    }
    case 'image_select': {
      if (!Array.isArray(q.options) || q.options.length < 2) {
        errs.push(`${tag}: "options" debe ser un arreglo de al menos 2 elementos {img, label}.`);
      } else if (q.options.some((o) => !isNonEmptyString(o?.img))) {
        errs.push(`${tag}: cada elemento de "options" necesita "img".`);
      }
      if (!Array.isArray(q.correctIndices) || q.correctIndices.length === 0) {
        errs.push(`${tag}: "correctIndices" debe ser un arreglo no vacío de índices.`);
      } else if (q.correctIndices.some((i) => !Number.isInteger(i) || i < 0 || i >= (q.options || []).length)) {
        errs.push(`${tag}: "correctIndices" contiene un índice fuera de rango.`);
      }
      break;
    }
    case 'dropdown_cloze': {
      const blankCount = (q.text || '').split('{{blank}}').length - 1;
      if (!isNonEmptyString(q.text) || blankCount < 1) {
        errs.push(`${tag}: "text" debe incluir al menos un "{{blank}}".`);
      } else if (!Array.isArray(q.blanks) || q.blanks.length !== blankCount) {
        errs.push(`${tag}: "blanks" debe tener exactamente ${blankCount} elemento(s), uno por "{{blank}}" en "text".`);
      } else {
        q.blanks.forEach((b, i) => {
          if (!Array.isArray(b?.options) || b.options.length < 2) errs.push(`${tag}, blank ${i + 1}: "options" debe tener al menos 2 elementos.`);
          else if (!b.options.includes(b.answer)) errs.push(`${tag}, blank ${i + 1}: "answer" debe coincidir con una de "options".`);
        });
      }
      break;
    }
    case 'word_bank_cloze': {
      if (!isNonEmptyString(q.rawText) || !/\{\{.+?\}\}/.test(q.rawText)) {
        errs.push(`${tag}: "rawText" debe incluir al menos una respuesta entre llaves dobles, p. ej. {{agua}}.`);
      }
      if (q.distractorsText !== undefined && typeof q.distractorsText !== 'string') {
        errs.push(`${tag}: "distractorsText" debe ser un string.`);
      }
      break;
    }
    case 'line_bank_cloze': {
      if (!Array.isArray(q.lines) || q.lines.length < 1) {
        errs.push(`${tag}: "lines" debe ser un arreglo de al menos 1 línea {img, rawText}.`);
      } else if (!q.lines.some((l) => /\{\{.+?\}\}/.test(l?.rawText || ''))) {
        errs.push(`${tag}: al menos una línea debe incluir una respuesta entre llaves dobles, p. ej. {{Café}}.`);
      }
      break;
    }
    default:
      errs.push(`${tag}: tipo de pregunta desconocido "${q.type}".`);
  }
  return errs;
};

const validateItem = (item, idx) => {
  const label = `Curiosidad ${idx + 1}${item?.title ? ` ("${item.title}")` : ''}`;
  if (!item || typeof item !== 'object') return [`${label}: no es un objeto válido.`];
  const errs = [];
  if (!isNonEmptyString(item.title)) errs.push(`${label}: falta "title".`);
  if (item.s2_dia != null && !Number.isFinite(Number(item.s2_dia))) errs.push(`${label}: "s2_dia" debe ser un número o null.`);
  if (item.s4_dia != null && !Number.isFinite(Number(item.s4_dia))) errs.push(`${label}: "s4_dia" debe ser un número o null.`);
  if (item.questions !== undefined && !Array.isArray(item.questions)) errs.push(`${label}: "questions" debe ser un arreglo.`);
  (item.questions || []).forEach((q, qi) => errs.push(...validateQuestion(q, qi + 1, label)));
  return errs;
};

// --- Image-reference collection ------------------------------------------
// Every place a local image filename can appear, across the base curiosidad
// and every question type. Returns {obj, key} pairs rather than plain
// values so the same list can both VALIDATE (read obj[key]) and SUBSTITUTE
// (write obj[key] = url) once uploads finish, without walking the structure
// twice with different logic.
const collectImageRefs = (item) => {
  const refs = [];
  if (item.img !== undefined) refs.push({ obj: item, key: 'img' });
  (item.questions || []).forEach((q) => {
    if (!q || typeof q !== 'object') return;
    if (q.type === 'multiple_choice' || q.type === 'ordering') {
      if (q.promptImage !== undefined) refs.push({ obj: q, key: 'promptImage' });
    }
    if (q.type === 'multiple_choice') {
      (q.optionImages || []).forEach((_, i) => refs.push({ obj: q.optionImages, key: i }));
    } else if (q.type === 'ordering') {
      (q.items || []).forEach((it) => {
        if (it && it.image !== undefined) refs.push({ obj: it, key: 'image' });
      });
    } else if (q.type === 'matching') {
      (q.pairs || []).forEach((p) => {
        if (p?.left && p.left.image !== undefined) refs.push({ obj: p.left, key: 'image' });
        if (p?.right && p.right.image !== undefined) refs.push({ obj: p.right, key: 'image' });
      });
    } else if (q.type === 'image_select') {
      (q.options || []).forEach((o) => {
        if (o && o.img !== undefined) refs.push({ obj: o, key: 'img' });
      });
    } else if (q.type === 'dropdown_cloze' || q.type === 'word_bank_cloze') {
      if (q.img !== undefined) refs.push({ obj: q, key: 'img' });
    } else if (q.type === 'line_bank_cloze') {
      (q.lines || []).forEach((l) => {
        if (l && l.img !== undefined) refs.push({ obj: l, key: 'img' });
      });
    }
  });
  return refs;
};

const validateImageRefs = (items, fileMap) => {
  const errs = [];
  items.forEach((item, idx) => {
    if (!item || typeof item !== 'object') return;
    const label = `Curiosidad ${idx + 1}${item.title ? ` ("${item.title}")` : ''}`;
    collectImageRefs(item).forEach(({ obj, key }) => {
      const value = obj[key];
      if (isNonEmptyString(value) && !isUrl(value) && !fileMap.has(value)) {
        errs.push(`${label}: la imagen "${value}" no fue proporcionada en los archivos seleccionados.`);
      }
    });
  });
  return errs;
};

const CuriosidadesUploader = () => {
  const [jsonInput, setJsonInput] = useState('');
  const [pickedFiles, setPickedFiles] = useState([]);
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

    // Validate EVERYTHING — shape first, then image references — before
    // touching Storage or Firestore at all, so a mistake anywhere in the
    // batch is reported up front instead of leaving a partial import.
    const shapeErrors = parsedData.flatMap((item, idx) => validateItem(item, idx));
    const fileMap = new Map(pickedFiles.map((f) => [f.name, f]));
    const imageErrors = validateImageRefs(parsedData, fileMap);
    const allErrors = [...shapeErrors, ...imageErrors];
    if (allErrors.length > 0) {
      setErrors(allErrors);
      return;
    }

    setLoading(true);
    try {
      setStatus('Subiendo imágenes...');
      const neededFilenames = new Set();
      parsedData.forEach((item) => {
        collectImageRefs(item).forEach(({ obj, key }) => {
          const value = obj[key];
          if (isNonEmptyString(value) && !isUrl(value)) neededFilenames.add(value);
        });
      });
      const urlMap = new Map();
      for (const filename of neededFilenames) {
        const url = await uploadAdminImage(fileMap.get(filename), 'curiosidades');
        urlMap.set(filename, url);
      }
      parsedData.forEach((item) => {
        collectImageRefs(item).forEach(({ obj, key }) => {
          const value = obj[key];
          if (isNonEmptyString(value) && !isUrl(value)) obj[key] = urlMap.get(value);
        });
      });

      setStatus('Preparando IDs...');
      // Same bundle-vs-legacy detection as CuriosidadesManager, plus
      // collecting every existing id so this batch's ids (generated or
      // supplied) can be checked for collisions before writing anything.
      const querySnapshot = await getDocs(collection(db, 'curiosidades'));
      let bundleData = null;
      const existingIds = new Set();
      querySnapshot.forEach((docSnap) => {
        if (docSnap.id === BUNDLE_DOC_ID) {
          bundleData = docSnap.data();
          Object.keys(bundleData?.items || {}).forEach((id) => existingIds.add(id));
        } else {
          existingIds.add(docSnap.id);
        }
      });
      const isBundled = !!bundleData;

      const renamedIds = [];
      const preparedItems = parsedData.map((item) => {
        const baseId = isNonEmptyString(item.id) ? item.id.trim() : generateId(item.title);
        const finalId = ensureUniqueId(baseId, existingIds);
        if (finalId !== baseId) renamedIds.push({ from: baseId, to: finalId });

        // finalizeQuestion is a no-op for the identity types (multiple_choice,
        // ordering, write, listen, image_select, dropdown_cloze) and does the
        // real raw->persisted conversion for the other three (matching,
        // word_bank_cloze, line_bank_cloze) — same function the admin editor
        // itself calls at save time.
        const questions = (item.questions || []).map((q) => finalizeQuestion(q));

        return {
          id: finalId,
          title: item.title || '',
          img: item.img || '',
          student_note: item.student_note || '',
          teacher_notes: item.teacher_notes || '',
          s2_dia: item.s2_dia != null ? Number(item.s2_dia) : null,
          s4_dia: item.s4_dia != null ? Number(item.s4_dia) : null,
          ...(questions.length > 0 ? { questions } : {}),
          ...(item.minSeconds != null ? { minSeconds: Number(item.minSeconds) } : {}),
          ...(item.gradeWeight != null ? { gradeWeight: Number(item.gradeWeight) } : {}),
          ...(item.excused != null ? { excused: !!item.excused } : {}),
        };
      });

      setStatus('Subiendo a Firestore...');
      if (isBundled) {
        const merged = { items: {} };
        preparedItems.forEach((item) => {
          const { id, ...rest } = item;
          merged.items[id] = rest;
        });
        await setDoc(doc(db, 'curiosidades', BUNDLE_DOC_ID), merged, { merge: true });
      } else {
        for (const item of preparedItems) {
          const { id, ...rest } = item;
          await setDoc(doc(db, 'curiosidades', id), rest);
        }
      }
      invalidateCollectionCache('curiosidades');

      let msg = `✅ ¡Éxito! Se subieron ${preparedItems.length} curiosidades a Firestore.`;
      if (renamedIds.length > 0) {
        msg += ` ⚠️ ${renamedIds.length} id(s) ya existían y se renombraron automáticamente: ${renamedIds
          .map((r) => `"${r.from}" → "${r.to}"`)
          .join(', ')}.`;
      }
      setStatus(msg);
      setJsonInput('');
      setPickedFiles([]);
    } catch (error) {
      console.error('Error uploading curiosidades:', error);
      setErrors([`Error al subir: ${error.message}`]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6 md:p-12">
      <div className="max-w-4xl mx-auto bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
        <h1 className="text-3xl font-black text-slate-800 mb-2">Curiosidades Bulk Uploader</h1>
        <p className="text-slate-500 font-medium mb-6">
          Pega tu arreglo JSON completo abajo. Si alguna curiosidad o pregunta hace referencia a una imagen local (p. ej.{' '}
          <code className="bg-slate-100 px-1 rounded">"img": "fallas.jpg"</code>), selecciona esos archivos abajo también — se
          suben automáticamente y sus URLs se insertan antes de guardar. No necesitas incluir "id": si lo omites, se genera uno
          a partir del título.
        </p>

        <textarea
          rows="12"
          value={jsonInput}
          onChange={(e) => setJsonInput(e.target.value)}
          placeholder='[ { "title": "Las Fallas", "img": "fallas.jpg", ... } ]'
          className="w-full font-mono text-xs bg-slate-100 border border-slate-200 rounded-xl p-4 mb-4 focus:ring-2 focus:ring-indigo-500 outline-none"
        ></textarea>

        <div className="mb-6">
          <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">
            Imágenes locales referenciadas en el JSON (opcional)
          </label>
          <input
            type="file"
            multiple
            accept="image/*"
            onChange={(e) => setPickedFiles(Array.from(e.target.files || []))}
            className="block w-full text-xs text-slate-600 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-slate-700 file:text-white file:text-[10px] file:font-black file:uppercase file:tracking-widest hover:file:bg-slate-600"
          />
          {pickedFiles.length > 0 && (
            <p className="text-[10px] text-slate-500 mt-1">{pickedFiles.length} archivo(s) seleccionados: {pickedFiles.map((f) => f.name).join(', ')}</p>
          )}
        </div>

        {errors.length > 0 && (
          <div className="mb-6 p-4 bg-rose-50 border border-rose-300 rounded-xl max-h-64 overflow-y-auto">
            <p className="text-xs font-black text-rose-800 uppercase tracking-widest mb-2">
              ❌ {errors.length} error(es) — nada se ha subido todavía
            </p>
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
            {loading ? 'Subiendo...' : 'Subir Curiosidades a Firebase'}
          </button>

          {status && <p className="text-sm font-bold text-slate-700">{status}</p>}
        </div>
      </div>
    </div>
  );
};

export default CuriosidadesUploader;
