import React, { useState, useEffect } from 'react';
import { db } from '../../../firebase.js';
import { doc, getDoc, setDoc } from 'firebase/firestore';

// CHANGE THIS CONSTANT TO UPDATE THE INITIAL LOAD YEAR
const DEFAULT_YEAR = '2026_2027';

const CalendarManager = () => {
  const [selectedYear, setSelectedYear] = useState(DEFAULT_YEAR);
  const [days, setDays] = useState([]);
  const [loading, setLoading] = useState(true);

  // Load data whenever the selectedYear changes
  useEffect(() => {
    const fetchCalendar = async () => {
      setLoading(true);
      try {
        const docId = `academic_year_${selectedYear}`;
        const docRef = doc(db, 'config', docId);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          const data = docSnap.data().map || [];
          const sanitized = data.map((day) => ({
            fecha: day.fecha || '',
            status: day.status || 'school',
            dia: day.dia ?? null,
            ciclo: day.ciclo || '',
            note: day.note || '',
            manualOverride: day.manualOverride || false,
          }));
          setDays(sanitized);
        } else {
          // If the document doesn't exist yet for a new year
          setDays([]);
        }
      } catch (error) {
        console.error('Error fetching calendar:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchCalendar();
  }, [selectedYear]);

  const handleRecalculate = () => {
    const sortedDays = [...days].sort(
      (a, b) => new Date(a.fecha) - new Date(b.fecha)
    );
    let nextDia = 1;
    let nextCiclo = 'A';

    const processedDays = sortedDays.map((day) => {
      if (day.manualOverride) {
        if (day.dia) {
          nextDia = day.dia;
          nextCiclo = day.ciclo;
          if (nextCiclo === 'A') {
            nextCiclo = 'B';
          } else {
            nextCiclo = 'A';
            nextDia++;
          }
        }
        return day;
      }

      const nonInstructional = [
        'no-school',
        'no-class',
        'virtual-pd',
        'in-person-pd',
        'break',
      ];
      if (nonInstructional.includes(day.status)) {
        return { ...day, dia: null, ciclo: null };
      }

      if (day.status === 'slide-day') {
        return { ...day, dia: nextDia, ciclo: nextCiclo };
      }

      const updatedDay = { ...day, dia: nextDia, ciclo: nextCiclo };
      if (nextCiclo === 'A') {
        nextCiclo = 'B';
      } else {
        nextCiclo = 'A';
        nextDia++;
      }

      return updatedDay;
    });

    setDays(processedDays);
    alert('Sequence recalculated and sorted!');
  };

  const addDayRow = () => {
    const lastDate =
      days.length > 0
        ? new Date(days[days.length - 1].fecha + 'T00:00:00')
        : new Date();

    lastDate.setDate(lastDate.getDate() + 1);

    const newDay = {
      fecha: lastDate.toISOString().split('T')[0],
      status: 'school',
      dia: null,
      ciclo: null,
      note: '',
      manualOverride: false,
    };

    setDays([...days, newDay]);
  };

  const wipeCalendar = () => {
    if (
      window.confirm(
        'Are you sure you want to clear ALL dates for this year? This cannot be undone.'
      )
    ) {
      setDays([]);
    }
  };

  const updateDayField = (index, field, value) => {
    const newDays = [...days];
    const isManualChange = field === 'dia' || field === 'ciclo';
    newDays[index] = {
      ...newDays[index],
      [field]: value,
      manualOverride: isManualChange
        ? true
        : newDays[index].manualOverride || false,
    };
    setDays(newDays);
  };

  const saveToFirebase = async () => {
    try {
      const cleanMap = days.map((day) => ({
        fecha: day.fecha || '',
        status: day.status || 'school',
        dia: day.dia ?? null,
        ciclo: day.ciclo || null,
        note: day.note || '',
        manualOverride: day.manualOverride || false,
      }));

      const docId = `academic_year_${selectedYear}`;
      const docRef = doc(db, 'config', docId);
      await setDoc(docRef, { map: cleanMap }, { merge: true });
      alert(
        `Calendar for ${selectedYear.replace('_', '-')} saved successfully!`
      );
    } catch (error) {
      alert('Error saving: ' + error.message);
    }
  };

  if (loading) return <div style={{ padding: '20px' }}>Loading...</div>;

  return (
    <div
      style={{
        padding: '20px',
        backgroundColor: '#fff',
        borderRadius: '8px',
        minHeight: '100vh',
      }}
    >
      <div
        style={{
          position: 'sticky',
          top: 0,
          backgroundColor: '#fff',
          paddingBottom: '20px',
          borderBottom: '2px solid #eee',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          zIndex: 10,
        }}
      >
        <div>
          <h2 style={{ margin: 0 }}>Instructional Ledger</h2>
          <div style={{ marginTop: '5px' }}>
            <label style={{ marginRight: '10px', fontWeight: 'bold' }}>
              Active Year:
            </label>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              style={{
                padding: '5px',
                borderRadius: '4px',
                border: '1px solid #ccc',
              }}
            >
              <option value="2025_2026">2025 - 2026</option>
              <option value="2026_2027">2026 - 2027</option>
              <option value="2027_2028">2027 - 2028</option>
            </select>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={wipeCalendar}
            style={{
              padding: '10px 15px',
              backgroundColor: '#dc3545',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
            }}
          >
            Wipe Year
          </button>
          <button
            onClick={addDayRow}
            style={{
              padding: '10px 15px',
              backgroundColor: '#28a745',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontWeight: 'bold',
            }}
          >
            + Add Date
          </button>
          <button
            onClick={handleRecalculate}
            style={{
              padding: '10px 15px',
              backgroundColor: '#ffc107',
              color: '#000',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontWeight: 'bold',
            }}
          >
            🔄 Recalculate & Sort
          </button>
          <button
            onClick={saveToFirebase}
            style={{
              padding: '10px 20px',
              backgroundColor: '#007BFF',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontWeight: 'bold',
            }}
          >
            💾 Save to Cloud
          </button>
        </div>
      </div>

      <table
        style={{ width: '100%', borderCollapse: 'collapse', marginTop: '20px' }}
      >
        <thead>
          <tr
            style={{
              textAlign: 'left',
              borderBottom: '2px solid #eee',
              color: '#666',
            }}
          >
            <th style={{ padding: '12px' }}>Date</th>
            <th style={{ padding: '12px' }}>Status</th>
            <th style={{ padding: '12px' }}>Día</th>
            <th style={{ padding: '12px' }}>Ciclo</th>
            <th style={{ padding: '12px' }}>Notes</th>
          </tr>
        </thead>
        <tbody>
          {days.length === 0 ? (
            <tr>
              <td
                colSpan="5"
                style={{ textAlign: 'center', padding: '40px', color: '#999' }}
              >
                No dates found for this year. Click "+ Add Date" to start.
              </td>
            </tr>
          ) : (
            days.map((day, index) => (
              <tr
                key={index}
                style={{
                  borderBottom: '1px solid #eee',
                  backgroundColor:
                    day.status === 'school' || day.status === 'half-day'
                      ? 'transparent'
                      : '#f8f9fa',
                }}
              >
                <td style={{ padding: '8px' }}>
                  <input
                    type="date"
                    value={day.fecha}
                    onChange={(e) =>
                      updateDayField(index, 'fecha', e.target.value)
                    }
                    style={{
                      border: '1px solid #ddd',
                      padding: '5px',
                      borderRadius: '4px',
                    }}
                  />
                </td>

                <td style={{ padding: '8px' }}>
                  <select
                    value={day.status || 'school'}
                    onChange={(e) =>
                      updateDayField(index, 'status', e.target.value)
                    }
                    style={{
                      padding: '6px',
                      borderRadius: '4px',
                      width: '100%',
                    }}
                  >
                    <option value="school">Standard Class</option>
                    <option value="half-day">Half Day</option>
                    <option value="no-school">No School</option>
                    <option value="no-class">No Class</option>
                    <option value="virtual-pd">Virtual PD</option>
                    <option value="in-person-pd">In-Person PD</option>
                    <option value="slide-day">Slide Day (Catch-up)</option>
                    <option value="break">Break</option>
                  </select>
                </td>

                <td style={{ padding: '8px' }}>
                  <input
                    type="number"
                    value={day.dia ?? ''}
                    onChange={(e) =>
                      updateDayField(
                        index,
                        'dia',
                        e.target.value === '' ? null : parseInt(e.target.value)
                      )
                    }
                    style={{
                      width: '60px',
                      padding: '6px',
                      textAlign: 'center',
                      borderRadius: '4px',
                      border: day.manualOverride
                        ? '2px solid #ffc107'
                        : '1px solid #ddd',
                      backgroundColor: day.manualOverride ? '#fffef0' : '#fff',
                    }}
                  />
                </td>

                <td style={{ padding: '8px' }}>
                  <select
                    value={day.ciclo || ''}
                    onChange={(e) =>
                      updateDayField(index, 'ciclo', e.target.value)
                    }
                    style={{ padding: '6px', borderRadius: '4px' }}
                  >
                    <option value="">—</option>
                    <option value="A">A</option>
                    <option value="B">B</option>
                  </select>
                </td>

                <td style={{ padding: '8px' }}>
                  <input
                    type="text"
                    value={day.note || ''}
                    onChange={(e) =>
                      updateDayField(index, 'note', e.target.value)
                    }
                    style={{
                      width: '100%',
                      padding: '6px',
                      border: '1px solid #eee',
                      borderRadius: '4px',
                    }}
                    placeholder="Context..."
                  />
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
};

export default CalendarManager;
