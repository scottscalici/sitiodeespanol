import React from 'react';

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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      {/* --- CLASIFICACIÓN --- */}
      <div style={{ padding: '15px', border: '1px solid #ccc', borderRadius: '6px', backgroundColor: '#f8f9fa' }}>
        <h4 style={{ margin: '0 0 15px 0' }}>Clasificación</h4>
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
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <label>Modelo de Respuesta</label>
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

    </div>
  );
}