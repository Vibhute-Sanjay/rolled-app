-- Check if columns exist
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'messages' 
AND column_name IN ('post_id', 'unrolled_id', 'activity_id');

-- Check if constraints exist
SELECT constraint_name, check_clause
FROM information_schema.check_constraints
WHERE constraint_name = 'messages_msg_type_check';

-- Check if anon_posts exists
SELECT table_name 
FROM information_schema.tables 
WHERE table_name = 'anon_posts';
