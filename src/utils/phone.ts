import { parsePhoneNumber, AsYouType } from 'libphonenumber-js';

/**
 * Normalizes a phone number to E.164 format
 * If the number is 10 digits, assumes US (+1) country code
 */
export function normalizePhoneToE164(phoneNumber: string): string | null {
  if (!phoneNumber || typeof phoneNumber !== 'string') {
    return null;
  }

  // Clean the input - remove all non-digit characters
  const cleaned = phoneNumber.replace(/\D/g, '');
  
  if (!cleaned) {
    return null;
  }

  try {
    // If exactly 10 digits, assume US number
    if (cleaned.length === 10) {
      const parsed = parsePhoneNumber(`+1${cleaned}`, 'US');
      return parsed.isValid() ? parsed.format('E.164') : null;
    }
    
    // If 11 digits and starts with 1, assume US number
    if (cleaned.length === 11 && cleaned.startsWith('1')) {
      const parsed = parsePhoneNumber(`+${cleaned}`, 'US');
      return parsed.isValid() ? parsed.format('E.164') : null;
    }
    
    // Try parsing as international number
    const parsed = parsePhoneNumber(phoneNumber);
    return parsed.isValid() ? parsed.format('E.164') : null;
  } catch (error) {
    return null;
  }
}

/**
 * Formats a phone number for display in national format
 * Falls back to original input if parsing fails
 */
export function formatPhoneForDisplay(phoneNumber: string): string {
  if (!phoneNumber) {
    return '';
  }

  try {
    const parsed = parsePhoneNumber(phoneNumber);
    if (parsed.isValid()) {
      return parsed.formatNational();
    }
  } catch (error) {
    // Fall through to return original
  }
  
  return phoneNumber;
}

/**
 * Validates if a phone number is valid
 */
export function isValidPhoneNumber(phoneNumber: string): boolean {
  if (!phoneNumber) {
    return false;
  }

  try {
    const parsed = parsePhoneNumber(phoneNumber);
    return parsed.isValid();
  } catch (error) {
    return false;
  }
}

/**
 * Format phone number as user types (for input fields)
 */
export function formatPhoneAsYouType(value: string, country: string = 'US'): string {
  const formatter = new AsYouType(country as any);
  return formatter.input(value);
}