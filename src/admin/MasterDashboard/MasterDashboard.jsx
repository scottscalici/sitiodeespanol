import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { collection, getDocs, doc, setDoc, updateDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../../firebase.js';
import FormCultura from './components/FormCultura';
import FormConversaciones from './components/FormConversaciones';
import FormAnuncios from './components/FormAnuncios';
import FormLecturas from './components/FormLecturas';
import CalendarManager from './components/CalendarManager';
import FormDestacadoDiario from './components/FormDestacadoDiario';
import FormTemas from './components/FormTemas';
import FormVideos from './components/FormVideos';
import FormLearningPath from '../FormLearningPath/FormLearningPath';
const VALID_COLLECTIONS = [
  "conversaciones", "culture", "lectura", "anuncios",
  "calendario", "destacado_diario", "temas", "videos", "learning_path",
];

export default function MasterDashboard() {
  const [searchParams] = useSearchParams();
  const requestedType = searchParams.get('tipo');
  const [coleccionActual, setColeccionActual] = useState(
    VALID_COLLECTIONS.includes(requestedType) ? requestedType : "conversaciones"
  );
  const [listaActividades, setListaActividades] = useState([]);
  const [actividad, setActividad] = useState(null);
  const [isUploading, setIsUploading] = useState(false);

  const fetchData = async () => {
    if (coleccionActual === "calendario" || coleccionActual === "learning_path") {
      setListaActividades([]);
      return;
    }
    try {
      const querySnapshot = await getDocs(collection(db, coleccionActual));
      const items = [];
      querySnapshot.forEach((doc) => {
        items.push({ id: doc.id, ...doc.data() });
      });
      setListaActividades(items);
    } catch (error) {
      console.error(`Error fetching data for ${coleccionActual}: `, error);
    }
  };

  useEffect(() => {
    fetchData();
  }, [coleccionActual]);

  const handleCreateNew = () => {
    const base = {
      id: "",
      titulo: "",
      subtitulo: "",
      imagen: "",
      isNew: true
    };

    if (coleccionActual === "lectura") {
      setActividad({
        ...base,
        test_id: "",
        text_id: "",
        paragraphs: [],
        question_sections: [],
        type: "ib_paper_2"
      });
    } else if (coleccionActual === "conversaciones") {
      setActividad({
        ...base,
        etiquetas: [],
        enlaces: [],
        courses: [],
        dias: [],
        prep_seconds: 600,
        presentation_segments: "",
        notas: { type: "bullets", bullets: 10, pregunta: false },
        escenario: "",
        instrucciones: ["", ""],
        modelo: "",
        extracto: "",
        preguntas: { "1": [], "2": [], "3": [] },
        activity_type: "oral_ia"
      });
    } else if (coleccionActual === "destacado_diario") {
      setActividad({
        ...base,
        dia: 1,
        type: "destino",
        header: "DESTINO DEL DÍA",
        location: "",
        image_url: "",
        spanish: "",
        english: "",
        course: ["s2", "s4"],
        word_of_the_day: { word: "", translation: "", sample_sentence: "", sentence_translation: "" }
      });
    } else if (coleccionActual === "temas") {
      setActividad({
        ...base,
        name: "Nuevo Tema",
        start: "",
        end: "",
        styles: {
          header: "bg-gradient-to-r from-blue-800 to-red-600",
          fontHeading: "Inter",
          accent: "#1e3a8a",
          cardOverrides: {
            evaluacion: "#1e3a8a", calentamiento: "#dc2626", curiosidad: "#1e3a8a",
            musica: "#1e3a8a", conversacion: "#dc2626", cultura: "#1e3a8a",
            lectura: "#1e3a8a", tareas: "#dc2626", destacado: "#0f172a",
            pruebas: "#0f172a", estructura: "#475569", extras: "#0f172a",
            video: "#1e3a8a", senordle: "#1e3a8a"
          }
        }
      });
    } else if (coleccionActual === "videos") {
      setActividad({
        ...base,
        title: "",
        dia: "",
        tags: [],
        video_url: "",
        thumbnail_url: "",
        page_url: "",
        is_short: false,
        description: "",
        internal_notes: ""
      });
    } else {
      setActividad(base);
    }
  };

  const handleChange = (e) => {
    setActividad({
      ...actividad,
      [e.target.name]: e.target.value
    });
  };
    const handleSave = async (e) => {
    e.preventDefault();
    if (actividad.isNew && !actividad.id) {
      alert("Please enter a unique ID (slug).");
      return;
    }
    try {
      const { isNew, id, ...dataToSave } = actividad;
      await setDoc(doc(db, coleccionActual, id), dataToSave, { merge: true });
      alert(`Saved to ${coleccionActual}!`);
      fetchData();
    } catch (error) {
      console.error("Save Error:", error);
      alert("Error saving document.");
    }
  };

  // Parses and imports a single already-parsed JSON blob, auto-detecting its
  // format. Returns a one-line summary string for the batch-upload alert.
  const processOneJSONUpload = async (jsonData) => {
        // --- DETECTAR FORMATO BUNDLE IB ---
        if (jsonData.worksheet) {
          const worksheetTitle = jsonData.worksheet.title;
          for (const textObj of jsonData.worksheet.texts) {
            const convertedData = {
              subtitulo: textObj.title || worksheetTitle,
              text_id: textObj.text_id || "",
              test_id: jsonData.worksheet.test_id || worksheetTitle || "",
              type: "ib_paper_2",
              dia: "",
              paragraphs: textObj.paragraphs || [],
              // "correction" sections are just the author's own answer-key
              // patch notes for a preceding multiple_select section, not
              // student-facing content — drop them. A question's answer can
              // also be an array (multiple_select, e.g. ["A","C","D"]); join
              // it to a string since LecturaPage grades every type with a
              // plain string compare.
              question_sections: (textObj.question_sections || [])
                .filter((sec) => sec.type !== "correction")
                .map((sec) => ({
                  ...sec,
                  questions: (sec.questions || []).map((q) => ({
                    ...q,
                    answer: Array.isArray(q.answer) ? q.answer.join(", ") : q.answer,
                  })),
                })),
            };

            const docId = `${worksheetTitle}-${textObj.text_id}`
              .toLowerCase()
              .replace(/[^a-z0-9]+/g, '-')
              .replace(/(^-|-$)/g, '');

            await setDoc(doc(db, "lecturas", docId), convertedData, { merge: true });
          }
          return `${jsonData.worksheet.texts.length} textos (worksheet IB)`;
        }
        // --- DETECTAR FORMATO LECTURA CULTURAL (Array de topics con niveles) ---
        else if (Array.isArray(jsonData) && jsonData.length > 0 && jsonData[0].topicName !== undefined && jsonData[0].levels !== undefined) {
          // Only the Spanish-language tiers make sense as reading-comprehension
          // practice — level_1 is written in English (a scaffolding tier), so
          // it's intentionally skipped here.
          const LEVELS_TO_IMPORT = [
            { key: "level_2", label: "Nivel 2" },
            { key: "level_3", label: "Nivel 3" },
          ];
          let count = 0;
          const topicNameCounts = {};
          for (const topic of jsonData) {
            // A few topicNames repeat in the source file with genuinely
            // different content (e.g. two different write-ups both titled
            // "Cartagena de Indias") — suffix the docId so the second one
            // doesn't silently overwrite the first.
            const slugBase = (topicNameCounts[topic.topicName] = (topicNameCounts[topic.topicName] || 0) + 1);
            const topicSlug = slugBase > 1 ? `${topic.topicName}-v${slugBase}` : topic.topicName;

            for (const { key, label } of LEVELS_TO_IMPORT) {
              const levelData = topic.levels?.[key];
              if (!levelData) continue;

              const convertedData = {
                subtitulo: topic.topicName,
                text_id: label,
                test_id: "Lectura Cultural",
                type: "cultural",
                dia: "",
                // Matched against an uploaded image's filename by the
                // "Upload Imágenes" tool below, which fills in `imagen`
                // with the real Storage URL once that file is uploaded.
                imagen_filename: topic.imageFileName || "",
                paragraphs: (levelData.readingText || "")
                  .split("\n\n")
                  .map((p) => p.trim())
                  .filter(Boolean),
                question_sections: [
                  {
                    type: "short_answer",
                    instructions: levelData.instruction || "",
                    questions: (levelData.questions || []).map((prompt, i) => ({
                      number: i + 1,
                      prompt,
                      answer: (levelData.answerKey || [])[i] || "",
                      points: 1,
                    })),
                  },
                ],
              };

              const docId = `${topicSlug}-${key}`
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, '-')
                .replace(/(^-|-$)/g, '');

              await setDoc(doc(db, "lecturas", docId), convertedData, { merge: true });
              count++;
            }
          }
          return `${count} lecturas culturales`;
        }
        // --- DETECTAR FORMATO DESTACADO DIARIO (Array) ---
        else if (Array.isArray(jsonData) && jsonData.length > 0 && jsonData[0].dia !== undefined) {
          let count = 0;
          for (const item of jsonData) {
            const docId = `dia-${String(item.dia).padStart(3, '0')}`;
            await setDoc(doc(db, "destacado_diario", docId), item, { merge: true });
            count++;
          }
          return `${count} destacados diarios`;
        }
        // --- DETECTAR FORMATO TEMAS (THEMES) ---
        else if (jsonData.themes && Array.isArray(jsonData.themes)) {
          let count = 0;
          for (const tema of jsonData.themes) {
            const docId = tema.id;
            const dataToSave = {
              ...tema,
              titulo: tema.name || docId,
              isNew: false
            };
            await setDoc(doc(db, "temas", docId), dataToSave, { merge: true });
            count++;
          }
          return `${count} temas`;
        }
        // --- DETECTAR FORMATO VIDEOS (daily_tags) ---
        else if (jsonData.daily_tags && Array.isArray(jsonData.daily_tags)) {
          let count = 0;
          for (const video of jsonData.daily_tags) {
            const docId = video.id;
            const dataToSave = {
              ...video,
              titulo: video.title || docId,
              isNew: false
            };
            await setDoc(doc(db, "videos", docId), dataToSave, { merge: true });
            count++;
          }
          return `${count} videos`;
        }
        // --- DETECTAR FORMATO CONVERSACIONES (items map, ej: planes/conversaciones.json) ---
        else if (jsonData.items && typeof jsonData.items === 'object' && !Array.isArray(jsonData.items)) {
          let count = 0;
          for (const [docId, lesson] of Object.entries(jsonData.items)) {
            const dataToSave = {
              titulo: lesson.titulo || docId,
              imagen: lesson.imagen || "",
              etiquetas: lesson.etiquetas || [],
              enlaces: lesson.enlaces || [],
              courses: lesson.courses || [],
              dias: lesson.dias || [],
              prep_seconds: lesson.prep_seconds ?? 600,
              presentation_segments: lesson.presentation_segments || "",
              notas: lesson.notas || { type: "bullets", bullets: 10, pregunta: false },
              escenario: lesson.escenario || "",
              instrucciones: lesson.instrucciones || [],
              modelo: lesson.modelo || "",
              preguntas: lesson.preguntas || { "1": [], "2": [], "3": [] },
              isNew: false
            };
            // Only copy these when the JSON has them, so re-importing doesn't erase values typed in the form
            for (const key of [
              "subtitulo", "tag", "activity_type", "url", "extracto",
              "descripcion", "relacion_tema", "conexion_cultural",
              "preguntas_interpretativas", "preguntas_personales", "conexion_personal",
              "expansion_tema", "expresiones_idiomaticas", "interacciones",
              "visibilidad", "pasos_estudiante", "banco_palabras", "autoevaluacion",
            ]) {
              if (lesson[key] !== undefined) dataToSave[key] = lesson[key];
            }
            await setDoc(doc(db, "conversaciones", docId), dataToSave, { merge: true });
            count++;
          }
          return `${count} lecciones de conversación`;
        }
        // --- SI NO RECONOCE NINGÚN FORMATO ---
        return null;
  };

  // Single or multi-file JSON upload. Each file is parsed and routed through
  // processOneJSONUpload independently, so one bad file in a batch doesn't
  // abort the rest — results are rolled up into one summary alert.
  const handleJSONUpload = async (event) => {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;
    setIsUploading(true);

    const results = [];
    for (const file of files) {
      try {
        const text = await file.text();
        const jsonData = JSON.parse(text);
        const summary = await processOneJSONUpload(jsonData);
        results.push(summary ? `✅ ${file.name}: ${summary}` : `⚠️ ${file.name}: formato no reconocido`);
      } catch (error) {
        console.error(`Error en carga de ${file.name}:`, error);
        results.push(`❌ ${file.name}: error al procesar`);
      }
    }

    fetchData();
    setIsUploading(false);
    alert(results.join('\n'));
    event.target.value = '';
  };
  // IA PREP Parser
  const handleHTMLUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    setIsUploading(true);
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const parser = new DOMParser();
        const docHtml = parser.parseFromString(e.target.result, "text/html");
        const rawTitle = docHtml.querySelector('title')?.innerText || "";
        const headerInfo = docHtml.querySelector('header p')?.innerText || "";
        const imageSrc = docHtml.querySelector('header img')?.src || "";
        const extractoText = docHtml.querySelector('.extract-box')?.innerText || "";
        const pdfLink = docHtml.querySelector('a[href*=".pdf"]')?.href || "";
        const questionNodes = docHtml.querySelectorAll('#questions-area ol li');
        const questionsArr = Array.from(questionNodes).map(li => li.innerText);

        const dataToSave = {
          titulo: headerInfo || rawTitle,
          subtitulo: rawTitle,
          imagen: imageSrc,
          etiquetas: ["IA Prep"],
          enlaces: [],
          extracto: extractoText,
          pdf_url: pdfLink,
          activity_type: "oral_ia",
          prep_seconds: 1200,
          presentation_segments: "240",
          notas: { type: "bullets", bullets: 10, pregunta: false },
          preguntas: { "1": questionsArr },
          tag: "IA Prep",
          courses: ["s4", "IB"],
          dias: []
        };

        const docId = rawTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-');
        await setDoc(doc(db, "conversaciones", docId), dataToSave, { merge: true });
        alert(`Imported IA Prep: ${dataToSave.titulo}`);
        fetchData();
      } catch (error) { alert("IA Prep Parser Error."); }
      setIsUploading(false);
    };
    reader.readAsText(file);
  };

  // STANDARD LECTURA Parser
  const handleLecturasHTMLUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    setIsUploading(true);
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const parser = new DOMParser();
        const docHtml = parser.parseFromString(e.target.result, "text/html");
        const titulo = docHtml.querySelector('h2, h1')?.innerText || "Nueva Lectura";
        const paragraphs = Array.from(docHtml.querySelectorAll('section p'))
          .filter(p => !p.querySelector('strong'))
          .map(p => p.innerText.trim());

        const dataToSave = {
          titulo,
          paragraphs,
          type: "reading_standard",
          courses: ["s2"],
          dias: []
        };

        const docId = titulo.toLowerCase().replace(/[^a-z0-9]+/g, '-');
        await setDoc(doc(db, "lectura", docId), dataToSave, { merge: true });
        alert(`Imported Reading: ${titulo}`);
        fetchData();
      } catch (error) { alert("Lectura Parser Error."); }
      setIsUploading(false);
    };
    reader.readAsText(file);
  };

  // Bulk image upload for lectura_cultural — uploads each selected file to
  // Storage, then matches it against any "lecturas" doc whose
  // imagen_filename has the same name IGNORING EXTENSION (the source JSON
  // references the original .png files, but what gets uploaded here is a
  // resized/recompressed .jpg copy — same base name, different extension)
  // and writes the resulting download URL into that doc's `imagen` field. A
  // topic's level_2 and level_3 docs share one image, so one file commonly
  // updates two docs. Matching is done against one up-front fetch of the
  // whole collection rather than a per-file query, since Firestore can't
  // do an extension-insensitive equality match server-side.
  const stripExt = (filename) => filename.replace(/\.[^./\\]+$/, '').toLowerCase();

  const handleImageBulkUpload = async (event) => {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;
    setIsUploading(true);

    const allLecturas = await getDocs(collection(db, "lecturas"));
    const byBaseName = new Map();
    allLecturas.forEach((docSnap) => {
      const fn = docSnap.data().imagen_filename;
      if (!fn) return;
      const base = stripExt(fn);
      if (!byBaseName.has(base)) byBaseName.set(base, []);
      byBaseName.get(base).push(docSnap.id);
    });

    const results = [];
    for (const file of files) {
      try {
        const storageRef = ref(storage, `lectura_images/${file.name}`);
        await uploadBytes(storageRef, file);
        const url = await getDownloadURL(storageRef);

        const matchedIds = byBaseName.get(stripExt(file.name)) || [];
        if (matchedIds.length === 0) {
          results.push(`⚠️ ${file.name}: subida, pero ninguna lectura la referencia todavía`);
          continue;
        }
        for (const id of matchedIds) {
          await updateDoc(doc(db, "lecturas", id), { imagen: url });
        }
        results.push(`✅ ${file.name}: ${matchedIds.length} lectura(s) actualizada(s)`);
      } catch (error) {
        console.error(`Error subiendo ${file.name}:`, error);
        results.push(`❌ ${file.name}: error al subir`);
      }
    }

    fetchData();
    setIsUploading(false);
    alert(results.join('\n'));
    event.target.value = '';
  };

  return (
    <div style={{ display: 'flex', height: '100vh', fontFamily: 'sans-serif' }}>
      <div style={{ width: '30%', borderRight: '1px solid #ccc', padding: '1rem', overflowY: 'auto', backgroundColor: '#f9f9f9' }}>
        <h3>Collection:</h3>
        <select value={coleccionActual} onChange={(e) => {setColeccionActual(e.target.value); setActividad(null);}} style={{ width: '100%', padding: '10px', marginBottom: '20px' }}>
          <option value="conversaciones">Conversaciones</option>
          <option value="culture">Cultura</option>
          <option value="lectura">Lectura</option>
          <option value="anuncios">Anuncios</option>
          <option value="calendario">📅 Calendario</option>
          <option value="destacado_diario">🌟 Destacado Diario</option>
          <option value="temas">🎨 Temas (Themes)</option>
          <option value="videos">🎬 Videos</option>
          <option value="learning_path">🛤️ Ruta de Aprendizaje</option>
          </select>

        {/* CHANGE THIS LINE: */}
        {coleccionActual !== "calendario" && coleccionActual !== "learning_path" && (
          <>
            <button onClick={handleCreateNew} style={{ width: '100%', padding: '10px', backgroundColor: '#28a745', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', marginBottom: '20px' }}>
              + Create New
            </button>
            <div style={{ marginBottom: '20px', padding: '10px', backgroundColor: '#eee', borderRadius: '4px' }}>
              <h4>Upload JSON</h4>
              <input type="file" accept=".json" multiple onChange={handleJSONUpload} />
              <p style={{ fontSize: '10px', color: '#666', marginTop: '4px' }}>Puedes seleccionar varios archivos a la vez (ej: los 24 de IB).</p>
            </div>
            <div style={{ marginBottom: '20px', padding: '10px', backgroundColor: '#e0f2fe', borderRadius: '4px' }}>
              <h4>Upload Imágenes (Lectura Cultural)</h4>
              <input type="file" accept="image/*" multiple onChange={handleImageBulkUpload} />
              <p style={{ fontSize: '10px', color: '#666', marginTop: '4px' }}>
                Selecciona todas las fotos a la vez — cada una se asigna sola a la(s) lectura(s) cuyo nombre de archivo coincida (primero sube el JSON de Lectura Cultural).
              </p>
            </div>
            <div style={{ marginBottom: '20px', padding: '10px', backgroundColor: '#fff3cd', borderRadius: '4px' }}>
              <h4>Import IA HTML</h4>
              <input type="file" accept=".html" onChange={handleHTMLUpload} />
            </div>
            <div style={{ marginBottom: '20px', padding: '10px', backgroundColor: '#d1ecf1', borderRadius: '4px' }}>
              <h4>Import Reading HTML</h4>
              <input type="file" accept=".html" onChange={handleLecturasHTMLUpload} />
            </div>
          </>
        )}

<div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {[...listaActividades] // Spread into a new array so we don't mutate state directly
            .sort((a, b) => {
              // Only sort by day if we are in destacado_diario
              if (coleccionActual === "destacado_diario") {
                return (a.dia || 0) - (b.dia || 0);
              }
              // Otherwise, leave the original fetch order
              return 0;
            })
            .map((item) => (
            <button
              key={item.id}
              onClick={() => setActividad(item)}
              style={{
                textAlign: 'left',
                padding: '10px',
                cursor: 'pointer',
                border: '1px solid #ddd',
                borderRadius: '4px',
                backgroundColor: 'white'
              }}
            >
              <strong>
                {/* Dynamically change the button text based on the collection */}
                {coleccionActual === "destacado_diario"
                  ? `Día ${item.dia || '?'}: ${item.location || item.header || item.id}`
                  : (item.titulo || item.id)
                }
              </strong>
            </button>
          ))}
        </div>

      </div>

      <div style={{ width: '70%', padding: coleccionActual === "learning_path" ? '0' : '2rem', overflowY: 'auto' }}>
               {coleccionActual === "learning_path" ? (
          <FormLearningPath />
        ) : coleccionActual === "calendario" ? (
          <CalendarManager />
        ) : actividad ? (
          <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            <h2>{actividad.isNew ? `New ${coleccionActual}` : `Edit: ${actividad.id}`}</h2>
            {actividad.isNew && (
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <label>Slug (ID)</label>
                <input name="id" value={actividad.id || ""} onChange={handleChange} required style={{ padding: '8px' }} />
              </div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <label>Title</label>
              <input name="titulo" value={actividad.titulo || ""} onChange={handleChange} style={{ padding: '8px' }} />
            </div>
            {coleccionActual === "conversaciones" && <FormConversaciones actividad={actividad} setActividad={setActividad} handleChange={handleChange} />}
            {coleccionActual === "culture" && <FormCultura actividad={actividad} handleChange={handleChange} />}
            {coleccionActual === "anuncios" && <FormAnuncios actividad={actividad} setActividad={setActividad} handleChange={handleChange} />}
            {coleccionActual === "lectura" && <FormLecturas actividad={actividad} setActividad={setActividad} handleChange={handleChange} />}
            {coleccionActual === "destacado_diario" && <FormDestacadoDiario actividad={actividad} setActividad={setActividad} handleChange={handleChange} />}
            {coleccionActual === "temas" && <FormTemas actividad={actividad} setActividad={setActividad} />}
            {coleccionActual === "videos" && <FormVideos actividad={actividad} setActividad={setActividad} />}
            <button type="submit" style={{ padding: '12px', backgroundColor: '#007BFF', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', marginTop: '20px' }}>
              Save to Firestore
            </button>
          </form>
        ) : (
          <div style={{ textAlign: 'center', marginTop: '20%' }}>
            <h2 style={{ color: '#aaa' }}>Select an activity to edit</h2>
          </div>
        )}
      </div>
    </div>
  );
}
