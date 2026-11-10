// Static room chrome (door, boards, screen, windows, teacher's desk) shared
// by the admin Seating Chart builder and the student seat-pick prompt, so
// both always render the identical room shape.
const wallClass = 'bg-slate-700/60 border border-slate-600 rounded-md flex items-center justify-center text-[10px] font-black uppercase tracking-widest text-slate-300';

export default function RoomChrome({ idLabel, bannerText, english = false }) {
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
        <div className="flex items-end text-slate-500 text-xs font-black" style={{ gridArea: 'idtag' }}>
          {idLabel}
        </div>
      )}
      {bannerText && (
        <div className="flex items-center justify-center text-[10px] text-slate-400 italic" style={{ gridArea: 'banner' }}>
          {bannerText}
        </div>
      )}
    </>
  );
}
