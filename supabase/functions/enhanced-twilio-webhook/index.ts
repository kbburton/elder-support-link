import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

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
    console.log('Enhanced Twilio webhook called');
    
    // Parse the form data from Twilio
    const body = await req.text();
    const params = new URLSearchParams(body);
    
    const callData: TwilioRequest = {
      CallSid: params.get('CallSid') || '',
      From: params.get('From') || '',
      To: params.get('To') || '',
      CallStatus: params.get('CallStatus') || ''
    };

    console.log('Call details:', callData);

    // Clean the phone number for database lookup
    const cleanPhone = callData.From.replace(/^\+1/, '').replace(/\D/g, '');
    console.log('Cleaned phone number:', cleanPhone);

    // First, check if this is a care recipient (care_groups table)
    const { data: careGroup, error: careGroupError } = await supabase
      .from('care_groups')
      .select('id, name, recipient_first_name, voice_pin, phone_auth_attempts, phone_lockout_until')
      .eq('recipient_phone', cleanPhone)
      .maybeSingle();

    if (careGroupError) {
      console.error('Error checking care groups:', careGroupError);
    }

    // If not found in care groups, check profiles table for users
    let userProfile = null;
    let userCareGroups = [];
    
    if (!careGroup) {
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select(`
          user_id,
          first_name,
          last_name,
          phone,
          voice_pin,
          phone_auth_attempts,
          phone_lockout_until
        `)
        .eq('phone', cleanPhone)
        .maybeSingle();

      if (profileError) {
        console.error('Error checking profiles:', profileError);
      }

      if (profile) {
        userProfile = profile;
        
        // Get the care groups this user is a member of
        const { data: groups, error: groupsError } = await supabase
          .from('care_group_members')
          .select(`
            care_groups (
              id,
              name,
              recipient_first_name
            )
          `)
          .eq('user_id', profile.user_id);

        if (groupsError) {
          console.error('Error fetching user care groups:', groupsError);
        } else {
          userCareGroups = (groups || []).map(g => g.care_groups).filter(Boolean);
        }
      }
    }

    console.log('Caller identification results:', {
      careGroup: !!careGroup,
      userProfile: !!userProfile,
      userCareGroupCount: userCareGroups.length
    });

    let twimlResponse = '';

    // Check if caller is recognized
    if (!careGroup && !userProfile) {
      console.log('Phone number not recognized');
      twimlResponse = `
        <?xml version="1.0" encoding="UTF-8"?>
        <Response>
          <Say voice="alice">I'm sorry, but this phone number is not recognized in the system. Please contact an administrator for assistance. Goodbye.</Say>
          <Hangup/>
        </Response>
      `;
    } else {
      // Determine which entity has the lockout status
      const entity = careGroup || userProfile;
      const isLockedOut = entity.phone_lockout_until && new Date(entity.phone_lockout_until) > new Date();

      if (isLockedOut) {
        console.log('Phone number is locked out');
        twimlResponse = `
          <?xml version="1.0" encoding="UTF-8"?>
          <Response>
            <Say voice="alice">This phone number is currently locked due to too many failed attempts. Please try again later or contact an administrator. Goodbye.</Say>
            <Hangup/>
          </Response>
        `;
      } else if (!entity.voice_pin) {
        console.log('No PIN set for caller');
        const entityType = careGroup ? 'care recipient' : 'user';
        twimlResponse = `
          <?xml version="1.0" encoding="UTF-8"?>
          <Response>
            <Say voice="alice">No voice PIN has been set for this ${entityType}. Please set up your PIN through the application first. Goodbye.</Say>
            <Hangup/>
          </Response>
        `;
      } else {
        console.log('Caller recognized, prompting for PIN');
        
        // Determine the appropriate greeting
        let greeting = '';
        if (careGroup) {
          greeting = `Hello ${careGroup.recipient_first_name}. `;
        } else if (userProfile) {
          greeting = `Hello ${userProfile.first_name || 'there'}. `;
        }

        // Create the PIN verification URL with appropriate parameters
        const baseUrl = `https://${supabaseUrl.split('//')[1].split('.')[0]}.supabase.co/functions/v1`;
        let pinVerifyUrl = `${baseUrl}/enhanced-twilio-pin-verify`;
        
        if (careGroup) {
          pinVerifyUrl += `?type=care_recipient&id=${careGroup.id}`;
        } else if (userProfile) {
          pinVerifyUrl += `?type=user&user_id=${userProfile.user_id}&groups=${userCareGroups.length}`;
        }

        twimlResponse = `
          <?xml version="1.0" encoding="UTF-8"?>
          <Response>
            <Say voice="alice">${greeting}Please enter your 4-digit PIN followed by the pound key.</Say>
            <Gather input="dtmf" numDigits="4" timeout="10" finishOnKey="#" action="${pinVerifyUrl}" method="POST">
              <Say voice="alice">Enter your PIN now.</Say>
            </Gather>
            <Say voice="alice">I didn't receive your PIN. Please try again later. Goodbye.</Say>
            <Hangup/>
          </Response>
        `;
      }
    }

    console.log('Sending TwiML response:', twimlResponse);

    return new Response(twimlResponse, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/xml',
      },
    });

  } catch (error) {
    console.error('Error in enhanced Twilio webhook:', error);
    
    const errorResponse = `
      <?xml version="1.0" encoding="UTF-8"?>
      <Response>
        <Say voice="alice">I'm sorry, there was a technical error. Please try again later. Goodbye.</Say>
        <Hangup/>
      </Response>
    `;

    return new Response(errorResponse, {
      status: 500,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/xml',
      },
    });
  }
});