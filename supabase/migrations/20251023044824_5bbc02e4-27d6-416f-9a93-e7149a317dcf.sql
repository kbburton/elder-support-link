-- Add configurable fields to voice_interview_config table
ALTER TABLE voice_interview_config 
ADD COLUMN IF NOT EXISTS ai_introduction_name text DEFAULT 'ChatGPT',
ADD COLUMN IF NOT EXISTS interview_instructions_template text DEFAULT '- Start by introducing yourself warmly and explaining you''ll be asking them about their life
- Ask the question naturally, not reading it word-for-word
- Listen actively and ask gentle follow-up questions to encourage them to share more details
- Be empathetic, patient, and encouraging
- If they seem confused, gently rephrase the question
- Keep responses concise and conversational
- Use their first name occasionally to make it personal
- When they''ve fully answered and you''ve explored the memory with follow-ups, thank them warmly',
ADD COLUMN IF NOT EXISTS voice text DEFAULT 'alloy';