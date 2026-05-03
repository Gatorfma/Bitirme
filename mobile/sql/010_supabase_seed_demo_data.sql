-- Seed Demo Data for MindJournal
-- Safe to run multiple times (deletes previous seed data first)

BEGIN;

-- Step 1: Delete previous seed data (identified by summary starting with "[SEED]")
DELETE FROM thought_items
WHERE session_id IN (
  SELECT id FROM journal_sessions WHERE summary LIKE '[SEED]%'
);

DELETE FROM journal_sessions
WHERE summary LIKE '[SEED]%';

-- Step 2: Insert/update 12 active categories with ON CONFLICT
INSERT INTO categories_active (name, thought_count)
VALUES
  ('Time Pressure', 0),
  ('Academic Stress', 0),
  ('Relationship Rumination', 0),
  ('Self-Worth', 0),
  ('Burnout', 0),
  ('Family Tension', 0),
  ('Social Anxiety', 0),
  ('Future Uncertainty', 0),
  ('Loneliness', 0),
  ('Motivation', 0),
  ('Health Worry', 0),
  ('Anger & Irritability', 0)
ON CONFLICT (name) DO UPDATE
SET thought_count = 0;

-- Step 3: Create journal sessions and thought items for each category
-- We'll create one session per category with 8 thoughts

DO $$
DECLARE
  cat_record RECORD;
  session_id_val uuid;
  thought_texts text[];
  thought_text text;
  thought_counter int;
BEGIN
  -- Loop through each category
  FOR cat_record IN SELECT id, name FROM categories_active WHERE name IN (
    'Time Pressure', 'Academic Stress', 'Relationship Rumination', 'Self-Worth',
    'Burnout', 'Family Tension', 'Social Anxiety', 'Future Uncertainty',
    'Loneliness', 'Motivation', 'Health Worry', 'Anger & Irritability'
  )
  LOOP
    -- Create one session per category
    INSERT INTO journal_sessions (started_at, ended_at, messages, summary, thoughts, post_processed_at, categorization_status)
    VALUES (
      NOW() - INTERVAL '30 days' - (random() * INTERVAL '20 days'),
      NOW() - INTERVAL '30 days' - (random() * INTERVAL '20 days') + INTERVAL '15 minutes',
      '[]'::jsonb,
      '[SEED] Demo session for ' || cat_record.name,
      '[]'::jsonb,
      NOW() - INTERVAL '30 days' - (random() * INTERVAL '20 days') + INTERVAL '15 minutes',
      'done'
    )
    RETURNING id INTO session_id_val;

    -- Define thought texts based on category
    CASE cat_record.name
      WHEN 'Time Pressure' THEN
        thought_texts := ARRAY[
          'I feel like there are never enough hours in the day.',
          'I keep missing deadlines and it makes me anxious.',
          'Everyone expects so much from me and I can''t keep up.',
          'I wish I could pause time just for a moment.',
          'I''m constantly rushing and it''s exhausting.',
          'I feel guilty when I take breaks because there''s always more to do.',
          'My to-do list keeps growing and I can''t catch up.',
          'I''m afraid I''m going to burn out from all this pressure.'
        ];
      WHEN 'Academic Stress' THEN
        thought_texts := ARRAY[
          'I''m worried I''m going to fail this exam.',
          'Everyone else seems to understand the material better than me.',
          'I study for hours but still feel unprepared.',
          'I can''t focus because I''m so stressed about my grades.',
          'What if I don''t get into the program I want?',
          'I feel like I''m not smart enough for this.',
          'I''m falling behind and don''t know how to catch up.',
          'My future depends on these grades and that terrifies me.'
        ];
      WHEN 'Relationship Rumination' THEN
        thought_texts := ARRAY[
          'I keep replaying that conversation in my head.',
          'Did I say something wrong? They seemed upset.',
          'Why haven''t they texted me back?',
          'I''m worried they''re going to leave me.',
          'I overthink every interaction we have.',
          'What if they don''t really care about me?',
          'I can''t stop thinking about what they meant by that.',
          'I feel like I''m always the one who cares more.'
        ];
      WHEN 'Self-Worth' THEN
        thought_texts := ARRAY[
          'I don''t feel good enough.',
          'Why can''t I be more like everyone else?',
          'I feel like I''m not worthy of good things.',
          'Everyone else seems to have it together except me.',
          'I''m my own worst critic.',
          'I don''t deserve happiness.',
          'I feel like a fraud and everyone will find out.',
          'I''m not as valuable as other people.'
        ];
      WHEN 'Burnout' THEN
        thought_texts := ARRAY[
          'I feel completely drained all the time.',
          'I used to love this but now I just feel empty.',
          'I can''t remember the last time I felt excited about anything.',
          'Everything feels like too much effort.',
          'I''m running on empty and there''s no end in sight.',
          'I don''t have the energy to care anymore.',
          'I feel like I''m just going through the motions.',
          'I need a break but I can''t afford to stop.'
        ];
      WHEN 'Family Tension' THEN
        thought_texts := ARRAY[
          'I feel like I can never do anything right in their eyes.',
          'Why do we always end up arguing?',
          'I love them but being around them is exhausting.',
          'They don''t understand me and never try to.',
          'I feel guilty for wanting space from my family.',
          'Every conversation turns into a lecture.',
          'I wish we could just have a normal conversation.',
          'I feel like I''m disappointing them no matter what I do.'
        ];
      WHEN 'Social Anxiety' THEN
        thought_texts := ARRAY[
          'I''m worried about what everyone thinks of me.',
          'I feel like I''m going to say something stupid.',
          'Everyone is judging me and I can''t relax.',
          'I avoid social situations because they make me anxious.',
          'I replay every social interaction and find things wrong.',
          'What if they think I''m weird or boring?',
          'I feel like I don''t belong in social groups.',
          'I''m afraid of being rejected or laughed at.'
        ];
      WHEN 'Future Uncertainty' THEN
        thought_texts := ARRAY[
          'I don''t know what I''m doing with my life.',
          'What if I make the wrong choice?',
          'I feel lost and don''t know which direction to go.',
          'Everyone else seems to have a plan except me.',
          'I''m afraid of making a mistake that will ruin everything.',
          'The future feels scary and uncertain.',
          'I wish I could see what''s going to happen.',
          'I feel paralyzed by all the possibilities.'
        ];
      WHEN 'Loneliness' THEN
        thought_texts := ARRAY[
          'I feel alone even when I''m with people.',
          'No one really understands what I''m going through.',
          'I wish I had someone to talk to who gets it.',
          'I feel disconnected from everyone around me.',
          'I''m surrounded by people but still feel empty.',
          'I don''t have anyone I can truly be myself with.',
          'I feel like I''m on the outside looking in.',
          'I''m lonely but also afraid of reaching out.'
        ];
      WHEN 'Motivation' THEN
        thought_texts := ARRAY[
          'I can''t seem to get started on anything.',
          'I know what I need to do but I just can''t do it.',
          'I feel stuck and unmotivated.',
          'Why can''t I just be productive like other people?',
          'I keep putting things off and it makes me feel worse.',
          'I want to change but I don''t have the energy.',
          'I feel like I''m wasting my potential.',
          'I''m disappointed in myself for not doing more.'
        ];
      WHEN 'Health Worry' THEN
        thought_texts := ARRAY[
          'I''m worried about this pain I keep feeling.',
          'What if something is seriously wrong with me?',
          'I can''t stop googling my symptoms.',
          'I''m afraid to go to the doctor because of what they might say.',
          'Every little ache makes me anxious.',
          'I feel like my body is failing me.',
          'I worry about my health constantly.',
          'What if I have something that can''t be fixed?'
        ];
      WHEN 'Anger & Irritability' THEN
        thought_texts := ARRAY[
          'I feel so angry and I don''t know why.',
          'Little things set me off and I can''t control it.',
          'I''m irritable all the time and it''s affecting my relationships.',
          'I feel like I''m going to explode.',
          'I don''t like who I am when I''m angry.',
          'I snap at people and then feel guilty.',
          'I can''t seem to let go of my anger.',
          'I feel like I''m always on edge and ready to react.'
        ];
    END CASE;

    -- Insert 8 thought items for this category
    FOR thought_counter IN 1..8 LOOP
      INSERT INTO thought_items (session_id, text, assigned_category_id, created_at, source_timestamp)
      VALUES (
        session_id_val,
        thought_texts[thought_counter],
        cat_record.id,
        NOW() - INTERVAL '30 days' - (random() * INTERVAL '20 days') + (thought_counter * INTERVAL '2 minutes'),
        NOW() - INTERVAL '30 days' - (random() * INTERVAL '20 days') + (thought_counter * INTERVAL '2 minutes')
      );
    END LOOP;
  END LOOP;
END $$;

-- Step 4: Update thought_count in categories_active to match actual thought_items
UPDATE categories_active
SET thought_count = (
  SELECT COUNT(*)
  FROM thought_items
  WHERE thought_items.assigned_category_id = categories_active.id
)
WHERE name IN (
  'Time Pressure', 'Academic Stress', 'Relationship Rumination', 'Self-Worth',
  'Burnout', 'Family Tension', 'Social Anxiety', 'Future Uncertainty',
  'Loneliness', 'Motivation', 'Health Worry', 'Anger & Irritability'
);

COMMIT;

