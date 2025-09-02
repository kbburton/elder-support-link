import { supabaseAdmin } from '@/lib/supabaseAdmin';
import bcrypt from 'bcryptjs';
import { z } from 'zod';

const PhoneSchema = z.string().regex(/^\+?[1-9]\d{1,14}$/, 'Invalid phone number format');
const PinSchema = z.string().length(4, 'PIN must be 4 digits').regex(/^\d{4}$/, 'PIN must be numeric');

export interface Identity {
  id: string;
  phone: string;
  email: string;
  firstName: string;
  lastName: string;
  careGroupId: string;
  isAdmin: boolean;
  relationship: string;
}

/**
 * Find user identity by phone number
 */
export async function findIdentityByPhone(phone: string): Promise<Identity | null> {
  try {
    const validatedPhone = PhoneSchema.parse(phone);
    
    // First, find the care group by phone
    const { data: careGroupData, error: careGroupError } = await supabaseAdmin
      .from('care_groups')
      .select('id, recipient_email')
      .eq('recipient_phone', validatedPhone)
      .single();

    if (careGroupError || !careGroupData) {
      return null;
    }

    // Then find the first member of that care group and their profile
    const { data: memberData, error: memberError } = await supabaseAdmin
      .from('care_group_members')
      .select(`
        user_id,
        is_admin,
        relationship_to_recipient
      `)
      .eq('group_id', careGroupData.id)
      .limit(1)
      .single();

    if (memberError || !memberData) {
      return null;
    }

    // Finally get the profile info
    const { data: profileData, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('first_name, last_name')
      .eq('user_id', memberData.user_id)
      .single();

    if (profileError || !profileData) {
      return null;
    }
    
    return {
      id: memberData.user_id,
      phone: validatedPhone,
      email: careGroupData.recipient_email,
      firstName: profileData.first_name || '',
      lastName: profileData.last_name || '',
      careGroupId: careGroupData.id,
      isAdmin: memberData.is_admin,
      relationship: memberData.relationship_to_recipient
    };
  } catch (error) {
    console.error('Error finding identity by phone:', error);
    return null;
  }
}

/**
 * Verify PIN for voice authentication
 * Note: This is a placeholder - implement actual PIN verification logic
 */
export async function verifyPin(userId: string, pin: string): Promise<boolean> {
  try {
    const validatedPin = PinSchema.parse(pin);
    
    // TODO: Implement actual PIN storage and verification
    // For now, return true for any 4-digit PIN (development only)
    console.log(`PIN verification for user ${userId}: ${validatedPin}`);
    
    // In production, you would:
    // 1. Retrieve stored PIN hash from database
    // 2. Compare with bcrypt.compare(pin, storedHash)
    // 3. Update last_pin_verification timestamp
    
    return true;
  } catch (error) {
    console.error('Error verifying PIN:', error);
    return false;
  }
}

/**
 * Audit voice/SMS interactions
 */
export async function auditVoiceInteraction(data: {
  userId: string;
  careGroupId: string;
  phone: string;
  action: string;
  details?: Record<string, any>;
  success: boolean;
}): Promise<void> {
  try {
    await supabaseAdmin.rpc('log_audit_event', {
      p_action: `voice_${data.action}`,
      p_resource_type: 'voice_interaction',
      p_resource_id: data.userId,
      p_group_id: data.careGroupId,
      p_details: {
        phone: data.phone,
        success: data.success,
        timestamp: new Date().toISOString(),
        ...data.details
      }
    });
  } catch (error) {
    console.error('Error auditing voice interaction:', error);
  }
}