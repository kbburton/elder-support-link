import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.54.0';

// Phone number normalization functions
function normalizePhoneToE164(phoneNumber: string): string | null {
  if (!phoneNumber || typeof phoneNumber !== 'string') {
    return null;
  }

  const cleaned = phoneNumber.replace(/\D/g, '');
  
  if (!cleaned) {
    return null;
  }

  try {
    if (cleaned.length === 10) {
      return `+1${cleaned}`;
    }
    
    if (cleaned.length === 11 && cleaned.startsWith('1')) {
      return `+${cleaned}`;
    }
    
    return phoneNumber.startsWith('+') ? phoneNumber : `+${cleaned}`;
  } catch (error) {
    return null;
  }
}

function getPhoneSearchVariants(phoneNumber: string): string[] {
  const cleaned = phoneNumber.replace(/\D/g, '');
  const variants = [];
  
  // Add the original cleaned version
  variants.push(cleaned);
  
  // Add E.164 format
  const e164 = normalizePhoneToE164(phoneNumber);
  if (e164) {
    variants.push(e164);
    variants.push(e164.substring(1)); // without the +
  }
  
  // Add 10-digit format (remove leading 1 if present)
  if (cleaned.length === 11 && cleaned.startsWith('1')) {
    variants.push(cleaned.substring(1));
  }
  
  // Add with country code
  if (cleaned.length === 10) {
    variants.push(`1${cleaned}`);
  }
  
  return [...new Set(variants)]; // Remove duplicates
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Initialize Supabase client
const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

interface TwilioRequest {
  CallSid: string;
  From: string;
  To: string;
  CallStatus: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Twilio voice webhook called');
    console.log('Request method:', req.method);
    console.log('Request headers:', Object.fromEntries(req.headers.entries()));
    
    const body = await req.text();
    console.log('Raw request body:', body);
    
    // Parse URL-encoded form data manually
    const urlParams = new URLSearchParams(body);
    const twilioData: TwilioRequest = {
      CallSid: urlParams.get('CallSid') || '',
      From: urlParams.get('From') || '',
      To: urlParams.get('To') || '',
      CallStatus: urlParams.get('CallStatus') || '',
    };

    console.log('Parsed Twilio data:', twilioData);

    // Get all possible phone number formats for lookup
    const phoneVariants = getPhoneSearchVariants(twilioData.From);
    
    console.log('Looking up phone variants:', phoneVariants);

    // Check caller type and find appropriate PIN location
    let careGroup = null;
    let userProfile = null;
    let membershipData = null;
    let voicePin = null;
    let phoneAuthAttempts = 0;
    let phoneLockoutUntil = null;

    // First check if caller is the care recipient themselves
    const { data: recipientData, error: recipientError } = await supabase
      .from('care_groups')
      .select('id, name, voice_pin, phone_auth_attempts, phone_lockout_until, recipient_phone')
      .in('recipient_phone', phoneVariants);

    console.log('Recipient lookup result:', { recipientData, error: recipientError });

    if (!recipientError && recipientData && recipientData.length > 0) {
      // Caller is a care recipient
      careGroup = recipientData[0];
      voicePin = careGroup.voice_pin;
      phoneAuthAttempts = careGroup.phone_auth_attempts || 0;
      phoneLockoutUntil = careGroup.phone_lockout_until;
      console.log('Found caller as care recipient');
    } else {
      // Check if caller is a care group member (user/admin)
      const { data: memberData, error: memberError } = await supabase
        .from('profiles')
        .select(`
          user_id,
          phone,
          voice_pin,
          phone_auth_attempts,
          phone_lockout_until
        `)
        .in('phone', phoneVariants);

      console.log('Member lookup result:', { memberData, error: memberError });

      if (!memberError && memberData && memberData.length > 0) {
        // If multiple profiles match, prioritize one with voice_pin set
        const profileWithPin = memberData.find(profile => profile.voice_pin) || memberData[0];
        
        // Get care group memberships for this user
        const { data: membershipResult, error: membershipError } = await supabase
          .from('care_group_members')
          .select(`
            is_admin,
            care_groups!inner(
              id, name
            )
          `)
          .eq('user_id', profileWithPin.user_id);

        console.log('Membership lookup result:', { membershipData: membershipResult, error: membershipError });

        if (!membershipError && membershipResult && membershipResult.length > 0) {
          // Caller is a care group member - use their profile PIN
          userProfile = profileWithPin;
          voicePin = profileWithPin.voice_pin;
          phoneAuthAttempts = profileWithPin.phone_auth_attempts || 0;
          phoneLockoutUntil = profileWithPin.phone_lockout_until;
          
          // Store membership data for later use
          membershipData = membershipResult;
          
          // Find their preferred care group (admin group if available)
          const adminGroup = membershipResult.find(m => m.is_admin);
          careGroup = adminGroup?.care_groups || membershipResult[0].care_groups;
          console.log('Found caller as care group member with PIN');
        }
      }
    }

    if (!careGroup) {
      console.log('Phone number not recognized as member or recipient');
      const twimlResponse = `<?xml version="1.0" encoding="UTF-8"?><Response><Say>I'm sorry, but this phone number is not recognized in our system. Please call from a registered number or contact support for assistance.</Say><Hangup/></Response>`;
      
      return new Response(twimlResponse, {
        headers: { ...corsHeaders, 'Content-Type': 'text/xml' },
      });
    }

    // Check if phone is locked out
    if (phoneLockoutUntil && new Date(phoneLockoutUntil) > new Date()) {
      console.log('Phone is locked out until:', phoneLockoutUntil);
      const twimlResponse = `<?xml version="1.0" encoding="UTF-8"?><Response><Say>This phone number is temporarily locked due to multiple incorrect PIN attempts. Please try again later or contact support.</Say><Hangup/></Response>`;
      
      return new Response(twimlResponse, {
        headers: { ...corsHeaders, 'Content-Type': 'text/xml' },
      });
    }

    // Check if PIN is set up
    if (!voicePin) {
      console.log('No PIN set up for caller');
      const twimlResponse = `<?xml version="1.0" encoding="UTF-8"?><Response><Say>Please set up your voice PIN in the app to continue. Visit your profile settings to create a four-digit PIN for voice access.</Say><Hangup/></Response>`;
      
      return new Response(twimlResponse, {
        headers: { ...corsHeaders, 'Content-Type': 'text/xml' },
      });
    }

    // XML escape function for safe TwiML - handles null/undefined values
    function xmlEscape(str: any): string {
      if (str === null || str === undefined) {
        return 'the care group';
      }
      return String(str).replace(/[<>&'"]/g, (match) => {
        switch (match) {
          case '<': return '&lt;';
          case '>': return '&gt;';
          case '&': return '&amp;';
          case '"': return '&quot;';
          case "'": return '&apos;';
          default: return match;
        }
      });
    }

    // Ensure we have valid values for URL construction
    if (!careGroup.id) {
      console.error('Care group missing ID:', careGroup);
      throw new Error('Invalid care group data');
    }

    // Simple PIN authentication flow - pass phone number for lookup
    const cleanPhone = twilioData.From.replace(/^\+1/, '').replace(/\D/g, '');
    const gatherUrl = `https://yfwgegapmggwywrnzqvg.functions.supabase.co/enhanced-twilio-pin-verify?phone=${encodeURIComponent(cleanPhone)}`;
    
    console.log('Generated gather URL:', gatherUrl);
    
    const twimlResponse = `<?xml version="1.0" encoding="UTF-8"?><Response><Say>Welcome to Elder-Support. Please enter your four-digit PIN followed by the pound key.</Say><Gather action="${gatherUrl}" method="POST" numDigits="4" finishOnKey="#" timeout="10"></Gather><Say>I didn't receive your PIN. Please try again.</Say><Redirect>${gatherUrl}</Redirect></Response>`;

    console.log('Generated TwiML response:', twimlResponse);
    
    return new Response(twimlResponse, {
      headers: { ...corsHeaders, 'Content-Type': 'text/xml' },
    });

  } catch (error) {
    console.error('Error in Twilio webhook:', error);
    const twimlResponse = `<?xml version="1.0" encoding="UTF-8"?><Response><Say>I'm sorry, there was an error processing your request. Please try again later.</Say><Hangup/></Response>`;
    
    return new Response(twimlResponse, {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'text/xml' },
    });
  }
});