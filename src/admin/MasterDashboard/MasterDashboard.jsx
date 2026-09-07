import React, { useState, useEffect } from 'react';
import { collection, getDocs, doc, setDoc } from 'firebase/firestore';
import { db } from '../../firebase.js'; 
import FormMusica from './components/FormMusica';
import FormCultura from './components/FormCultura';
import FormAtandoCabos from './components/FormAtandoCabos';
import FormConversaciones from './components/FormConversaciones';
import FormAnuncios from './components/FormAnuncios';
import FormLecturas from './components/FormLecturas'; 
import CalendarManager from './components/CalendarManager';
import FormDestacadoDiario from './components/FormDestacadoDiario'; 
import FormTemas from './components/FormTemas';
import FormVideos from './components/FormVideos';
import FormLearningPath from '../FormLearningPath/FormLearningPath';
export default function MasterDashboard() {
  const [coleccionActual, setColeccionActual] = useState("conversaciones");
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
    } else if (coleccionActual === "conversations") {
      setActividad({
        ...base,
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

  const handleJSONUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    setIsUploading(true);
  
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const jsonData = JSON.parse(e.target.result);
  
        // --- DETECTAR FORMATO BUNDLE IB ---
        if (jsonData.worksheet) {
          const worksheetTitle = jsonData.worksheet.title;
          for (const textObj of jsonData.worksheet.texts) {
            const convertedData = {
              titulo: textObj.title,
              subtitulo: worksheetTitle,
              text_id: textObj.text_id || "",
              test_id: jsonData.worksheet.test_id || "", 
              type: "ib_paper_2",
              paragraphs: textObj.paragraphs || [],
              question_sections: textObj.question_sections || [], 
              dias: [],
              isNew: false
            };
  
            const docId = `${worksheetTitle}-${textObj.text_id}`
              .toLowerCase()
              .replace(/[^a-z0-9]+/g, '-')
              .replace(/(^-|-$)/g, '');
  
            await setDoc(doc(db, "lectura", docId), convertedData, { merge: true });
          }
          alert(`Se han convertido y subido ${jsonData.worksheet.texts.length} textos con éxito.`);
        } 
        // --- DETECTAR FORMATO DESTACADO DIARIO (Array) ---
        else if (Array.isArray(jsonData) && jsonData.length > 0 && jsonData[0].dia !== undefined) {
          let count = 0;
          for (const item of jsonData) {
            const docId = `dia-${String(item.dia).padStart(3, '0')}`;
            await setDoc(doc(db, "destacado_diario", docId), item, { merge: true });
            count++;
          }
          alert(`¡Éxito! Se han migrado ${count} destacados diarios.`);
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
          alert(`¡Éxito! Se han migrado ${count} temas a la base de datos.`);
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
          alert(`¡Éxito! Se han migrado ${count} videos a la base de datos.`);
        }
        // --- SI NO RECONOCE NINGÚN FORMATO ---
        else {
          alert("Formato no reconocido. Asegúrate de que el JSON sea un worksheet, Destacado Diario, Temas, o Videos.");
        }
        
        fetchData();
      } catch (error) {
        console.error("Error en carga:", error);
        alert("Error al procesar el JSON.");
      }
      setIsUploading(false);
    };
    reader.readAsText(file);
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
          extracto: extractoText,
          pdf_url: pdfLink,
          activity_type: "oral_ia",
          prep_seconds: 1200,
          presentation_segments: "240",
          preguntas: { "1": questionsArr },
          tag: "IA Prep",
          courses: ["s4", "IB"],
          dias: []
        };

        const docId = rawTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-');
        await setDoc(doc(db, "conversations", docId), dataToSave, { merge: true });
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

  return (
    <div style={{ display: 'flex', height: '100vh', fontFamily: 'sans-serif' }}>
      <div style={{ width: '30%', borderRight: '1px solid #ccc', padding: '1rem', overflowY: 'auto', backgroundColor: '#f9f9f9' }}>
        <h3>Collection:</h3>
        <select value={coleccionActual} onChange={(e) => {setColeccionActual(e.target.value); setActividad(null);}} style={{ width: '100%', padding: '10px', marginBottom: '20px' }}>
          <option value="conversations">Conversaciones</option>
          <option value="musica">Música</option>
          <option value="culture">Cultura</option>
          <option value="lectura">Lectura</option>
          <option value="juego_atandocabos">Atando Cabos</option>
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
              <input type="file" accept=".json" onChange={handleJSONUpload} />
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
        {coleccionActual !== "learning_path" && <AIAssistant coleccionActual={coleccionActual} />}
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
            {coleccionActual === "conversations" && <FormConversaciones actividad={actividad} setActividad={setActividad} handleChange={handleChange} />}
            {coleccionActual === "musica" && <FormMusica actividad={actividad} setActividad={setActividad} handleChange={handleChange} />}
            {coleccionActual === "culture" && <FormCultura actividad={actividad} handleChange={handleChange} />}
            {coleccionActual === "juego_atandocabos" && <FormAtandoCabos actividad={actividad} setActividad={setActividad} handleChange={handleChange} />}
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