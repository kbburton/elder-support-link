import { z } from "zod";
import { sanitizeTextInput, isValidEmail, isValidPhone, isValidUrl } from "./security";

/**
 * Enhanced validation schemas with security hardening
 */

// Base string validation with sanitization
export const secureString = (minLength: number = 0, maxLength: number = 255) =>
  z.string()
    .min(minLength)
    .max(maxLength)
    .transform(sanitizeTextInput);

// Email validation with sanitization
export const secureEmail = z.string()
  .transform(sanitizeTextInput)
  .refine(isValidEmail, { message: "Invalid email format" });

// Phone validation with sanitization
export const securePhone = z.string()
  .optional()
  .transform((val) => val ? sanitizeTextInput(val) : val)
  .refine((val) => !val || isValidPhone(val), { message: "Invalid phone format" });

// URL validation with sanitization
export const secureUrl = z.string()
  .optional()
  .transform((val) => val ? sanitizeTextInput(val) : val)
  .refine((val) => !val || isValidUrl(val), { message: "Invalid URL format" });

// Contact validation schema
export const secureContactSchema = z.object({
  first_name: secureString(1, 100),
  last_name: secureString(1, 100),
  email_personal: secureEmail.optional(),
  email_work: secureEmail.optional(),
  phone_primary: securePhone,
  phone_secondary: securePhone,
  organization_name: secureString(0, 200).optional(),
  address_line1: secureString(0, 200).optional(),
  address_line2: secureString(0, 200).optional(),
  city: secureString(0, 100).optional(),
  state: secureString(0, 50).optional(),
  postal_code: secureString(0, 20).optional(),
  notes: secureString(0, 2000).optional(),
  emergency_notes: secureString(0, 1000).optional(),
});

// Task validation schema
export const secureTaskSchema = z.object({
  title: secureString(1, 200),
  description: secureString(0, 2000).optional(),
  category: secureString(0, 100).optional(),
  due_date: z.string().optional(),
  priority: z.enum(['Low', 'Medium', 'High']).optional(),
});

// Appointment validation schema
export const secureAppointmentSchema = z.object({
  description: secureString(1, 200),
  location: secureString(0, 200).optional(),
  category: secureString(0, 100).optional(),
  outcome_notes: secureString(0, 2000).optional(),
  date_time: z.string(),
  duration_minutes: z.number().min(5).max(480).optional(),
});

// Document validation schema
export const secureDocumentSchema = z.object({
  title: secureString(1, 200),
  category: secureString(0, 100).optional(),
  notes: secureString(0, 2000).optional(),
  summary: secureString(0, 1000).optional(),
});

// Activity log validation schema
export const secureActivityLogSchema = z.object({
  title: secureString(0, 200).optional(),
  type: secureString(1, 100),
  notes: secureString(0, 2000).optional(),
  date_time: z.string(),
});

// Care group validation schema
export const secureCareGroupSchema = z.object({
  name: secureString(1, 100),
  recipient_first_name: secureString(0, 100).optional(),
  recipient_last_name: secureString(0, 100).optional(),
  recipient_email: secureEmail.optional(),
  recipient_phone: securePhone,
  recipient_address: secureString(0, 200).optional(),
  recipient_city: secureString(0, 100).optional(),
  recipient_state: secureString(0, 50).optional(),
  recipient_zip: secureString(0, 20).optional(),
  profile_description: secureString(0, 2000).optional(),
  chronic_conditions: secureString(0, 1000).optional(),
  mental_health: secureString(0, 1000).optional(),
  mobility: secureString(0, 500).optional(),
  vision: secureString(0, 500).optional(),
  hearing: secureString(0, 500).optional(),
  memory: secureString(0, 500).optional(),
  living_situation: secureString(0, 500).optional(),
  other_important_information: secureString(0, 2000).optional(),
});

// Feedback validation schema
export const secureFeedbackSchema = z.object({
  title: secureString(1, 200),
  description: secureString(1, 2000),
  type: z.enum(['bug', 'feature_request', 'improvement', 'question']),
  severity: z.enum(['low', 'medium', 'high', 'critical']),
  steps_to_reproduce: secureString(0, 2000).optional(),
  expected_result: secureString(0, 1000).optional(),
  actual_result: secureString(0, 1000).optional(),
});

/**
 * Validates and sanitizes form data
 */
export function validateFormData<T>(schema: z.ZodSchema<T>, data: unknown): T {
  return schema.parse(data);
}

/**
 * Safely validates form data with error handling
 */
export function safeValidateFormData<T>(
  schema: z.ZodSchema<T>, 
  data: unknown
): { success: true; data: T } | { success: false; errors: string[] } {
  try {
    const validData = schema.parse(data);
    return { success: true, data: validData };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        errors: error.issues.map(e => `${e.path.join('.')}: ${e.message}`)
      };
    }
    return { success: false, errors: ['Validation failed'] };
  }
}