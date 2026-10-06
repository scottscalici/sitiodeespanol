import React, { useState } from 'react';
import FormConversaciones from '../MasterDashboard/components/FormConversaciones';

// Wraps the existing FormConversaciones (escenario, instrucciones, preguntas,
// contenido extendido, andamio del estudiante...) in a modal, with its
// Clasificación block hidden since ConversacionesManager's grid row already
// covers título/imagen/subtítulo/courses/días. Saves straight to Firestore
// (via the parent-provided onSave) and only closes once that write
// succeeds, same pattern as CuriosidadQuestionsModal — an error leaves the
// modal open with the edits still intact instead of silently losing them.
const ConversacionContentModal = ({ conversacion, onClose, onSave }) => {
  const [actividad, setActividad] = useState(conversacion);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (e) => {
    setActividad({ ...actividad, [e.target.name]: e.target.value });
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      await onSave(actividad);
      onClose();
    } catch (err) {
      setError('No se pudo guardar. Revisa tu conexión e intenta de nuevo — tus cambios aquí no se perdieron.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={saving ? undefined : onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto"
      >
        <div className="sticky top-0 bg-white border-b border-slate-200 p-5 flex justify-between items-center z-10">
          <div>
            <h2 className="text-lg font-black text-slate-800">{actividad.titulo || 'Conversación sin título'}</h2>
            <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-0.5">
              Escenario, preguntas, contenido extendido, andamio del estudiante...
            </p>
          </div>
          <button onClick={onClose} disabled={saving} className="text-slate-400 hover:text-slate-700 text-xl px-2 disabled:opacity-30">
            ✕
          </button>
        </div>

        <div className="p-5">
          <FormConversaciones actividad={actividad} setActividad={setActividad} handleChange={handleChange} hideClassification />
          {error && <p className="text-rose-600 text-sm font-bold mt-4">{error}</p>}
        </div>

        <div className="sticky bottom-0 bg-white border-t border-slate-200 p-4 flex justify-end gap-3">
          <button onClick={onClose} disabled={saving} className="px-5 py-2.5 text-slate-500 font-bold text-xs uppercase disabled:opacity-50">
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs uppercase tracking-widest rounded-lg disabled:opacity-50"
          >
            {saving ? 'Guardando...' : 'Guardar Contenido'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConversacionContentModal;
