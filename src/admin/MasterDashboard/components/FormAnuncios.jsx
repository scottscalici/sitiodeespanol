import React from 'react';

export default function FormAnuncios({ actividad, setActividad, handleChange }) {

  // Helper to handle the courses array (comma-separated)
  const handleCoursesChange = (e) => {
    const arr = e.target.value.split(',').map(item => item.trim());
    setActividad({ ...actividad, courses: arr });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
      
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <label>Texto del Anuncio</label>
        <textarea 
          name="text" 
          value={actividad.text || ""} 
          onChange={handleChange} 
          placeholder="Ej: Galería de Arte – Seniors IB 2026"
          style={{ padding: '8px', minHeight: '60px', border: '1px solid #ccc', borderRadius: '4px' }} 
        />
      </div>

      <div style={{ display: 'flex', gap: '20px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
          <label>Tipo</label>
          <input 
            name="type" 
            value={actividad.type || "standard"} 
            onChange={handleChange} 
            style={{ padding: '8px', border: '1px solid #ccc', borderRadius: '4px' }} 
          />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', flex: 2 }}>
          <label>Cursos (separados por coma)</label>
          <input 
            value={(actividad.courses || []).join(", ")} 
            onChange={handleCoursesChange} 
            placeholder="s2, s4" 
            style={{ padding: '8px', border: '1px solid #ccc', borderRadius: '4px' }} 
          />
        </div>
      </div>

      <div style={{ display: 'flex', gap: '20px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
          <label>Fecha de Inicio</label>
          <input 
            type="date" 
            name="start_date" 
            value={actividad.start_date || ""} 
            onChange={handleChange} 
            style={{ padding: '8px', border: '1px solid #ccc', borderRadius: '4px' }} 
          />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
          <label>Fecha de Fin</label>
          <input 
            type="date" 
            name="end_date" 
            value={actividad.end_date || ""} 
            onChange={handleChange} 
            style={{ padding: '8px', border: '1px solid #ccc', borderRadius: '4px' }} 
          />
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <label>Miniatura (Thumbnail URL)</label>
        <input 
          name="thumbnail" 
          value={actividad.thumbnail || ""} 
          onChange={handleChange} 
          style={{ padding: '8px', border: '1px solid #ccc', borderRadius: '4px' }} 
        />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <label>Enlace (Opcional)</label>
        <input 
          name="link" 
          value={actividad.link || ""} 
          onChange={handleChange} 
          style={{ padding: '8px', border: '1px solid #ccc', borderRadius: '4px' }} 
        />
      </div>

    </div>
  );
}