import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { doc, getDocs, collection, setDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { invalidateCollectionCache } from '../../utils/firestoreCache';
import { isNonEmptyString, validateQuestion, collectQuestionImageRefs, collectQuestionAudioRefs } from '../../utils/validateQuestion';
import { validateMediaRefs, resolveMediaRefs } from '../../utils/mediaImport';
import { uploadAdminImage, uploadAdminAudio, importImageFromUrl, importAudioFromUrl } from '../../utils/imageUpload';
import { QUESTION_TYPES, finalizeQuestion } from '../../shared/questionTypes';
import ImageCropAssist from '../shared/ImageCropAssist';

const COURSE_IDS = new Set(['s2', 's4']);

// A reading card's own media refs — the passage's images/audio, plus every
// question's own refs via the same shared collectors every other importer
// uses. Passage images are an array (a reading can show several), unlike
// Curiosidades' single `img`.
const collectCardImageRefs = (card) => {
  const refs = [];
  (card.passage?.images || []).forEach((_, i) => refs.push({ obj: card.passage.images, key: i }));
  (card.questions || []).forEach((q) => refs.push(...collectQuestionImageRefs(q)));
  return refs;
};
const collectCardAudioRefs = (card) => {
  const refs = [];
  if (card.passage?.audio !== undefined) refs.push({ obj: card.passage, key: 'audio' });
  (card.questions || []).forEach((q) => refs.push(...collectQuestionAudioRefs(q)));
  return refs;
};
const cardLabel = (item, idx) => `Lectura ${idx + 1}${item?.title ? ` ("${item.title}")` : ''}`;

const validateCard = (item, idx) => {
  const label = cardLabel(item, idx);
  if (!item || typeof item !== 'object') return [`${label}: no es un objeto válido.`];
  const errors = [];
  if (!isNonEmptyString(item.id)) errors.push(`${label}: falta "id" (requerido — este importador nunca genera ids automáticamente).`);
  if (!isNonEmptyString(item.title)) errors.push(`${label}: falta "title".`);
  if (!isNonEmptyString(item.course) || !COURSE_IDS.has(item.course)) errors.push(`${label}: "course" debe ser "s2" o "s4".`);
  if (item.dia !== null && item.dia !== undefined && typeof item.dia !== 'number') {
    errors.push(`${label}: "dia" debe ser un número, o null/omitido para guardarla en la biblioteca sin asignar.`);
  }
  if (!isNonEmptyString(item.passage?.text)) errors.push(`${label}: falta "passage.text".`);
  if (item.passage?.images !== undefined && !Array.isArray(item.passage.images)) errors.push(`${label}: "passage.images" debe ser un arreglo.`);
  if (!Array.isArray(item.questions) || item.questions.length === 0) {
    errors.push(`${label}: "questions" debe ser un arreglo no vacío.`);
  } else {
    item.questions.forEach((q, qi) => errors.push(...validateQuestion(q, qi + 1, label)));
  }
  return errors;
};

const ReadingCardsUploader = () => {
  const [jsonInput, setJsonInput] = useState('');
  const [pickedFiles, setPickedFiles] = useState([]);
  const [croppedFiles, setCroppedFiles] = useState([]);
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

    const shapeErrors = parsedData.flatMap((item, idx) => validateCard(item, idx));
    const fileMap = new Map([...pickedFiles, ...croppedFiles].map((f) => [f.name, f]));
    const imageErrors = validateMediaRefs(parsedData, fileMap, collectCardImageRefs, 'la imagen', cardLabel);
    const audioErrors = validateMediaRefs(parsedData, fileMap, collectCardAudioRefs, 'el audio', cardLabel);
    const allErrors = [...shapeErrors, ...imageErrors, ...audioErrors];
    if (allErrors.length > 0) {
      setErrors(allErrors);
      return;
    }

    setLoading(true);
    try {
      setStatus('Revisando ids existentes...');
      const snap = await getDocs(collection(db, 'reading_cards'));
      const existingIds = new Set(snap.docs.map((d) => d.id));

      const idErrors = [];
      const seenIds = new Map();
      parsedData.forEach((item, idx) => {
        if (seenIds.has(item.id)) {
          idErrors.push(`"${item.id}" aparece más de una vez en este lote (lecturas ${seenIds.get(item.id) + 1} y ${idx + 1}).`);
        } else {
          seenIds.set(item.id, idx);
        }
        if (existingIds.has(item.id)) {
          idErrors.push(`"${item.id}" ya existe en Firestore — este importador no sobrescribe lecturas existentes.`);
        }
      });
      if (idErrors.length > 0) {
        setErrors(idErrors);
        return;
      }

      setStatus('Subiendo imágenes...');
      await resolveMediaRefs(parsedData, collectCardImageRefs, fileMap, 'lecturas', uploadAdminImage, importImageFromUrl, 'imagen.png');

      setStatus('Subiendo audio...');
      await resolveMediaRefs(parsedData, collectCardAudioRefs, fileMap, 'lecturas', uploadAdminAudio, importAudioFromUrl, 'audio.mp3');

      setStatus('Subiendo a Firestore...');
      for (const item of parsedData) {
        const payload = {
          id: item.id,
          title: item.title,
          course: item.course,
          dia: item.dia ?? null,
          passage: {
            text: item.passage.text,
            images: item.passage.images || [],
            audio: item.passage.audio || '',
          },
          gradeWeight: Number(item.gradeWeight) || 1,
          excused: !!item.excused,
          questions: item.questions.map(finalizeQuestion),
          createdAt: new Date().toISOString(),
        };
        await setDoc(doc(db, 'reading_cards', item.id), payload);
      }
      invalidateCollectionCache('reading_cards');

      setStatus(`✅ ¡Éxito! Se subieron ${parsedData.length} lectura(s) a Firestore.`);
      setJsonInput('');
      setPickedFiles([]);
      setCroppedFiles([]);
    } catch (error) {
      console.error('Error uploading reading cards:', error);
      setErrors([`Error al subir: ${error.message}`]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6 md:p-12">
      <div className="max-w-4xl mx-auto bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
        <div className="flex justify-between items-start mb-2">
          <h1 className="text-3xl font-black text-slate-800">Lecturas Culturales — Bulk Uploader</h1>
          <Link to="/" className="shrink-0 text-slate-500 hover:text-slate-800 text-xs font-bold border border-slate-200 px-3 py-1.5 rounded-lg">
            ← Dashboard
          </Link>
        </div>
        <p className="text-slate-500 font-medium mb-6">
          Pega tu arreglo JSON completo abajo. Cada lectura necesita su propio <code className="bg-slate-100 px-1 rounded">"id"</code> explícito y un{' '}
          <code className="bg-slate-100 px-1 rounded">"passage"</code> con al menos <code className="bg-slate-100 px-1 rounded">"text"</code>. Deja{' '}
          <code className="bg-slate-100 px-1 rounded">"dia"</code> en null/omitido para que quede en la biblioteca sin asignar. Tipos de pregunta soportados:{' '}
          {Object.keys(QUESTION_TYPES).join(', ')}. Si una pregunta o el propio passage referencia una imagen o audio local, selecciónalo abajo o usa un
          enlace <code className="bg-slate-100 px-1 rounded">raw.githubusercontent.com</code> directamente en el JSON.
        </p>

        <textarea
          rows="14"
          value={jsonInput}
          onChange={(e) => setJsonInput(e.target.value)}
          placeholder={
            '[\n' +
            '  {\n' +
            '    "id": "lectura_s4_peru_turismo",\n' +
            '    "title": "Perú, destino turístico",\n' +
            '    "course": "s4",\n' +
            '    "dia": null,\n' +
            '    "passage": { "text": "Primer párrafo...\\n\\nSegundo párrafo...", "images": [], "audio": "" },\n' +
            '    "questions": [\n' +
            '      { "type": "true_false", "prompt": "El texto dice que...", "answer": true }\n' +
            '    ]\n' +
            '  }\n' +
            ']'
          }
          className="w-full font-mono text-xs bg-slate-100 border border-slate-200 rounded-xl p-4 mb-4 focus:ring-2 focus:ring-indigo-500 outline-none"
        ></textarea>

        <div className="mb-4">
          <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">
            Imágenes o audio locales referenciados en el JSON (opcional)
          </label>
          <input
            type="file"
            multiple
            accept="image/*,audio/*"
            onChange={(e) => setPickedFiles(Array.from(e.target.files || []))}
            className="block w-full text-xs text-slate-600 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-slate-700 file:text-white file:text-[10px] file:font-black file:uppercase file:tracking-widest hover:file:bg-slate-600"
          />
          {pickedFiles.length > 0 && (
            <p className="text-[10px] text-slate-500 mt-1">{pickedFiles.length} archivo(s) seleccionados: {pickedFiles.map((f) => f.name).join(', ')}</p>
          )}
        </div>

        <div className="mb-6">
          <ImageCropAssist onCroppedFiles={setCroppedFiles} />
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

        <div className="flex items-center justify-between">
          <button
            onClick={handleUpload}
            disabled={loading}
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-black px-8 py-3 rounded-xl uppercase tracking-widest text-xs transition-colors disabled:opacity-50 shadow-sm"
          >
            {loading ? 'Subiendo...' : 'Subir Lecturas a Firebase'}
          </button>
          {status && <p className="text-sm font-bold text-slate-700">{status}</p>}
        </div>
      </div>
    </div>
  );
};

export default ReadingCardsUploader;
