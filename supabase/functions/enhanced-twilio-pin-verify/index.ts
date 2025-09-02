import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { hash, compare } from 'https://deno.land/x/bcrypt@v0.2.4/mod.ts';

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
    
    // Parse URL parameters - now we just get the phone number
    const url = new URL(req.url);
    const phoneParam = url.searchParams.get('phone');

    // Use phone number from URL parameter or fallback to 'from'
    const lookupPhone = phoneParam || from.replace(/^\+1/, '').replace(/\D/g, '');
    
    console.log('PIN verification details:', {
      lookupPhone,
      digits: digits.length
    });

    let pinMatch = false;
    let entity = null;
    let careGroups = [];
    let callerType = null;

    // First, try to find the phone number in care_groups table (care recipient)
    const { data: careGroupMatch, error: careGroupError } = await supabase
      .from('care_groups')
      .select('*')
      .eq('recipient_phone', lookupPhone)
      .single();

    if (!careGroupError && careGroupMatch && careGroupMatch.voice_pin) {
      console.log('Found care recipient match');
      entity = careGroupMatch;
      callerType = 'care_recipient';
      pinMatch = await compare(digits, careGroupMatch.voice_pin);
      
      if (pinMatch) {
        careGroups = [careGroupMatch];
      }
    } else {
      // Try to find in profiles table (care group member)
      const { data: profileMatch, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('phone', lookupPhone)
        .single();

      if (!profileError && profileMatch && profileMatch.voice_pin) {
        console.log('Found care group member match');
        entity = profileMatch;
        callerType = 'user';
        pinMatch = await compare(digits, profileMatch.voice_pin);
        
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
            .eq('user_id', profileMatch.user_id);

          if (!groupsError && groups) {
            careGroups = groups.map(g => g.care_groups).filter(Boolean);
          }
        }
      }
    }

    if (!entity) {
      throw new Error('Phone number not found in system');
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
          .eq('id', entity.id);
      } else {
        await supabase
          .from('profiles')
          .update(updateData)
          .eq('user_id', entity.user_id);
      }

      // Handle care group selection for users with multiple groups
      if (callerType === 'user' && careGroups.length > 1) {
        console.log('User has multiple care groups, prompting for selection');
        
        let groupList = 'Please select a care group. ';
        careGroups.forEach((group, index) => {
          groupList += `Press ${index + 1} for ${group.recipient_first_name}'s care group. `;
        });
        groupList += 'Please press the number for your selection.';

        const baseUrl = `https://yfwgegapmggwywrnzqvg.functions.supabase.co`;
        const groupIds = careGroups.map(g => g.id).join(',');
        const groupNames = careGroups.map(g => g.recipient_first_name).join(',');
        const selectionUrl = `${baseUrl}/enhanced-twilio-group-selection?user_id=${entity.user_id}&groups=${encodeURIComponent(groupIds)}&names=${encodeURIComponent(groupNames)}`;

        twimlResponse = `
          <?xml version="1.0" encoding="UTF-8"?>
          <Response>
            <Say voice="alice">${groupList}</Say>
            <Gather action="${selectionUrl}" method="POST" numDigits="1" timeout="10">
            </Gather>
            <Say voice="alice">I didn't receive your selection. Let me connect you to the first care group.</Say>
            <Redirect>${baseUrl}/enhanced-twilio-voice-chat?group_id=${careGroups[0].id}&user_id=${entity.user_id}&type=user</Redirect>
          </Response>
        `;
      } else {
        // Single care group or care recipient - proceed to voice chat
        const selectedGroup = careGroups[0];
        const baseUrl = `https://yfwgegapmggwywrnzqvg.functions.supabase.co`;
        let chatUrl = `${baseUrl}/enhanced-twilio-voice-chat?group_id=${selectedGroup.id}`;
        
        if (callerType === 'user') {
          chatUrl += `&user_id=${entity.user_id}&type=user`;
          var greeting = `Welcome to ${selectedGroup.recipient_first_name}'s care group, what would you like to know?`;
        } else {
          chatUrl += `&type=care_recipient`;
          var greeting = `Welcome to ${selectedGroup.recipient_first_name || 'your care group'}, what would you like to know?`;
        }

        twimlResponse = `
          <?xml version="1.0" encoding="UTF-8"?>
          <Response>
            <Say voice="alice">${greeting}</Say>
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
          .eq('id', entity.id);
      } else {
        await supabase
          .from('profiles')
          .update(updateData)
          .eq('user_id', entity.user_id);
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