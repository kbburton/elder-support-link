import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    if (!OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY is not configured');
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { storyId, customPrompt } = await req.json();
    
    if (!storyId) {
      throw new Error('Story ID is required');
    }

    // Fetch the story and its associated interview
    const { data: story, error: storyError } = await supabaseClient
      .from('memory_stories')
      .select(`
        *,
        memory_interviews (
          id,
          transcript,
          care_groups (
            loved_one_first_name,
            loved_one_last_name,
            loved_one_relationship
          )
        )
      `)
      .eq('id', storyId)
      .single();

    if (storyError || !story) {
      throw new Error(`Story not found: ${storyError?.message}`);
    }

    const interview = story.memory_interviews;
    if (!interview || !interview.transcript) {
      throw new Error('Interview transcript not found');
    }

    // Use custom prompt if provided, otherwise use default
    const systemPrompt = customPrompt || `You are a factual family biographer who writes short third-person vignettes about a person's life based on interview transcripts with an AI interviewer.

Your job:
- Write an engaging short story that feels human, warm, and vivid but always grounded in facts stated or logically inferred from the transcript.
- You may infer timing and context (e.g., if he was six in 1942, mention wartime life), but you must not invent fictional people, dialogue, or events.
- Treat each story as part of a larger biography but make it self-contained.
- Never begin with birth details unless relevant to that vignette.
- Maintain a consistent, respectful tone suitable for a family storybook.
- If details are missing, write naturally around the gaps rather than fabricating content.
- The narrator's voice is third-person.

Return your response as a JSON object with this structure:
{
  "title": "A short, evocative title for the story",
  "story": "The complete story text",
  "memory_facts": ["fact1", "fact2", "fact3"]
}`;

    const recipientName = interview.care_groups?.loved_one_first_name 
      ? `${interview.care_groups.loved_one_first_name} ${interview.care_groups.loved_one_last_name || ''}`.trim()
      : 'the person';
    
    const relationship = interview.care_groups?.loved_one_relationship || 'family member';

    const userPrompt = `Create a biographical story about ${recipientName} (${relationship}) based on this interview transcript:

${interview.transcript}

Remember to:
1. Stay factual - only include information directly stated or logically inferred
2. Write in third person
3. Make it engaging and warm
4. Extract key facts for the memory_facts array`;

    console.log('Generating story with OpenAI for story:', storyId);

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        response_format: { type: "json_object" },
        max_tokens: 2000,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`OpenAI API error: ${response.status} - ${errorText}`);
      throw new Error(`Story generation failed: ${response.statusText}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error('No content received from OpenAI');
    }

    const parsedContent = JSON.parse(content);
    const newTitle = parsedContent.title || story.title;
    const newStoryText = parsedContent.story || 'Story could not be generated.';
    const memoryFacts = parsedContent.memory_facts || [];

    // Create a new version
    const { error: versionError } = await supabaseClient
      .from('memory_story_versions')
      .insert({
        story_id: storyId,
        version_number: (story.current_version || 1) + 1,
        title: newTitle,
        story_text: newStoryText,
        memory_facts: memoryFacts,
        created_by: story.created_by,
      });

    if (versionError) {
      console.error('Failed to create story version:', versionError);
    }

    // Update the story
    const { error: updateError } = await supabaseClient
      .from('memory_stories')
      .update({ 
        title: newTitle,
        story_text: newStoryText,
        memory_facts: memoryFacts,
        current_version: (story.current_version || 1) + 1,
      })
      .eq('id', storyId);

    if (updateError) {
      throw new Error(`Failed to update story: ${updateError.message}`);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        title: newTitle,
        story_text: newStoryText,
        memory_facts: memoryFacts,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in regenerate-story function:', error);
    return new Response(
      JSON.stringify({ error: error.message, success: false }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
