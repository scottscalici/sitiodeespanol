import React from 'react';

export default function FormAtandoCabos({ actividad, setActividad, handleChange }) {
  
  // Helpers moved here so they don't clutter the main dashboard!
  const handleCategoryTitleChange = (catIndex, newTitle) => {
    const newCategories = [...(actividad.categories || [
      {title: "", level: 1, items: ["","","",""]},
      {title: "", level: 2, items: ["","","",""]},
      {title: "", level: 3, items: ["","","",""]},
      {title: "", level: 4, items: ["","","",""]}
    ])];
    newCategories[catIndex].title = newTitle;
    setActividad({ ...actividad, categories: newCategories });
  };

  const handleCategoryItemChange = (catIndex, itemIndex, newValue) => {
    const newCategories = [...(actividad.categories || [
      {title: "", level: 1, items: ["","","",""]},
      {title: "", level: 2, items: ["","","",""]},
      {title: "", level: 3, items: ["","","",""]},
      {title: "", level: 4, items: ["","","",""]}
    ])];
    newCategories[catIndex].items[itemIndex] = newValue;
    setActividad({ ...actividad, categories: newCategories });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
      <div style={{ display: 'flex', gap: '20px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
          <label>Curso (ej: s2)</label>
          <input name="course" value={actividad.course || ""} onChange={handleChange} style={{ padding: '8px' }} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
          <label>Fecha</label>
          <input type="date" name="fecha" value={actividad.fecha || ""} onChange={handleChange} style={{ padding: '8px' }} />
        </div>
      </div>

      <hr style={{ borderTop: '1px solid #ddd', margin: '10px 0' }} />
      <h4>Categorías y Palabras</h4>

      {[0, 1, 2, 3].map((catIndex) => {
        const cat = (actividad.categories && actividad.categories[catIndex]) || { title: "", level: catIndex + 1, items: ["", "", "", ""] };
        return (
          <div key={catIndex} style={{ border: '1px solid #ddd', padding: '15px', borderRadius: '6px', backgroundColor: '#fdfdfd' }}>
            <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', flex: 3 }}>
                <label style={{ fontWeight: 'bold' }}>Título de Categoría {catIndex + 1}</label>
                <input value={cat.title} onChange={(e) => handleCategoryTitleChange(catIndex, e.target.value)} placeholder="Ej: Falsos amigos" style={{ padding: '8px' }} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                <label>Nivel</label>
                <input value={cat.level} disabled style={{ padding: '8px', backgroundColor: '#eee' }} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              {[0, 1, 2, 3].map((itemIndex) => (
                <input 
                  key={itemIndex}
                  value={cat.items ? cat.items[itemIndex] : ""} 
                  onChange={(e) => handleCategoryItemChange(catIndex, itemIndex, e.target.value)} 
                  placeholder={`Palabra ${itemIndex + 1}`}
                  style={{ padding: '8px', flex: 1, border: '1px solid #ccc', borderRadius: '4px', minWidth: 0 }} 
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}