import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { doc, getDocs, collection, setDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { invalidateCollectionCache } from '../../utils/firestoreCache';
import { uploadAdminImage } from '../../utils/imageUpload';
import { finalizeQuestion } from '../../shared/questionTypes';
import { isNonEmptyString, validateQuestion, collectQuestionImageRefs } from '../../utils/validateQuestion';

const isUrl = (v) => typeof v === 'string' && /^https?:\/\//i.test(v);

// --- Per-block-type shape validation --------------------------------------
// Mirrors each type's own emptyBlock()/Editor contract in
// src/shared/noteBlocks/*.jsx. Every block type's raw shape === stored
// shape — the JSON you write is exactly what gets saved — EXCEPT a
// `question` block's nested `question` object, which still goes through
// the shared question-type validator (and, at write time, finalizeQuestion)
// for the 3 types that have their own raw/finalized split.
const validateBlock = (b, bNum, noteLabel) => {
  const tag = `${noteLabel}, bloque ${bNum}`;
  const errs = [];
  if (!b || typeof b !== 'object') return [`${tag}: no es un objeto.`];
  if (!isNonEmptyString(b.type)) return [`${tag}: falta "type".`];

  switch (b.type) {
    case 'rule': {
      if (!isNonEmptyString(b.text)) errs.push(`${tag}: falta "text".`);
      break;
    }
    case 'example': {
      if (!Array.isArray(b.items) || b.items.length === 0) {
        errs.push(`${tag}: "items" debe ser un arreglo no vacío de {es, en?}.`);
      } else if (b.items.some((it) => !isNonEmptyString(it?.es))) {
        errs.push(`${tag}: cada elemento de "items" necesita "es".`);
      }
      break;
    }
    case 'aside': {
      if (!isNonEmptyString(b.text) && !(Array.isArray(b.items) && b.items.length > 0)) {
        errs.push(`${tag}: necesita "text" y/o "items".`);
      }
      break;
    }
    case 'link': {
      if (!isNonEmptyString(b.label)) errs.push(`${tag}: falta "label".`);
      if (!isNonEmptyString(b.targetId) && !isNonEmptyString(b.url)) errs.push(`${tag}: necesita "targetId" o "url".`);
      if (isNonEmptyString(b.targetId) && isNonEmptyString(b.url)) errs.push(`${tag}: usa "targetId" o "url", no ambos.`);
      break;
    }
    case 'media': {
      if (b.kind !== 'video' && b.kind !== 'slides') errs.push(`${tag}: "kind" debe ser "video" o "slides".`);
      if (!isNonEmptyString(b.url)) errs.push(`${tag}: falta "url".`);
      break;
    }
    case 'comparison': {
      if (!Array.isArray(b.columns) || b.columns.length < 2) {
        errs.push(`${tag}: "columns" debe tener al menos 2 columnas.`);
      } else {
        b.columns.forEach((c, i) => {
          if (!isNonEmptyString(c?.label)) errs.push(`${tag}, columna ${i + 1}: falta "label".`);
          if (!Array.isArray(c?.items) || c.items.length === 0) errs.push(`${tag}, columna ${i + 1}: "items" debe ser un arreglo no vacío.`);
        });
      }
      break;
    }
    case 'question': {
      if (!b.question || typeof b.question !== 'object') errs.push(`${tag}: falta "question".`);
      else errs.push(...validateQuestion(b.question, 1, tag));
      break;
    }
    case 'drill': {
      const colCount = Array.isArray(b.contextColumns) ? b.contextColumns.length : -1;
      if (colCount < 0) errs.push(`${tag}: "contextColumns" debe ser un arreglo (puede estar vacío).`);
      if (!Array.isArray(b.rows) || b.rows.length === 0) {
        errs.push(`${tag}: "rows" debe ser un arreglo no vacío.`);
      } else {
        b.rows.forEach((r, i) => {
          if (!isNonEmptyString(r?.answer)) errs.push(`${tag}, fila ${i + 1}: falta "answer".`);
          if (colCount >= 0 && (!Array.isArray(r?.context) || r.context.length !== colCount)) {
            errs.push(`${tag}, fila ${i + 1}: "context" debe tener ${colCount} elemento(s), uno por columna de "contextColumns".`);
          }
        });
      }
      break;
    }
    default:
      errs.push(`${tag}: tipo de bloque desconocido "${b.type}".`);
  }
  return errs;
};

const validateNote = (item, idx) => {
  const label = `Nota ${idx + 1}${item?.title ? ` ("${item.title}")` : ''}`;
  if (!item || typeof item !== 'object') return [`${label}: no es un objeto válido.`];
  const errs = [];
  if (!isNonEmptyString(item.id)) errs.push(`${label}: falta "id" (requerido — p. ej. "imperfecto:notas_generales"). Este importador nunca genera ids automáticamente.`);
  if (!isNonEmptyString(item.title)) errs.push(`${label}: falta "title".`);
  if (item.type !== 'subtopic' && item.type !== 'landing') {
    errs.push(`${label}: "type" debe ser "subtopic" o "landing".`);
  } else if (item.type === 'subtopic') {
    if (!Array.isArray(item.blocks) || item.blocks.length === 0) {
      errs.push(`${label}: "blocks" debe ser un arreglo no vacío.`);
    } else {
      item.blocks.forEach((b, bi) => errs.push(...validateBlock(b, bi + 1, label)));
    }
  } else if (item.type === 'landing') {
    if (!Array.isArray(item.subtopics) || item.subtopics.length === 0) {
      errs.push(`${label}: "subtopics" debe ser un arreglo no vacío de {id, label?}.`);
    } else {
      item.subtopics.forEach((s, si) => {
        if (!isNonEmptyString(s?.id)) errs.push(`${label}, subtema ${si + 1}: falta "id".`);
      });
    }
    if (item.blocks !== undefined) {
      if (!Array.isArray(item.blocks)) errs.push(`${label}: "blocks" debe ser un arreglo si se incluye.`);
      else item.blocks.forEach((b, bi) => errs.push(...validateBlock(b, bi + 1, label)));
    }
  }
  return errs;
};

// `rule.image` is the only block-level local-filename reference (media.url
// is always a direct hosted link — video/YouTube or slides/raw-file — never
// something this importer uploads itself, since there's no generic
// non-image file-upload utility in this app). A `question` block's nested
// question can have its own image fields (promptImage, a hotspot board,
// etc.) — collected via the same shared helper the Curiosidades importer
// uses, so a new question type's image field only needs to be taught once.
const collectImageRefs = (item) => {
  const refs = [];
  (item.blocks || []).forEach((b) => {
    if (b?.type === 'rule' && b.image !== undefined) refs.push({ obj: b, key: 'image' });
    if (b?.type === 'question' && b.question) refs.push(...collectQuestionImageRefs(b.question));
  });
  return refs;
};

const validateImageRefs = (items, fileMap) => {
  const errs = [];
  items.forEach((item, idx) => {
    if (!item || typeof item !== 'object') return;
    const label = `Nota ${idx + 1}${item.title ? ` ("${item.title}")` : ''}`;
    collectImageRefs(item).forEach(({ obj, key }) => {
      const value = obj[key];
      if (isNonEmptyString(value) && !isUrl(value) && !fileMap.has(value)) {
        errs.push(`${label}: la imagen "${value}" no fue proporcionada en los archivos seleccionados.`);
      }
    });
  });
  return errs;
};

const GrammarNotesUploader = () => {
  const [jsonInput, setJsonInput] = useState('');
  const [pickedFiles, setPickedFiles] = useState([]);
  const [status, setStatus] = useState('');
  const [errors, setErrors] = useState([]);
  const [warnings, setWarnings] = useState([]);
  const [loading, setLoading] = useState(false);

  const handleUpload = async () => {
    setStatus('');
    setErrors([]);
    setWarnings([]);

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

    // Shape and image-reference validation are pure/synchronous — run them
    // first so a trivially-broken JSON gets immediate feedback even if
    // Firestore is slow or unreachable. Only once the content itself is
    // valid do we pay for a network round-trip (existing-id lookup for the
    // collision check below).
    const shapeErrors = parsedData.flatMap((item, idx) => validateNote(item, idx));
    const fileMap = new Map(pickedFiles.map((f) => [f.name, f]));
    const imageErrors = validateImageRefs(parsedData, fileMap);
    if (shapeErrors.length + imageErrors.length > 0) {
      setErrors([...shapeErrors, ...imageErrors]);
      return;
    }

    setLoading(true);
    try {
      setStatus('Revisando ids existentes...');
      const snap = await getDocs(collection(db, 'grammar_pages'));
      const existingIds = new Set(snap.docs.map((d) => d.id));

      // ID collisions are a hard error here — unlike curiosidades, these ids
      // are durable (other notes and the day-sequencer link to them
      // directly), so this importer never auto-renames; a collision must be
      // resolved by hand.
      const idErrors = [];
      const seenInBatch = new Map();
      parsedData.forEach((item, idx) => {
        const id = item?.id;
        if (!isNonEmptyString(id)) return; // already reported by validateNote
        if (seenInBatch.has(id)) {
          idErrors.push(`"${id}" aparece más de una vez en este lote (notas ${seenInBatch.get(id) + 1} y ${idx + 1}).`);
        } else {
          seenInBatch.set(id, idx);
        }
        if (existingIds.has(id)) {
          idErrors.push(`"${id}" ya existe en Firestore — este importador no sobrescribe notas existentes (edítala en el Manager si quieres cambiarla).`);
        }
      });

      if (idErrors.length > 0) {
        setErrors(idErrors);
        return;
      }

      // Forward references to a not-yet-built note are expected (notes are
      // deliberately built a couple of topics ahead of each other) — warn,
      // don't block. Checked against existing ids PLUS every id in this
      // same batch, so linking between two notes uploaded together works.
      const allIds = new Set([...existingIds, ...parsedData.map((it) => it.id)]);
      const linkWarnings = [];
      parsedData.forEach((item, idx) => {
        const label = `Nota ${idx + 1}${item.title ? ` ("${item.title}")` : ''}`;
        (item.blocks || []).forEach((b) => {
          if (b?.type === 'link' && b.targetId && !allIds.has(b.targetId)) {
            linkWarnings.push(`${label}: el enlace a "${b.targetId}" no existe todavía — se mostrará como "próximamente" hasta que lo crees.`);
          }
        });
        if (item.type === 'landing') {
          (item.subtopics || []).forEach((s) => {
            if (s?.id && !allIds.has(s.id)) {
              linkWarnings.push(`${label}: el subtema "${s.id}" no existe todavía — se mostrará como "próximamente" en la tabla de contenido.`);
            }
          });
        }
      });

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
        const url = await uploadAdminImage(fileMap.get(filename), 'grammar_pages');
        urlMap.set(filename, url);
      }
      parsedData.forEach((item) => {
        collectImageRefs(item).forEach(({ obj, key }) => {
          const value = obj[key];
          if (isNonEmptyString(value) && !isUrl(value)) obj[key] = urlMap.get(value);
        });
      });

      setStatus('Subiendo a Firestore...');
      for (const item of parsedData) {
        const blocks = (item.blocks || []).map((b) => (b.type === 'question' && b.question ? { ...b, question: finalizeQuestion(b.question) } : b));
        const payload = {
          title: item.title,
          category: item.category || '',
          topic: item.topic || '',
          type: item.type,
        };
        if (item.type === 'subtopic') {
          payload.blocks = blocks;
        } else {
          payload.subtopics = item.subtopics;
          if (blocks.length > 0) payload.blocks = blocks;
        }
        await setDoc(doc(db, 'grammar_pages', item.id), payload);
      }
      invalidateCollectionCache('grammar_pages');

      setStatus(`✅ ¡Éxito! Se subieron ${parsedData.length} nota(s) a Firestore.`);
      setWarnings(linkWarnings);
      setJsonInput('');
      setPickedFiles([]);
    } catch (error) {
      console.error('Error uploading grammar notes:', error);
      setErrors([`Error al subir: ${error.message}`]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6 md:p-12">
      <div className="max-w-4xl mx-auto bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
        <div className="flex justify-between items-start mb-2">
          <h1 className="text-3xl font-black text-slate-800">Grammar Notes Bulk Uploader</h1>
          <Link to="/admin-grammar-notes" className="shrink-0 text-slate-500 hover:text-slate-800 text-xs font-bold border border-slate-200 px-3 py-1.5 rounded-lg">
            ← Manager
          </Link>
        </div>
        <p className="text-slate-500 font-medium mb-6">
          Pega tu arreglo JSON completo abajo. Cada nota necesita su propio <code className="bg-slate-100 px-1 rounded">"id"</code> explícito — este
          importador nunca sobrescribe una nota existente ni genera ids automáticamente, porque otras notas y el secuenciador diario enlazan a ellos
          directamente. Si algún bloque hace referencia a una imagen local (p. ej.{' '}
          <code className="bg-slate-100 px-1 rounded">"image": "diagrama.jpg"</code>), selecciona esos archivos abajo también.
        </p>

        <textarea
          rows="12"
          value={jsonInput}
          onChange={(e) => setJsonInput(e.target.value)}
          placeholder='[ { "id": "imperfecto:notas_generales", "title": "Imperfecto", "type": "subtopic", "blocks": [...] } ]'
          className="w-full font-mono text-xs bg-slate-100 border border-slate-200 rounded-xl p-4 mb-4 focus:ring-2 focus:ring-indigo-500 outline-none"
        ></textarea>

        <div className="mb-6">
          <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Imágenes locales referenciadas en el JSON (opcional)</label>
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

        {warnings.length > 0 && (
          <div className="mb-6 p-4 bg-amber-50 border border-amber-300 rounded-xl max-h-48 overflow-y-auto">
            <p className="text-xs font-black text-amber-800 uppercase tracking-widest mb-2">⚠️ {warnings.length} aviso(s) (no bloquean la subida)</p>
            <ul className="list-disc list-inside space-y-1">
              {warnings.map((w, i) => (
                <li key={i} className="text-xs text-amber-700 font-mono">
                  {w}
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
            {loading ? 'Subiendo...' : 'Subir Notas a Firebase'}
          </button>
          {status && <p className="text-sm font-bold text-slate-700">{status}</p>}
        </div>
      </div>
    </div>
  );
};

export default GrammarNotesUploader;
