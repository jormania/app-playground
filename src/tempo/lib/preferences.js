import { loadPreferences } from './storage'

// Shared between every screen that can open Settings (currently the home
// screen and the Player) so they read/write the exact same shape and stay in
// sync via the underlying localStorage key.
export const DEFAULT_PREFERENCES = {
  sound: true,
  silent: false, // master mute for all audio — never touches vibration, that's a separate setting
  wakeLock: true,
  haptics: true,
  prepare: true, // a 3·2·1 count-in before the first step
  volume: 'normal', // cue volume: 'soft' | 'normal' | 'loud'
  intervalChime: false, // a soft bell every few minutes of a running session
  chimeInterval: 5, // minutes between interval chimes: 3 | 5 | 10
  tickWindow: 5, // seconds of anticipatory tick + ring pulse before a ding-family transition: 3 | 5 | 8
}

// The audio actually in effect right now — Silent mode overrides the Sound
// cues preference without changing its stored value, so turning Silent back
// off restores whatever the user had before.
export function soundIsOn(preferences) {
  return preferences.sound && !preferences.silent
}

export function loadPlayerPreferences() {
  return { ...DEFAULT_PREFERENCES, ...loadPreferences({}) }
}
