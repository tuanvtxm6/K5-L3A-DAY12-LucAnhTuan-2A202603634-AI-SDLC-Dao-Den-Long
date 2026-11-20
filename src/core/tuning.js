// Single source of truth for gameplay numbers.
// game.contract.json "tuning" MUST equal TUNING (enforced by tests/contract.test.js).
export const TUNING = {
  player_speed: 6,
  carry_capacity: 5,
  lantern_cost: 5,
  lantern_count_night1: 5,
  pickup_radius: 1.0,
  interact_radius: 2.5,
  pulse_cost: 1,
  pulse_radius: 6,
  night1_duration_s: 300,
  flames: 3,
  invuln_s: 1.5,
  hit_drop_ratio: 0.5,
  pulse_stun_s: 3,
  pulse_push_m: 4,
  pulse_cooldown_s: 1,
  safe_radius: 5,
  shade_speed: 3.5,
  shade_hit_radius: 1.0,
  fall_enabled: false,
  score: { per_mote: 10, per_lantern: 100, per_stun: 20, per_second_left: 2, per_flame_left: 50 },
};

// Internal numbers not in the contract (documented in docs/notes/phase-1-assumptions.md).
export const WORLD = {
  tick_hz: 60,
  island_radius: 40,       // player/shades are clamped inside (fall disabled)
  lantern_ring_radius: 20, // default L1..L5 positions
  gravity: 20,             // m/s^2
  jump_speed: 7,           // m/s
  motes_initial: 20,
  motes_target: 20,        // random_motes refills up to this many
  mote_respawn_s: 2,
  shade_first_spawn_s: 10,
  shade_spawn_every_s: 20,
  shade_max: 4,
  shade_spawn_radius: 36,
  shade_hover_y: 1.0,
};
