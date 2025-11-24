import React from 'react';
import { X, FileText, Image as ImageIcon, FileCode, AlertCircle } from 'lucide-react';
import { Attachment } from '../types';

interface FilePreviewProps {
  files: Attachment[];
  errors: string[];
  onRemove: (index: number) => void;
  onRemoveError: (index: number) => void;
}

const FilePreview: React.FC<FilePreviewProps> = ({ files, errors, onRemove, onRemoveError }) => {
  if (files.length === 0 && errors.length === 0) return null;

  const getIcon = (mimeType: string) => {
    if (mimeType.startsWith('image/')) return <ImageIcon size={14} />;
    if (mimeType.includes('pdf')) return <FileText size={14} />;
    return <FileCode size={14} />;
  };

  return (
    <div className="flex flex-col gap-2 mb-3 px-1">
      {/* Errors Section */}
      {errors.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {errors.map((error, idx) => (
            <div 
              key={`err-${idx}`} 
              className="flex items-center gap-2 bg-red-950/40 border border-red-900/50 rounded-lg pl-3 pr-2 py-1.5 text-xs text-red-200 animate-in fade-in slide-in-from-bottom-2"
            >
              <AlertCircle size={14} className="text-red-500" />
              <span className="max-w-[200px] truncate font-mono" title={error}>
                {error}
              </span>
              <button 
                onClick={() => onRemoveError(idx)}
                className="ml-1 p-0.5 hover:bg-red-900/40 rounded-full text-red-400 hover:text-red-200 transition-colors"
              >
                <X size={12} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Valid Files Section */}
      {files.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {files.map((file, idx) => (
            <div 
              key={`file-${idx}`} 
              className="flex items-center gap-2 bg-zinc-800 border border-zinc-700 rounded-lg pl-3 pr-2 py-1.5 text-xs text-zinc-300 animate-in fade-in slide-in-from-bottom-2"
            >
              <span className="text-zinc-500">{getIcon(file.mimeType)}</span>
              <span className="max-w-[150px] truncate font-mono" title={file.name}>
                {file.name}
              </span>
              <button 
                onClick={() => onRemove(idx)}
                className="ml-1 p-0.5 hover:bg-zinc-700 rounded-full text-zinc-500 hover:text-zinc-300 transition-colors"
              >
                <X size={12} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default FilePreview;