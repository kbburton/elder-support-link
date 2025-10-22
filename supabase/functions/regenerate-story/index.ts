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

    const { storyId, promptId } = await req.json();
    
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

    // Get the prompt to use
    let systemPrompt: string;
    let finalPromptId = promptId;

    if (promptId) {
      // Use specified prompt
      const { data: prompt, error: promptError } = await supabaseClient
        .from('story_generation_prompts')
        .select('prompt_text')
        .eq('id', promptId)
        .single();

      if (promptError) throw new Error(`Prompt not found: ${promptError.message}`);
      systemPrompt = prompt.prompt_text;
    } else {
      // Get default prompt
      const { data: defaultPrompt, error: defaultError } = await supabaseClient
        .from('story_generation_prompts')
        .select('id, prompt_text')
        .eq('is_default', true)
        .single();

      if (defaultError) throw new Error(`No default prompt found: ${defaultError.message}`);
      systemPrompt = defaultPrompt.prompt_text;
      finalPromptId = defaultPrompt.id;
    }

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
        prompt_id: finalPromptId,
        prompt_text_used: systemPrompt,
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
        prompt_id: finalPromptId,
        prompt_text_used: systemPrompt,
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
