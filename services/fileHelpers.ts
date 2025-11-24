import { Attachment } from '../types';

export const MAX_FILE_SIZE_MB = 10;
export const SUPPORTED_MIME_TYPES = [
  'image/png', 'image/jpeg', 'image/webp', 'image/heic', 'image/heif',
  'application/pdf',
  'text/plain', 'text/csv', 'text/html', 'text/markdown',
  'application/json', 'text/xml'
];

export const validateFile = (file: File): string | null => {
  if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
    return `File "${file.name}" exceeds ${MAX_FILE_SIZE_MB}MB limit.`;
  }
  if (!SUPPORTED_MIME_TYPES.some(type => file.type === type || file.type.startsWith('text/'))) {
    // Relaxed check for text files
    if (!file.type.startsWith('text/') && !file.type.includes('pdf') && !file.type.startsWith('image/')) {
       return `File "${file.name}" has unsupported type: ${file.type}`;
    }
  }
  return null;
};

export const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const result = reader.result as string;
      // Remove Data URL prefix (e.g., "data:image/png;base64,")
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = error => reject(error);
  });
};

export const processFiles = async (files: FileList | null): Promise<{ valid: Attachment[], errors: string[] }> => {
  if (!files) return { valid: [], errors: [] };
  
  const valid: Attachment[] = [];
  const errors: string[] = [];

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const error = validateFile(file);
    if (error) {
      errors.push(error);
      continue;
    }

    try {
      const base64 = await fileToBase64(file);
      valid.push({
        name: file.name,
        mimeType: file.type,
        data: base64
      });
    } catch (e) {
      console.error(`Failed to read file ${file.name}`, e);
      errors.push(`Failed to read file "${file.name}"`);
    }
  }
  
  return { valid, errors };
};