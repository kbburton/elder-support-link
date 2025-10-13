import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { format, addDays, startOfDay, endOfDay } from 'https://esm.sh/date-fns@4.1.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

serve(async (req) => {
  console.log('=== Enhanced Twilio Voice Chat Request Received ===');
  console.log('Method:', req.method);
  console.log('URL:', req.url);
  console.log('Headers:', Object.fromEntries(req.headers.entries()));
  
  if (req.method === 'OPTIONS') {
    console.log('Handling CORS preflight');
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    let groupId = url.searchParams.get('group_id');
    let userId = url.searchParams.get('user_id');
    let callerType = url.searchParams.get('type');
    const groupsParam = url.searchParams.get('groups');
    const defaultGroup = url.searchParams.get('default_group');

    console.log('Voice chat parameters:', {
      groupId,
      userId,
      callerType,
      groupsParam,
      defaultGroup
    });

    // Handle care group selection for users with multiple groups
    if (callerType === 'user' && groupsParam && !groupId) {
      console.log('Processing care group selection for user');
      
      // Parse the recorded audio or use default group
      let selectedGroupId = defaultGroup;
      
      if (!selectedGroupId) {
        // In a real implementation, you would process the recorded audio
        // to determine which care group the user mentioned
        // For now, we'll use the first group
        const groupIds = groupsParam.split(',');
        selectedGroupId = groupIds[0];
      }

      // Redirect to the selected group's chat
      const chatUrl = `${req.url.split('?')[0]}?group_id=${selectedGroupId}&user_id=${userId}&type=user`;
      
      return new Response('', {
        status: 302,
        headers: {
          ...corsHeaders,
          'Location': chatUrl
        }
      });
    }

    if (!groupId && (req.headers.get('upgrade') || '').toLowerCase() !== 'websocket') {
      throw new Error('No group ID provided');
    }

    if ((req.headers.get('upgrade') || '').toLowerCase() !== 'websocket') {
      // Get care group details for non-WebSocket requests
      const { data: careGroup, error: groupError } = await supabase
        .from('care_groups')
        .select(`
          id,
          name,
          recipient_first_name,
          profile_description,
          chronic_conditions,
          mental_health,
          mobility,
          memory,
          hearing,
          vision
        `)
        .eq('id', groupId)
        .single();

      if (groupError || !careGroup) {
        throw new Error('Care group not found');
      }

      console.log('Care group found:', careGroup.name);
    }

    // Check if this is a WebSocket upgrade for real-time communication
    const upgrade = req.headers.get('upgrade') || '';
    console.log('Upgrade header value:', upgrade);
    
    if (upgrade.toLowerCase() === 'websocket') {
      console.log('=== INITIATING WEBSOCKET UPGRADE FOR TWILIO STREAM ===');
      
      try {
        const { socket, response } = Deno.upgradeWebSocket(req);
        console.log('WebSocket upgrade successful');
        
        let openaiWs: WebSocket | null = null;
        let streamSid: string | null = null;
        let currentGroupId: string | null = groupId;

        socket.onopen = () => {
          console.log('✓ Twilio WebSocket connection OPENED');
        };

      socket.onmessage = async (event) => {
        try {
          const message = JSON.parse(event.data);
          console.log('Twilio message type:', message.event);
          
          if (message.event === 'start') {
            streamSid = message.start.streamSid;
            console.log('✓ Twilio stream STARTED:', streamSid);
            console.log('Stream metadata:', message.start);
            
            // Extract custom parameters and fetch care group
            const cp = message.start.customParameters || message.start.custom_parameters || {};
            const effectiveGroupId = (cp.group_id ?? groupId) as string | null;
            const effectiveUserId = (cp.user_id ?? userId) as string | null;
            callerType = (cp.type ?? callerType) as string | null;
            currentGroupId = effectiveGroupId;
            console.log('Resolved parameters:', { effectiveGroupId, effectiveUserId, callerType });

            if (!effectiveGroupId) {
              console.error('✗ Missing group_id in custom parameters and URL');
              socket.close(1011, 'Missing group_id');
              return;
            }

            const { data: careGroup, error: groupError } = await supabase
              .from('care_groups')
              .select(`id,name,recipient_first_name,profile_description,chronic_conditions,mental_health,mobility,memory,hearing,vision`)
              .eq('id', effectiveGroupId)
              .single();

            if (groupError || !careGroup) {
              console.error('✗ Care group not found:', groupError);
              socket.close(1011, 'Care group not found');
              return;
            }
            console.log('Care group found for WS:', careGroup.name);
            
            // Initialize OpenAI connection when stream starts
            console.log('Connecting to OpenAI Realtime API...');
            const openaiKey = Deno.env.get('OPENAI_API_KEY');
            
            if (!openaiKey) {
              console.error('✗ OPENAI_API_KEY not found in environment!');
              throw new Error('OpenAI API key not configured');
            }
            
            openaiWs = new WebSocket('wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-10-01', {
              headers: {
                'Authorization': `Bearer ${openaiKey}`,
                'OpenAI-Beta': 'realtime=v1'
              }
            });

            openaiWs.onopen = () => {
              console.log('✓ Connected to OpenAI Realtime API');
              
              // Configure the session with read-only capabilities
              const sessionConfig = {
                type: 'session.update',
                session: {
                  modalities: ['text', 'audio'],
                  instructions: `You are a helpful voice assistant for ${careGroup.recipient_first_name}'s care group.
                  
                  The caller is ${callerType === 'user' ? 'a care team member' : 'the care recipient'}. 
                  You can provide READ-ONLY information about:
                  - Upcoming appointments
                  - Open tasks 
                  - Recent activities
                  - Document summaries
                  - Emergency contacts
                  
                  IMPORTANT: You can only provide information, you cannot create, modify, or delete anything.
                  
                  Care recipient profile:
                  ${careGroup.profile_description || 'No profile description available'}
                  
                  Health conditions: ${careGroup.chronic_conditions || 'None listed'}
                  Mental health: ${careGroup.mental_health || 'None listed'}
                  Mobility: ${careGroup.mobility || 'Not specified'}
                  Memory: ${careGroup.memory || 'Not specified'}
                  Hearing: ${careGroup.hearing || 'Not specified'}
                  Vision: ${careGroup.vision || 'Not specified'}
                  
                  Keep responses concise and helpful. If asked to make changes, politely explain that you can only provide information.`,
                  voice: 'alloy',
                  input_audio_format: 'g711_ulaw',
                  output_audio_format: 'g711_ulaw',
                  input_audio_transcription: {
                    model: 'whisper-1'
                  },
                  turn_detection: {
                    type: 'server_vad',
                    threshold: 0.5,
                    prefix_padding_ms: 300,
                    silence_duration_ms: 200
                  },
                  tools: [
                    {
                      type: 'function',
                      name: 'get_appointments',
                      description: 'Get upcoming appointments',
                      parameters: {
                        type: 'object',
                        properties: {
                          timeframe: {
                            type: 'string',
                            enum: ['today', 'tomorrow', 'week'],
                            description: 'Timeframe for appointments'
                          }
                        }
                      }
                    },
                    {
                      type: 'function',
                      name: 'get_tasks',
                      description: 'Get open tasks',
                      parameters: {
                        type: 'object',
                        properties: {
                          status: {
                            type: 'string',
                            enum: ['open', 'all'],
                            description: 'Task status filter'
                          }
                        }
                      }
                    },
                    {
                      type: 'function',
                      name: 'get_documents',
                      description: 'Get document summaries',
                      parameters: {
                        type: 'object',
                        properties: {
                          search_term: {
                            type: 'string',
                            description: 'Optional search term'
                          }
                        }
                      }
                    },
                    {
                      type: 'function',
                      name: 'get_contacts',
                      description: 'Get contact information',
                      parameters: {
                        type: 'object',
                        properties: {
                          type: {
                            type: 'string',
                            enum: ['medical', 'emergency', 'all'],
                            description: 'Type of contacts to retrieve'
                          }
                        }
                      }
                    },
                    {
                      type: 'function',
                      name: 'get_recent_activities',
                      description: 'Get recent activities',
                      parameters: {
                        type: 'object',
                        properties: {}
                      }
                    }
                  ]
                }
              };
              
              if (openaiWs) {
                openaiWs.send(JSON.stringify(sessionConfig));
              }
            };

            openaiWs.onmessage = async (event) => {
              try {
                const data = JSON.parse(event.data);
                console.log('OpenAI event:', data.type);
                
                if (data.type === 'response.audio.delta') {
                  // Forward audio to Twilio
                  const audioMessage = {
                    event: 'media',
                    streamSid: streamSid,
                    media: {
                      payload: data.delta
                    }
                  };
                  socket.send(JSON.stringify(audioMessage));
                } else if (data.type === 'response.function_call_arguments.done') {
                  // Handle function calls for data retrieval
                  await handleFunctionCall(data, currentGroupId as string, openaiWs);
                }
              } catch (error) {
                console.error('Error processing OpenAI message:', error);
              }
            };

            openaiWs.onerror = (error) => {
              console.error('✗ OpenAI WebSocket ERROR:', error);
            };

            openaiWs.onclose = (event) => {
              console.log('✗ OpenAI WebSocket CLOSED:', {
                code: event.code,
                reason: event.reason,
                wasClean: event.wasClean
              });
            };
          } else if (message.event === 'media' && openaiWs) {
            // Forward audio from Twilio to OpenAI
            const audioMessage = {
              type: 'input_audio_buffer.append',
              audio: message.media.payload
            };
            openaiWs.send(JSON.stringify(audioMessage));
          } else if (message.event === 'stop') {
            console.log('Twilio stream stopped');
            if (openaiWs) {
              openaiWs.close();
            }
          }
        } catch (error) {
          console.error('Error processing Twilio message:', error);
        }
      };

      socket.onerror = (error) => {
        console.error('✗ Twilio WebSocket ERROR:', error);
      };

      socket.onclose = (event) => {
        console.log('✗ Twilio WebSocket CLOSED:', {
          code: event.code,
          reason: event.reason,
          wasClean: event.wasClean
        });
        if (openaiWs && openaiWs.readyState === WebSocket.OPEN) {
          console.log('Closing OpenAI WebSocket');
          openaiWs.close();
        }
      };

      console.log('Returning WebSocket upgrade response');
      return response;
      } catch (upgradeError) {
        console.error('✗ WebSocket upgrade FAILED:', upgradeError);
        throw upgradeError;
      }
    }

    // If not WebSocket, return basic response
    console.log('Not a WebSocket request, returning basic response');
    return new Response('Enhanced Voice Chat endpoint - Ready for WebSocket connections', {
      headers: corsHeaders
    });

  } catch (error) {
    console.error('Error in enhanced voice chat:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  }
});

// Function call handler
async function handleFunctionCall(data: any, careGroupId: string, openaiWs: WebSocket | null) {
  if (!openaiWs || data.type !== 'response.function_call_arguments.done') return;
  
  console.log('Handling function call:', data.name);

  let result = '';
  let args: any = {};
  
  try {
    // Parse arguments if they're a string
    if (typeof data.arguments === 'string') {
      args = JSON.parse(data.arguments);
    } else {
      args = data.arguments || {};
    }
  } catch (error) {
    console.error('Error parsing function arguments:', error);
  }
  
  try {
    switch (data.name) {
      case 'get_appointments':
        const timeframe = args.timeframe || 'week';
        result = await getAppointments(careGroupId, timeframe);
        break;
      case 'get_tasks':
        const status = args.status || 'open';
        result = await getTasks(careGroupId, status);
        break;
      case 'get_documents':
        const searchTerm = args.search_term;
        result = await getDocuments(careGroupId, searchTerm);
        break;
      case 'get_contacts':
        const type = args.type || 'all';
        result = await getContacts(careGroupId, type);
        break;
      case 'get_recent_activities':
        result = await getRecentActivities(careGroupId);
        break;
      default:
        result = 'Unknown function requested.';
    }
  } catch (error) {
    console.error('Error in function call:', error);
    result = 'Sorry, I encountered an error retrieving that information.';
  }

  // Send function result back to OpenAI
  const functionResponse = {
    type: 'conversation.item.create',
    item: {
      type: 'function_call_output',
      call_id: data.call_id,
      output: result
    }
  };
  
  openaiWs.send(JSON.stringify(functionResponse));
  
  // Request a new response after providing the function output
  openaiWs.send(JSON.stringify({ type: 'response.create' }));
}

// Data access functions (read-only versions)
async function getAppointments(careGroupId: string, timeframe: string): Promise<string> {
  try {
    const startDate = startOfDay(new Date());
    const endDate = endOfDay(addDays(new Date(), 7));

    const { data, error } = await supabase
      .from('appointments')
      .select(`
        id,
        description,
        date_time,
        category,
        street_address,
        city,
        state
      `)
      .eq('group_id', careGroupId)
      .eq('is_deleted', false)
      .gte('date_time', startDate.toISOString())
      .lte('date_time', endDate.toISOString())
      .order('date_time', { ascending: true })
      .limit(5);

    if (error) {
      console.error('Error fetching appointments:', error);
      return 'Sorry, I could not retrieve appointment information at this time.';
    }

    const appointments = (data || []).map(appointment => ({
      id: appointment.id,
      description: appointment.description || 'Appointment',
      dateTime: appointment.date_time,
      category: appointment.category || '',
      streetAddress: appointment.street_address || undefined,
      city: appointment.city || undefined,
      state: appointment.state || undefined
    }));
    
    if (appointments.length === 0) {
      return 'No upcoming appointments found.';
    }

    let response = 'Here are the upcoming appointments: ';
    appointments.forEach((apt, index) => {
      const date = new Date(apt.dateTime).toLocaleDateString();
      const time = new Date(apt.dateTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
      response += `${index + 1}. ${apt.description} on ${date} at ${time}`;
      if (apt.streetAddress) {
        response += ` at ${apt.streetAddress}`;
      }
      response += '. ';
    });

    return response;
  } catch (error) {
    console.error('Error in getAppointments:', error);
    return 'Sorry, I could not retrieve appointment information at this time.';
  }
}

async function getTasks(careGroupId: string, status: string): Promise<string> {
  try {
    const { data, error } = await supabase
      .from('tasks')
      .select(`
        id,
        title,
        description,
        due_date,
        priority,
        primary_owner_id,
        profiles!tasks_primary_owner_id_fkey(first_name, last_name)
      `)
      .eq('group_id', careGroupId)
      .eq('is_deleted', false)
      .neq('status', 'Completed')
      .order('due_date', { ascending: true, nullsFirst: false })
      .limit(10);

    if (error) {
      console.error('Error fetching tasks:', error);
      return 'Sorry, I could not retrieve task information at this time.';
    }

    const tasks = (data || []).map(task => ({
      id: task.id,
      title: task.title || 'Untitled Task',
      description: task.description || undefined,
      dueDate: task.due_date || undefined,
      priority: task.priority || 'medium',
      assignedToName: task.profiles ? `${task.profiles.first_name || ''} ${task.profiles.last_name || ''}`.trim() : undefined
    }));
    
    if (tasks.length === 0) {
      return 'No open tasks found.';
    }

    let response = 'Here are the open tasks: ';
    tasks.forEach((task, index) => {
      response += `${index + 1}. ${task.title}`;
      if (task.dueDate) {
        const dueDate = new Date(task.dueDate).toLocaleDateString();
        response += ` due ${dueDate}`;
      }
      if (task.assignedToName) {
        response += ` assigned to ${task.assignedToName}`;
      }
      response += '. ';
    });

    return response;
  } catch (error) {
    console.error('Error in getTasks:', error);
    return 'Sorry, I could not retrieve task information at this time.';
  }
}

async function getDocuments(careGroupId: string, searchTerm?: string): Promise<string> {
  try {
    const { data, error } = await supabase
      .from('documents')
      .select(`
        id,
        title,
        summary,
        category,
        upload_date
      `)
      .eq('group_id', careGroupId)
      .eq('is_deleted', false)
      .not('summary', 'is', null)
      .order('upload_date', { ascending: false })
      .limit(5);

    if (error) {
      console.error('Error fetching documents:', error);
      return 'Sorry, I could not retrieve document information at this time.';
    }

    const documents = (data || []).map(doc => ({
      id: doc.id,
      title: doc.title || 'Untitled Document',
      summary: doc.summary || undefined,
      category: doc.category || undefined,
      uploadDate: doc.upload_date
    }));
    
    if (documents.length === 0) {
      return 'No documents found.';
    }

    let response = 'Here are recent documents: ';
    documents.slice(0, 3).forEach((doc, index) => {
      response += `${index + 1}. ${doc.title}`;
      if (doc.summary) {
        response += `: ${doc.summary.substring(0, 100)}...`;
      }
      response += '. ';
    });

    return response;
  } catch (error) {
    console.error('Error in getDocuments:', error);
    return 'Sorry, I could not retrieve document information at this time.';
  }
}

async function getContacts(careGroupId: string, type?: string): Promise<string> {
  try {
    const { data, error } = await supabase
      .from('contacts')
      .select(`
        id,
        first_name,
        last_name,
        phone_primary,
        phone_secondary,
        organization_name
      `)
      .eq('care_group_id', careGroupId)
      .eq('is_deleted', false)
      .eq('contact_type', 'medical')
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (error || !data) {
      return 'No primary care physician contact found.';
    }

    const pcp = {
      id: data.id,
      firstName: data.first_name || '',
      lastName: data.last_name || '',
      phonePrimary: data.phone_primary || undefined,
      phoneSecondary: data.phone_secondary || undefined,
      organizationName: data.organization_name || undefined
    };

    let response = `Primary care physician: ${pcp.firstName} ${pcp.lastName}`;
    if (pcp.organizationName) {
      response += ` at ${pcp.organizationName}`;
    }
    if (pcp.phonePrimary) {
      response += `. Phone: ${pcp.phonePrimary}`;
    }
    response += '.';

    return response;
  } catch (error) {
    console.error('Error in getContacts:', error);
    return 'Sorry, I could not retrieve contact information at this time.';
  }
}

async function getRecentActivities(careGroupId: string): Promise<string> {
  try {
    const startDate = startOfDay(addDays(new Date(), -7));

    const { data, error } = await supabase
      .from('activity_logs')
      .select(`
        id,
        title,
        type,
        date_time,
        notes
      `)
      .eq('group_id', careGroupId)
      .eq('is_deleted', false)
      .gte('date_time', startDate.toISOString())
      .order('date_time', { ascending: false })
      .limit(5);

    if (error) {
      console.error('Error fetching activities:', error);
      return 'Sorry, I could not retrieve activity information at this time.';
    }

    const activities = (data || []).map(activity => ({
      id: activity.id,
      title: activity.title || undefined,
      type: activity.type || undefined,
      dateTime: activity.date_time,
      notes: activity.notes || undefined
    }));
    
    if (activities.length === 0) {
      return 'No recent activities found.';
    }

    let response = 'Here are recent activities: ';
    activities.forEach((activity, index) => {
      const date = new Date(activity.dateTime).toLocaleDateString();
      response += `${index + 1}. ${activity.title || activity.type || 'Activity'} on ${date}`;
      if (activity.notes) {
        response += `: ${activity.notes.substring(0, 50)}...`;
      }
      response += '. ';
    });

    return response;
  } catch (error) {
    console.error('Error in getRecentActivities:', error);
    return 'Sorry, I could not retrieve activity information at this time.';
  }
}