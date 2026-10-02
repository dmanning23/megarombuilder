export const SCREEN_W = 256;
export const SCREEN_H = 240;

export const PLAYER_W = 14;
export const PLAYER_H = 22;

export const SHOT_W = 6;
export const SHOT_H = 4;
export const SHOT_SPEED = 4;

// How fast speed changes per step when running on ice.
export const ICE_ACCEL = 0.05;
// Releasing jump while rising faster than this cuts the rise to this speed.
export const JUMP_CUT_SPEED = 1;

export const TRANSITION_STEPS = 48;
export const RESPAWN_STEPS = 90;

// Enemies vanish when this far outside the screen.
export const DESPAWN_MARGIN = 32;
export const ENEMY_GRAVITY = 0.25;
export const ENEMY_MAX_FALL = 7;
export const ENEMY_SHOT_SIZE = 6;
export const ENEMY_FLASH_STEPS = 4;

// After a hit the player is pushed back for HURT_STEPS, then cannot be hurt until INVULN_STEPS have passed.
export const HURT_STEPS = 16;
export const INVULN_STEPS = 60;
export const KNOCKBACK_SPEED = 0.75;

export const BOSS_INTRO_STEPS = 60;
export const BOSS_IDLE_STEPS = 40;
export const BOSS_FLASH_STEPS = 20;
