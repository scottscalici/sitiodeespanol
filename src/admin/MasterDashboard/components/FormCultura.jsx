import React from 'react';

export default function FormCulture({ actividad, setActividad, handleChange }) {

  // ==========================================
  // HELPERS FOR NESTED OBJECTS & ARRAYS
  // ==========================================
  
  // Helper for maps like 'header', 'metadata', 'location'
  const handleNestedChange = (category, field, value) => {
    setActividad({
      ...actividad,
      [category]: {
        ...(actividad[category] || {}),
        [field]: value
      }
    });
  };

  // Helper for the deep location.coordinates map
  const handleCoordinatesChange = (field, value) => {
    const currentLoc = actividad.location || {};
    setActividad({
      ...actividad,
      location: {
        ...currentLoc,
        coordinates: {
          ...(currentLoc.coordinates || {}),
          [field]: parseFloat(value) || 0 // Coords need to be numbers
        }
      }
    });
  };

  // Helper for the SubTopics array
  const handleSubTopicChange = (index, field, value) => {
    const newSubTopics = [...(actividad.subTopics || [])];
    // If we are typing in a new subtopic that doesn't exist yet, create a blank one
    if (!newSubTopics[index]) newSubTopics[index] = { title: "", text: "", image: "" };
    
    newSubTopics[index][field] = value;
    setActividad({ ...actividad, subTopics: newSubTopics });
  };

  // ==========================================
  // THE UI FORM
  // ==========================================
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      {/* --- METADATA & HEADER --- */}
      <div style={{ padding: '15px', border: '1px solid #ccc', borderRadius: '6px', backgroundColor: '#f8f9fa' }}>
        <h4 style={{ margin: '0 0 15px 0' }}>Metadata y Cabecera (Header)</h4>
        <div style={{ display: 'flex', gap: '15px', marginBottom: '10px' }}>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            <label>País</label>
            <input value={actividad.metadata?.country || ""} onChange={(e) => handleNestedChange('metadata', 'country', e.target.value)} style={{ padding: '8px' }} />
          </div>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            <label>Tipo (ej: General Overview)</label>
            <input value={actividad.metadata?.type || ""} onChange={(e) => handleNestedChange('metadata', 'type', e.target.value)} style={{ padding: '8px' }} />
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', marginBottom: '10px' }}>
          <label>Header Image URL</label>
          <input value={actividad.header?.image || ""} onChange={(e) => handleNestedChange('header', 'image', e.target.value)} style={{ padding: '8px' }} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <label>Caption</label>
          <textarea value={actividad.header?.caption || ""} onChange={(e) => handleNestedChange('header', 'caption', e.target.value)} style={{ padding: '8px', minHeight: '60px' }} />
        </div>
      </div>

      {/* --- LOCATION --- */}
      <div style={{ padding: '15px', border: '1px solid #ccc', borderRadius: '6px', backgroundColor: '#f8f9fa' }}>
        <h4 style={{ margin: '0 0 15px 0' }}>Ubicación y Mapa</h4>
        <div style={{ display: 'flex', gap: '15px', marginBottom: '10px' }}>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            <label>Región (ej: Sudamérica)</label>
            <input value={actividad.location?.region || ""} onChange={(e) => handleNestedChange('location', 'region', e.target.value)} style={{ padding: '8px' }} />
          </div>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            <label>Latitud</label>
            <input type="number" step="any" value={actividad.location?.coordinates?.lat || ""} onChange={(e) => handleCoordinatesChange('lat', e.target.value)} style={{ padding: '8px' }} />
          </div>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            <label>Longitud</label>
            <input type="number" step="any" value={actividad.location?.coordinates?.lng || ""} onChange={(e) => handleCoordinatesChange('lng', e.target.value)} style={{ padding: '8px' }} />
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <label>Descripción de Ubicación</label>
          <textarea value={actividad.location?.description || ""} onChange={(e) => handleNestedChange('location', 'description', e.target.value)} style={{ padding: '8px', minHeight: '60px' }} />
        </div>
      </div>

      {/* --- MAIN TEXT --- */}
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <h4 style={{ margin: '0 0 5px 0' }}>Texto Principal (Main Text)</h4>
        <textarea name="mainText" value={actividad.mainText || ""} onChange={handleChange} style={{ padding: '12px', minHeight: '150px', lineHeight: '1.5' }} />
      </div>

      {/* --- SUBTOPICS --- */}
      <div>
        <h4 style={{ margin: '0 0 15px 0', borderBottom: '2px solid #ddd', paddingBottom: '5px' }}>Subtemas (SubTopics)</h4>
        {/* We map over existing subtopics, plus 1 blank one at the end so you can always add more */}
        {[...Array((actividad.subTopics?.length || 0) + 1)].map((_, index) => {
          const sub = actividad.subTopics?.[index] || { title: "", text: "", image: "" };
          return (
            <div key={index} style={{ padding: '15px', border: '1px dashed #aaa', borderRadius: '6px', marginBottom: '15px' }}>
              <h5 style={{ margin: '0 0 10px 0', color: '#555' }}>Subtema {index + 1}</h5>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <input placeholder="Título del subtema" value={sub.title} onChange={(e) => handleSubTopicChange(index, 'title', e.target.value)} style={{ padding: '8px' }} />
                <input placeholder="URL de imagen" value={sub.image} onChange={(e) => handleSubTopicChange(index, 'image', e.target.value)} style={{ padding: '8px' }} />
                <textarea placeholder="Texto del subtema..." value={sub.text} onChange={(e) => handleSubTopicChange(index, 'text', e.target.value)} style={{ padding: '8px', minHeight: '80px' }} />
              </div>
            </div>
          );
        })}
      </div>

    </div>
  );
}