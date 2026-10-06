-- CHECK FOREIGN KEYS FOR CASCADE
SELECT
    kcu.table_name,
    kcu.column_name,
    kcu.constraint_name,
    rc.delete_rule
FROM information_schema.key_column_usage kcu
JOIN information_schema.referential_constraints rc
    ON kcu.constraint_name = rc.constraint_name
WHERE kcu.table_name = 'comments';
