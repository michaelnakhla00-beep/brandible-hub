-- Check if activity was inserted
SELECT * FROM client_activity ORDER BY timestamp DESC LIMIT 10;

-- Check policies are active
SELECT policyname, cmd, roles FROM pg_policies WHERE tablename = 'client_activity';
