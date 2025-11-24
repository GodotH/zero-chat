import React from 'react';
import { X, FileText, Image as ImageIcon, FileCode } from 'lucide-react';
import { Attachment } from '../types';

interface FilePreviewProps {
  files: Attachment[];
  onRemove: (index: number) => void;
}

const FilePreview: React.FC<FilePreviewProps> = ({ files, onRemove }) => {
  if (files.length === 0) return null;

  const getIcon = (mimeType: string) => {
    if (mimeType.startsWith('image/')) return <ImageIcon size={14} />;
    if (mimeType.includes('pdf')) return <FileText size={14} />;
    return <FileCode size={14} />;
  };

  return (
    <div className="flex flex-wrap gap-2 mb-3 px-1">
      {files.map((file, idx) => (
        <div 
          key={idx} 
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
  );
};

export default FilePreview;