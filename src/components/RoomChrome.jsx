// Static room chrome (door, boards, screen, windows, teacher's desk) shared
// by the admin Seating Chart builder, the student seat-pick prompt, and the
// print view, so all three always render the identical room shape.
const DARK_WALL_CLASS =
  'bg-slate-700/60 border border-slate-600 rounded-md flex items-center justify-center text-[10px] font-black uppercase tracking-widest text-slate-300';
const PRINT_WALL_CLASS =
  'border-2 border-black bg-white flex items-center justify-center text-[11px] font-black uppercase tracking-wide text-black';

export default function RoomChrome({ idLabel, bannerText, english = false, printMode = false }) {
  const wallClass = printMode ? PRINT_WALL_CLASS : DARK_WALL_CLASS;
  const t = english
    ? { door: 'Door', board: 'Board', screen: 'Screen', windows: 'Windows', teacher: "Teacher's Desk" }
    : { door: 'Puerta', board: 'Pizarra', screen: 'Pantalla', windows: 'Ventanas', teacher: 'Señor' };
  return (
    <>
      <div className={wallClass} style={{ gridArea: 'puerta', writingMode: 'vertical-rl' }}>
        {t.door}
      </div>
      <div className={wallClass} style={{ gridArea: 'board1' }}>{t.board}</div>
      <div className={wallClass} style={{ gridArea: 'board2' }}>{t.screen}</div>
      <div className={wallClass} style={{ gridArea: 'board3' }}>{t.board}</div>
      <div className={wallClass} style={{ gridArea: 'ventanas', writingMode: 'vertical-rl' }}>
        {t.windows}
      </div>
      <div className={wallClass} style={{ gridArea: 'senor' }}>{t.teacher}</div>
      {idLabel && (
        <div
          className={`flex items-end text-xs font-black ${printMode ? 'text-black' : 'text-slate-500'}`}
          style={{ gridArea: 'idtag' }}
        >
          {idLabel}
        </div>
      )}
      {bannerText && (
        <div
          className={`flex items-center justify-center text-[10px] italic border ${
            printMode ? 'text-black border-black' : 'text-slate-400 border-transparent'
          }`}
          style={{ gridArea: 'banner' }}
        >
          {bannerText}
        </div>
      )}
    </>
  );
}
