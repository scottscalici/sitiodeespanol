// Shared bits for IB Paper 2 exam texts (from The Spanish Gym Studio): a tiny
// safe renderer for the few inline tags the exams use, and the reading passage
// with the same line / paragraph numbering as the printed packet, so references
// like "(línea 12)" or "(párrafo 3)" in the questions point at the right place.

const TAGS = { u: 'u', em: 'em', i: 'em', strong: 'strong', b: 'strong' };
const TOKEN = /(<\/?(?:u|em|i|strong|b)>|\^\d+)/g;

// "…<u>que</u> los niños…" / "azotea^1" -> React nodes, without innerHTML.
export function RichText({ text }) {
  const root = { tag: null, children: [] };
  const stack = [root];
  String(text ?? '').split(TOKEN).forEach((part, i) => {
    if (!part) return;
    const top = stack[stack.length - 1];
    const sup = part.match(/^\^(\d+)$/);
    if (sup) { top.children.push(<sup key={`s${i}`}>{sup[1]}</sup>); return; }
    const tag = part.match(/^<(\/?)(u|em|i|strong|b)>$/);
    if (!tag) { top.children.push(part); return; }
    const name = TAGS[tag[2]];
    if (!tag[1]) { stack.push({ tag: name, children: [], key: `t${i}` }); return; }
    // Closing tag: pop back to the matching open tag (ignore a stray one).
    const at = stack.map((n) => n.tag).lastIndexOf(name);
    if (at <= 0) return;
    while (stack.length > at) {
      const node = stack.pop();
      const Tag = node.tag;
      stack[stack.length - 1].children.push(<Tag key={node.key}>{node.children}</Tag>);
    }
  });
  // Close anything left open.
  while (stack.length > 1) {
    const node = stack.pop();
    const Tag = node.tag;
    stack[stack.length - 1].children.push(<Tag key={node.key}>{node.children}</Tag>);
  }
  return <>{root.children}</>;
}

const GAP = /^(\[\s*[–-]\s*\d+\s*[–-]\s*\])\s*/;

export function IbPassage({ lectura }) {
  const paragraphs = lectura.paragraphs || [];
  const numbering = lectura.numbering;
  // First printed line number of each paragraph (lines are counted across the text).
  const firstLine = [];
  paragraphs.reduce((n, p, i) => { firstLine[i] = n + 1; return n + String(p).split('\n').length; }, 0);

  return (
    <div className="space-y-4">
      {lectura.imagen && (
        <img
          src={lectura.imagen}
          alt={lectura.subtitulo || ''}
          className="w-full max-h-72 object-cover rounded-xl border border-slate-700"
        />
      )}

      <div className={`space-y-4 font-serif text-slate-300 text-left ${numbering === 'lines' ? 'text-[14px] leading-6' : 'leading-relaxed text-base'}`}>
        {paragraphs.map((p, idx) => {
          if (numbering === 'lines') {
            return (
              <div key={idx}>
                {String(p).split('\n').map((l, li) => {
                  const line = firstLine[idx] + li;
                  return (
                    <div key={line} className="flex">
                      <span className="w-8 shrink-0 pr-3 text-right font-mono text-xs leading-relaxed text-slate-500 select-none">
                        {line % 5 === 0 ? line : ''}
                      </span>
                      {/* Hanging indent: if a printed line wraps in a narrow column,
                          the continuation is indented so it still reads as one line. */}
                      <span className="pl-5 -indent-5"><RichText text={l} /></span>
                    </div>
                  );
                })}
              </div>
            );
          }
          if (numbering === 'paragraphs') {
            const gap = String(p).match(GAP);
            return (
              <div key={idx} className="flex gap-3">
                <span className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded bg-slate-200 text-[11px] font-black text-slate-900 select-none">
                  {idx + 1}
                </span>
                <p>
                  {gap && <strong className="block text-cyan-300">{gap[1]}</strong>}
                  <RichText text={gap ? String(p).slice(gap[0].length) : p} />
                </p>
              </div>
            );
          }
          return (
            <p key={idx} className="indent-6">
              <RichText text={p} />
            </p>
          );
        })}
      </div>

      {(lectura.footnotes || []).length > 0 && (
        <div className="border-t border-slate-700 pt-3 space-y-1 text-xs text-slate-400">
          {lectura.footnotes.map((f, i) => (
            <p key={i}>
              <sup>{i + 1}</sup> <RichText text={f} />
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
