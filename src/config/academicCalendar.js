// academicCalendar.js

export const quarters = {
  q1: { start: '2026-08-31', end: '2026-10-30' },
  q2: { start: '2026-11-02', end: '2027-01-15' },
  q3: { start: '2027-01-18', end: '2027-03-25' },
  q4: { start: '2027-04-05', end: '2027-06-15' }
};

// Helper function to figure out which quarter we are currently in
export const getCurrentQuarter = () => {
  const now = new Date();
  
  for (const [quarter, dates] of Object.entries(quarters)) {
    const startDate = new Date(dates.start);
    const endDate = new Date(dates.end);
    // Add 1 day to end date to include the full final day
    endDate.setDate(endDate.getDate() + 1); 
    
    if (now >= startDate && now < endDate) {
      return quarter;
    }
  }
  return 'out_of_session';
};