/**
 * Global file and photo limits configuration
 * These limits should match the Document Center configuration
 */

export const FILE_LIMITS = {
  // Maximum file size in bytes (25MB)
  MAX_FILE_SIZE: 25 * 1024 * 1024,
  
  // Maximum photo size in bytes (10MB for photos)
  MAX_PHOTO_SIZE: 10 * 1024 * 1024,
  
  // Allowed file types for documents
  ALLOWED_DOCUMENT_TYPES: [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain',
    'text/csv'
  ] as readonly string[],
  
  // Allowed image types for photos
  ALLOWED_IMAGE_TYPES: [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/gif',
    'image/webp'
  ] as readonly string[],
  
  // File extensions for documents
  ALLOWED_DOCUMENT_EXTENSIONS: [
    '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.txt', '.csv'
  ] as readonly string[],
  
  // File extensions for images
  ALLOWED_IMAGE_EXTENSIONS: [
    '.jpg', '.jpeg', '.png', '.gif', '.webp'
  ] as readonly string[]
};

/**
 * Validates file size against the appropriate limit
 */
export function validateFileSize(file: File, isPhoto: boolean = false): { isValid: boolean; message?: string } {
  const maxSize = isPhoto ? FILE_LIMITS.MAX_PHOTO_SIZE : FILE_LIMITS.MAX_FILE_SIZE;
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
 * Validates file type
 */
export function validateFileType(file: File, isPhoto: boolean = false): { isValid: boolean; message?: string } {
  const allowedTypes = isPhoto ? FILE_LIMITS.ALLOWED_IMAGE_TYPES : FILE_LIMITS.ALLOWED_DOCUMENT_TYPES;
  const allowedExtensions = isPhoto ? FILE_LIMITS.ALLOWED_IMAGE_EXTENSIONS : FILE_LIMITS.ALLOWED_DOCUMENT_EXTENSIONS;
  
  // Check MIME type
  if (!allowedTypes.includes(file.type as any)) {
    // Fallback to extension check
    const extension = `.${file.name.split('.').pop()?.toLowerCase()}`;
    if (!allowedExtensions.includes(extension as any)) {
      const typeDescription = isPhoto ? 'image' : 'document';
      const extensionList = allowedExtensions.join(', ');
      return {
        isValid: false,
        message: `Invalid ${typeDescription} type. Allowed types: ${extensionList}`
      };
    }
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
  const maxSize = isPhoto ? FILE_LIMITS.MAX_PHOTO_SIZE : FILE_LIMITS.MAX_FILE_SIZE;
  return formatFileSize(maxSize);
}