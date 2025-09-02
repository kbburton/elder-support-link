import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

// Import the same data access functions from the voice data file
import {
  getUpcomingAppointments,
  getPcpContact,
  getOpenTasks,
  getDocumentSummaries,
  getRecentActivities
} from '../twilio-voice-chat/index.ts';

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
    console.log('Enhanced Twilio Voice Chat called');
    
    const url = new URL(req.url);
    const groupId = url.searchParams.get('group_id');
    const userId = url.searchParams.get('user_id');
    const callerType = url.searchParams.get('type'); // 'user' or 'care_recipient'
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

    if (!groupId) {
      throw new Error('No group ID provided');
    }

    // Get care group details
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

    // Check if this is a WebSocket upgrade for real-time communication
    const upgrade = req.headers.get('upgrade') || '';
    if (upgrade.toLowerCase() === 'websocket') {
      console.log('WebSocket connection requested');
      
      const { socket, response } = Deno.upgradeWebSocket(req);

      socket.onopen = async () => {
        console.log('WebSocket connected for enhanced voice chat');
        
        // Set up OpenAI connection similar to the original implementation
        const openaiWs = new WebSocket('wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-10-01', {
          headers: {
            'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}`,
            'OpenAI-Beta': 'realtime=v1'
          }
        });

        openaiWs.onopen = () => {
          console.log('Connected to OpenAI Realtime API');
          
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
          
          openaiWs.send(JSON.stringify(sessionConfig));
        };

        openaiWs.onmessage = async (event) => {
          const data = JSON.parse(event.data);
          
          if (data.type === 'response.audio.delta') {
            // Forward audio to Twilio
            const audioMessage = {
              event: 'media',
              media: {
                payload: data.delta
              }
            };
            socket.send(JSON.stringify(audioMessage));
          } else if (data.type === 'response.function_call_delta') {
            // Handle function calls for data retrieval
            await handleFunctionCall(data, groupId, openaiWs);
          }
        };

        socket.onmessage = (event) => {
          const message = JSON.parse(event.data);
          
          if (message.event === 'media') {
            // Forward audio from Twilio to OpenAI
            const audioMessage = {
              type: 'input_audio_buffer.append',
              audio: message.media.payload
            };
            openaiWs.send(JSON.stringify(audioMessage));
          } else if (message.event === 'start') {
            console.log('Twilio media stream started');
          }
        };

        socket.onclose = () => {
          console.log('WebSocket closed');
          if (openaiWs.readyState === WebSocket.OPEN) {
            openaiWs.close();
          }
        };
      };

      return response;
    }

    // If not WebSocket, return basic response
    return new Response('Enhanced Voice Chat endpoint', {
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

// Function call handler (same as original but with read-only emphasis)
async function handleFunctionCall(data: any, careGroupId: string, openaiWs: WebSocket) {
  if (data.type !== 'response.function_call_delta' || !data.name) return;

  let result = '';
  
  try {
    switch (data.name) {
      case 'get_appointments':
        const timeframe = data.arguments?.timeframe || 'week';
        result = await getAppointments(careGroupId, timeframe);
        break;
      case 'get_tasks':
        const status = data.arguments?.status || 'open';
        result = await getTasks(careGroupId, status);
        break;
      case 'get_documents':
        const searchTerm = data.arguments?.search_term;
        result = await getDocuments(careGroupId, searchTerm);
        break;
      case 'get_contacts':
        const type = data.arguments?.type || 'all';
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
}

// Data access functions (read-only versions)
async function getAppointments(careGroupId: string, timeframe: string): Promise<string> {
  try {
    const appointments = await getUpcomingAppointments(careGroupId);
    
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
    return 'Sorry, I could not retrieve appointment information at this time.';
  }
}

async function getTasks(careGroupId: string, status: string): Promise<string> {
  try {
    const tasks = await getOpenTasks(careGroupId);
    
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
    return 'Sorry, I could not retrieve task information at this time.';
  }
}

async function getDocuments(careGroupId: string, searchTerm?: string): Promise<string> {
  try {
    const documents = await getDocumentSummaries(careGroupId);
    
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
    return 'Sorry, I could not retrieve document information at this time.';
  }
}

async function getContacts(careGroupId: string, type?: string): Promise<string> {
  try {
    const pcp = await getPcpContact(careGroupId);
    
    if (!pcp) {
      return 'No primary care physician contact found.';
    }

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
    return 'Sorry, I could not retrieve contact information at this time.';
  }
}

async function getRecentActivities(careGroupId: string): Promise<string> {
  try {
    const activities = await getRecentActivities(careGroupId);
    
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
    return 'Sorry, I could not retrieve activity information at this time.';
  }
}