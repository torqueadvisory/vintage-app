-- Dealer stock number: the dealership's own reference for a unit (e.g. "A-4471").
-- Optional free-form text -- larger stores reference cars by stock #, not VIN,
-- and use it to look a specific unit up fast. Not unique on purpose (numbers get
-- reused after a car sells; a duplicate is a soft warning in the UI, not a block).
alter table public.vehicles add column if not exists stock_number text;
