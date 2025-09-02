import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.54.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Initialize Supabase client
const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const careGroupId = url.searchParams.get('careGroupId');
  const callSid = url.searchParams.get('callSid');

  if (!careGroupId) {
    return new Response('Missing careGroupId', { status: 400 });
  }

  try {
    console.log('Starting voice chat for care group:', careGroupId);

    // Get care group information for context
    const { data: careGroup, error: careGroupError } = await supabase
      .from('care_groups')
      .select(`
        id, name, recipient_first_name, recipient_last_name,
        profile_description, chronic_conditions, mobility, memory, hearing, vision
      `)
      .eq('id', careGroupId)
      .single();

    if (careGroupError || !careGroup) {
      throw new Error('Care group not found');
    }

    // Set up WebSocket upgrade for Twilio Media Stream
    if (req.headers.get("upgrade") !== "websocket") {
      return new Response("Expected WebSocket upgrade", { status: 400 });
    }

    const { socket, response } = Deno.upgradeWebSocket(req);

    // OpenAI Realtime API WebSocket
    let openaiWs: WebSocket | null = null;
    let isConnected = false;

    socket.onopen = async () => {
      console.log('Twilio WebSocket connected');
      
      try {
        // Connect to OpenAI Realtime API
        const openaiUrl = `wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-12-17`;
        openaiWs = new WebSocket(openaiUrl, {
          headers: {
            'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}`,
            'OpenAI-Beta': 'realtime=v1'
          }
        });

        openaiWs.onopen = () => {
          console.log('Connected to OpenAI Realtime API');
          isConnected = true;

          // Send session configuration
          const sessionConfig = {
            type: 'session.update',
            session: {
              modalities: ['text', 'audio'],
              instructions: `You are a professional healthcare assistant for ${careGroup.recipient_first_name} ${careGroup.recipient_last_name}. 

Patient Profile:
- Name: ${careGroup.recipient_first_name} ${careGroup.recipient_last_name}
- Description: ${careGroup.profile_description || 'No description available'}
- Chronic Conditions: ${careGroup.chronic_conditions || 'None listed'}
- Mobility: ${careGroup.mobility || 'Not specified'}
- Memory: ${careGroup.memory || 'Not specified'}
- Hearing: ${careGroup.hearing || 'Not specified'}
- Vision: ${careGroup.vision || 'Not specified'}

You can help with:
1. Upcoming appointments (next 60 days) and past appointments (last 30 days)
2. Open tasks and completed tasks
3. Recent documents and their summaries
4. Contact information for healthcare providers
5. Recent activities and care notes

Be warm, professional, and concise. Ask clarifying questions when needed. When providing information, be specific about dates and details. If you need to call functions to get information, let the user know you're looking that up for them.

Keep responses conversational and under 50 words unless providing detailed information that was specifically requested.`,
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
                silence_duration_ms: 1000
              },
              tools: [
                {
                  type: 'function',
                  name: 'get_appointments',
                  description: 'Get upcoming or past appointments for the care recipient',
                  parameters: {
                    type: 'object',
                    properties: {
                      timeframe: { 
                        type: 'string', 
                        enum: ['upcoming', 'past'],
                        description: 'Whether to get upcoming or past appointments'
                      }
                    },
                    required: ['timeframe']
                  }
                },
                {
                  type: 'function',
                  name: 'get_tasks',
                  description: 'Get tasks for the care recipient',
                  parameters: {
                    type: 'object',
                    properties: {
                      status: { 
                        type: 'string', 
                        enum: ['all', 'open', 'completed'],
                        description: 'Filter tasks by status'
                      }
                    },
                    required: ['status']
                  }
                },
                {
                  type: 'function',
                  name: 'get_documents',
                  description: 'Search for documents by title or filename',
                  parameters: {
                    type: 'object',
                    properties: {
                      search_term: { 
                        type: 'string', 
                        description: 'Search term for document titles or filenames'
                      }
                    }
                  }
                },
                {
                  type: 'function',
                  name: 'get_contacts',
                  description: 'Get contact information, especially for healthcare providers',
                  parameters: {
                    type: 'object',
                    properties: {
                      type: { 
                        type: 'string', 
                        description: 'Type of contact (e.g., doctor, healthcare, emergency)'
                      }
                    }
                  }
                },
                {
                  type: 'function',
                  name: 'get_recent_activities',
                  description: 'Get recent care activities and notes',
                  parameters: {
                    type: 'object',
                    properties: {}
                  }
                }
              ],
              tool_choice: 'auto',
              temperature: 0.7
            }
          };

          openaiWs!.send(JSON.stringify(sessionConfig));
        };

        openaiWs.onmessage = (event) => {
          const data = JSON.parse(event.data);
          console.log('OpenAI event type:', data.type);

          if (data.type === 'session.created') {
            console.log('OpenAI session created');
          } else if (data.type === 'response.audio.delta') {
            // Send audio back to Twilio
            const audioMessage = {
              event: 'media',
              streamSid: callSid,
              media: {
                payload: data.delta
              }
            };
            socket.send(JSON.stringify(audioMessage));
          } else if (data.type === 'response.function_call_arguments.done') {
            // Handle function calls
            handleFunctionCall(data, careGroupId, openaiWs!);
          }
        };

        openaiWs.onclose = () => {
          console.log('OpenAI WebSocket closed');
          isConnected = false;
        };

        openaiWs.onerror = (error) => {
          console.error('OpenAI WebSocket error:', error);
          isConnected = false;
        };

      } catch (error) {
        console.error('Error connecting to OpenAI:', error);
      }
    };

    socket.onmessage = (event) => {
      const data = JSON.parse(event.data);
      
      if (data.event === 'media' && isConnected && openaiWs) {
        // Forward audio from Twilio to OpenAI
        const audioEvent = {
          type: 'input_audio_buffer.append',
          audio: data.media.payload
        };
        openaiWs.send(JSON.stringify(audioEvent));
      }
    };

    socket.onclose = () => {
      console.log('Twilio WebSocket closed');
      if (openaiWs) {
        openaiWs.close();
      }
    };

    return response;

  } catch (error) {
    console.error('Error in voice chat:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

// Handle function calls from OpenAI
async function handleFunctionCall(data: any, careGroupId: string, openaiWs: WebSocket) {
  const { call_id, name: functionName, arguments: args } = data;
  const parsedArgs = JSON.parse(args);
  
  console.log('Function call:', functionName, parsedArgs);

  try {
    let result = '';

    switch (functionName) {
      case 'get_appointments':
        result = await getAppointments(careGroupId, parsedArgs.timeframe);
        break;
      case 'get_tasks':
        result = await getTasks(careGroupId, parsedArgs.status);
        break;
      case 'get_documents':
        result = await getDocuments(careGroupId, parsedArgs.search_term);
        break;
      case 'get_contacts':
        result = await getContacts(careGroupId, parsedArgs.type);
        break;
      case 'get_recent_activities':
        result = await getRecentActivities(careGroupId);
        break;
      default:
        result = 'Function not implemented';
    }

    // Send function result back to OpenAI
    const functionResult = {
      type: 'conversation.item.create',
      item: {
        type: 'function_call_output',
        call_id,
        output: result
      }
    };

    openaiWs.send(JSON.stringify(functionResult));
    openaiWs.send(JSON.stringify({ type: 'response.create' }));

  } catch (error) {
    console.error('Function call error:', error);
    const errorResult = {
      type: 'conversation.item.create',
      item: {
        type: 'function_call_output',
        call_id,
        output: `Error: ${error.message}`
      }
    };
    openaiWs.send(JSON.stringify(errorResult));
  }
}

// Data access functions
async function getAppointments(careGroupId: string, timeframe: string): Promise<string> {
  const now = new Date();
  let dateFilter = '';
  
  if (timeframe === 'upcoming') {
    const futureDate = new Date(now.getTime() + (60 * 24 * 60 * 60 * 1000)); // 60 days ahead
    dateFilter = `date_time.gte.${now.toISOString()}&date_time.lte.${futureDate.toISOString()}`;
  } else {
    const pastDate = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000)); // 30 days ago
    dateFilter = `date_time.gte.${pastDate.toISOString()}&date_time.lte.${now.toISOString()}`;
  }

  const { data: appointments, error } = await supabase
    .from('appointments')
    .select('description, date_time, category, street_address, outcome_notes')
    .eq('group_id', careGroupId)
    .eq('is_deleted', false)
    .order('date_time', { ascending: timeframe === 'upcoming' })
    .limit(5);

  if (error || !appointments?.length) {
    return `No ${timeframe} appointments found.`;
  }

  const appointmentList = appointments.map(apt => {
    const date = new Date(apt.date_time).toLocaleDateString();
    const time = new Date(apt.date_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return `${apt.description || 'Appointment'} on ${date} at ${time}${apt.category ? ` (${apt.category})` : ''}${apt.street_address ? ` at ${apt.street_address}` : ''}`;
  }).join('. ');

  return `${timeframe === 'upcoming' ? 'Upcoming' : 'Recent'} appointments: ${appointmentList}`;
}

async function getTasks(careGroupId: string, status: string): Promise<string> {
  let query = supabase
    .from('tasks')
    .select('title, description, due_date, completed_at, priority')
    .eq('group_id', careGroupId)
    .eq('is_deleted', false);

  if (status === 'open') {
    query = query.is('completed_at', null);
  } else if (status === 'completed') {
    query = query.not('completed_at', 'is', null);
  }

  const { data: tasks, error } = await query
    .order('due_date', { ascending: true, nullsLast: true })
    .limit(5);

  if (error || !tasks?.length) {
    return `No ${status} tasks found.`;
  }

  const taskList = tasks.map(task => {
    const dueText = task.due_date ? ` due ${new Date(task.due_date).toLocaleDateString()}` : '';
    const completedText = task.completed_at ? ` completed ${new Date(task.completed_at).toLocaleDateString()}` : '';
    const priorityText = task.priority && task.priority !== 'medium' ? ` (${task.priority} priority)` : '';
    return `${task.title}${dueText}${completedText}${priorityText}`;
  }).join('. ');

  return `${status === 'all' ? 'All' : status === 'open' ? 'Open' : 'Completed'} tasks: ${taskList}`;
}

async function getDocuments(careGroupId: string, searchTerm?: string): Promise<string> {
  let query = supabase
    .from('documents')
    .select('title, original_filename, summary, upload_date, category')
    .eq('group_id', careGroupId)
    .eq('is_deleted', false);

  if (searchTerm) {
    query = query.or(`title.ilike.%${searchTerm}%,original_filename.ilike.%${searchTerm}%`);
  }

  const { data: documents, error } = await query
    .order('upload_date', { ascending: false })
    .limit(5);

  if (error || !documents?.length) {
    return searchTerm ? `No documents found matching "${searchTerm}".` : 'No documents found.';
  }

  const docList = documents.map(doc => {
    const name = doc.title || doc.original_filename || 'Untitled Document';
    const date = new Date(doc.upload_date).toLocaleDateString();
    const summary = doc.summary ? ` - ${doc.summary.substring(0, 100)}...` : '';
    return `${name} (uploaded ${date})${summary}`;
  }).join('. ');

  return `Documents: ${docList}`;
}

async function getContacts(careGroupId: string, type?: string): Promise<string> {
  let query = supabase
    .from('contacts')
    .select('first_name, last_name, organization_name, contact_type, phone_primary, email_personal, title')
    .eq('care_group_id', careGroupId)
    .eq('is_deleted', false);

  if (type) {
    query = query.or(`contact_type.ilike.%${type}%,title.ilike.%${type}%,organization_name.ilike.%${type}%`);
  }

  const { data: contacts, error } = await query
    .order('contact_type')
    .limit(5);

  if (error || !contacts?.length) {
    return type ? `No contacts found for "${type}".` : 'No contacts found.';
  }

  const contactList = contacts.map(contact => {
    const name = contact.organization_name || `${contact.first_name || ''} ${contact.last_name || ''}`.trim();
    const title = contact.title ? ` (${contact.title})` : '';
    const phone = contact.phone_primary ? ` at ${contact.phone_primary}` : '';
    return `${name}${title}${phone}`;
  }).join('. ');

  return `Contacts: ${contactList}`;
}

async function getRecentActivities(careGroupId: string): Promise<string> {
  const weekAgo = new Date(Date.now() - (7 * 24 * 60 * 60 * 1000));

  const { data: activities, error } = await supabase
    .from('activity_logs')
    .select('title, type, notes, date_time')
    .eq('group_id', careGroupId)
    .eq('is_deleted', false)
    .gte('date_time', weekAgo.toISOString())
    .order('date_time', { ascending: false })
    .limit(5);

  if (error || !activities?.length) {
    return 'No recent activities found.';
  }

  const activityList = activities.map(activity => {
    const date = new Date(activity.date_time).toLocaleDateString();
    const title = activity.title || activity.type || 'Activity';
    const notes = activity.notes ? ` - ${activity.notes.substring(0, 50)}...` : '';
    return `${title} on ${date}${notes}`;
  }).join('. ');

  return `Recent activities: ${activityList}`;
}