import React from 'react';
import { QUESTION_TYPES } from '../questionTypes';

// Embeds any existing registry question type directly, in its self-contained
// 'retry' mode — no engine wrapper (timer, finish screen, points) needed,
// since this is a self-check embedded in a note, not a graded quiz.
export const TYPE_KEY = 'question';
export const TYPE_LABEL = 'Pregunta de práctica';

export const emptyBlock = () => ({ type: 'question', question: null });

export const Renderer = ({ block }) => {
  const q = block.question;
  const TypeRenderer = q && QUESTION_TYPES[q.type]?.Renderer;
  if (!TypeRenderer) return null;
  return (
    <div className="bg-emerald-50 border border-emerald-100 rounded-lg p-3">
      <p className="text-[9px] font-black text-emerald-600 uppercase tracking-widest mb-1.5">🧠 Practica rápida</p>
      <TypeRenderer question={q} onItemFirstAttempt={() => {}} onAllCorrect={() => {}} />
    </div>
  );
};

export const Editor = ({ block, onChange, instanceId }) => {
  const q = block.question;
  if (!q) {
    return (
      <div className="flex flex-wrap gap-2">
        {Object.values(QUESTION_TYPES).map((mod) => (
          <button
            key={mod.TYPE_KEY}
            onClick={() => onChange({ question: mod.emptyQuestion() })}
            className="px-3 py-2 border-2 border-dashed border-emerald-300 text-emerald-700 rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-emerald-50"
          >
            + {mod.TYPE_LABEL}
          </button>
        ))}
      </div>
    );
  }
  const TypeEditor = QUESTION_TYPES[q.type]?.Editor;
  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center">
        <span className="text-[9px] font-black uppercase tracking-widest text-emerald-700 bg-emerald-100 rounded-full px-2 py-1">{QUESTION_TYPES[q.type]?.TYPE_LABEL}</span>
        <button onClick={() => onChange({ question: null })} className="text-[10px] font-bold text-rose-500 uppercase">
          Cambiar tipo
        </button>
      </div>
      {TypeEditor && <TypeEditor question={q} onChange={(patch) => onChange({ question: { ...q, ...patch } })} instanceId={instanceId} />}
    </div>
  );
};
