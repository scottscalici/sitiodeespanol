import React from 'react';

export default function FormLecturas({ actividad, setActividad, handleChange }) {
  
  // Helper para párrafos
  const handleParagraphsChange = (text) => {
    setActividad({ ...actividad, paragraphs: text.split('\n').filter(p => p.trim() !== "") });
  };

  // Helper para cambiar campos dentro de una sección (instrucciones o tipo)
  const updateSection = (sIdx, field, value) => {
    const newSections = [...(actividad.question_sections || [])];
    newSections[sIdx][field] = value;
    setActividad({ ...actividad, question_sections: newSections });
  };

  // Helper para las opciones (ej: A: "Respuesta...")
  const updateOption = (sIdx, key, value) => {
    const newSections = [...(actividad.question_sections || [])];
    if (!newSections[sIdx].options) newSections[sIdx].options = {};
    newSections[sIdx].options[key] = value;
    setActividad({ ...actividad, question_sections: newSections });
  };

  // Helper para las preguntas individuales
  const updateQuestion = (sIdx, qIdx, field, value) => {
    const newSections = [...(actividad.question_sections || [])];
    newSections[sIdx].questions[qIdx][field] = value;
    setActividad({ ...actividad, question_sections: newSections });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '25px' }}>
      {/* Inside the first div (Lectura Info) of FormLecturas.jsx */}
<div style={{ padding: '15px', border: '1px solid #ccc', borderRadius: '6px', backgroundColor: '#f8f9fa' }}>
  <h4 style={{ margin: '0 0 10px 0' }}>Lectura Metadata</h4>
  <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap' }}>
    <div style={{ flex: 2, display: 'flex', flexDirection: 'column' }}>
      <label>Subtítulo / Tema</label>
      <input name="subtitulo" value={actividad.subtitulo || ""} onChange={handleChange} style={{ padding: '8px' }} />
    </div>
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
      <label>Test ID (ej: 2020 Nov. NS)</label>
      <input name="test_id" value={actividad.test_id || ""} onChange={handleChange} placeholder="Exam Session" style={{ padding: '8px' }} />
    </div>
    <div style={{ width: '80px', display: 'flex', flexDirection: 'column' }}>
      <label>Text ID</label>
      <input name="text_id" value={actividad.text_id || ""} onChange={handleChange} placeholder="A, B, C..." style={{ padding: '8px' }} />
    </div>
    <div style={{ width: '60px', display: 'flex', flexDirection: 'column' }}>
      <label>Día</label>
      <input type="number" name="dia" value={actividad.dia || ""} onChange={handleChange} style={{ padding: '8px' }} />
    </div>
  </div>
</div>
      {/* 1. TEXTO PRINCIPAL */}
      <div style={{ padding: '15px', border: '1px solid #ccc', borderRadius: '8px', backgroundColor: '#fff' }}>
        <h4 style={{ margin: '0 0 10px 0', color: '#2b6cb0' }}>Contenido del Texto</h4>
        <textarea 
          value={(actividad.paragraphs || []).join('\n\n')} 
          onChange={(e) => handleParagraphsChange(e.target.value)}
          style={{ width: '100%', minHeight: '180px', padding: '10px', fontFamily: 'serif', lineHeight: '1.5' }}
          placeholder="Párrafos..."
        />
      </div>

      {/* 2. SECCIONES DE PREGUNTAS IB */}
      {(actividad.question_sections || []).map((section, sIdx) => (
        <div key={sIdx} style={{ padding: '20px', border: '1px solid #cbd5e0', borderRadius: '8px', backgroundColor: '#f7fafc' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
            <span style={{ fontWeight: 'bold', textTransform: 'uppercase', fontSize: '12px', color: '#4a5568' }}>
              Sección {sIdx + 1} ({section.type})
            </span>
          </div>

          <label style={{ fontSize: '12px', fontWeight: 'bold' }}>Instrucciones:</label>
          <textarea 
            value={section.instructions || ""} 
            onChange={(e) => updateSection(sIdx, 'instructions', e.target.value)}
            style={{ width: '100%', marginBottom: '15px', padding: '5px' }}
          />

          {/* Renderizar Opciones (Si existen, como en matching o mcq) */}
          {section.options && (
            <div style={{ marginBottom: '15px', padding: '10px', background: '#edf2f7', borderRadius: '4px' }}>
              <label style={{ fontSize: '11px', fontWeight: 'bold' }}>Opciones de la lista (A, B, C...):</label>
              {Object.entries(section.options).map(([key, val]) => (
                <div key={key} style={{ display: 'flex', gap: '5px', marginBottom: '5px' }}>
                  <span style={{ width: '20px', fontWeight: 'bold' }}>{key}:</span>
                  <input 
                    value={val} 
                    onChange={(e) => updateOption(sIdx, key, e.target.value)}
                    style={{ flex: 1, fontSize: '13px' }}
                  />
                </div>
              ))}
            </div>
          )}

          {/* Renderizar Preguntas de esta sección */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {section.questions.map((q, qIdx) => (
              <div key={qIdx} style={{ display: 'flex', gap: '10px', background: '#fff', padding: '8px', borderRadius: '4px', border: '1px solid #e2e8f0' }}>
                <div style={{ width: '30px', fontWeight: 'bold', color: '#c53030' }}>{q.number}.</div>
                <div style={{ flex: 1 }}>
                  <input 
                    value={q.prompt} 
                    onChange={(e) => updateQuestion(sIdx, qIdx, 'prompt', e.target.value)}
                    style={{ width: '100%', border: 'none', borderBottom: '1px solid #eee', marginBottom: '5px' }}
                  />
                  <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
                    <small style={{ color: 'green' }}>Respuesta:</small>
                    <input 
                      value={q.answer} 
                      onChange={(e) => updateQuestion(sIdx, qIdx, 'answer', e.target.value)}
                      style={{ flex: 1, fontSize: '12px', color: '#276749', fontWeight: 'bold', border: 'none' }}
                    />
                    <small>Pts:</small>
                    <input 
                      type="number" 
                      value={q.points || 1} 
                      onChange={(e) => updateQuestion(sIdx, qIdx, 'points', parseInt(e.target.value))}
                      style={{ width: '40px', textAlign: 'center' }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}