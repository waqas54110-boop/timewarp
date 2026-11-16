// Tables for the realistic people and vehicles (no Three.js here, so they can be unit tested).
// The pictures live in public/media/sprites/. scripts/sprites/build_sprites.py makes them from the green-screen sheets.
(function (root) {
  const COLS = 6, CELL = 320, STAND_PX = 252, PAD_B = 14;                    // atlas layout: 6 columns of 320 px cells, the standing figure is 252 px tall
  const FRAMES = {                                                          // atlas order, row by row
    male: ['idle', 'walk1', 'run1', 'run2', 'run3', 'guard', 'punch', 'kick', 'slide', 'flykick', 'hit', 'kneel', 'arms', 'turn', 'back'],
    female: ['idle', 'walk1', 'walk2', 'walk3', 'run1', 'run2', 'run3', 'guard', 'guard2', 'punch', 'kick', 'slide', 'flykick', 'hit', 'kneel', 'arms', 'turn', 'back'],
    police: ['idle', 'walk1', 'walk2', 'run1', 'run2', 'aim', 'point', 'radio', 'guard', 'kick', 'kneelaim', 'back', 'backwalk', 'crawl', 'stop', 'run3'],
  };
  // Which frames make each movement (side view, and the view from behind while walking away from the camera).
  const CYCLES = {
    male: { walk: ['walk1', 'idle', 'walk1', 'run1'], run: ['run1', 'run2', 'run3', 'run2'], backwalk: ['turn', 'back'], punch: ['guard', 'punch'], kick: ['guard', 'kick'], handsup: ['arms'], talk: ['arms', 'idle'], wave: ['arms', 'idle'], dance: ['arms', 'guard', 'turn', 'slide'], pray: ['kneel'], hurt: ['hit'] },
    female: { walk: ['walk1', 'walk2', 'walk3', 'walk2'], run: ['run1', 'run2', 'run3', 'run2'], backwalk: ['turn', 'back'], punch: ['guard', 'punch'], kick: ['guard2', 'kick'], handsup: ['arms'], talk: ['arms', 'idle'], wave: ['arms', 'idle'], dance: ['arms', 'guard', 'turn', 'slide'], pray: ['kneel'], hurt: ['hit'] },
    police: { walk: ['walk1', 'walk2'], run: ['run1', 'run2', 'run3', 'run2'], backwalk: ['backwalk', 'back'], punch: ['guard', 'guard'], kick: ['guard', 'kick'], handsup: ['stop'], talk: ['radio', 'point'], wave: ['stop', 'idle'], dance: ['stop', 'guard', 'point', 'radio'], pray: ['kneelaim'], hurt: ['crawl'] },
  };
  const IDLE_BACK = { male: 'back', female: 'back', police: 'back' };
  const VEHICLE_LENGTH = { sports: 3.6, sedan: 3.8, taxi: 3.8, police: 3.9, citybus: 8.4, coach: 9.6, doubledecker: 8.7, rescue: 12.5, military: 13, bluecopter: 11.5 };   // metres, nose to tail
  const api = { COLS, CELL, STAND_PX, PAD_B, FRAMES, CYCLES, IDLE_BACK, VEHICLE_LENGTH };
  if (typeof module === 'object' && module.exports) module.exports = api; else root.TimeWarpSprites = api;
})(typeof window !== 'undefined' ? window : this);
