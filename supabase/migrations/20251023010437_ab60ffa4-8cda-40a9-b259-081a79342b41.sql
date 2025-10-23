-- Fix search_path security warning by recreating trigger and function
DROP TRIGGER IF EXISTS trigger_create_default_voice_config ON care_groups;
DROP FUNCTION IF EXISTS create_default_voice_config();

CREATE OR REPLACE FUNCTION create_default_voice_config()
RETURNS TRIGGER 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO voice_interview_config (
    care_group_id,
    vad_threshold,
    vad_silence_duration_ms,
    vad_prefix_padding_ms,
    temperature,
    response_style_instructions
  ) VALUES (
    NEW.id,
    0.5,
    2500,
    500,
    0.7,
    'Keep your responses brief - maximum 1-2 sentences. Ask one focused follow-up question at a time. Wait patiently for the person to finish their thoughts.'
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_create_default_voice_config
  AFTER INSERT ON care_groups
  FOR EACH ROW
  EXECUTE FUNCTION create_default_voice_config();