import React from 'react';

const VisibilidadCheckbox = ({ field, visibilidad, onToggle }) => (
  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#444', cursor: 'pointer' }}>
    <input type="checkbox" checked={!!visibilidad?.[field]} onChange={() => onToggle(field)} />
    Visible para estudiantes
  </label>
);

export default function FormConversaciones({ actividad, setActividad, handleChange }) {

  // Helper for comma-separated numbers (dias)
  const handleDiasChange = (e) => {
    const arr = e.target.value.split(',')
      .map(item => parseInt(item.trim(), 10))
      .filter(item => !isNaN(item));
    setActividad({ ...actividad, dias: arr });
  };

  // Helper for comma-separated strings (courses, etiquetas)
  const handleStringArrayChange = (field, e) => {
    const arr = e.target.value.split(',').map(item => item.trim());
    setActividad({ ...actividad, [field]: arr });
  };

  // Helper for the 'notas' map
  const handleNotasChange = (field, value) => {
    setActividad({
      ...actividad,
      notas: {
        ...(actividad.notas || { type: "block", bullets: 10, pregunta: false }),
        [field]: value
      }
    });
  };

  // Helper for 'instrucciones' array
  const handleInstruccionChange = (index, value) => {
    const newInstrucciones = [...(actividad.instrucciones || ["", ""])];
    newInstrucciones[index] = value;
    setActividad({ ...actividad, instrucciones: newInstrucciones });
  };

  // Helper for 'preguntas' sections (newlines to array)
  const handlePreguntasChange = (seccion, text) => {
    const arrayPreguntas = text.split('\n');
    setActividad({
      ...actividad,
      preguntas: {
        ...(actividad.preguntas || {}),
        [seccion]: arrayPreguntas.filter(p => p.trim() !== "")
      }
    });
  };

  // Helper for 'enlaces' (repeatable {texto, url} links)
  const handleEnlaceChange = (index, field, value) => {
    const newEnlaces = [...(actividad.enlaces || [])];
    newEnlaces[index] = { ...newEnlaces[index], [field]: value };
    setActividad({ ...actividad, enlaces: newEnlaces });
  };
  const handleAddEnlace = () => {
    setActividad({ ...actividad, enlaces: [...(actividad.enlaces || []), { texto: "", url: "" }] });
  };
  const handleRemoveEnlace = (index) => {
    setActividad({ ...actividad, enlaces: (actividad.enlaces || []).filter((_, i) => i !== index) });
  };

  // Generic helper for any top-level array-of-strings field (one item per line)
  const handleArrayLinesChange = (field, text) => {
    setActividad({ ...actividad, [field]: text.split('\n').filter((line) => line.trim() !== '') });
  };

  // Helper for 'interacciones' (3 fixed levels, each a list of exchange lines)
  const handleInteraccionChange = (nivel, text) => {
    setActividad({
      ...actividad,
      interacciones: {
        ...(actividad.interacciones || {}),
        [nivel]: text.split('\n').filter((line) => line.trim() !== ''),
      },
    });
  };

  // Helper for 'expresiones_idiomaticas' (repeatable {expresion, significado, ejemplo})
  const handleExpresionChange = (index, field, value) => {
    const newExpresiones = [...(actividad.expresiones_idiomaticas || [])];
    newExpresiones[index] = { ...newExpresiones[index], [field]: value };
    setActividad({ ...actividad, expresiones_idiomaticas: newExpresiones });
  };
  const handleAddExpresion = () => {
    setActividad({ ...actividad, expresiones_idiomaticas: [...(actividad.expresiones_idiomaticas || []), { expresion: "", significado: "", ejemplo: "" }] });
  };
  const handleRemoveExpresion = (index) => {
    setActividad({ ...actividad, expresiones_idiomaticas: (actividad.expresiones_idiomaticas || []).filter((_, i) => i !== index) });
  };

  // Helper for 'pasos_estudiante' (repeatable {titulo, prompt})
  const handlePasoChange = (index, field, value) => {
    const newPasos = [...(actividad.pasos_estudiante || [])];
    newPasos[index] = { ...newPasos[index], [field]: value };
    setActividad({ ...actividad, pasos_estudiante: newPasos });
  };
  const handleAddPaso = () => {
    setActividad({ ...actividad, pasos_estudiante: [...(actividad.pasos_estudiante || []), { titulo: "", prompt: "" }] });
  };
  const handleRemovePaso = (index) => {
    setActividad({ ...actividad, pasos_estudiante: (actividad.pasos_estudiante || []).filter((_, i) => i !== index) });
  };

  // Toggle whether a field (by name) is shown to students — default hidden
  // (admin-only) for every field in this map, matching "modelo" and every
  // new teacher-content section below. Fields NOT in this system (escenario,
  // instrucciones, enlaces, preguntas, extracto) stay always-visible, as
  // they already were before this existed.
  const toggleVisibilidad = (field) => {
    setActividad({
      ...actividad,
      visibilidad: { ...(actividad.visibilidad || {}), [field]: !(actividad.visibilidad || {})[field] },
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      {/* --- CLASIFICACIÓN --- */}
      <div style={{ padding: '15px', border: '1px solid #ccc', borderRadius: '6px', backgroundColor: '#f8f9fa' }}>
        <h4 style={{ margin: '0 0 15px 0' }}>Clasificación</h4>
        <div style={{ display: 'flex', flexDirection: 'column', marginBottom: '10px' }}>
          <label>Imagen (URL)</label>
          <input name="imagen" value={actividad.imagen || ""} onChange={handleChange} placeholder="https://..." style={{ padding: '8px' }} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', marginBottom: '10px' }}>
          <label>Subtítulo / Tema general</label>
          <input name="subtitulo" value={actividad.subtitulo || ""} onChange={handleChange} style={{ padding: '8px' }} />
        </div>

        <div style={{ display: 'flex', gap: '15px' }}>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            <label>Tag (ej: Presentar, IA Prep)</label>
            <input name="tag" value={actividad.tag || ""} onChange={handleChange} style={{ padding: '8px' }} />
          </div>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            <label>Activity Type (ej: oral_ia, flipgrid)</label>
            <input name="activity_type" value={actividad.activity_type || ""} onChange={handleChange} style={{ padding: '8px' }} />
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', marginTop: '10px' }}>
          <label>Etiquetas / Temas (separados por coma)</label>
          <input value={(actividad.etiquetas || []).join(", ")} onChange={(e) => handleStringArrayChange('etiquetas', e)} placeholder="ej: Identidades, Tecnología" style={{ padding: '8px' }} />
        </div>

        <div style={{ display: 'flex', gap: '15px', marginTop: '10px' }}>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            <label>Courses (separados por coma)</label>
            <input value={(actividad.courses || []).join(", ")} onChange={(e) => handleStringArrayChange('courses', e)} placeholder="ej: s2, s4" style={{ padding: '8px' }} />
          </div>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            <label>Días (separados por coma)</label>
            <input value={(actividad.dias || []).join(", ")} onChange={handleDiasChange} placeholder="ej: 58, 59" style={{ padding: '8px' }} />
          </div>
        </div>
      </div>

      {/* --- ENLACES --- */}
      <div style={{ padding: '15px', border: '1px solid #ccc', borderRadius: '6px', backgroundColor: '#f8f9fa' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
          <h4 style={{ margin: 0 }}>Enlaces de Apoyo</h4>
          <button type="button" onClick={handleAddEnlace} style={{ padding: '6px 12px', cursor: 'pointer' }}>+ Añadir Enlace</button>
        </div>
        {(actividad.enlaces || []).length === 0 && <p style={{ fontSize: '12px', color: '#666' }}>Sin enlaces.</p>}
        {(actividad.enlaces || []).map((enlace, index) => (
          <div key={index} style={{ display: 'flex', gap: '10px', marginBottom: '8px', alignItems: 'center' }}>
            <input value={enlace.texto || ""} onChange={(e) => handleEnlaceChange(index, 'texto', e.target.value)} placeholder="Texto del botón" style={{ padding: '8px', flex: 1 }} />
            <input value={enlace.url || ""} onChange={(e) => handleEnlaceChange(index, 'url', e.target.value)} placeholder="https://..." style={{ padding: '8px', flex: 2 }} />
            <button type="button" onClick={() => handleRemoveEnlace(index)} style={{ padding: '8px', cursor: 'pointer' }}>✕</button>
          </div>
        ))}
      </div>

      {/* --- TIEMPOS & NOTAS --- */}
      <div style={{ display: 'flex', gap: '15px' }}>
        <div style={{ flex: 1, padding: '15px', border: '1px solid #ccc', borderRadius: '6px', backgroundColor: '#f8f9fa' }}>
          <h4 style={{ margin: '0 0 15px 0' }}>Tiempos</h4>
          <div style={{ display: 'flex', flexDirection: 'column', marginBottom: '10px' }}>
            <label>Segundos de Preparación (IA: 1200)</label>
            <input type="number" name="prep_seconds" value={actividad.prep_seconds ?? 600} onChange={handleChange} style={{ padding: '8px' }} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <label>Segundos de Presentación (IA: 240)</label>
            <input name="presentation_segments" value={actividad.presentation_segments || ""} onChange={handleChange} placeholder="ej: 240 o 60,60,60" style={{ padding: '8px' }} />
          </div>
        </div>

        <div style={{ flex: 1, padding: '15px', border: '1px solid #ccc', borderRadius: '6px', backgroundColor: '#f8f9fa' }}>
          <h4 style={{ margin: '0 0 15px 0' }}>Configuración de Notas</h4>
          <div style={{ display: 'flex', flexDirection: 'column', marginBottom: '10px' }}>
            <label>Tipo (block / bullets)</label>
            <select value={actividad.notas?.type || "block"} onChange={(e) => handleNotasChange('type', e.target.value)} style={{ padding: '8px' }}>
              <option value="block">Block</option>
              <option value="bullets">Bullets</option>
            </select>
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
             <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
               <label>Bullets Max</label>
               <input type="number" value={actividad.notas?.bullets ?? 10} onChange={(e) => handleNotasChange('bullets', parseInt(e.target.value, 10))} style={{ padding: '8px' }} />
             </div>
             <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
               <label>Permitir Pregunta?</label>
               <input type="checkbox" checked={actividad.notas?.pregunta || false} onChange={(e) => handleNotasChange('pregunta', e.target.checked)} style={{ transform: 'scale(1.5)', marginTop: '5px' }} />
             </div>
          </div>
        </div>
      </div>

      {/* --- NEW SECTION: ESTIMULO LITERARIO --- */}
      <div style={{ padding: '15px', border: '1px solid #ccc', borderRadius: '6px', backgroundColor: '#fff3cd' }}>
        <h4 style={{ margin: '0 0 15px 0' }}>Estímulo / Extracto Literario (Oral IA)</h4>
        <p style={{ fontSize: '12px', color: '#856404', marginTop: '-10px' }}>Solo necesario para actividades de IA prep o lecturas orales.</p>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <label>Extracto de la Obra</label>
          <textarea 
            value={actividad.extracto || ""} 
            onChange={(e) => setActividad({...actividad, extracto: e.target.value})} 
            placeholder="Pega aquí el pasaje literario..."
            style={{ padding: '10px', minHeight: '200px', fontFamily: 'serif', lineHeight: '1.5' }} 
          />
        </div>
      </div>

      {/* --- CONTENIDO ORAL --- */}
      <div style={{ padding: '15px', border: '1px solid #ccc', borderRadius: '6px', backgroundColor: '#f8f9fa' }}>
        <h4 style={{ margin: '0 0 15px 0' }}>Contexto y Modelo</h4>
        <div style={{ display: 'flex', flexDirection: 'column', marginBottom: '15px' }}>
          <label>Escenario (Contexto para el estudiante)</label>
          <textarea value={actividad.escenario || ""} onChange={(e) => setActividad({...actividad, escenario: e.target.value})} style={{ padding: '8px', minHeight: '60px' }} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', marginBottom: '15px', gap: '10px' }}>
          <label>Instrucciones</label>
          <input value={actividad.instrucciones?.[0] || ""} onChange={(e) => handleInstruccionChange(0, e.target.value)} placeholder="Instrucción 1..." style={{ padding: '8px' }} />
          <input value={actividad.instrucciones?.[1] || ""} onChange={(e) => handleInstruccionChange(1, e.target.value)} placeholder="Instrucción 2..." style={{ padding: '8px' }} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <label>Modelo de Respuesta</label>
            <VisibilidadCheckbox field="modelo" visibilidad={actividad.visibilidad} onToggle={toggleVisibilidad} />
          </div>
          <textarea value={actividad.modelo || ""} onChange={(e) => setActividad({...actividad, modelo: e.target.value})} style={{ padding: '8px', minHeight: '60px' }} />
        </div>
      </div>

      {/* --- PREGUNTAS (NEWLINE TRICK) --- */}
      <div style={{ padding: '15px', border: '1px solid #ccc', borderRadius: '6px', backgroundColor: '#f8f9fa' }}>
        <h4 style={{ margin: '0 0 15px 0' }}>Preguntas de Discusión / Seguimiento</h4>
        <p style={{ fontSize: '12px', color: '#666', marginTop: '-10px' }}>Para IA Prep, puedes usar la Sección 1 para las 15 preguntas de apoyo.</p>
        <div style={{ display: 'flex', gap: '15px' }}>
          {["1", "2", "3"].map(seccion => (
            <div key={seccion} style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
              <label style={{ fontWeight: 'bold' }}>Sección {seccion}</label>
              <textarea 
                value={(actividad.preguntas?.[seccion] || []).join('\n')} 
                onChange={(e) => handlePreguntasChange(seccion, e.target.value)} 
                placeholder={`Una pregunta por línea...`}
                style={{ padding: '8px', minHeight: '150px', whiteSpace: 'pre-wrap' }} 
              />
            </div>
          ))}
        </div>
      </div>

      {/* --- CONTENIDO EXTENDIDO DEL PROFESOR --- */}
      <div style={{ padding: '15px', border: '1px solid #ccc', borderRadius: '6px', backgroundColor: '#fdf2f8' }}>
        <h4 style={{ margin: '0 0 4px 0' }}>Contenido Extendido (Profesor)</h4>
        <p style={{ fontSize: '12px', color: '#666', marginTop: 0, marginBottom: '15px' }}>
          Cada sección tiene su propia casilla "Visible para estudiantes" — sin marcar, solo el profesor la ve en la página de la actividad.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', marginBottom: '15px', gap: '6px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <label>🖼️ Descripción (puntos para hablar, ~1:00)</label>
            <VisibilidadCheckbox field="descripcion" visibilidad={actividad.visibilidad} onToggle={toggleVisibilidad} />
          </div>
          <textarea value={actividad.descripcion || ""} onChange={(e) => setActividad({ ...actividad, descripcion: e.target.value })} style={{ padding: '8px', minHeight: '60px' }} />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', marginBottom: '15px', gap: '6px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <label>🌍 Relación con el Tema (~1:30)</label>
            <VisibilidadCheckbox field="relacion_tema" visibilidad={actividad.visibilidad} onToggle={toggleVisibilidad} />
          </div>
          <textarea value={actividad.relacion_tema || ""} onChange={(e) => setActividad({ ...actividad, relacion_tema: e.target.value })} style={{ padding: '8px', minHeight: '60px' }} />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', marginBottom: '15px', gap: '6px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <label>💡 Conexión Cultural (una por línea)</label>
            <VisibilidadCheckbox field="conexion_cultural" visibilidad={actividad.visibilidad} onToggle={toggleVisibilidad} />
          </div>
          <textarea value={(actividad.conexion_cultural || []).join('\n')} onChange={(e) => handleArrayLinesChange('conexion_cultural', e.target.value)} placeholder="En Perú, ...&#10;En Colombia, ..." style={{ padding: '8px', minHeight: '100px', whiteSpace: 'pre-wrap' }} />
        </div>

        <div style={{ display: 'flex', gap: '15px', marginBottom: '15px' }}>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label>💬 Preguntas Interpretativas</label>
              <VisibilidadCheckbox field="preguntas_interpretativas" visibilidad={actividad.visibilidad} onToggle={toggleVisibilidad} />
            </div>
            <textarea value={(actividad.preguntas_interpretativas || []).join('\n')} onChange={(e) => handleArrayLinesChange('preguntas_interpretativas', e.target.value)} placeholder="Una pregunta por línea..." style={{ padding: '8px', minHeight: '120px', whiteSpace: 'pre-wrap' }} />
          </div>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label>🌎 Preguntas Personales / Globales</label>
              <VisibilidadCheckbox field="preguntas_personales" visibilidad={actividad.visibilidad} onToggle={toggleVisibilidad} />
            </div>
            <textarea value={(actividad.preguntas_personales || []).join('\n')} onChange={(e) => handleArrayLinesChange('preguntas_personales', e.target.value)} placeholder="Una pregunta por línea..." style={{ padding: '8px', minHeight: '120px', whiteSpace: 'pre-wrap' }} />
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', marginBottom: '15px', gap: '6px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <label>🪞 Conexión Personal (frases para empezar, una por línea)</label>
            <VisibilidadCheckbox field="conexion_personal" visibilidad={actividad.visibilidad} onToggle={toggleVisibilidad} />
          </div>
          <textarea value={(actividad.conexion_personal || []).join('\n')} onChange={(e) => handleArrayLinesChange('conexion_personal', e.target.value)} placeholder="Una experiencia familiar que nunca olvidaré es..." style={{ padding: '8px', minHeight: '100px', whiteSpace: 'pre-wrap' }} />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', marginBottom: '15px', gap: '6px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <label>🌱 Expansión del Tema (frases útiles, una por línea)</label>
            <VisibilidadCheckbox field="expansion_tema" visibilidad={actividad.visibilidad} onToggle={toggleVisibilidad} />
          </div>
          <textarea value={(actividad.expansion_tema || []).join('\n')} onChange={(e) => handleArrayLinesChange('expansion_tema', e.target.value)} style={{ padding: '8px', minHeight: '80px', whiteSpace: 'pre-wrap' }} />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', marginBottom: '15px', gap: '10px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <label>🪶 Expresiones Idiomáticas</label>
            <VisibilidadCheckbox field="expresiones_idiomaticas" visibilidad={actividad.visibilidad} onToggle={toggleVisibilidad} />
          </div>
          {(actividad.expresiones_idiomaticas || []).map((exp, i) => (
            <div key={i} style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <input value={exp.expresion || ""} onChange={(e) => handleExpresionChange(i, 'expresion', e.target.value)} placeholder="Expresión" style={{ padding: '8px', flex: 1 }} />
              <input value={exp.significado || ""} onChange={(e) => handleExpresionChange(i, 'significado', e.target.value)} placeholder="Significado" style={{ padding: '8px', flex: 2 }} />
              <input value={exp.ejemplo || ""} onChange={(e) => handleExpresionChange(i, 'ejemplo', e.target.value)} placeholder="Ejemplo con 'yo'" style={{ padding: '8px', flex: 2 }} />
              <button type="button" onClick={() => handleRemoveExpresion(i)} style={{ padding: '8px', cursor: 'pointer' }}>✕</button>
            </div>
          ))}
          <button type="button" onClick={handleAddExpresion} style={{ padding: '6px 12px', cursor: 'pointer', alignSelf: 'flex-start' }}>+ Añadir Expresión</button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <label>🔹 Interacción: Niveles (un intercambio por línea, ej: "A: ... B: ...")</label>
            <VisibilidadCheckbox field="interacciones" visibilidad={actividad.visibilidad} onToggle={toggleVisibilidad} />
          </div>
          <div style={{ display: 'flex', gap: '15px' }}>
            {[
              { key: 'descriptivo', label: 'Descriptivo' },
              { key: 'interpretativo', label: 'Interpretativo' },
              { key: 'personal_global', label: 'Personal-Global' },
            ].map(({ key, label }) => (
              <div key={key} style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                <label style={{ fontWeight: 'bold', fontSize: '12px' }}>{label}</label>
                <textarea
                  value={(actividad.interacciones?.[key] || []).join('\n')}
                  onChange={(e) => handleInteraccionChange(key, e.target.value)}
                  placeholder={'A: ... B: ...'}
                  style={{ padding: '8px', minHeight: '100px', whiteSpace: 'pre-wrap' }}
                />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* --- ANDAMIO DEL ESTUDIANTE (siempre visible) --- */}
      <div style={{ padding: '15px', border: '1px solid #ccc', borderRadius: '6px', backgroundColor: '#ecfdf5' }}>
        <h4 style={{ margin: '0 0 4px 0' }}>🧑‍🎓 Andamio del Estudiante</h4>
        <p style={{ fontSize: '12px', color: '#666', marginTop: 0, marginBottom: '15px' }}>
          Esta sección siempre es visible para el estudiante — no tiene casilla de visibilidad.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', marginBottom: '15px', gap: '10px' }}>
          <label>Pasos Guiados</label>
          {(actividad.pasos_estudiante || []).map((paso, i) => (
            <div key={i} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
              <input value={paso.titulo || ""} onChange={(e) => handlePasoChange(i, 'titulo', e.target.value)} placeholder="Paso 1 — Observo" style={{ padding: '8px', flex: 1 }} />
              <input value={paso.prompt || ""} onChange={(e) => handlePasoChange(i, 'prompt', e.target.value)} placeholder="¿Qué ves en la imagen?..." style={{ padding: '8px', flex: 2 }} />
              <button type="button" onClick={() => handleRemovePaso(i)} style={{ padding: '8px', cursor: 'pointer' }}>✕</button>
            </div>
          ))}
          <button type="button" onClick={handleAddPaso} style={{ padding: '6px 12px', cursor: 'pointer', alignSelf: 'flex-start' }}>+ Añadir Paso</button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', marginBottom: '15px' }}>
          <label>Banco de Palabras (una por línea)</label>
          <textarea value={(actividad.banco_palabras || []).join('\n')} onChange={(e) => handleArrayLinesChange('banco_palabras', e.target.value)} style={{ padding: '8px', minHeight: '80px', whiteSpace: 'pre-wrap' }} />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <label>Autoevaluación (una casilla por línea)</label>
          <textarea value={(actividad.autoevaluacion || []).join('\n')} onChange={(e) => handleArrayLinesChange('autoevaluacion', e.target.value)} placeholder="Describí lo que veo con detalle." style={{ padding: '8px', minHeight: '80px', whiteSpace: 'pre-wrap' }} />
        </div>
      </div>

    </div>
  );
}