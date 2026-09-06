import React, { useState, useEffect } from 'react';
import { db } from '../../../firebase.js'; 
import { doc, setDoc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';

const TareasDashboard = () => {
  const [activeCourse, setActiveCourse] = useState('s4'); 
  const [assignments, setAssignments] = useState([]);
  
  // --- CALENDAR STATES ---
  const [activeCalendarDoc, setActiveCalendarDoc] = useState('academic_year_2026_2027');
  const [calendarMap, setCalendarMap] = useState({}); 
  
  const [isLoading, setIsLoading] = useState(true);
  
  // --- UI STATES ---
  const [jsonInput, setJsonInput] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [editingId, setEditingId] = useState(null);

  // --- DATA FETCHING ---
  const fetchDashboardData = async () => {
    setIsLoading(true);
    try {
      // 1. Fetch Tareas Bundle
      const taskRef = doc(db, "tareas_bundles", activeCourse);
      const taskSnap = await getDoc(taskRef);
      if (taskSnap.exists()) {
        setAssignments(taskSnap.data().assignments || []);
      } else {
        setAssignments([]);
      }

      // 2. Fetch Active Calendar
      const calRef = doc(db, "config", activeCalendarDoc);
      const calSnap = await getDoc(calRef);
      
      if (calSnap.exists()) {
        const rawData = calSnap.data();
        const processedMap = {};
        
        // --- SMART A/B DAY AGGREGATOR (UPGRADED) ---
        // Hunt down the calendar data regardless of what the array/map field is named
        let allDays = [];
        Object.values(rawData).forEach(val => {
          if (Array.isArray(val)) {
            allDays = [...allDays, ...val]; // If it's an array, extract the days
          } else if (typeof val === 'object' && val !== null) {
            allDays.push(val); // If it's a map/object, grab it
          }
        });

        // Group them by Día number
        allDays.forEach(entry => {
          if (entry && entry.dia !== undefined && entry.status === 'school') {
            const diaNum = entry.dia;
            if (!processedMap[diaNum]) processedMap[diaNum] = [];
            
            try {
              // Parse the "2025-09-12" string safely
              const dateObj = new Date(entry.fecha + "T12:00:00Z"); 
              const shortDate = `${dateObj.getMonth() + 1}/${dateObj.getDate()}`;
              processedMap[diaNum].push(`${shortDate} (${entry.ciclo})`);
            } catch (e) {
              console.error("Error parsing date:", entry.fecha);
            }
          }
        });

        // Join the A and B days into a single readable string
        Object.keys(processedMap).forEach(key => {
          processedMap[key] = processedMap[key].join(' & ');
        });

        setCalendarMap(processedMap);
      } else {
        setCalendarMap({});
      }
      
      setIsLoading(false);
    } catch (err) {
      console.error("Error loading data:", err);
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, [activeCourse, activeCalendarDoc]);

  // --- LOGIC: JSON IMPORTER ---
  const handleBulkImport = async () => {
    try {
      const data = JSON.parse(jsonInput);
      const newAssignments = data.tareas.filter(t => t.course === activeCourse);
      
      await setDoc(doc(db, "tareas_bundles", activeCourse), {
        assignments: newAssignments,
        lastUpdated: serverTimestamp()
      });

      setAssignments(newAssignments);
      setJsonInput('');
      setIsImporting(false);
      alert(`✅ Imported ${newAssignments.length} assignments to ${activeCourse}`);
    } catch (e) {
      alert("❌ Invalid JSON format.");
    }
  };

  // --- LOGIC: INDIVIDUAL EDITING ---
  const saveAssignment = async (updatedItem) => {
    const newBatch = assignments.map(a => a.id === updatedItem.id ? updatedItem : a);
    try {
      await updateDoc(doc(db, "tareas_bundles", activeCourse), {
        assignments: newBatch,
        lastUpdated: serverTimestamp()
      });
      setAssignments(newBatch);
      setEditingId(null);
    } catch (e) {
      alert("Save failed.");
    }
  };

  const deleteAssignment = async (id) => {
    if (!window.confirm("Delete this assignment?")) return;
    const newBatch = assignments.filter(a => a.id !== id);
    await updateDoc(doc(db, "tareas_bundles", activeCourse), { assignments: newBatch });
    setAssignments(newBatch);
  };

  // --- HELPERS ---
  const getDisplayDate = (diaNum) => {
    if (!diaNum) return "No Date";
    return calendarMap[diaNum] || "Date TBD";
  };

  if (isLoading) return <div style={s.center}><h2>Loading Homework Hub...</h2></div>;

  return (
    <div style={s.container}>
      <header style={s.header}>
        <div style={{display: 'flex', flexDirection: 'column', gap: '5px'}}>
          <h1 style={s.title}>TAREAS <span style={{color: '#4cc9f0'}}>HUB</span></h1>
          <div style={{display: 'flex', alignItems: 'center', gap: '10px'}}>
            <span style={{fontSize: '12px', color: '#666', textTransform: 'uppercase'}}>Active Calendar:</span>
            <input 
              style={s.inputSmallDark} 
              value={activeCalendarDoc} 
              onChange={(e) => setActiveCalendarDoc(e.target.value)} 
            />
          </div>
        </div>
        
        <div style={s.courseTabs}>
          <button onClick={() => setActiveCourse('s2')} style={activeCourse === 's2' ? s.tabActive : s.tab}>Spanish 2</button>
          <button onClick={() => setActiveCourse('s4')} style={activeCourse === 's4' ? s.tabActive : s.tab}>Spanish 4</button>
        </div>
      </header>

      <div style={s.toolBar}>
        <button onClick={() => setIsImporting(!isImporting)} style={s.secondaryBtn}>
          {isImporting ? "Close Importer" : "Bulk Import JSON"}
        </button>
      </div>

      {isImporting && (
        <div style={s.importerPanel}>
          <textarea 
            style={s.jsonArea} 
            value={jsonInput} 
            onChange={(e) => setJsonInput(e.target.value)}
            placeholder='{ "tareas": [ ... ] }'
          />
          <button onClick={handleBulkImport} style={s.primaryBtn}>Initialize Course Bundle</button>
        </div>
      )}

      <div style={s.timeline}>
        {assignments
          .sort((a, b) => a.day_assigned - b.day_assigned)
          .map(task => (
            <div key={task.id} style={s.row}>
              <div style={s.diaColumn}>
                <span style={s.diaLabel}>ASSIGNED DÍA</span>
                <div style={s.diaNum}>{task.day_assigned}</div>
                <div style={s.dateSub}>{getDisplayDate(task.day_assigned)}</div>
              </div>

              <div style={s.contentColumn}>
                {editingId === task.id ? (
                  <div style={s.editForm}>
                    <label style={s.label}>Title</label>
                    <input style={s.input} value={task.titulo} onChange={(e) => saveAssignment({...task, titulo: e.target.value})} />
                    
                    <div style={{display: 'flex', gap: '15px', marginTop: '10px', flexWrap: 'wrap'}}>
                       <div style={s.editGroup}>
                         <label style={s.label}>Assigned Día</label>
                         <input style={s.inputNumber} type="number" value={task.day_assigned} onChange={(e) => saveAssignment({...task, day_assigned: parseInt(e.target.value)})} />
                       </div>
                       <div style={s.editGroup}>
                         <label style={s.label}>Due Día</label>
                         <input style={s.inputNumber} type="number" value={task.day_due} onChange={(e) => saveAssignment({...task, day_due: parseInt(e.target.value)})} />
                       </div>
                       <div style={s.editGroup}>
                         <label style={s.label}>Hard Override Date (Optional)</label>
                         <input style={s.input} placeholder="e.g. Sunday, Oct 12th" value={task.hard_due_date || ""} onChange={(e) => saveAssignment({...task, hard_due_date: e.target.value})} />
                       </div>
                    </div>
                    <button onClick={() => setEditingId(null)} style={s.doneBtn}>Done Editing</button>
                  </div>
                ) : (
                  <>
                    <div style={{display: 'flex', justifyContent: 'space-between'}}>
                      <span style={s.typeBadge}>{task.tipo}</span>
                      <span style={s.idLabel}>{task.id}</span>
                    </div>
                    <h3 style={s.taskTitle}>{task.titulo}</h3>
                    <div style={s.dueRow}>
                      <strong>DUE:</strong> Día {task.day_due} <span style={{color: '#4cc9f0', marginLeft: '5px'}}>➔ {task.hard_due_date || getDisplayDate(task.day_due)}</span>
                    </div>
                  </>
                )}
              </div>

              <div style={s.actionColumn}>
                <button onClick={() => setEditingId(task.id)} style={s.iconBtn}>✎</button>
                <button onClick={() => deleteAssignment(task.id)} style={s.iconBtnDel}>×</button>
              </div>
            </div>
          ))}
      </div>
    </div>
  );
};

// --- STYLES ---
const s = {
  container: { backgroundColor: '#000', color: '#fff', minHeight: '100vh', padding: '40px', fontFamily: 'sans-serif' },
  center: { height: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center', backgroundColor: '#000', color: '#4cc9f0' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #222', paddingBottom: '20px' },
  title: { margin: 0, letterSpacing: '2px' },
  courseTabs: { display: 'flex', gap: '10px' },
  tab: { padding: '10px 20px', background: '#111', border: '1px solid #333', color: '#666', cursor: 'pointer', borderRadius: '4px' },
  tabActive: { padding: '10px 20px', background: '#4cc9f0', border: '1px solid #4cc9f0', color: '#000', cursor: 'pointer', borderRadius: '4px', fontWeight: 'bold' },
  inputSmallDark: { background: '#111', border: '1px solid #333', color: '#aaa', padding: '6px 12px', borderRadius: '4px', fontSize: '12px', width: '220px' },
  toolBar: { marginTop: '20px', display: 'flex', justifyContent: 'flex-end' },
  secondaryBtn: { background: 'none', border: '1px solid #444', color: '#aaa', padding: '8px 16px', borderRadius: '4px', cursor: 'pointer' },
  primaryBtn: { background: '#4cc9f0', border: 'none', color: '#000', padding: '12px 24px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', marginTop: '10px' },
  importerPanel: { background: '#0a0a0a', padding: '20px', borderRadius: '8px', border: '1px solid #222', marginTop: '20px', display: 'flex', flexDirection: 'column' },
  jsonArea: { width: '100%', height: '200px', background: '#000', color: '#0f0', fontFamily: 'monospace', padding: '10px', borderRadius: '4px', border: '1px solid #333' },
  timeline: { marginTop: '40px', display: 'flex', flexDirection: 'column', gap: '15px' },
  row: { display: 'flex', background: '#0a0a0a', border: '1px solid #222', borderRadius: '8px', overflow: 'hidden' },
  diaColumn: { width: '130px', background: '#111', padding: '20px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', borderRight: '1px solid #222' },
  diaLabel: { fontSize: '10px', color: '#444', fontWeight: 'bold' },
  diaNum: { fontSize: '32px', fontWeight: 'bold', color: '#4cc9f0' },
  dateSub: { fontSize: '11px', color: '#888', textAlign: 'center', marginTop: '5px', lineHeight: '1.4' },
  contentColumn: { flexGrow: 1, padding: '20px' },
  typeBadge: { fontSize: '10px', background: '#222', color: '#4cc9f0', padding: '2px 8px', borderRadius: '10px', textTransform: 'uppercase', fontWeight: 'bold' },
  idLabel: { fontSize: '10px', color: '#444' },
  taskTitle: { margin: '10px 0', fontSize: '20px' },
  dueRow: { fontSize: '13px', color: '#aaa' },
  actionColumn: { width: '60px', borderLeft: '1px solid #222', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '10px', background: '#0d0d0d' },
  iconBtn: { background: 'none', border: 'none', color: '#666', fontSize: '18px', cursor: 'pointer' },
  iconBtnDel: { background: 'none', border: 'none', color: '#f44', fontSize: '22px', cursor: 'pointer' },
  editForm: { display: 'flex', flexDirection: 'column', gap: '5px', background: '#111', padding: '15px', borderRadius: '6px', border: '1px dashed #444' },
  editGroup: { display: 'flex', flexDirection: 'column', gap: '5px' },
  label: { fontSize: '10px', color: '#666', textTransform: 'uppercase' },
  input: { background: '#000', border: '1px solid #444', color: '#fff', padding: '8px', borderRadius: '4px', minWidth: '250px' },
  inputNumber: { background: '#000', border: '1px solid #444', color: '#4cc9f0', padding: '8px', borderRadius: '4px', width: '80px', fontWeight: 'bold' },
  doneBtn: { background: '#4cc9f0', border: 'none', padding: '8px 16px', marginTop: '10px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', color: '#000', alignSelf: 'flex-start' }
};

export default TareasDashboard;