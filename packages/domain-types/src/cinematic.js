export const SHOT_SIZES = Object.freeze({
  ECU: 'ECU',
  CU: 'CU',
  MCU: 'MCU',
  MS: 'MS',
  MLS: 'MLS',
  LS: 'LS',
  WS: 'WS',
  EWS: 'EWS',
});

export const CAMERA_MOTIONS = Object.freeze({
  STATIC: 'static',
  PAN_LEFT: 'pan_left',
  PAN_RIGHT: 'pan_right',
  TILT_UP: 'tilt_up',
  TILT_DOWN: 'tilt_down',
  DOLLY_IN: 'dolly_in',
  DOLLY_OUT: 'dolly_out',
  TRACKING: 'tracking',
  CRANE_UP: 'crane_up',
  CRANE_DOWN: 'crane_down',
  HANDHELD: 'handheld',
  STEADICAM: 'steadicam',
});

export const SHOT_KEYFRAME_ROLES = Object.freeze({
  KEY: 'key',
  SECONDARY: 'secondary',
  INSERT: 'insert',
});

export const SHOT_RELATION_TYPES = Object.freeze({
  MATCH_CUT: 'match_cut',
  CUT_ON_ACTION: 'cut_on_action',
  INSERT: 'insert',
  REACTION: 'reaction',
  REVERSE: 'reverse',
  ESTABLISH: 'establish',
  PARALLEL: 'parallel',
});

export const RELATION_INTENTS = Object.freeze({
  FOCUS_SHIFT: 'focus_shift',
  REACTION: 'reaction',
  ACTION_CONTINUATION: 'action_continuation',
  GEOGRAPHY: 'geography',
  TENSION: 'tension',
  REVEAL: 'reveal',
});
