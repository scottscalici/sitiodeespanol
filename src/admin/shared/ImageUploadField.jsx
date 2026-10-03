import React, { useRef, useState } from 'react';
import { uploadAdminImage } from '../../utils/imageUpload';
import ImagePickerModal from './ImagePickerModal';

// A URL text field with an "upload a file" button beside it — paste an
// existing link (Schoology, Imgur, wherever) exactly like before, upload a
// new file straight to Firebase Storage, or browse images already uploaded
// to this same folder and reuse one instead of uploading it again. Drop-in
// for any existing plain `<input type="text">` image-URL field.
const ImageUploadField = ({
  value,
  onChange,
  folder = 'misc',
  placeholder = 'https://...',
  inputClassName = '',
}) => {
  const fileInputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [pickerOpen, setPickerOpen] = useState(false);

  const handleFileSelected = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-selecting the same file again later
    if (!file) return;

    setError('');
    setUploading(true);
    try {
      const url = await uploadAdminImage(file, folder);
      onChange(url);
    } catch (err) {
      console.error('Error uploading image:', err);
      setError(err.message || 'Error al subir la imagen.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="w-full">
      <div className="flex items-center gap-2 w-full">
        <input
          type="text"
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={inputClassName}
        />
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileSelected}
          className="hidden"
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          title="Subir una imagen desde tu dispositivo"
          className="shrink-0 px-3 py-2 bg-slate-700 hover:bg-slate-600 text-white text-[10px] font-black uppercase tracking-widest rounded-lg disabled:opacity-50 transition-colors"
        >
          {uploading ? '⏳...' : '📤 Subir'}
        </button>
        <button
          type="button"
          onClick={() => setPickerOpen(true)}
          disabled={uploading}
          title="Elegir una imagen ya subida"
          className="shrink-0 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-black uppercase tracking-widest rounded-lg disabled:opacity-50 transition-colors"
        >
          🖼️ Elegir
        </button>
      </div>
      {error && <p className="text-[10px] text-rose-500 font-bold mt-1">{error}</p>}

      {pickerOpen && (
        <ImagePickerModal
          folder={folder}
          onSelect={(url) => {
            onChange(url);
            setPickerOpen(false);
          }}
          onClose={() => setPickerOpen(false)}
        />
      )}
    </div>
  );
};

export default ImageUploadField;
