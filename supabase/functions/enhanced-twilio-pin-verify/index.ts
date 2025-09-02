import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { compare } from 'https://deno.land/x/bcrypt@v0.4.1/mod.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Enhanced PIN verification called');
    
    // Parse the form data from Twilio
    const body = await req.text();
    const params = new URLSearchParams(body);
    
    const callSid = params.get('CallSid') || '';
    const from = params.get('From') || '';
    const digits = params.get('Digits') || '';
    
    // Parse URL parameters to determine caller type
    const url = new URL(req.url);
    const callerType = url.searchParams.get('type'); // 'care_recipient' or 'user'
    const entityId = url.searchParams.get('id');
    const userId = url.searchParams.get('user_id');
    const groupCount = parseInt(url.searchParams.get('groups') || '0');

    console.log('PIN verification details:', {
      callerType,
      entityId,
      userId,
      groupCount,
      digits: digits.length
    });

    const cleanPhone = from.replace(/^\+1/, '').replace(/\D/g, '');
    let pinMatch = false;
    let entity = null;
    let careGroups = [];

    // Verify PIN based on caller type
    if (callerType === 'care_recipient' && entityId) {
      // Get care recipient data
      const { data: careGroup, error } = await supabase
        .from('care_groups')
        .select('*')
        .eq('id', entityId)
        .single();

      if (error || !careGroup) {
        throw new Error('Care group not found');
      }

      entity = careGroup;
      pinMatch = await compare(digits, careGroup.voice_pin);
      
      if (pinMatch) {
        careGroups = [careGroup];
      }
      
    } else if (callerType === 'user' && userId) {
      // Get user profile data
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error || !profile) {
        throw new Error('User profile not found');
      }

      entity = profile;
      pinMatch = await compare(digits, profile.voice_pin);
      
      if (pinMatch) {
        // Get user's care groups
        const { data: groups, error: groupsError } = await supabase
          .from('care_group_members')
          .select(`
            care_groups (
              id,
              name,
              recipient_first_name
            )
          `)
          .eq('user_id', userId);

        if (!groupsError && groups) {
          careGroups = groups.map(g => g.care_groups).filter(Boolean);
        }
      }
    }

    if (!entity) {
      throw new Error('Invalid caller type or missing entity');
    }

    let twimlResponse = '';

    if (pinMatch) {
      console.log('PIN verification successful');
      
      // Reset failed attempts
      const updateData = {
        phone_auth_attempts: 0,
        phone_lockout_until: null
      };

      if (callerType === 'care_recipient') {
        await supabase
          .from('care_groups')
          .update(updateData)
          .eq('id', entityId);
      } else {
        await supabase
          .from('profiles')
          .update(updateData)
          .eq('user_id', userId);
      }

      // Handle care group selection for users with multiple groups
      if (callerType === 'user' && careGroups.length > 1) {
        console.log('User has multiple care groups, prompting for selection');
        
        let groupList = 'You are part of more than one care group. Let me list them. ';
        careGroups.forEach((group, index) => {
          groupList += `${index + 1}. ${group.recipient_first_name}'s care group. `;
        });
        groupList += 'What care group are you calling about today? Please say the first name of the care recipient.';

        const baseUrl = `https://${supabaseUrl.split('//')[1].split('.')[0]}.supabase.co/functions/v1`;
        const groupIds = careGroups.map(g => g.id).join(',');
        const chatUrl = `${baseUrl}/enhanced-twilio-voice-chat?user_id=${userId}&groups=${encodeURIComponent(groupIds)}&type=user`;

        twimlResponse = `
          <?xml version="1.0" encoding="UTF-8"?>
          <Response>
            <Say voice="alice">${groupList}</Say>
            <Record action="${chatUrl}" method="POST" maxLength="10" timeout="5" finishOnKey="#"/>
            <Say voice="alice">I didn't hear a response. Let me connect you to the first care group.</Say>
            <Connect>
              <Stream url="${chatUrl}&default_group=${careGroups[0].id}"/>
            </Connect>
          </Response>
        `;
      } else {
        // Single care group or care recipient - proceed to voice chat
        const selectedGroup = careGroups[0];
        const baseUrl = `https://${supabaseUrl.split('//')[1].split('.')[0]}.supabase.co/functions/v1`;
        let chatUrl = `${baseUrl}/enhanced-twilio-voice-chat?group_id=${selectedGroup.id}`;
        
        if (callerType === 'user') {
          chatUrl += `&user_id=${userId}&type=user`;
        } else {
          chatUrl += `&type=care_recipient`;
        }

        const greeting = callerType === 'care_recipient' 
          ? `Welcome ${selectedGroup.recipient_first_name || 'to your care system'}.`
          : `Welcome to ${selectedGroup.recipient_first_name}'s care group.`;

        twimlResponse = `
          <?xml version="1.0" encoding="UTF-8"?>
          <Response>
            <Say voice="alice">${greeting} I'm here to help you access information about appointments, contacts, activities, tasks, and documents. What would you like to know?</Say>
            <Connect>
              <Stream url="${chatUrl}"/>
            </Connect>
          </Response>
        `;
      }
    } else {
      console.log('PIN verification failed');
      
      // Increment failed attempts
      const currentAttempts = (entity.phone_auth_attempts || 0) + 1;
      const maxAttempts = 4;
      const lockoutUntil = currentAttempts >= maxAttempts 
        ? new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // 24 hours
        : null;

      const updateData = {
        phone_auth_attempts: currentAttempts,
        phone_lockout_until: lockoutUntil
      };

      if (callerType === 'care_recipient') {
        await supabase
          .from('care_groups')
          .update(updateData)
          .eq('id', entityId);
      } else {
        await supabase
          .from('profiles')
          .update(updateData)
          .eq('user_id', userId);
      }

      if (lockoutUntil) {
        twimlResponse = `
          <?xml version="1.0" encoding="UTF-8"?>
          <Response>
            <Say voice="alice">Incorrect PIN. This phone number is now locked for 24 hours due to too many failed attempts. Goodbye.</Say>
            <Hangup/>
          </Response>
        `;
      } else {
        const remainingAttempts = maxAttempts - currentAttempts;
        twimlResponse = `
          <?xml version="1.0" encoding="UTF-8"?>
          <Response>
            <Say voice="alice">Incorrect PIN. You have ${remainingAttempts} attempts remaining. Goodbye.</Say>
            <Hangup/>
          </Response>
        `;
      }
    }

    console.log('Sending TwiML response for PIN verification');

    return new Response(twimlResponse, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/xml',
      },
    });

  } catch (error) {
    console.error('Error in enhanced PIN verification:', error);
    
    const errorResponse = `
      <?xml version="1.0" encoding="UTF-8"?>
      <Response>
        <Say voice="alice">I'm sorry, there was an error verifying your PIN. Please try again later. Goodbye.</Say>
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