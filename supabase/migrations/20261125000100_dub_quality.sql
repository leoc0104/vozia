-- How each line was performed (the directions spoken, takes, re-takes, how close its words landed) and how close
-- the whole dub came to the original, written by the worker and shown on the dub page.
alter table public.dub_segments add column performance jsonb;
alter table public.dubs add column quality jsonb;
