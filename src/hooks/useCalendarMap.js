import { useState, useEffect } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';

export const useCalendarMap = () => {
  const [calendarMap, setCalendarMap] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCalendar = async () => {
      try {
        const docRef = doc(db, 'config', 'academic_year_2026_2027');
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
          const data = docSnap.data();
          // Assuming your document has an array or map of days to dates
          let mapping = {};
          if (data.map && Array.isArray(data.map)) {
            data.map.forEach(item => {
              mapping[item.dia] = item.fecha; // e.g., { 1: "2026-09-08", 2: "2026-09-09" }
            });
          }
          setCalendarMap(mapping);
        }
      } catch (err) {
        console.error("Error loading calendar config:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchCalendar();
  }, []);

  return { calendarMap, loading };
};