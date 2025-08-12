/**
 * US State validation - must be exactly 2 uppercase letters
 */
export function validateUSState(state: string): boolean {
  if (!state || typeof state !== 'string') {
    return false;
  }
  return /^[A-Z]{2}$/.test(state);
}

/**
 * ZIP code validation - must be 5 digits or ZIP+4 format
 */
export function validateZipCode(zip: string): boolean {
  if (!zip || typeof zip !== 'string') {
    return false;
  }
  return /^\d{5}(-\d{4})?$/.test(zip);
}

/**
 * Validates that a person contact has at least one phone or email
 */
export function validatePersonContactInfo(contact: {
  is_organization?: boolean;
  phone_primary?: string | null;
  phone_secondary?: string | null;
  email_personal?: string | null;
  email_work?: string | null;
}): { isValid: boolean; message?: string } {
  // Only apply this validation to person contacts (not organizations)
  if (contact.is_organization) {
    return { isValid: true };
  }

  const hasPhone = !!(contact.phone_primary || contact.phone_secondary);
  const hasEmail = !!(contact.email_personal || contact.email_work);

  if (!hasPhone && !hasEmail) {
    return {
      isValid: false,
      message: 'Person contacts must have at least one phone number or email address'
    };
  }

  return { isValid: true };
}

/**
 * Normalizes US state to uppercase 2-letter format
 */
export function normalizeUSState(state: string): string {
  if (!state || typeof state !== 'string') {
    return '';
  }
  
  const trimmed = state.trim().toUpperCase();
  
  // If it's already 2 letters, return as-is
  if (trimmed.length === 2) {
    return trimmed;
  }
  
  // Common state name to abbreviation mapping
  const stateMap: Record<string, string> = {
    'ALABAMA': 'AL', 'ALASKA': 'AK', 'ARIZONA': 'AZ', 'ARKANSAS': 'AR',
    'CALIFORNIA': 'CA', 'COLORADO': 'CO', 'CONNECTICUT': 'CT', 'DELAWARE': 'DE',
    'FLORIDA': 'FL', 'GEORGIA': 'GA', 'HAWAII': 'HI', 'IDAHO': 'ID',
    'ILLINOIS': 'IL', 'INDIANA': 'IN', 'IOWA': 'IA', 'KANSAS': 'KS',
    'KENTUCKY': 'KY', 'LOUISIANA': 'LA', 'MAINE': 'ME', 'MARYLAND': 'MD',
    'MASSACHUSETTS': 'MA', 'MICHIGAN': 'MI', 'MINNESOTA': 'MN', 'MISSISSIPPI': 'MS',
    'MISSOURI': 'MO', 'MONTANA': 'MT', 'NEBRASKA': 'NE', 'NEVADA': 'NV',
    'NEW HAMPSHIRE': 'NH', 'NEW JERSEY': 'NJ', 'NEW MEXICO': 'NM', 'NEW YORK': 'NY',
    'NORTH CAROLINA': 'NC', 'NORTH DAKOTA': 'ND', 'OHIO': 'OH', 'OKLAHOMA': 'OK',
    'OREGON': 'OR', 'PENNSYLVANIA': 'PA', 'RHODE ISLAND': 'RI', 'SOUTH CAROLINA': 'SC',
    'SOUTH DAKOTA': 'SD', 'TENNESSEE': 'TN', 'TEXAS': 'TX', 'UTAH': 'UT',
    'VERMONT': 'VT', 'VIRGINIA': 'VA', 'WASHINGTON': 'WA', 'WEST VIRGINIA': 'WV',
    'WISCONSIN': 'WI', 'WYOMING': 'WY', 'DISTRICT OF COLUMBIA': 'DC'
  };
  
  return stateMap[trimmed] || trimmed;
}

/**
 * Normalizes ZIP code to standard format
 */
export function normalizeZipCode(zip: string): string {
  if (!zip || typeof zip !== 'string') {
    return '';
  }
  
  // Remove all non-digit and non-hyphen characters
  const cleaned = zip.replace(/[^\d-]/g, '');
  
  // Handle ZIP+4 format
  if (cleaned.includes('-')) {
    const parts = cleaned.split('-');
    const zip5 = parts[0]?.slice(0, 5) || '';
    const zip4 = parts[1]?.slice(0, 4) || '';
    
    if (zip5.length === 5 && zip4.length === 4) {
      return `${zip5}-${zip4}`;
    } else if (zip5.length === 5) {
      return zip5;
    }
  } else {
    // Handle 9-digit ZIP without hyphen
    if (cleaned.length === 9) {
      return `${cleaned.slice(0, 5)}-${cleaned.slice(5)}`;
    } else if (cleaned.length === 5) {
      return cleaned;
    }
  }
  
  return cleaned.slice(0, 5); // Fallback to first 5 digits
}