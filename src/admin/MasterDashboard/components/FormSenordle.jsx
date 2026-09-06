import React from 'react';

export default function FormSenordle({ actividad, handleChange, setActividad }) {
  // Helper to ensure 5-letter limit if desired, though standard input handles it too.
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', backgroundColor: '#f4f4f4', padding: '15px', borderRadius: '8px' }}>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <label><strong>Target Date (YYYY-MM-DD)</strong></label>
        <input 
          type="date" 
          name="date" 
          value={actividad.date || ""} 
          onChange={handleChange} 
          style={{ padding: '8px' }} 
        />
        <small style={{ color: '#666' }}>Note: Changing this will save a new document if the ID doesn't match.</small>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <label><strong>Spanish II Word (s2)</strong></label>
        <input 
          type="text" 
          name="s2" 
          value={actividad.s2 || ""} 
          onChange={handleChange} 
          maxLength={5}
          style={{ padding: '8px', textTransform: 'lowercase' }} 
        />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <label><strong>Spanish 4 Word (s4)</strong></label>
        <input 
          type="text" 
          name="s4" 
          value={actividad.s4 || ""} 
          onChange={handleChange} 
          maxLength={5}
          style={{ padding: '8px', textTransform: 'lowercase' }} 
        />
      </div>
    </div>
  );
}