import React from 'react';

export default function FormMusica({ actividad, setActividad, handleChange }) {

  // ==========================================
  // HELPERS FOR NESTED DATA & ARRAYS
  // ==========================================

  // Helper para arreglos de strings (courses)
  const handleStringArrayChange = (field, e) => {
    const arr = e.target.value.split(',').map(item => item.trim());
    setActividad({ ...actividad, [field]: arr });
  };

  // Helper para arreglos de números (dias)
  const handleDiasChange = (e) => {
    const arr = e.target.value.split(',')
      .map(item => parseInt(item.trim(), 10))
      .filter(item => !isNaN(item));
    setActividad({ ...actividad, dias: arr });
  };

  // Helper para objetos anidados simples (video)
  const handleNestedChange = (category, field, value) => {
    setActividad({
      ...actividad,
      [category]: {
        ...(actividad[category] || {}),
        [field]: value
      }
    });
  };

  // Helper para las respuestas de las letras (salto de línea)
  const handleRespuestasChange = (text) => {
    const arrayRespuestas = text.split('\n');
    setActividad({
      ...actividad,
      letras: {
        ...(actividad.letras || {}),
        respuestas: arrayRespuestas.filter(p => p.trim() !== "")
      }
    });
  };

  // ==========================================
  // THE UI FORM
  // ==========================================
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      {/* --- DETALLES DE LA CANCIÓN --- */}
      <div style={{ padding: '15px', border: '1px solid #ccc', borderRadius: '6px', backgroundColor: '#f8f9fa' }}>
        <h4 style={{ margin: '0 0 15px 0' }}>Detalles de la Canción</h4>
        
        <div style={{ display: 'flex', gap: '15px', marginBottom: '10px' }}>
          <div style={{ flex: 2, display: 'flex', flexDirection: 'column' }}>
            <label>Artista</label>
            <input name="artista" value={actividad.artista || ""} onChange={handleChange} style={{ padding: '8px' }} />
          </div>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            <label>Tema (ej: Solemne)</label>
            <input name="tema" value={actividad.tema || ""} onChange={handleChange} style={{ padding: '8px' }} />
          </div>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            <label>Puntos Totales</label>
            <input type="number" name="totalPoints" value={actividad.totalPoints ?? 0} onChange={handleChange} style={{ padding: '8px' }} />
          </div>
        </div>

        <div style={{ display: 'flex', gap: '15px' }}>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            <label>Courses (separados por coma)</label>
            <input value={(actividad.course || []).join(", ")} onChange={(e) => handleStringArrayChange('course', e)} placeholder="ej: s2, s4" style={{ padding: '8px' }} />
          </div>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            <label>Días (separados por coma)</label>
            <input value={(actividad.dias || []).join(", ")} onChange={handleDiasChange} placeholder="ej: 58, 59" style={{ padding: '8px' }} />
          </div>
        </div>
      </div>

      {/* --- MULTIMEDIA --- */}
      <div style={{ padding: '15px', border: '1px solid #ccc', borderRadius: '6px', backgroundColor: '#f8f9fa' }}>
        <h4 style={{ margin: '0 0 15px 0' }}>Multimedia</h4>
        
        <div style={{ display: 'flex', flexDirection: 'column', marginBottom: '10px' }}>
          <label>Enlace de Spotify</label>
          <input name="spotify" value={actividad.spotify || ""} onChange={handleChange} placeholder="URL de Spotify" style={{ padding: '8px' }} />
        </div>

        <div style={{ display: 'flex', gap: '15px' }}>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            <label>Tipo de Video</label>
            <input value={actividad.video?.type || "youtube"} onChange={(e) => handleNestedChange('video', 'type', e.target.value)} style={{ padding: '8px' }} />
          </div>
          <div style={{ flex: 2, display: 'flex', flexDirection: 'column' }}>
            <label>ID del Video (ej: kMIaYXxLnUA)</label>
            <input value={actividad.video?.id || ""} onChange={(e) => handleNestedChange('video', 'id', e.target.value)} style={{ padding: '8px' }} />
          </div>
        </div>
      </div>

      {/* --- LETRAS Y RESPUESTAS --- */}
      <div style={{ padding: '15px', border: '1px solid #ccc', borderRadius: '6px', backgroundColor: '#f8f9fa' }}>
        <h4 style={{ margin: '0 0 15px 0' }}>Letras de la Canción</h4>

        <div style={{ display: 'flex', flexDirection: 'column', marginBottom: '15px' }}>
          <label>Tipo de Actividad</label>
          <input value={actividad.letras?.tipo || "cloze"} onChange={(e) => handleNestedChange('letras', 'tipo', e.target.value)} style={{ padding: '8px', maxWidth: '200px' }} />
        </div>
        
        <div style={{ display: 'flex', gap: '15px' }}>
          {/* Texto de la Canción */}
          <div style={{ flex: 2, display: 'flex', flexDirection: 'column' }}>
            <label>Texto (Usa 1)_[[1]] para los huecos)</label>
            <textarea 
              value={actividad.letras?.texto || ""} 
              onChange={(e) => handleNestedChange('letras', 'texto', e.target.value)} 
              style={{ padding: '8px', minHeight: '300px', lineHeight: '1.5' }} 
            />
          </div>

          {/* Banco de Respuestas */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            <label>Respuestas (Una por línea)</label>
            <textarea 
              value={(actividad.letras?.respuestas || []).join('\n')} 
              onChange={(e) => handleRespuestasChange(e.target.value)} 
              placeholder="ojos&#10;despierten&#10;luz..."
              style={{ padding: '8px', minHeight: '300px', whiteSpace: 'pre-wrap' }} 
            />
            <small style={{ color: '#666', marginTop: '5px' }}>
              Total: {actividad.letras?.respuestas?.length || 0} palabras
            </small>
          </div>
        </div>
      </div>

    </div>
  );
}