// Single source of truth for gameplay numbers — Ticket-02 standard values + Ticket-03 changes (Contract v1.2).
// game.contract.json "tuning" MUST equal TUNING (enforced by tests/headless.test.js).
export const TUNING = {
  player_speed: 6,
  carry_capacity: 10,
  lantern_cost: 10,
  lantern_count_night1: 5,
  pickup_radius: 1.0,
  interact_radius: 2.0,
  pulse_cost: 3,
  pulse_radius: 5,
  night1_duration_s: 240,
  night2_duration_s: 270,
  night3_duration_s: 300,
  flames: 3,
  invuln_s: 1.5,
  hit_drop_ratio: 0.5,
  pulse_stun_s: 2,
  pulse_push_m: 4,
  pulse_cooldown_s: 3,
  safe_radius: 6,
  shade_speed: 4.0,
  shade_hit_radius: 1.0,
  fall_enabled: true,
  dash_speed: 14,
  dash_duration_s: 0.2,
  dash_cooldown_s: 1.5,
  fuel_max: 100,
  fuel_decay_per_s: 1.0,
  fuel_per_mote: 10,
  relight_cost: 5,
  win_ratio: 0.6,
  drain_per_s: 5,
  low_fuel_threshold: 30,
  capacity_max: 20,
  // Ticket-03 score: per_second_left removed (0); extra keys are this build's names for the new rows (B10)
  score: { per_mote: 5, per_lantern: 100, per_relight: 40, per_stun: 5, per_stun_drain: 15, per_lit_at_dawn: 50, per_second_left: 0, per_flame_left: 50 },
};

// Other Ticket-02 numbers (ticks at 60 Hz) + a few own choices marked (A#) in docs/notes/phase-2-spec.md.
export const WORLD = {
  tick_hz: 60,
  gravity: 20,
  jump_speed: 7,
  accel_time_s: 0.1,          // reach/stop run speed in 0.1 s
  step_up_m: 0.35,            // (A) max ledge walked up per tick (ramps); higher = wall
  fall_y: -10,
  fall_wait_ticks: 60,
  pickup_dy_m: 1.5,
  hit_dy_m: 1.5,
  motes_initial: 20,
  motes_cap: 30,
  mote_every_ticks: 240,
  drop_ring_min_m: 1.5,
  drop_ring_max_m: 2.5,
  drop_ttl_ticks: 480,
  pulse_center_dy_m: 0.8,
  stun_push_ticks: 15,
  shade_detect_m: 12,
  shade_lose_m: 18,
  shade_first_spawn_tick: 300,
  shade_spawn_min_dist_m: 15,
  shade_spawning_ticks: 30,   // (A)
  shade_wander_speed: 1.5,    // (A)
  shade_hover_y: 1.0,         // (A) spawned shade center height
  recoil_m: 2,
  recoil_ticks: 60,
  evict_ticks: 30,
  tower_radius_m: 2,
  drifter_speed: 7,
  drifter_idle_speed: 2,
  drifter_max: 2,
  drifter_every_ticks: 1200,
  drifter_chase_carried: 5,
  drifter_chase_m: 15,
  drifter_contact_m: 1.2,
  drifter_steal_max: 3,
  drifter_flee_ticks: 240,
  drifter_drop_remove_ticks: 120,
  drifter_hover_y: 1.5,       // (A)
  charm_ticks: 600,
  charm_speed: 7.2,
  charm_respawn_ticks: 2700,
  wind_every_ticks: 1800,
  wind_duration_ticks: 300,
  wind_warn_ticks: 120,
  wind_speed: 2,
  capacity_per_light: 2,      // capacity = 10 + 2 x successful_lights (max capacity_max)
  drain_range_m: 2,
  drain_break_m: 6,           // a draining shade chases if Mây comes within 6 m
  fuel_units_per_s: 60,       // fuel kept as integer 1/60 units (Ticket-03 precision note)
};
