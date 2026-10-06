-- check constraint definition
SELECT pg_get_constraintdef(oid) 
FROM pg_constraint 
WHERE conname = 'notifications_type_check';
