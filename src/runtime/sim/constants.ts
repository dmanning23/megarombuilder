export const SCREEN_W = 256;
export const SCREEN_H = 240;

export const PLAYER_W = 14;
export const PLAYER_H = 22;

// Sliding: a low body that fits through one-tile gaps, for about four tiles at more than running speed.
export const SLIDE_H = 14;
export const SLIDE_STEPS = 26;
export const SLIDE_SPEED = 2.5;

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
// A hurt boss (below half health) pauses less between attacks.
export const BOSS_HURRIED_IDLE_STEPS = 24;
// The boss's new attacks.
export const AIMED_SHOT_SPEED = 3;
export const RAIN_SPEED = 2.5;
export const RAIN_SPACING = 40; // pixels between falling shots: every gap is over two tiles
export const BIG_SHOT_SIZE = 16;
export const BIG_SHOT_SPEED = 1.25;
export const BIG_SHOT_DAMAGE = 4;
export const BIG_SHOT_HEIGHT = 30; // its top above the boss's feet: a 14-high slide passes under

// How long the hero is drawn in a shooting pose after firing.
export const SHOT_POSE_STEPS = 12;

// Holding shoot for a second charges a big shot: 12 by 10, 3 damage.
export const CHARGE_STEPS = 60;
export const CHARGED_W = 12;
export const CHARGED_H = 10;
export const CHARGED_DAMAGE = 3;
// Holding for two seconds, with the level 2 ability, charges a bigger shot: 16 by 12, 5 damage.
export const CHARGE2_STEPS = 120;
export const CHARGED2_W = 16;
export const CHARGED2_H = 12;
export const CHARGED2_DAMAGE = 5;
