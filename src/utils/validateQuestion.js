// Shared per-question-type shape validation, used by any bulk importer that
// accepts a question object from the shared registry (src/shared/questionTypes)
// embedded in its own content — the Curiosidades importer and the Grammar
// Notes importer's `question` blocks both validate against this, so the
// rules live in exactly one place.
//
// Mirrors each type's own emptyQuestion()/Editor contract. Types whose
// finalizeQuestion is an identity function (multiple_choice, ordering,
// write, listen, image_select, dropdown_cloze) are validated in their
// FINAL/persisted shape — the JSON you write is exactly what gets saved.
// Types with a real raw→finalized conversion (matching, word_bank_cloze,
// line_bank_cloze) are validated in their RAW/editing shape
// (distractorsText/rawText, not distractors/text) — finalizeQuestion() must
// be run on them before saving.
export const isNonEmptyString = (v) => typeof v === 'string' && v.trim() !== '';

export const validateQuestion = (q, qNum, ownerLabel) => {
  const tag = `${ownerLabel}, pregunta ${qNum}`;
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
    case 'hotspot': {
      if (!isNonEmptyString(q.image)) errs.push(`${tag}: falta "image".`);
      const t = q.target;
      if (!t || typeof t !== 'object' || typeof t.x !== 'number' || typeof t.y !== 'number' || typeof t.radius !== 'number') {
        errs.push(`${tag}: "target" debe ser {x, y, radius} (números, porcentajes 0-100) — estas coordenadas no se pueden adivinar desde una captura de pantalla; colócalas en el editor dentro de la app después de subir esta pregunta.`);
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
