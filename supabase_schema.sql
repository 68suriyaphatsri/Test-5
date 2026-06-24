-- Table for words
CREATE TABLE vocabulary (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    word TEXT NOT NULL,
    definition TEXT NOT NULL,
    example_sentence TEXT NOT NULL,
    audio_url TEXT, -- Optional
    phonetic TEXT,   -- Optional
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table for user mastery (Tracking individual progress)
CREATE TABLE user_mastery (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id TEXT NOT NULL,
    word_id UUID REFERENCES vocabulary(id) ON DELETE CASCADE,
    mastery_level INT DEFAULT 0,
    next_review_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_reviewed_at TIMESTAMP WITH TIME ZONE,
    UNIQUE(user_id, word_id)
);

-- RPC for fetching random words for recall test
-- This function skips words already mastered or not due for review, 
-- or just returns random ones if it's the first time.
CREATE OR REPLACE FUNCTION fetch_recall_set(p_user_id TEXT, p_limit INT)
RETURNS SETOF json AS $$
BEGIN
    RETURN QUERY
    SELECT json_build_object(
        'id', v.id,
        'word', v.word,
        'definition', v.definition,
        'example_sentence', v.example_sentence,
        'mastery_level', COALESCE(um.mastery_level, 0),
        'next_review_at', um.next_review_at
    )
    FROM vocabulary v
    LEFT JOIN user_mastery um ON v.id = um.word_id AND um.user_id = p_user_id
    WHERE um.next_review_at IS NULL OR um.next_review_at <= NOW()
    ORDER BY random()
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- RPC for updating word status
CREATE OR REPLACE FUNCTION update_word_status(p_user_id TEXT, p_word_id UUID, p_is_correct BOOLEAN)
RETURNS VOID AS $$
DECLARE
    v_mastery INT;
    v_interval INTERVAL;
BEGIN
    -- Get current mastery or default to 0
    SELECT COALESCE(mastery_level, 0) INTO v_mastery
    FROM user_mastery
    WHERE user_id = p_user_id AND word_id = p_word_id;

    IF p_is_correct THEN
        v_mastery := v_mastery + 1;
    ELSE
        v_mastery := GREATEST(0, v_mastery - 1);
    END IF;

    -- Simple Spaced Repetition logic
    -- Level 0: 1 min, Level 1: 1 day, Level 2: 3 days, Level 3: 7 days, etc.
    CASE v_mastery
        WHEN 0 THEN v_interval := '1 minute';
        WHEN 1 THEN v_interval := '1 day';
        WHEN 2 THEN v_interval := '3 days';
        WHEN 3 THEN v_interval := '7 days';
        ELSE v_interval := (v_mastery * 7 || ' days')::INTERVAL;
    END CASE;

    INSERT INTO user_mastery (user_id, word_id, mastery_level, next_review_at, last_reviewed_at)
    VALUES (p_user_id, p_word_id, v_mastery, NOW() + v_interval, NOW())
    ON CONFLICT (user_id, word_id) DO UPDATE
    SET mastery_level = EXCLUDED.mastery_level,
        next_review_at = EXCLUDED.next_review_at,
        last_reviewed_at = EXCLUDED.last_reviewed_at;
END;
$$ LANGUAGE plpgsql;

-- Get progress for today
CREATE OR REPLACE FUNCTION get_user_progress(p_user_id TEXT)
RETURNS json AS $$
DECLARE
    v_reviewed_today INT;
    v_total_due INT;
BEGIN
    SELECT COUNT(*) INTO v_reviewed_today
    FROM user_mastery
    WHERE user_id = p_user_id AND last_reviewed_at >= CURRENT_DATE;

    SELECT COUNT(*) INTO v_total_due
    FROM user_mastery um
    WHERE um.user_id = p_user_id AND um.next_review_at <= NOW();

    RETURN json_build_object(
        'reviewed_today', v_reviewed_today,
        'total_due', v_total_due
    );
END;
$$ LANGUAGE plpgsql;

-- Table for assessment results
CREATE TABLE IF NOT EXISTS test_results (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id TEXT NOT NULL,
    name TEXT,
    age INT,
    gender TEXT,
    education TEXT,
    disease TEXT,
    total_score INT,
    risk_level TEXT,
    details JSONB,
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
