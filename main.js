// ==========================================
// CONFIGURACIÓN DE LA APP (VERSIÓN LIGERA)
// ==========================================
var DEBUG_MODE = 0, STATE_WARMUP = 0, STATE_STAGE_1 = 1, STATE_STAGE_2 = 2,
  STATE_STAGE_3 = 3, STATE_STAGE_4 = 4, STATE_COOLDOWN = 5, STATE_DONE = 6;

var state, timeInState, maxHR, currentTemplate, stageDurIndex, isPaused;
var lt1_hr, lt1_pace, lt2_hr, lt2_pace, lt2_power;
var h1_hrSum, h1_spdSum, h1_count, h1_spdCount;
var h2_hrSum, h2_spdSum, h2_count, h2_spdCount;
var h3_pwrSum, h3_pwrCount, stage_results;
var zs_active, dfa_current, debugTimer, outOfRangeSeconds, alertShowTimer;
var countdownValue = 6, isCountdownActive = 0;
var WARMUP_DUR = 600, STAGE_1_DUR = 600, STAGE_2_DUR = 600, STAGE_3_DUR = 600, STAGE_4_DUR = 300, COOLDOWN_DUR = 300;

var resetApp = function () {
  state = STATE_WARMUP; timeInState = 0; maxHR = 190; currentTemplate = 'countdown'; stageDurIndex = 0;
  countdownValue = 6;
  isCountdownActive = 0;
  lt1_hr = 0; lt1_pace = 0; lt2_hr = 0; lt2_pace = 0; lt2_power = 0;
  h1_hrSum = 0; h1_spdSum = 0; h1_count = 0; h1_spdCount = 0;
  h2_hrSum = 0; h2_spdSum = 0; h2_count = 0; h2_spdCount = 0;
  h3_pwrSum = 0; h3_pwrCount = 0; stage_results = [];
  zs_active = 0; dfa_current = 0; debugTimer = 0; isPaused = 0;
  outOfRangeSeconds = 0; alertShowTimer = 0;
};

function onLoad(input, output) { resetApp(); }
function onExerciseStart(input, output) { resetApp(); }
function onExercisePause(input, output) { isPaused = 1; }
function onExerciseContinue(input, output) { isPaused = 0; }

var tickCountdown = function () {
  if (isCountdownActive === 0) return;

  switch (countdownValue) {
    case 6:
      countdownValue = 5;
      break;
    case 5:
      countdownValue = 4;
      break;
    case 4:
      countdownValue = 3;
      break;
    case 3:
      countdownValue = 2;
      break;
    case 2:
      countdownValue = 1;
      break;
    case 1:
      countdownValue = 0;
      playIndication("Confirm");
      break;
    case 0:
      countdownValue = -2;
      currentTemplate = 't';
      unload('_cm');
      break;
  }
};

var evaluateCountdown = function (input, output) {
  output.stateNum = state;
  output.hrTargetNum = 0;
  output.timeRemaining = 0;
  output.testModeNum = 0;
  output.dfaCurrent = 0;
  output.hrZoneNum = 0;
  output.lt1HR = 0;
  output.lt2HR = 0;
  output.lt1Pace = 0;
  output.lt2Pace = 0;
  output.lt2Power = 0;

  tickCountdown();

  if (countdownValue === 6) {
    output.countdown = 5;
  } else if (countdownValue >= 0) {
    output.countdown = countdownValue;
  } else if (countdownValue === -1) {
    output.countdown = 0;
  } else {
    output.countdown = -2;
  }
};

var handleCountdownEvent = function () {
  if (isCountdownActive === 0) {
    isCountdownActive = 1;
    unload('_cm');
  } else {
    currentTemplate = 't';
    countdownValue = -2;
    unload('_cm');
  }
};

function onEvent(input, output, eventId) {
  if (eventId === 1) {
    if (state === STATE_DONE) {
      if (currentTemplate !== 'results') { currentTemplate = 'results'; unload('_cm'); }
      return;
    }
    if (currentTemplate === 'countdown') {
      handleCountdownEvent();
    } else if (currentTemplate === 't') {
      if (DEBUG_MODE === 1) { currentTemplate = 'debug'; debugTimer = 0; unload('_cm'); }
    } else {
      currentTemplate = 't'; debugTimer = 0; unload('_cm');
    }
  }
}

var accumulateDecoupling = function (input, dur) {
  var offset = dur > 120 ? 60 : 0;
  if (timeInState < offset) return;
  var isH1 = timeInState < (offset + (dur - offset) / 2);
  var hr = input.HeartRate || 0, spd = input.Speed || 0;
  if (isH1) {
    if (hr > 0) { h1_hrSum += hr; h1_count++; }
    if (spd > 0) { h1_spdSum += spd; h1_spdCount++; }
  } else {
    if (hr > 0) { h2_hrSum += hr; h2_count++; }
    if (spd > 0) { h2_spdSum += spd; h2_spdCount++; }
  }
};

var saveStageResult = function (idx) {
  var ef1 = 0; if (h1_count > 0 && h1_hrSum > 0) ef1 = (h1_spdSum / h1_spdCount) / (h1_hrSum / h1_count);
  var ef2 = 0; if (h2_count > 0 && h2_hrSum > 0) ef2 = (h2_spdSum / h2_spdCount) / (h2_hrSum / h2_count);
  var dec = 0; if (ef1 > 0) dec = ((ef1 - ef2) / ef1) * 100;
  stage_results[stage_results.length] = {
    index: idx, dec: dec,
    hr: h2_count > 0 ? h2_hrSum / h2_count : 0,
    pace: h2_spdCount > 0 ? h2_spdSum / h2_spdCount : 0
  };
};

var calculateThresholds = function () {
  var f1 = 0, f2 = 0;
  if (stage_results.length > 0) { lt1_hr = stage_results[0].hr; lt1_pace = stage_results[0].pace; }
  for (var i = 0; i < stage_results.length; i++) {
    var sr = stage_results[i];
    if (f1 === 0 && i <= 1 && sr.dec > 5.0) { lt1_hr = sr.hr; lt1_pace = sr.pace; f1 = 1; }
    if (f2 === 0 && (sr.dec > 10.0 || i === stage_results.length - 1)) { lt2_hr = sr.hr; lt2_pace = sr.pace; f2 = 1; }
  }
  if (lt2_hr < lt1_hr) { lt2_hr = lt1_hr; lt2_pace = lt1_pace; }
};

function evaluate(input, output) {
  if (state === undefined) return;

  if (currentTemplate === 'countdown') {
    evaluateCountdown(input, output);
    return;
  }

  if (isPaused === 1) return;

  if (currentTemplate === 'debug') {
    debugTimer++;
    if (debugTimer >= 30) { debugTimer = 0; currentTemplate = 't'; }
  } else debugTimer = 0;

  if (currentTemplate === 'alert') {
    alertShowTimer--;
    if (alertShowTimer <= 0) { alertShowTimer = 0; currentTemplate = 't'; unload('_cm'); }
  } else alertShowTimer = 0;

  var advance = 0, tLow = 0, tHigh = 0, tRem = 0;
  timeInState++;

  if (input.MaxHR && input.MaxHR > 0) {
    maxHR = input.MaxHR < 10 ? input.MaxHR * 60 : input.MaxHR;
  }

  switch (state) {
    case STATE_WARMUP:
      tLow = maxHR * 0.62; tHigh = maxHR * 0.69; tRem = WARMUP_DUR - timeInState;
      if (timeInState >= WARMUP_DUR) advance = 1; break;
    case STATE_STAGE_1:
      tLow = maxHR * 0.65; tHigh = maxHR * 0.76; tRem = STAGE_1_DUR - timeInState;
      accumulateDecoupling(input, STAGE_1_DUR);
      if (timeInState >= STAGE_1_DUR) { saveStageResult(1); advance = 1; } break;
    case STATE_STAGE_2:
      tLow = maxHR * 0.72; tHigh = maxHR * 0.84; tRem = STAGE_2_DUR - timeInState;
      accumulateDecoupling(input, STAGE_2_DUR);
      if (timeInState >= STAGE_2_DUR) { saveStageResult(2); advance = 1; } break;
    case STATE_STAGE_3:
      tLow = maxHR * 0.80; tHigh = maxHR * 0.91; tRem = STAGE_3_DUR - timeInState;
      accumulateDecoupling(input, STAGE_3_DUR);
      if (timeInState >= 60 && input.Power > 0) { h3_pwrSum += input.Power; h3_pwrCount++; }
      if (timeInState >= STAGE_3_DUR) { saveStageResult(3); lt2_power = h3_pwrCount > 0 ? Math.round(h3_pwrSum / h3_pwrCount) : 0; advance = 1; } break;
    case STATE_STAGE_4:
      tLow = maxHR * 0.87; tHigh = maxHR * 1.0; tRem = STAGE_4_DUR - timeInState;
      accumulateDecoupling(input, STAGE_4_DUR);
      if (timeInState >= STAGE_4_DUR) { saveStageResult(4); calculateThresholds(); advance = 1; } break;
    case STATE_COOLDOWN:
      tLow = maxHR * 0.50; tHigh = maxHR * 0.64; tRem = COOLDOWN_DUR - timeInState;
      if (timeInState >= COOLDOWN_DUR) { playIndication("Confirm"); state = STATE_DONE; currentTemplate = 'results'; unload('_cm'); } break;
  }

  if (state !== STATE_DONE && tRem >= 1 && tRem <= 5) playIndication("StartTimer");

  if (advance === 1) {
    playIndication("Interval"); state++; timeInState = 0;
    h1_hrSum = 0; h1_spdSum = 0; h1_count = 0; h1_spdCount = 0;
    h2_hrSum = 0; h2_spdSum = 0; h2_count = 0; h2_spdCount = 0;
    h3_pwrSum = 0; h3_pwrCount = 0; outOfRangeSeconds = 0;
  }

  var hr = Math.round((input.HeartRate || 0) * 60);

  // ===================================
  // LÓGICA DE ALERTA 
  // ===================================
  if (state !== STATE_DONE && hr > 0 && tLow > 0) {
    if (hr < Math.round(tLow) || hr > Math.round(tHigh)) {
      if (currentTemplate !== 'alert') {
        outOfRangeSeconds++;
        if (outOfRangeSeconds >= 20) {
          playIndication("Interval");
          currentTemplate = 'alert';
          alertShowTimer = 5;
          outOfRangeSeconds = 0;
          unload('_cm');
        }
      }
    } else {
      outOfRangeSeconds = 0;
    }
  } else {
    outOfRangeSeconds = 0;
  }
  // ===================================

  var zone = 0;
  if (maxHR > 0 && hr > 0) {
    if (hr >= Math.round(maxHR * 0.87)) zone = 5;
    else if (hr >= Math.round(maxHR * 0.82)) zone = 4;
    else if (hr >= Math.round(maxHR * 0.77)) zone = 3;
    else if (hr >= Math.round(maxHR * 0.72)) zone = 2;
    else zone = 1;
  }

  output.stateNum = state;
  output.hrTargetNum = Math.round(tLow) * 1000 + Math.round(tHigh);
  output.timeRemaining = tRem;
  output.testModeNum = 0;
  output.dfaCurrent = 0;
  output.hrZoneNum = zone;
  output.countdown = countdownValue;

  if (state >= STATE_COOLDOWN) {
    output.lt1HR = Math.round(lt1_hr * 60) / 60;
    output.lt2HR = Math.round(lt2_hr * 60) / 60;
    output.lt1Pace = lt1_pace;
    output.lt2Pace = lt2_pace;
    output.lt2Power = lt2_power;
  }
}

function getUserInterface(input, output) {
  return {
    template: currentTemplate || 't',
    zn: { input: '/Activity/Zones/HeartRate/CurrentZone' },
    segm: 5,
    currentHR: { input: '/Activity/Move/-1/HeartRate/Current' },
    hrTarget: { input: '/Zapp/{zapp_index}/Output/hrTargetNum' },
    stateNum: { input: '/Zapp/{zapp_index}/Output/stateNum' },
    hrZone: { input: '/Zapp/{zapp_index}/Output/hrZoneNum' },
    countdown: { input: '/Zapp/{zapp_index}/Output/countdown' }
  };
}

function getSummaryOutputs(input, output) {
  return [
    { id: 'lt1HR', name: "LT1 HR", format: 'HeartRate_Fourdigits', value: output.lt1HR },
    { id: 'lt2HR', name: "LT2 HR", format: 'HeartRate_Fourdigits', value: output.lt2HR },
    { id: 'lt2Pace', name: "LT2 Pace", format: 'Pace_Fourdigits', value: output.lt2Pace },
    { id: 'lt2Power', name: "Critical Power", format: 'Power_Accurate', value: output.lt2Power }
  ];
}