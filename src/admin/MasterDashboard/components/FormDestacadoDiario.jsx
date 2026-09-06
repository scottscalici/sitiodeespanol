import React from 'react';

export default function FormDestacadoDiario({ actividad, setActividad, handleChange }) {
  
  // Handle the nested word_of_the_day object
  const handleWordChange = (e) => {
    setActividad({
      ...actividad,
      word_of_the_day: {
        ...(actividad.word_of_the_day || {}),
        [e.target.name]: e.target.value
      }
    });
  };

  // Handle the course array checkboxes
  const handleCourseChange = (e) => {
    const { value, checked } = e.target;
    let currentCourses = actividad.course || [];
    if (checked) {
      setActividad({ ...actividad, course: [...currentCourses, value] });
    } else {
      setActividad({ ...actividad, course: currentCourses.filter(c => c !== value) });
    }
  };

  // Fun Flag Helper Dictionary
  const countryFlags = {
    "ARGENTINA": "🇦🇷", "BOLIVIA": "🇧🇴", "CHILE": "🇨🇱", "COLOMBIA": "🇨🇴",
    "COSTA RICA": "🇨🇷", "CUBA": "🇨🇺", "ECUADOR": "🇪🇨", "EL SALVADOR": "🇸🇻",
    "ESPAÑA": "🇪🇸", "SPAIN": "🇪🇸", "GUATEMALA": "🇬🇹", "HONDURAS": "🇭🇳",
    "MEXICO": "🇲🇽", "MÉXICO": "🇲🇽", "NICARAGUA": "🇳🇮", "PANAMA": "🇵🇦",
    "PARAGUAY": "🇵🇾", "PERU": "🇵🇪", "PUERTO RICO": "🇵🇷", "REPUBLICA DOMINICANA": "🇩🇴",
    "URUGUAY": "🇺🇾", "VENEZUELA": "🇻🇪", "GUINEA ECUATORIAL": "🇬🇶", "USA": "🇺🇸"
  };

  const addFlag = (e) => {
    e.preventDefault();
    const loc = (actividad.location || "").toUpperCase().trim();
    // Check if the location matches a key and doesn't already have the flag
    const mappedFlag = countryFlags[Object.keys(countryFlags).find(k => loc.includes(k))];
    if (mappedFlag && !actividad.location.includes(mappedFlag)) {
      setActividad({ ...actividad, location: `${actividad.location} ${mappedFlag}` });
    } else if (!mappedFlag) {
      alert("No matching Spanish-speaking country found in the dictionary for that text.");
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      {/* HEADER ROW: Day, Type, Header */}
      <div style={{ display: 'flex', gap: '15px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
          <label><strong>Día (Order/Sequence)</strong></label>
          <input type="number" name="dia" value={actividad.dia || 0} onChange={handleChange} style={{ padding: '8px' }} />
          <small>Change this number to shift when it appears.</small>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
          <label>Type</label>
          <input type="text" name="type" value={actividad.type || ""} onChange={handleChange} placeholder="e.g. destino, curiosidad" style={{ padding: '8px' }} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
          <label>Header Tag</label>
          <input type="text" name="header" value={actividad.header || ""} onChange={handleChange} style={{ padding: '8px' }} />
        </div>
      </div>

      {/* LOCATION & FLAG */}
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <label>Location (with Flag)</label>
        <div style={{ display: 'flex', gap: '10px' }}>
          <input type="text" name="location" value={actividad.location || ""} onChange={handleChange} style={{ padding: '8px', flex: 1 }} />
          <button onClick={addFlag} style={{ padding: '8px', cursor: 'pointer' }}>Add Flag 🏳️‍🌈</button>
        </div>
      </div>

      {/* MEDIA PREVIEW */}
      <div style={{ display: 'flex', flexDirection: 'column', backgroundColor: '#f1f1f1', padding: '15px', borderRadius: '8px' }}>
        <label>Image URL</label>
        <input type="text" name="image_url" value={actividad.image_url || ""} onChange={handleChange} style={{ padding: '8px', marginBottom: '10px' }} />
        {actividad.image_url && (
          <img src={actividad.image_url} alt="Destacado Preview" style={{ maxHeight: '200px', objectFit: 'contain', alignSelf: 'flex-start', border: '1px solid #ccc' }} />
        )}
      </div>

      {/* MAIN TEXTS */}
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <label>Spanish Text</label>
        <textarea name="spanish" value={actividad.spanish || ""} onChange={handleChange} rows="3" style={{ padding: '8px' }} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <label>English Text</label>
        <textarea name="english" value={actividad.english || ""} onChange={handleChange} rows="3" style={{ padding: '8px' }} />
      </div>

      {/* WORD OF THE DAY (Nested Map) */}
      <div style={{ backgroundColor: '#e9ecef', padding: '15px', borderRadius: '8px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <h4 style={{ margin: 0 }}>Word of the Day Map</h4>
        <div style={{ display: 'flex', gap: '10px' }}>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            <label>Word (Spanish)</label>
            <input type="text" name="word" value={actividad.word_of_the_day?.word || ""} onChange={handleWordChange} style={{ padding: '8px' }} />
          </div>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            <label>Translation</label>
            <input type="text" name="translation" value={actividad.word_of_the_day?.translation || ""} onChange={handleWordChange} style={{ padding: '8px' }} />
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <label>Sample Sentence (Spanish)</label>
          <input type="text" name="sample_sentence" value={actividad.word_of_the_day?.sample_sentence || ""} onChange={handleWordChange} style={{ padding: '8px' }} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <label>Sentence Translation</label>
          <input type="text" name="sentence_translation" value={actividad.word_of_the_day?.sentence_translation || ""} onChange={handleWordChange} style={{ padding: '8px' }} />
        </div>
      </div>

      {/* COURSES (Array) */}
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <label>Courses</label>
        <div style={{ display: 'flex', gap: '15px' }}>
          <label>
            <input type="checkbox" value="s2" checked={(actividad.course || []).includes("s2")} onChange={handleCourseChange} /> S2
          </label>
          <label>
            <input type="checkbox" value="s4" checked={(actividad.course || []).includes("s4")} onChange={handleCourseChange} /> S4
          </label>
        </div>
      </div>

    </div>
  );
}