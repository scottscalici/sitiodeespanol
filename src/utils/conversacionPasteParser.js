// Parses one pasted block of text with header lines (e.g. "ESCENARIO:",
// "PREGUNTAS NIVEL 1:") into the individual FormConversaciones fields, so a
// teacher can type/paste everything in one place instead of filling a dozen
// separate boxes one at a time. Headers are matched case- and
// accent-insensitively and may or may not end in a colon.
//
// Fields NOT listed here (enlaces, expresiones_idiomaticas, interacciones,
// pasos_estudiante) are repeatable multi-field objects that don't map
// cleanly onto "header: block of text" — they stay manual-entry only.

const FIELD_DEFS = [
  { headers: ['escenario'], field: 'escenario', type: 'string' },
  { headers: ['instrucciones'], field: 'instrucciones', type: 'lines-fixed2' },
  { headers: ['modelo', 'modelo de respuesta', 'frase de presentacion', 'frase de presentacion inicial'], field: 'modelo', type: 'string' },
  { headers: ['extracto', 'extracto de la obra'], field: 'extracto', type: 'string' },
  { headers: ['preguntas nivel 1', 'preguntas 1', 'preguntas seccion 1'], field: 'preguntas.1', type: 'lines' },
  { headers: ['preguntas nivel 2', 'preguntas 2', 'preguntas seccion 2'], field: 'preguntas.2', type: 'lines' },
  { headers: ['preguntas nivel 3', 'preguntas 3', 'preguntas seccion 3'], field: 'preguntas.3', type: 'lines' },
  { headers: ['descripcion'], field: 'descripcion', type: 'string' },
  { headers: ['relacion con el tema', 'relacion tema'], field: 'relacion_tema', type: 'string' },
  { headers: ['conexion cultural'], field: 'conexion_cultural', type: 'lines' },
  { headers: ['preguntas interpretativas'], field: 'preguntas_interpretativas', type: 'lines' },
  { headers: ['preguntas personales', 'preguntas personales globales', 'preguntas personales y globales'], field: 'preguntas_personales', type: 'lines' },
  { headers: ['conexion personal'], field: 'conexion_personal', type: 'lines' },
  { headers: ['expansion del tema', 'expansion tema'], field: 'expansion_tema', type: 'lines' },
  { headers: ['banco de palabras'], field: 'banco_palabras', type: 'lines' },
  { headers: ['autoevaluacion'], field: 'autoevaluacion', type: 'lines' },
];

function normalize(str) {
  return str
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
    .replace(/:$/, '');
}

const HEADER_LOOKUP = new Map();
for (const def of FIELD_DEFS) {
  for (const h of def.headers) HEADER_LOOKUP.set(normalize(h), def);
}

// Returns a list of recognized header labels, for a usage hint in the UI.
export function getRecognizedHeaders() {
  return FIELD_DEFS.map((d) => d.headers[0]);
}

function buildValue(type, lines) {
  const trimmedLines = lines.map((l) => l.trim());
  if (type === 'string') {
    return trimmedLines.join('\n').trim();
  }
  if (type === 'lines') {
    return trimmedLines.filter((l) => l !== '');
  }
  if (type === 'lines-fixed2') {
    const nonEmpty = trimmedLines.filter((l) => l !== '');
    return [nonEmpty[0] || '', nonEmpty[1] || ''];
  }
  return trimmedLines;
}

// Parses `text` and returns a NEW actividad object with only the fields it
// recognized merged in — everything else on `actividad` is left untouched,
// so pasting a partial block never erases fields it didn't mention.
export function parseConversacionPaste(text, actividad) {
  const lines = (text || '').split('\n');
  const buckets = []; // { def, lines: [] }
  let current = null;

  for (const rawLine of lines) {
    const def = HEADER_LOOKUP.get(normalize(rawLine));
    if (def) {
      current = { def, lines: [] };
      buckets.push(current);
    } else if (current) {
      current.lines.push(rawLine);
    }
    // Lines before the first recognized header are ignored.
  }

  const updated = { ...actividad };
  let matchCount = 0;

  for (const { def, lines: bodyLines } of buckets) {
    const value = buildValue(def.type, bodyLines);
    matchCount++;
    if (def.field.includes('.')) {
      const [parent, key] = def.field.split('.');
      updated[parent] = { ...(updated[parent] || {}), [key]: value };
    } else {
      updated[def.field] = value;
    }
  }

  return { actividad: updated, matchCount };
}
