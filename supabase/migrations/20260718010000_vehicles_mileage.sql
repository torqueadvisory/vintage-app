-- Mileage at acquisition. Optional integer; part of the vehicle's identity
-- alongside year/make/model (dealers know units as "the '19 F-150 with 82k").
alter table public.vehicles add column if not exists mileage integer;
