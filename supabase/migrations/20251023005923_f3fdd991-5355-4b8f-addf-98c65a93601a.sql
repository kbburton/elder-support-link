-- Create voice_interview_config table
CREATE TABLE voice_interview_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- One config per care group (UNIQUE constraint enforces this)
  care_group_id UUID NOT NULL UNIQUE REFERENCES care_groups(id) ON DELETE CASCADE,
  
  -- VAD (Voice Activity Detection) Settings
  vad_threshold DECIMAL(3,2) NOT NULL DEFAULT 0.5 
    CHECK (vad_threshold >= 0.0 AND vad_threshold <= 1.0),
  vad_silence_duration_ms INTEGER NOT NULL DEFAULT 2500 
    CHECK (vad_silence_duration_ms >= 500 AND vad_silence_duration_ms <= 10000),
  vad_prefix_padding_ms INTEGER NOT NULL DEFAULT 500 
    CHECK (vad_prefix_padding_ms >= 100 AND vad_prefix_padding_ms <= 2000),
  
  -- AI Behavior Settings
  temperature DECIMAL(3,2) NOT NULL DEFAULT 0.7 
    CHECK (temperature >= 0.0 AND temperature <= 1.0),
  response_style_instructions TEXT NOT NULL DEFAULT 'Keep your responses brief - maximum 1-2 sentences. Ask one focused follow-up question at a time. Wait patiently for the person to finish their thoughts.',
  
  -- Audit fields
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  last_modified_by_user_id UUID REFERENCES auth.users(id),
  
  CONSTRAINT fk_care_group FOREIGN KEY (care_group_id) 
    REFERENCES care_groups(id) ON DELETE CASCADE
);

-- Index for performance
CREATE INDEX idx_voice_config_care_group ON voice_interview_config(care_group_id);

-- Enable RLS
ALTER TABLE voice_interview_config ENABLE ROW LEVEL SECURITY;

-- RLS: All care group members can view config
CREATE POLICY "Care group members can view voice config"
  ON voice_interview_config FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM care_group_members cgm
    WHERE cgm.group_id = voice_interview_config.care_group_id
    AND cgm.user_id = auth.uid()
  ));

-- RLS: Care group admins and system admins can manage config
CREATE POLICY "Admins can manage voice config"
  ON voice_interview_config FOR ALL
  USING (
    is_system_admin() OR
    EXISTS (
      SELECT 1 FROM care_group_members cgm
      WHERE cgm.group_id = voice_interview_config.care_group_id
      AND cgm.user_id = auth.uid()
      AND cgm.is_admin = true
    )
  )
  WITH CHECK (
    is_system_admin() OR
    EXISTS (
      SELECT 1 FROM care_group_members cgm
      WHERE cgm.group_id = voice_interview_config.care_group_id
      AND cgm.user_id = auth.uid()
      AND cgm.is_admin = true
    )
  );

-- Trigger: Auto-create default config when care group is created
CREATE OR REPLACE FUNCTION create_default_voice_config()
RETURNS TRIGGER AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_create_default_voice_config
  AFTER INSERT ON care_groups
  FOR EACH ROW
  EXECUTE FUNCTION create_default_voice_config();

-- Backfill: Create default configs for existing care groups
INSERT INTO voice_interview_config (
  care_group_id,
  vad_threshold,
  vad_silence_duration_ms,
  vad_prefix_padding_ms,
  temperature,
  response_style_instructions
)
SELECT 
  id,
  0.5,
  2500,
  500,
  0.7,
  'Keep your responses brief - maximum 1-2 sentences. Ask one focused follow-up question at a time. Wait patiently for the person to finish their thoughts.'
FROM care_groups
WHERE id NOT IN (SELECT care_group_id FROM voice_interview_config);