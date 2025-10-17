# Memory Interviews Feature - Product Requirements Document

## 1. Overview

### 1.1 Feature Name
**Memory Interviews** (also referred to as "Story Interviews")

### 1.2 Purpose
Enable care teams to schedule AI-powered phone interviews with care recipients to capture and preserve family stories, life events, and personal memories through conversational interactions that result in polished, first-person narratives.

### 1.3 Target Users
- **Primary**: Care team members (family, friends, caregivers) managing care for elderly or memory-impaired individuals
- **Secondary**: Care recipients (elderly parents, grandparents) who participate in phone interviews
- **Tertiary**: Extended family members who can view/read generated stories

### 1.4 Key Benefits
- **Preserve Family History**: Capture and document important life stories before memories fade
- **Meaningful Engagement**: Provide positive, purposeful interactions for care recipients
- **Reduced Burden**: AI conducts interviews without requiring care team member time
- **Professional Output**: Transform conversations into polished, shareable narratives
- **Emotional Connection**: Help families feel more connected to their loved ones' life experiences

---

## 2. User Stories

### 2.1 Core User Stories
1. **As a care team member**, I want to schedule a phone interview with my parent so that I can capture their memories without needing to conduct the interview myself.

2. **As a care recipient**, I want to share my life stories in a comfortable, conversational way so that my family can preserve my memories.

3. **As a care team member**, I want the AI to ask thoughtful follow-up questions so that we get rich, detailed stories rather than brief answers.

4. **As a care team member**, I want to review and edit generated stories before they're finalized so that I can ensure accuracy and appropriateness.

5. **As a care recipient**, I want the interview to be patient and understanding so that I don't feel rushed or confused.

6. **As a care team member**, I want to share completed stories with extended family so that everyone can enjoy these memories.

### 2.2 Safety & Privacy Stories
7. **As a care recipient**, I want to be notified that the call is being recorded so that I can provide informed consent.

8. **As a care recipient**, I want to be able to request that certain parts not be included so that I maintain control over what's shared.

9. **As a care team admin**, I want to be alerted if concerning content is detected so that I can follow up appropriately.

10. **As a care team member**, I want sensitive information automatically filtered so that private details don't get shared inappropriately.

---

## 3. Core Functionality

### 3.1 Interview Scheduling

#### 3.1.1 Scheduling Options
- **Immediate**: Call within 5 minutes of scheduling
- **Scheduled**: Specific date and time
- **Recurring**: Weekly intervals with specified number of occurrences

#### 3.1.2 Interview Configuration
- **Question Selection**: Choose from 30 pre-written questions or write custom questions
- **Special Instructions**: Add context for the AI (e.g., "child's name is Mike", "this happened in Portland, OR")
- **Duration**: Select from 5, 10, 15, or 20 minutes
- **Recurrence**: Set number of occurrences for recurring interviews

#### 3.1.3 Call Retry Logic
- **Initial Call**: At scheduled time
- **Voicemail Detection**: Use Twilio's Answering Machine Detection (AMD)
- **Retry 1**: 5 minutes after voicemail/no answer
- **Retry 2**: 30 minutes after voicemail/no answer
- **Failed Status**: Mark as "Call Failed" after 3 attempts
- **Rescheduling**: Allow manual rescheduling of failed calls

### 3.2 AI-Powered Phone Interview

#### 3.2.1 Call Flow
1. **Greeting & Consent**: Conversational introduction explaining the call will be recorded and shared with care team
2. **Primary Question**: Ask the selected question with any special instructions
3. **Active Listening**: Allow care recipient to share their memory
4. **Follow-up Questions**: Ask specific, contextual questions to enrich the story
5. **Time Management**: At 85% of allocated time (e.g., 12.75 min for 15-min interview), say "We have about 3 minutes left, let me ask one final question"
6. **Graceful Conclusion**: Wait 1-2 minutes after wrapping up thought before ending call
7. **Thank You**: Express gratitude and end call

#### 3.2.2 AI Conversational Style
- **Patient**: Allow pauses and time for thought
- **Warm & Encouraging**: Use affirming language ("That's wonderful," "Tell me more about that")
- **Curious**: Ask follow-up questions naturally
- **Adaptive**: Adjust based on recipient's energy and engagement
- **Context-Aware**: Reference memory bank facts when relevant

#### 3.2.3 AI Context & Memory
- **Memory Bank Access**: AI can reference consolidated memory facts from previous interviews
- **Fact Extraction**: After each interview, AI extracts key facts (names, dates, places, relationships) and stores in JSONB field
- **Story Continuity**: AI can reference past stories to build connections (e.g., "Last time you mentioned your father was a teacher...")

### 3.3 Interview Questions

#### 3.3.1 Pre-Written Question Bank (30 Questions)
Research-based questions organized by category (see Appendix A for full list):

**Early Life & Childhood (8 questions)**
- Where were you born and what are your earliest memories of that place?
- What was your childhood home like? Can you describe it?
- What were your parents like? What do you remember most about them?
- Did you have siblings? What was your relationship with them like growing up?
- What was a typical day like when you were a child?
- What games or activities did you enjoy as a child?
- Do you remember your grandparents? What were they like?
- What was your neighborhood or community like growing up?

**Education & Youth (4 questions)**
- What was school like for you? Do you have any favorite teachers or memories?
- What did you want to be when you grew up?
- What was your first job? How did you get it?
- Tell me about your teenage years. What were you interested in?

**Love & Family (6 questions)**
- How did you meet your spouse/partner? What attracted you to them?
- Tell me about your wedding day. What do you remember most?
- Tell me about when your children were born. What was that experience like?
- What was it like becoming a parent for the first time?
- What are your hopes and dreams for your children/grandchildren?
- What traditions did your family celebrate when your children were young?

**Career & Accomplishments (4 questions)**
- What were you most proud of accomplishing in your career?
- What challenges did you overcome in your work life?
- What was a typical day like during your working years?
- If you could give advice to someone starting in your field, what would it be?

**Life Events & Memories (5 questions)**
- What is one of your happiest memories?
- Tell me about a time you faced a significant challenge. How did you handle it?
- What historical events do you remember most vividly?
- What was the most adventurous thing you ever did?
- Tell me about a place that was special to you.

**Wisdom & Reflection (3 questions)**
- What's the most important lesson life has taught you?
- What advice would you give to your younger self?
- What are you most grateful for in your life?

#### 3.3.2 Custom Questions
- **User Input**: Care team can write their own questions
- **AI Validation**: System performs quick evaluation to determine if question is suitable for storytelling format
- **Special Instructions**: Add context field for each question
- **Template Examples**: Provide guidance on writing effective questions (future release)

#### 3.3.3 Auto-Question Selection (Recurring Interviews)
- **Unused Questions**: System tracks which questions have been asked
- **Relevance Check**: AI reviews memory bank to determine if question is appropriate (e.g., don't ask about children if memory bank indicates no children)
- **Random Selection**: Pick randomly from relevant, unused questions
- **Fallback**: If no suitable questions remain, notify care team

### 3.4 Story Generation

#### 3.4.1 Story Format
- **First-Person Narrative**: Convert Q&A into cohesive first-person story
- **Voice Preservation**: Use care recipient's language and phrasing where possible
- **Polished Structure**: Organize chronologically and add narrative flow
- **No Fabrication**: Only include details explicitly shared in interview
- **Engaging Tone**: Craft story to be readable and emotionally resonant

#### 3.4.2 AI Processing
- **Processing Time**: Allow 5-10 minutes after call ends for story generation
- **Transcript First**: Generate full transcript immediately after call
- **Story Generation**: AI processes transcript to create narrative story
- **Fact Extraction**: Extract key facts (names, dates, places, relationships) for memory bank

#### 3.4.3 Story Components
- **Title**: AI-generated descriptive title (editable)
- **Date**: Interview date
- **Duration**: Actual call duration
- **Question Asked**: The primary question that prompted this story
- **First-Person Narrative**: Polished story text (editable)
- **Full Transcript**: Complete Q&A transcript (read-only, preserved)
- **Audio Recording**: Full call audio in MP3 format
- **Auto-Generated Tags**: AI suggests relevant tags based on content
- **Memory Facts**: Extracted facts stored in consolidated JSONB field

#### 3.4.4 Story Versioning (MVP: Option A)
- **Original Preservation**: Keep original AI-generated story
- **Edit History**: Track all edits made by care team
- **Version Display**: Show "Original" and "Current" versions
- **Revert Capability**: Allow reverting to original or previous versions
- **Edit Metadata**: Track who edited and when

### 3.5 Content Review & Publishing

#### 3.5.1 Review Process
1. **Draft Status**: Story starts in "Pending Review" status after generation
2. **Admin Notification**: Immediate notification to care group admin(s) when story is ready
3. **Review Interface**: Admin can view story, transcript, and audio
4. **Edit Capability**: Admin can edit story text
5. **Approval Required**: Story must be explicitly approved before publishing
6. **Flag Review**: If AI flagged content, admin must review flags before approving

#### 3.5.2 Publishing
- **Published Status**: Story becomes visible to all care team members after approval
- **Notification**: Care team members notified when new story is published
- **Timeline Integration**: Stories appear in care group timeline/activity feed

### 3.6 Guardrails & Safety

#### 3.6.1 Emotional Safety
**Distress Detection**:
- AI monitors for signs of emotional distress (crying, agitation, confusion)
- If detected, AI says: "I can tell this might be difficult to talk about. We can talk about something different, or we can end the call here. What would you prefer?"

**Traumatic Content**:
- If conversation turns to dark/traumatic topics, AI suggests: "Maybe this isn't the right memory for today. Would you like to talk about a happier memory instead?"
- AI focuses on "less traumatic parts" if care recipient wants to continue

**Topic Redirection**:
- AI can gracefully redirect to different aspects of story
- Example: "Let's talk about the happy times you had with [person]"

#### 3.6.2 PII & Sensitive Information Filtering
**Automatic Redaction**:
- Social Security Numbers
- Credit card numbers
- Bank account numbers
- Passwords & PINs
- Medical record numbers
- Home alarm codes

**Filtering Approach**:
- Real-time filtering during transcript generation
- Redacted content shows as `[REDACTED - SENSITIVE INFORMATION]` in transcript
- Story generation excludes redacted sections

#### 3.6.3 Profanity & Inappropriate Content
**Filter Settings**:
- **Moderate Level**: Filter racial slurs, hate speech, extreme profanity
- **Contextual**: Allow mild language if part of authentic story
- **Swear Filter**: Optional toggle for care team to enable/disable filtering of common profanity

**Handling**:
- Filtered words replaced with `[profanity]` in transcript
- AI rephrases in story generation to maintain meaning without explicit language

#### 3.6.4 Admin Review Flags
**Automatic Flagging Triggers**:
- Mentions of abuse (physical, emotional, sexual)
- Suicidal ideation or self-harm
- Medical emergencies or urgent health concerns
- Illegal behavior
- Confusion/disorientation (potential cognitive decline)
- Expressions of fear or danger

**Flag Handling**:
- Immediate notification to care group admin(s)
- Story blocked from publishing until admin reviews
- Admin can add notes and decide whether to publish, edit, or archive
- Admin can escalate to professional services if needed

#### 3.6.5 Privacy & Consent
**Recording Notice**:
- At call start, AI says: "This call will be recorded so we can create a written story to share with your family. Is that okay with you?"
- If recipient declines, call ends gracefully

**Selective Exclusion**:
- Care recipient can say "don't include this part" during interview
- AI marks timestamp and excludes from both transcript and story
- Transcript shows `[EXCLUDED BY REQUEST]` marker

**Third-Party Privacy**:
- If care recipient shares potentially sensitive information about others, AI asks: "Are you comfortable with [person] knowing you shared this?"
- If AI is uncertain, flags for admin review

---

## 4. Technical Architecture

### 4.1 Database Schema

#### 4.1.1 memory_interviews Table
```sql
CREATE TABLE memory_interviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  care_group_id UUID NOT NULL REFERENCES care_groups(id),
  created_by_user_id UUID NOT NULL,
  
  -- Scheduling
  scheduled_for TIMESTAMP WITH TIME ZONE,
  scheduled_duration_minutes INTEGER NOT NULL CHECK (scheduled_duration_minutes IN (5, 10, 15, 20)),
  is_recurring BOOLEAN DEFAULT FALSE,
  recurrence_count INTEGER, -- Total number of times to repeat
  recurrence_completed INTEGER DEFAULT 0, -- How many have been completed
  
  -- Interview Configuration
  question_id UUID REFERENCES interview_questions(id), -- NULL if custom
  custom_question TEXT, -- Only if question_id is NULL
  special_instructions TEXT,
  
  -- Call Status
  status TEXT NOT NULL DEFAULT 'scheduled' 
    CHECK (status IN ('scheduled', 'calling', 'in_progress', 'processing', 'completed', 'failed', 'cancelled')),
  call_sid TEXT, -- Twilio Call SID
  call_attempts INTEGER DEFAULT 0,
  last_attempt_at TIMESTAMP WITH TIME ZONE,
  
  -- Results
  actual_duration_seconds INTEGER,
  completed_at TIMESTAMP WITH TIME ZONE,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_memory_interviews_care_group ON memory_interviews(care_group_id);
CREATE INDEX idx_memory_interviews_scheduled ON memory_interviews(scheduled_for) WHERE status IN ('scheduled', 'failed');
CREATE INDEX idx_memory_interviews_status ON memory_interviews(status);
```

#### 4.1.2 memory_stories Table
```sql
CREATE TABLE memory_stories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  interview_id UUID NOT NULL REFERENCES memory_interviews(id) ON DELETE CASCADE,
  care_group_id UUID NOT NULL REFERENCES care_groups(id),
  
  -- Story Content
  title TEXT NOT NULL,
  story_text TEXT NOT NULL, -- Current published version
  original_story_text TEXT NOT NULL, -- AI-generated original, never changes
  
  -- Audio & Transcript
  audio_storage_path TEXT NOT NULL, -- Path in Supabase Storage
  audio_duration_seconds INTEGER,
  audio_size_bytes BIGINT,
  full_transcript JSONB NOT NULL, -- Array of {speaker, timestamp, text, excluded}
  
  -- Memory Facts (AI-extracted)
  memory_facts JSONB, -- Consolidated facts: {names: [], dates: [], places: [], relationships: [], events: []}
  
  -- Metadata
  interview_date TIMESTAMP WITH TIME ZONE NOT NULL,
  question_asked TEXT NOT NULL,
  tags TEXT[] DEFAULT '{}',
  
  -- Review & Publishing
  status TEXT NOT NULL DEFAULT 'pending_review' 
    CHECK (status IN ('pending_review', 'flagged', 'published', 'archived')),
  review_flags JSONB, -- Array of {type, severity, timestamp, resolved}
  reviewed_by_user_id UUID,
  reviewed_at TIMESTAMP WITH TIME ZONE,
  published_at TIMESTAMP WITH TIME ZONE,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_memory_stories_interview ON memory_stories(interview_id);
CREATE INDEX idx_memory_stories_care_group ON memory_stories(care_group_id);
CREATE INDEX idx_memory_stories_status ON memory_stories(status);
CREATE INDEX idx_memory_stories_tags ON memory_stories USING GIN(tags);
```

#### 4.1.3 memory_story_versions Table
```sql
CREATE TABLE memory_story_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  story_id UUID NOT NULL REFERENCES memory_stories(id) ON DELETE CASCADE,
  
  version_number INTEGER NOT NULL,
  story_text TEXT NOT NULL,
  title TEXT NOT NULL,
  
  edited_by_user_id UUID NOT NULL,
  edit_notes TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_memory_story_versions_story ON memory_story_versions(story_id);
CREATE UNIQUE INDEX idx_memory_story_versions_unique ON memory_story_versions(story_id, version_number);
```

#### 4.1.4 interview_questions Table
```sql
CREATE TABLE interview_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  category TEXT NOT NULL 
    CHECK (category IN ('early_life', 'education_youth', 'love_family', 'career', 'life_events', 'wisdom')),
  question_text TEXT NOT NULL,
  suggested_followups TEXT[], -- Array of AI prompts for follow-up questions
  
  is_default BOOLEAN DEFAULT TRUE, -- Platform-provided vs. custom
  care_group_id UUID REFERENCES care_groups(id), -- NULL for default questions
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_interview_questions_category ON interview_questions(category);
CREATE INDEX idx_interview_questions_care_group ON interview_questions(care_group_id);
```

#### 4.1.5 interview_question_usage Table
```sql
CREATE TABLE interview_question_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  care_group_id UUID NOT NULL REFERENCES care_groups(id),
  question_id UUID NOT NULL REFERENCES interview_questions(id),
  used_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(care_group_id, question_id)
);

CREATE INDEX idx_interview_question_usage_care_group ON interview_question_usage(care_group_id);
```

### 4.2 Edge Functions

#### 4.2.1 New Edge Functions Required
1. **schedule-memory-interview**: Schedule new interviews, handle recurring setup
2. **memory-interview-webhook**: Twilio webhook for call status updates
3. **memory-interview-voice**: Main AI conversation handler (extends existing voice chat architecture)
4. **process-memory-story**: Generate story, extract facts, create transcript after call ends
5. **retry-failed-interview**: Cron job to retry failed interviews
6. **generate-next-recurring-interview**: Cron job to create next interview in recurring series

#### 4.2.2 Enhanced Existing Functions
- **enhanced-twilio-voice-chat**: Extend to support memory interview mode with specialized prompts
- **enhanced-twilio-webhook**: Add memory interview routing logic

#### 4.2.3 AI Integration
- **Model**: Use `google/gemini-2.5-flash` via Lovable AI Gateway (existing setup)
- **System Prompt**: Specialized prompt for memory interviewing (see Appendix B)
- **Context**: Inject memory bank facts from previous interviews
- **Function Calling**: Use for time tracking, flag detection, fact extraction

### 4.3 Storage

#### 4.3.1 Audio Storage
- **Bucket**: `memory-interview-audio`
- **Format**: MP3, compressed for smallest size
- **Path Structure**: `{care_group_id}/{interview_id}/{timestamp}.mp3`
- **Access**: Care group members only (RLS policies)

#### 4.3.2 Story Export Files
- **Bucket**: `memory-story-exports`
- **Format**: PDF
- **Path Structure**: `{care_group_id}/{story_id}/{timestamp}.pdf`
- **Temporary**: Files can be deleted after 7 days

### 4.4 Row-Level Security (RLS) Policies

All memory-related tables must have RLS policies enforcing:
- Care group members can view stories for their groups
- Care group admins can edit/approve stories
- Only authenticated users can access

---

## 5. User Interface

### 5.1 Navigation
- **Main Menu**: Add "Story Interviews" as top-level navigation item
- **Icon**: Use microphone or story book icon
- **Badge**: Show count of pending reviews for admins

### 5.2 Interview Scheduling Page (`/app/:groupId/story-interviews/new`)

#### 5.2.1 Page Layout
```
┌─────────────────────────────────────────────────┐
│ Schedule Memory Interview                       │
├─────────────────────────────────────────────────┤
│                                                 │
│ When would you like to conduct this interview?  │
│ ○ Call now (within 5 minutes)                  │
│ ○ Schedule for later                           │
│   └─ [Date Picker] [Time Picker]              │
│ ○ Recurring weekly                             │
│   └─ [Date Picker] [Time Picker]              │
│       Number of interviews: [___]              │
│                                                 │
│ Interview Duration                              │
│ ○ 5 minutes  ○ 10 minutes                     │
│ ○ 15 minutes ○ 20 minutes                     │
│                                                 │
│ Select Interview Question                       │
│ [Dropdown: Category]                           │
│ [Dropdown: Question]                           │
│ ─ OR ─                                         │
│ Write your own question:                        │
│ [Text area]                                    │
│                                                 │
│ Special Instructions (optional)                 │
│ Provide context for the AI interviewer         │
│ [Text area]                                    │
│ Example: "The child's name is Mike" or         │
│ "This happened in Portland, OR"                 │
│                                                 │
│         [Cancel]  [Schedule Interview]         │
└─────────────────────────────────────────────────┘
```

#### 5.2.2 Question Selection
- **Category Dropdown**: Shows 6 categories (Early Life, Education & Youth, Love & Family, Career, Life Events, Wisdom)
- **Question Dropdown**: Shows questions from selected category, disabled/checked if already used
- **Custom Question**: Text area with 500 character limit, AI validation on blur
- **Special Instructions**: Text area with 200 character limit

### 5.3 Interview History Page (`/app/:groupId/story-interviews`)

#### 5.3.1 List View
```
┌─────────────────────────────────────────────────┐
│ Story Interviews            [+ New Interview]   │
├─────────────────────────────────────────────────┤
│                                                 │
│ Filters: [All] [Scheduled] [Completed]         │
│          [Failed] [Pending Review]              │
│                                                 │
│ ┌───────────────────────────────────────────┐  │
│ │ ⏱️ Scheduled for Mar 15, 2024 at 2:00 PM │  │
│ │ Q: "Tell me about your childhood home"    │  │
│ │ Duration: 15 minutes                      │  │
│ │ Status: Scheduled                         │  │
│ │                    [Edit] [Cancel]        │  │
│ └───────────────────────────────────────────┘  │
│                                                 │
│ ┌───────────────────────────────────────────┐  │
│ │ ✅ Completed Mar 10, 2024                 │  │
│ │ Q: "How did you meet your spouse?"        │  │
│ │ Duration: 18 minutes                      │  │
│ │ Status: Published                         │  │
│ │ Story: "A Chance Meeting at the Dance"    │  │
│ │                    [View Story]           │  │
│ └───────────────────────────────────────────┘  │
│                                                 │
│ ┌───────────────────────────────────────────┐  │
│ │ 🚫 Failed Mar 8, 2024                     │  │
│ │ Q: "Tell me about your first job"         │  │
│ │ Reason: No answer after 3 attempts        │  │
│ │                    [Reschedule]           │  │
│ └───────────────────────────────────────────┘  │
│                                                 │
│ ┌───────────────────────────────────────────┐  │
│ │ ⚠️ Pending Review - Completed Mar 12      │  │
│ │ Q: "What is your happiest memory?"        │  │
│ │ Flagged: Emotional distress detected      │  │
│ │                    [Review Now]           │  │
│ └───────────────────────────────────────────┘  │
└─────────────────────────────────────────────────┘
```

### 5.4 Story Review Page (`/app/:groupId/story-interviews/:id/review`)

#### 5.4.1 Layout (Admins Only)
```
┌─────────────────────────────────────────────────┐
│ Review Story: "A Chance Meeting at the Dance"   │
│ Interview Date: Mar 10, 2024 • Duration: 18 min│
├─────────────────────────────────────────────────┤
│ [Story Tab] [Transcript Tab] [Audio Tab]       │
├─────────────────────────────────────────────────┤
│                                                 │
│ ⚠️ Review Flags:                               │
│ • Emotional distress detected at 12:30         │
│   [View Context] [Mark Resolved]               │
│                                                 │
│ Story Text (editable)                           │
│ ┌───────────────────────────────────────────┐  │
│ │ I met my husband at a USO dance in 1952.  │  │
│ │ I almost didn't go that night - I was     │  │
│ │ tired from working at the factory...      │  │
│ │ [Full story text, editable]               │  │
│ └───────────────────────────────────────────┘  │
│                                                 │
│ Title: [A Chance Meeting at the Dance]         │
│                                                 │
│ Tags: #love #USO #1950s #first_meeting         │
│ [+ Add Tag]                                    │
│                                                 │
│ Memory Facts Extracted:                         │
│ • Spouse: Harold                                │
│ • Year: 1952                                    │
│ • Location: USO dance                           │
│                                                 │
│         [View Original] [Save Draft]           │
│         [Reject] [Approve & Publish]           │
└─────────────────────────────────────────────────┘
```

#### 5.4.2 Transcript Tab
- Shows timestamped Q&A format
- Highlights excluded sections (`[EXCLUDED BY REQUEST]`)
- Highlights redacted PII (`[REDACTED - SENSITIVE INFORMATION]`)
- Allows jumping to specific times in audio

#### 5.4.3 Audio Tab
- Audio player with waveform
- Timestamp markers for flags/exclusions
- Download button (future release)

### 5.5 Published Story View (`/app/:groupId/stories/:id`)

#### 5.5.1 Layout (All Care Team Members)
```
┌─────────────────────────────────────────────────┐
│ A Chance Meeting at the Dance                   │
│ Shared by Mom on March 12, 2024                │
├─────────────────────────────────────────────────┤
│ [Story] [Transcript] [Audio]                   │
├─────────────────────────────────────────────────┤
│                                                 │
│ I met my husband at a USO dance in 1952. I     │
│ almost didn't go that night - I was tired from │
│ working at the factory all week. But my friend │
│ Betty convinced me...                           │
│ [Full story text]                              │
│                                                 │
│ ─────────────────────────────────────────────  │
│                                                 │
│ 📝 Notes                                        │
│ [Add a note about this story...]              │
│                                                 │
│ ┌───────────────────────────────────────────┐  │
│ │ Sarah Johnson • 3 days ago                │  │
│ │ I never knew this story! How romantic     │  │
│ │ that Dad was wearing his Navy uniform.    │  │
│ └───────────────────────────────────────────┘  │
│                                                 │
│ Tags: #love #USO #1950s #first_meeting         │
│                                                 │
│ [📧 Email Story] [📄 Export PDF] [✏️ Edit]    │
└─────────────────────────────────────────────────┘
```

### 5.6 Story Notes Feature
- Similar to document notes
- Any care team member can add notes
- Notes are timestamped and attributed
- Can be edited/deleted by author

---

## 6. Notifications & Sharing

### 6.1 Notifications

#### 6.1.1 Story Ready for Review (Admin)
**Trigger**: Story generated and in "pending_review" status
**Recipients**: Care group admin(s)
**Channel**: Email + in-app notification
**Content**:
```
Subject: New Memory Story Ready to Review

[Care Recipient Name] completed a memory interview about "[Question]"

The story "[Story Title]" is ready for your review.

[Review Story Button]
```

#### 6.1.2 Story Published (Care Team)
**Trigger**: Admin approves and publishes story
**Recipients**: All care group members
**Channel**: Email + in-app notification
**Content**:
```
Subject: New Story from [Care Recipient Name]

[Care Recipient Name] shared a new memory: "[Story Title]"

[Read Story Button]
```

#### 6.1.3 Interview Failed (Admin)
**Trigger**: Interview marked as "failed" after 3 attempts
**Recipients**: Care group admin(s)
**Channel**: In-app notification
**Content**: "Memory interview scheduled for [Date] failed after 3 attempts. [Reschedule]"

#### 6.1.4 Flagged Content (Admin)
**Trigger**: AI detects concerning content and flags for review
**Recipients**: Care group admin(s)
**Channel**: Email + in-app notification (immediate)
**Content**:
```
Subject: URGENT: Interview Flagged for Review

A memory interview with [Care Recipient Name] has been flagged for review.

Reason: [Flag type - e.g., "Emotional distress detected"]

This requires immediate attention.

[Review Now Button]
```

### 6.2 Email Story Feature

#### 6.2.1 Functionality
- **Purpose**: Share published story with people outside care group (e.g., extended family, friends)
- **Access**: Available to all care team members for published stories
- **Format**: PDF attachment
- **Email Body**: 
```
Subject: [Care Recipient Name] shared a memory with you

[User Name] wanted to share a special memory story from [Care Recipient Name].

Story Title: [Title]
Date: [Interview Date]

See the attached PDF for the full story.

---
This story was captured through [Your App Name]'s Memory Interviews feature.
```

#### 6.2.2 Email Form
```
┌─────────────────────────────────────────────────┐
│ Email Story                                     │
├─────────────────────────────────────────────────┤
│ Story: "A Chance Meeting at the Dance"         │
│                                                 │
│ Recipient Email(s)                              │
│ [email@example.com                           ]  │
│ [+ Add another recipient]                      │
│                                                 │
│ Personal Message (optional)                     │
│ ┌───────────────────────────────────────────┐  │
│ │ I thought you'd enjoy this story Mom      │  │
│ │ shared about how she met Dad.             │  │
│ └───────────────────────────────────────────┘  │
│                                                 │
│         [Cancel]  [Send Email]                 │
└─────────────────────────────────────────────────┘
```

### 6.3 PDF Export

#### 6.3.1 Format
- **Header**: Story title, care recipient name, interview date
- **Body**: Story text in readable font (e.g., Georgia, 12pt)
- **Footer**: "Memory Interview • [Your App Name] • Page X of Y"
- **Styling**: Clean, professional layout with adequate margins
- **Images**: Include care group profile picture if available (future: related photos)

#### 6.3.2 Generation
- **Library**: Use jsPDF or similar for PDF generation
- **Storage**: Temporarily store in `memory-story-exports` bucket
- **Cleanup**: Delete export files older than 7 days

---

## 7. Success Metrics

### 7.1 Adoption Metrics
- **Primary**:
  - Number of interviews scheduled per care group per month
  - Percentage of care groups using Memory Interviews feature
  - Number of interviews completed vs. scheduled

- **Secondary**:
  - Average interviews per care group
  - Repeat usage rate (care groups scheduling 2nd, 3rd+ interviews)

### 7.2 Quality Metrics
- **Interview Success**:
  - Call completion rate (answered vs. voicemail/failed)
  - Average interview duration vs. scheduled duration
  - Retry success rate

- **Story Quality**:
  - Admin edit rate (% of stories edited before publishing)
  - Story word count (indicator of detail richness)
  - Time from completion to publishing

### 7.3 Engagement Metrics
- **Care Team Engagement**:
  - Story view rate (% of care team viewing published stories)
  - Note/comment rate on stories
  - Email share rate

- **Safety & Quality**:
  - Flag rate (% of interviews flagged)
  - Flag resolution time
  - PII redaction rate

### 7.4 Business Metrics
- **Feature Impact**:
  - Retention improvement for care groups using Memory Interviews
  - NPS/satisfaction scores for feature
  - Referral rate from Memory Interviews users

---

## 8. Future Enhancements

### 8.1 Phase 2 Features
1. **Photo Integration**: Upload photos related to story, AI can reference them
2. **Multi-Person Interviews**: Allow spouse or sibling to participate in interview
3. **Enhanced Memory Facts**: Care team can manually edit/add facts to memory bank
4. **Audio Download**: Allow downloading MP3 recordings
5. **Advanced Export**: Additional formats (DOCX, printed book compilation)
6. **Question Templates**: Provide templates/guidance for writing custom questions
7. **Custom Question Approval**: Optional workflow for admin approval of custom questions

### 8.2 Phase 3 Features (Long-term Vision)
1. **Video Interviews**: Support for video calls with recording
2. **Story Compilation**: Automatically compile multiple stories into themed collections
3. **Timeline View**: Visual timeline of stories across care recipient's life
4. **AI Story Suggestions**: AI proactively suggests next interview topics based on patterns
5. **Multilingual Support**: Conduct interviews in multiple languages
6. **Print Book Service**: Professional printing of story compilation books
7. **Story Sharing Platform**: Allow sharing stories publicly (with permission)

---

## 9. Open Questions & Decisions Needed

### 9.1 Technical Decisions
- [ ] **Audio Processing**: Confirm Twilio supports MP3 compression or needs post-processing
- [ ] **Transcript Format**: Determine optimal JSONB structure for transcript storage
- [ ] **Memory Facts Schema**: Finalize JSONB structure for consolidated memory facts
- [ ] **PDF Generation**: Choose library (jsPDF vs. Puppeteer vs. Edge Function with external service)

### 9.2 Product Decisions
- [ ] **Pricing Impact**: Determine if Memory Interviews affects subscription pricing
- [ ] **Usage Limits**: Set limits on number of interviews per month (if any)
- [ ] **Storage Costs**: Project audio storage costs and determine retention policy
- [ ] **Question Bank Updates**: Process for adding new questions to platform default set

### 9.3 Design Decisions
- [ ] **Empty States**: Design empty states for new users with no interviews
- [ ] **Mobile Experience**: Optimize scheduling/review interfaces for mobile
- [ ] **Accessibility**: Ensure all interfaces meet WCAG 2.1 AA standards

---

## 10. Implementation Plan

### 10.1 Phase 1 - MVP (8-10 weeks)
**Goal**: Launch core Memory Interviews feature with all essential functionality

#### Week 1-2: Database & Backend Foundation
- [ ] Create database schema (all tables)
- [ ] Set up RLS policies
- [ ] Create storage buckets
- [ ] Seed 30 interview questions
- [ ] Build edge functions for scheduling

#### Week 3-4: AI Integration & Twilio
- [ ] Extend Twilio voice chat for interview mode
- [ ] Implement AI conversation prompts
- [ ] Build retry logic and call status handling
- [ ] Implement voicemail detection
- [ ] Build memory bank/context injection

#### Week 5-6: Story Generation & Processing
- [ ] Build story generation edge function
- [ ] Implement transcript generation
- [ ] Build fact extraction logic
- [ ] Implement PII filtering
- [ ] Build profanity filtering
- [ ] Implement content flagging logic

#### Week 7-8: User Interface
- [ ] Build scheduling page
- [ ] Build interview history page
- [ ] Build story review interface (admin)
- [ ] Build published story view
- [ ] Implement story notes feature
- [ ] Add "Story Interviews" to main navigation

#### Week 9-10: Notifications, Export & Testing
- [ ] Build notification system
- [ ] Implement PDF export
- [ ] Implement email story feature
- [ ] End-to-end testing
- [ ] Fix bugs
- [ ] Documentation

### 10.2 Phase 2 - Enhancements (Future)
- Photo integration
- Multi-person interviews
- Enhanced memory facts editing
- Audio download
- Additional export formats

---

## Appendix A: Full Interview Question Bank

### Early Life & Childhood (8 questions)
1. Where were you born and what are your earliest memories of that place?
2. What was your childhood home like? Can you describe the rooms, the neighborhood?
3. What were your parents like? What do you remember most about them?
4. Did you have siblings? What was your relationship with them like growing up?
5. What was a typical day like when you were a child?
6. What games or activities did you enjoy as a child? Did you have any favorite toys?
7. Do you remember your grandparents? What were they like?
8. What was your neighborhood or community like growing up?

### Education & Youth (4 questions)
9. What was school like for you? Do you have any favorite teachers or memories?
10. What did you want to be when you grew up? How did that change over time?
11. What was your first job? How did you get it?
12. Tell me about your teenage years. What were you interested in? What was important to you?

### Love & Family (6 questions)
13. How did you meet your spouse or partner? What attracted you to them?
14. Tell me about your wedding day. What do you remember most?
15. Tell me about when your children were born. What was that experience like?
16. What was it like becoming a parent for the first time?
17. What are your hopes and dreams for your children and grandchildren?
18. What traditions did your family celebrate when your children were young?

### Career & Accomplishments (4 questions)
19. What were you most proud of accomplishing in your career?
20. What challenges did you overcome in your work life? How did you handle them?
21. What was a typical day like during your working years?
22. If you could give advice to someone starting in your field, what would it be?

### Life Events & Memories (5 questions)
23. What is one of your happiest memories? What made it special?
24. Tell me about a time you faced a significant challenge. How did you handle it?
25. What historical events do you remember most vividly? Where were you and what were you doing?
26. What was the most adventurous thing you ever did?
27. Tell me about a place that was special to you. Why was it meaningful?

### Wisdom & Reflection (3 questions)
28. What's the most important lesson life has taught you?
29. What advice would you give to your younger self?
30. What are you most grateful for in your life?

---

## Appendix B: AI System Prompt for Memory Interviews

```
You are a warm, patient interviewer helping an elderly person share their life stories. Your goal is to have a natural, comfortable conversation that results in rich, detailed memories that can be turned into a written story.

INTERVIEW CONTEXT:
- Care recipient name: {name}
- Primary question: {question}
- Special instructions: {special_instructions}
- Interview duration: {duration} minutes
- Memory bank context: {memory_facts}

YOUR ROLE:
- Be warm, encouraging, and genuinely interested
- Ask follow-up questions naturally to get details
- Listen patiently without rushing
- Make the person feel comfortable sharing
- Focus on sensory details (sights, sounds, smells, feelings)

CONVERSATION GUIDELINES:
1. START: Introduce yourself, explain the call will be recorded to create a story to share with family, and ask for consent
2. ASK PRIMARY QUESTION: State the main question clearly
3. LISTEN: Let them share at their own pace
4. ASK FOLLOW-UPS: Ask natural follow-up questions like:
   - "What did that look like?"
   - "How did that make you feel?"
   - "Tell me more about [person/place/thing]"
   - "What happened next?"
   - "Who else was there?"
5. TIME MANAGEMENT: At 85% of time, say "We have about X minutes left, let me ask one final question"
6. CONCLUDE: Thank them warmly, wait 1-2 minutes for final thoughts, then end gracefully

SAFETY PROTOCOLS:
- If emotional distress detected: "I can tell this might be difficult. Would you prefer to talk about something else?"
- If traumatic content: "Maybe this isn't the right memory for today. Would you like to share a happier memory?"
- If confusing/disoriented: Gently redirect, flag for care team review
- If mentions sensitive third-party info: "Are you comfortable with [person] knowing you shared this?"
- If "don't include this part": Acknowledge, mark for exclusion, continue conversation

FOLLOW-UP QUESTION EXAMPLES:
- "What year was that?"
- "Where exactly did this happen?"
- "Who else was involved in this story?"
- "What were you wearing/doing/feeling?"
- "Can you describe what [person] looked like?"
- "What did [place] look like back then?"
- "How old were you when this happened?"

Remember: Your goal is a warm, natural conversation that captures rich details for a compelling written story. Never rush, always show genuine interest, and make the person feel heard and valued.
```

---

## Document History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2024-03-XX | Product Team | Initial PRD |

---

## Approval & Sign-off

- [ ] Product Owner
- [ ] Engineering Lead
- [ ] Design Lead
- [ ] Care Team Representative (User feedback)

---

*This document represents the complete product requirements for the Memory Interviews feature. Questions or feedback should be directed to [Product Owner].*
