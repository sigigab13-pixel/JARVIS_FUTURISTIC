# RLS medicine verification

This lab change is intentionally **not applied** to production.

Before promotion, verify the draft against a Supabase development branch:

1. Apply/test the draft migration in the development database.
2. Confirm `jarvis_plan_prices` returns only active prices to `anon`/`authenticated`.
3. Confirm `jarvis_family_access` lets an authenticated user read only their own row.
4. Confirm browser roles cannot INSERT, UPDATE, or DELETE family-access rows.
5. Re-run the Supabase Security Advisor.
6. Confirm the application pricing endpoint still returns its regional prices.
7. Confirm service-role backend reads/writes continue to work.

Important schema limitation:
`jarvis_family_access` currently has no `family_id` or family-owner table, so this draft deliberately does **not** create a fictional owner/member policy. That requires a separate family-membership schema review.

Rollback for the lab is to drop the two policies and revoke the newly granted SELECT privileges; production should be changed only through a reviewed migration.
