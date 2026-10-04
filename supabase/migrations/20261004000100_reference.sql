-- Checklist templates (mirrors src/lib/checklists.ts) and helper functions used by the ingest function.

insert into public.checklist_templates (service_type, position, label_key) values
  ('inspection_6m', 0, 'visual_inspection'),
  ('inspection_6m', 1, 'enclosure_seals'),
  ('inspection_6m', 2, 'coolant_level'),
  ('inspection_6m', 3, 'pump_operation'),
  ('inspection_6m', 4, 'dc_torque'),
  ('inspection_6m', 5, 'contactors_fuses'),
  ('inspection_6m', 6, 'bms_logs'),
  ('inspection_6m', 7, 'cell_balance'),
  ('inspection_6m', 8, 'fire_detection_test'),
  ('inspection_6m', 9, 'fire_pressure'),
  ('inspection_6m', 10, 'hmi_comm'),
  ('inspection_6m', 11, 'clean_filters'),
  ('inspection_6m', 12, 'firmware'),
  ('inspection_6m', 13, 'customer_briefing'),
  ('annual_coolant_fire', 0, 'replace_coolant'),
  ('annual_coolant_fire', 1, 'cooling_pressure_test'),
  ('annual_coolant_fire', 2, 'inspect_cooling_plates'),
  ('annual_coolant_fire', 3, 'fire_valves_test'),
  ('annual_coolant_fire', 4, 'compartment_flood_test'),
  ('annual_coolant_fire', 5, 'fire_water_filter'),
  ('annual_coolant_fire', 6, 'insulation_test'),
  ('annual_coolant_fire', 7, 'transformer_inspection'),
  ('annual_coolant_fire', 8, 'thermal_imaging'),
  ('annual_coolant_fire', 9, 'capacity_test'),
  ('repair', 0, 'diagnose_fault'),
  ('repair', 1, 'isolate_dc'),
  ('repair', 2, 'replace_component'),
  ('repair', 3, 'verify_operation'),
  ('repair', 4, 'clear_fault_codes'),
  ('repair', 5, 'customer_briefing'),
  ('module_replacement', 0, 'isolate_dc'),
  ('module_replacement', 1, 'verify_zero_voltage'),
  ('module_replacement', 2, 'remove_faulty_module'),
  ('module_replacement', 3, 'install_replacement'),
  ('module_replacement', 4, 'record_serials'),
  ('module_replacement', 5, 'dc_torque'),
  ('module_replacement', 6, 'reconnect_cooling'),
  ('module_replacement', 7, 'bms_addressing'),
  ('module_replacement', 8, 'cell_balance'),
  ('module_replacement', 9, 'verify_operation'),
  ('commissioning', 0, 'site_survey'),
  ('commissioning', 1, 'mounting'),
  ('commissioning', 2, 'dc_torque'),
  ('commissioning', 3, 'reconnect_cooling'),
  ('commissioning', 4, 'fire_detection_test'),
  ('commissioning', 5, 'hmi_comm'),
  ('commissioning', 6, 'capacity_test'),
  ('commissioning', 7, 'customer_briefing')
on conflict do nothing;

-- Adds the energy of one telemetry interval to the station's daily roll-up.
create or replace function public.add_daily_energy(
  p_station uuid, p_day date,
  p_charged numeric, p_discharged numeric, p_solar numeric, p_load numeric, p_import numeric, p_export numeric,
  p_soh numeric, p_cycles numeric, p_temp_max numeric, p_temp_avg numeric, p_spread numeric
) returns public.station_daily
language plpgsql security definer set search_path = public as $$
declare v public.station_daily; v_tariff numeric; v_export_tariff numeric;
begin
  select tariff_amd, export_tariff_amd into v_tariff, v_export_tariff from public.stations where id = p_station;
  insert into public.station_daily as d (station_id, day, charged_kwh, discharged_kwh, solar_kwh, load_kwh, grid_import_kwh, grid_export_kwh, soh, cycles, temp_max, temp_avg, spread_mv)
  values (p_station, p_day, p_charged, p_discharged, p_solar, p_load, p_import, p_export, p_soh, p_cycles, p_temp_max, p_temp_avg, p_spread)
  on conflict (station_id, day) do update set
    charged_kwh = d.charged_kwh + excluded.charged_kwh,
    discharged_kwh = d.discharged_kwh + excluded.discharged_kwh,
    solar_kwh = d.solar_kwh + excluded.solar_kwh,
    load_kwh = d.load_kwh + excluded.load_kwh,
    grid_import_kwh = d.grid_import_kwh + excluded.grid_import_kwh,
    grid_export_kwh = d.grid_export_kwh + excluded.grid_export_kwh,
    soh = excluded.soh,
    cycles = excluded.cycles,
    temp_max = greatest(d.temp_max, excluded.temp_max),
    temp_avg = excluded.temp_avg,
    spread_mv = greatest(d.spread_mv, excluded.spread_mv)
  returning * into v;
  update public.station_daily set
    self_consumption_pct = case when solar_kwh > 0.01 then greatest(0, least(100, round((solar_kwh - grid_export_kwh) / solar_kwh * 100))) else 0 end,
    savings_amd = round((load_kwh - grid_import_kwh) * v_tariff + grid_export_kwh * v_export_tariff)
  where station_id = p_station and day = p_day
  returning * into v;
  return v;
end $$;
revoke execute on function public.add_daily_energy from anon, authenticated;

-- Optional: run the communication-lost check every 5 minutes (requires the pg_cron extension).
-- create extension if not exists pg_cron;
-- select cron.schedule('armen-comm-lost', '*/5 * * * *', 'select public.check_comm_lost()');
