// A student's "Nombre Preferido" (optional, admin/teacher-editable) wins
// over their formal firstName/lastName from signup wherever this is used —
// currently just the Seating Chart family (SeatingChartManager,
// PrintSeatingChart, SeatPickPrompt) and the Roster manager, deliberately
// NOT rolled out to Gradebook/leaderboards/Schoology export yet, so nothing
// that depends on a student's official roster name is affected.
export const getDisplayName = (user) => {
  if (user?.preferredName?.trim()) return user.preferredName.trim();
  if (user?.firstName || user?.lastName) return `${user.firstName || ''} ${user.lastName || ''}`.trim();
  return (user?.email || '').split('@')[0];
};
