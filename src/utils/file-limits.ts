/**
 * Global file and photo limits configuration
 * These limits should match the Document Center configuration
 */

export const FILE_LIMITS = {
  // Maximum file size in bytes (25MB per file)
  MAX_FILE_SIZE: 25 * 1024 * 1024,
  
  // Maximum batch size in bytes (100MB total)
  MAX_BATCH_SIZE: 100 * 1024 * 1024,
  
  // Allowed file types for documents
  ALLOWED_DOCUMENT_TYPES: [
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/plain',
    'image/jpeg',
    'image/png',
    'image/webp'
  ] as readonly string[],
  
  // Blocked dangerous file types
  BLOCKED_TYPES: [
    'application/x-executable',
    'application/x-msdownload',
    'application/x-sh',
    'application/x-bat',
    'application/javascript',
    'text/html',
    'image/svg+xml',
    'application/zip',
    'application/x-gzip',
    'application/x-rar-compressed',
    'application/octet-stream'
  ] as readonly string[],
  
  // Blocked file extensions
  BLOCKED_EXTENSIONS: [
    '.exe', '.dll', '.sh', '.bat', '.js', '.html', '.svg', '.zip', '.gz', '.rar', '.bin', '.com', '.scr', '.cmd', '.msi'
  ] as readonly string[],
  
  // File extensions for documents
  ALLOWED_DOCUMENT_EXTENSIONS: [
    '.pdf', '.docx', '.xlsx', '.pptx', '.txt', '.jpg', '.jpeg', '.png', '.webp'
  ] as readonly string[]
};

/**
 * Validates file size against the appropriate limit
 */
export function validateFileSize(file: File, isPhoto: boolean = false): { isValid: boolean; message?: string } {
  const maxSize = FILE_LIMITS.MAX_FILE_SIZE;
  const maxSizeMB = Math.round(maxSize / (1024 * 1024));
  
  if (file.size > maxSize) {
    return {
      isValid: false,
      message: `File size must be less than ${maxSizeMB}MB`
    };
  }
  
  return { isValid: true };
}

/**
 * Validates file type and blocks dangerous files
 */
export function validateFileType(file: File, isPhoto: boolean = false): { isValid: boolean; message?: string } {
  const extension = `.${file.name.split('.').pop()?.toLowerCase()}`;
  
  // Check for blocked extensions first
  if (FILE_LIMITS.BLOCKED_EXTENSIONS.includes(extension as any)) {
    return {
      isValid: false,
      message: `File type ${extension} is blocked for security reasons`
    };
  }
  
  // Check for blocked MIME types
  if (FILE_LIMITS.BLOCKED_TYPES.includes(file.type)) {
    return {
      isValid: false,
      message: `File type ${file.type} is blocked for security reasons`
    };
  }
  
  const allowedTypes = FILE_LIMITS.ALLOWED_DOCUMENT_TYPES;
  const allowedExtensions = FILE_LIMITS.ALLOWED_DOCUMENT_EXTENSIONS;
  
  // Check MIME type
  if (!allowedTypes.includes(file.type as any)) {
    // Fallback to extension check
    if (!allowedExtensions.includes(extension as any)) {
      const extensionList = allowedExtensions.join(', ');
      return {
        isValid: false,
        message: `Invalid file type. Allowed types: ${extensionList}`
      };
    }
  }
  
  return { isValid: true };
}

/**
 * Validates batch of files for total size
 */
export function validateBatch(files: File[]): { isValid: boolean; message?: string } {
  const totalSize = files.reduce((sum, file) => sum + file.size, 0);
  
  if (totalSize > FILE_LIMITS.MAX_BATCH_SIZE) {
    const totalMB = Math.round(totalSize / (1024 * 1024));
    const maxMB = Math.round(FILE_LIMITS.MAX_BATCH_SIZE / (1024 * 1024));
    return {
      isValid: false,
      message: `Total batch size (${totalMB}MB) exceeds limit of ${maxMB}MB`
    };
  }
  
  return { isValid: true };
}

/**
 * Comprehensive file validation
 */
export function validateFile(file: File, isPhoto: boolean = false): { isValid: boolean; message?: string } {
  // Check file size
  const sizeValidation = validateFileSize(file, isPhoto);
  if (!sizeValidation.isValid) {
    return sizeValidation;
  }
  
  // Check file type
  const typeValidation = validateFileType(file, isPhoto);
  if (!typeValidation.isValid) {
    return typeValidation;
  }
  
  return { isValid: true };
}

/**
 * Formats file size for display
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Gets the maximum file size for display
 */
export function getMaxFileSizeDisplay(isPhoto: boolean = false): string {
  const maxSize = FILE_LIMITS.MAX_FILE_SIZE;
  return formatFileSize(maxSize);
}