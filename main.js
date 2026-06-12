// ==========================================
// CONFIGURACIÓN DE LA APP
// ==========================================
// Cambiar a 1 para activar la pantalla de Diagnóstico/Debug en el reloj
var DEBUG_MODE = 1;

var STATE_WARMUP, STATE_STAGE_1, STATE_STAGE_2, STATE_STAGE_3, STATE_STAGE_4,
  STATE_COOLDOWN, STATE_DONE, state, timeInState, maxHR,
  WARMUP_DUR, STAGE_1_DUR, STAGE_2_DUR, STAGE_3_DUR, STAGE_4_DUR, COOLDOWN_DUR,
  lt1_hr, lt1_pace, lt2_hr, lt2_pace, lt2_power, currentTemplate, uiLoaded,
  h1_hrSum, h1_spdSum, h1_count, h1_spdCount, h2_hrSum, h2_spdSum, h2_count, h2_spdCount, stage_results,
  zs_active, testModeNum, dfa_current, debugTimer, stageDurIndex, lt1_detected, lt2_detected,
  h3_pwrSum, h3_pwrCount, isPaused;

function onLoad(input, output) {
  STATE_WARMUP = 0;
  STATE_STAGE_1 = 1;
  STATE_STAGE_2 = 2;
  STATE_STAGE_3 = 3;
  STATE_STAGE_4 = 4;
  STATE_COOLDOWN = 5;
  STATE_DONE = 6;

  state = STATE_WARMUP;
  timeInState = 0;
  maxHR = 190;
  currentTemplate = 't';

  stageDurIndex = 0;
  WARMUP_DUR = 600;
  STAGE_1_DUR = 600;
  STAGE_2_DUR = 600;
  STAGE_3_DUR = 600;
  STAGE_4_DUR = 300;
  COOLDOWN_DUR = 300;

  lt1_hr = 0;
  lt1_pace = 0;
  lt2_hr = 0;
  lt2_pace = 0;
  lt2_power = 0;

  h1_hrSum = 0; h1_spdSum = 0; h1_count = 0; h1_spdCount = 0;
  h2_hrSum = 0; h2_spdSum = 0; h2_count = 0; h2_spdCount = 0;
  h3_pwrSum = 0; h3_pwrCount = 0;
  stage_results = [];

  zs_active = 0;
  testModeNum = 0; // 0 = STANDARD, 1 = ADVANCED
  dfa_current = 0;
  debugTimer = 0;
  lt1_detected = false;
  lt2_detected = false;
  isPaused = 0;
}

function onExerciseStart(input, output) {
  state = STATE_WARMUP;
  timeInState = 0;
  currentTemplate = 't';

  h1_hrSum = 0; h1_spdSum = 0; h1_count = 0; h1_spdCount = 0;
  h2_hrSum = 0; h2_spdSum = 0; h2_count = 0; h2_spdCount = 0;
  h3_pwrSum = 0; h3_pwrCount = 0;
  stage_results = [];

  zs_active = 0;
  testModeNum = 0;
  dfa_current = 0;
  debugTimer = 0;
  stageDurIndex = 0;
  lt1_detected = false;
  lt2_detected = false;
  isPaused = 0;

  WARMUP_DUR = 600;
  STAGE_1_DUR = 600;
  STAGE_2_DUR = 600;
  STAGE_3_DUR = 600;
  STAGE_4_DUR = 300;
  COOLDOWN_DUR = 300;
}

function onEvent(input, output, eventId) {
  if (eventId === 1) { // 1 = Toggle page
    if (state === STATE_DONE) {
      if (currentTemplate !== 'results') {
        currentTemplate = 'results';
        unload('_cm');
      }
      return;
    }
    if (currentTemplate === 't') {
      if (DEBUG_MODE === 1) {
        currentTemplate = 'debug';
        debugTimer = 0;
        unload('_cm');
      }
    } else {
      currentTemplate = 't';
      debugTimer = 0;
      unload('_cm');
    }
  }
}

var accumulateDecoupling = function (input, stageDur) {
  var offset = stageDur > 120 ? 60 : 0;
  if (timeInState < offset) return;

  var halfPoint = offset + (stageDur - offset) / 2;

  if (timeInState < halfPoint) {
    if (input.HeartRate > 0) {
      h1_hrSum += input.HeartRate;
      h1_count++;
    }
    if (input.Speed && input.Speed > 0) {
      h1_spdSum += input.Speed;
      h1_spdCount++;
    }
  } else {
    if (input.HeartRate > 0) {
      h2_hrSum += input.HeartRate;
      h2_count++;
    }
    if (input.Speed && input.Speed > 0) {
      h2_spdSum += input.Speed;
      h2_spdCount++;
    }
  }
};

var saveStageResult = function (stageIndex) {
  var avg_hr1 = h1_count > 0 ? h1_hrSum / h1_count : 0;
  var avg_spd1 = h1_spdCount > 0 ? h1_spdSum / h1_spdCount : 0;
  var avg_hr2 = h2_count > 0 ? h2_hrSum / h2_count : 0;
  var avg_spd2 = h2_spdCount > 0 ? h2_spdSum / h2_spdCount : 0;

  var ef1 = avg_hr1 > 0 ? avg_spd1 / avg_hr1 : 0;
  var ef2 = avg_hr2 > 0 ? avg_spd2 / avg_hr2 : 0;

  var decoupling = 0;
  if (ef1 > 0) {
    decoupling = ((ef1 - ef2) / ef1) * 100;
  }

  stage_results[stage_results.length] = {
    index: stageIndex,
    dec: decoupling,
    hr: avg_hr2,
    pace: avg_spd2
  };
};

var calculateThresholds = function () {
  var foundLT1 = false;
  var foundLT2 = false;

  if (stage_results.length > 0) {
    lt1_hr = stage_results[0].hr;
    lt1_pace = stage_results[0].pace;
  }

  for (var i = 0; i < stage_results.length; i++) {
    var sr = stage_results[i];
    if (!foundLT1 && i <= 1 && sr.dec > 5.0) {
      lt1_hr = sr.hr;
      lt1_pace = sr.pace;
      foundLT1 = true;
    }
    if (!foundLT2 && (sr.dec > 10.0 || i === stage_results.length - 1)) {
      lt2_hr = sr.hr;
      lt2_pace = sr.pace;
      foundLT2 = true;
    }
  }
  if (lt2_hr < lt1_hr) {
    lt2_hr = lt1_hr;
    lt2_pace = lt1_pace;
  }
};

function onExercisePause(input, output) {
  isPaused = 1;
}

function onExerciseContinue(input, output) {
  isPaused = 0;
}

function evaluate(input, output) {
  if (state === undefined) return;
  if (isPaused === 1) return;

  if (currentTemplate === 'debug') {
    debugTimer++;
    if (debugTimer >= 30) {
      debugTimer = 0;
      currentTemplate = 't';
    }
  } else {
    debugTimer = 0;
  }

  var shouldAdvance = false;
  timeInState++;

  if (input.MaxHR && input.MaxHR > 0) {
    if (input.MaxHR < 10) {
      maxHR = input.MaxHR * 60;
    } else {
      maxHR = input.MaxHR;
    }
  }

  var targetLow = 0, targetHigh = 0;
  var stageLabel = "WARM UP";
  var stepLabel = "";
  var timeRem = 0;

  switch (state) {
    case STATE_WARMUP:
      stageLabel = "Warm Up";
      targetLow = maxHR * 0.62;
      targetHigh = maxHR * 0.69;
      stepLabel = "PRE";
      timeRem = WARMUP_DUR - timeInState;
      if (timeInState >= WARMUP_DUR) shouldAdvance = true;
      break;
    case STATE_STAGE_1:
      stageLabel = "Stable";
      targetLow = maxHR * 0.65;
      targetHigh = maxHR * 0.76;
      stepLabel = "1/4";
      timeRem = STAGE_1_DUR - timeInState;
      accumulateDecoupling(input, STAGE_1_DUR);
      if (timeInState >= STAGE_1_DUR) {
        saveStageResult(1);
        shouldAdvance = true;
      }
      break;
    case STATE_STAGE_2:
      stageLabel = "Stable";
      targetLow = maxHR * 0.72;
      targetHigh = maxHR * 0.84;
      stepLabel = "2/4";
      timeRem = STAGE_2_DUR - timeInState;
      accumulateDecoupling(input, STAGE_2_DUR);
      if (timeInState >= STAGE_2_DUR) {
        saveStageResult(2);
        shouldAdvance = true;
      }
      break;
    case STATE_STAGE_3:
      stageLabel = "Stable Stage";
      targetLow = maxHR * 0.80;
      targetHigh = maxHR * 0.91;
      stepLabel = "3/4";
      timeRem = STAGE_3_DUR - timeInState;
      accumulateDecoupling(input, STAGE_3_DUR);
      if (timeInState >= 60) {
        if (input.Power && input.Power > 0) {
          h3_pwrSum += input.Power;
          h3_pwrCount++;
        }
      }
      if (timeInState >= STAGE_3_DUR) {
        saveStageResult(3);
        lt2_power = h3_pwrCount > 0 ? Math.round(h3_pwrSum / h3_pwrCount) : 0;
        shouldAdvance = true;
      }
      break;
    case STATE_STAGE_4:
      stageLabel = "Peak Stage";
      targetLow = maxHR * 0.87;
      targetHigh = maxHR * 1.0;
      stepLabel = "4/4";
      timeRem = STAGE_4_DUR - timeInState;
      accumulateDecoupling(input, STAGE_4_DUR);
      if (timeInState >= STAGE_4_DUR) {
        saveStageResult(4);
        calculateThresholds();
        shouldAdvance = true;
      }
      break;
    case STATE_COOLDOWN:
      stageLabel = "Cool Down";
      targetLow = maxHR * 0.50;
      targetHigh = maxHR * 0.64;
      stepLabel = "POST";
      timeRem = COOLDOWN_DUR - timeInState;
      if (timeInState >= COOLDOWN_DUR) {
        playIndication("Confirm");
        state = STATE_DONE;
        currentTemplate = 'results';
        unload('_cm');
      }
      break;
    case STATE_DONE:
      stageLabel = "TEST DONE";
      stepLabel = "";
      timeRem = 0;
      break;
  }

  if (state !== STATE_DONE && timeRem >= 1 && timeRem <= 5) {
    playIndication("StartTimer");
  }

  if (shouldAdvance) {
    playIndication("Interval");
    state++;
    timeInState = 0;
    h1_hrSum = 0; h1_spdSum = 0; h1_count = 0; h1_spdCount = 0;
    h2_hrSum = 0; h2_spdSum = 0; h2_count = 0; h2_spdCount = 0;
    h3_pwrSum = 0; h3_pwrCount = 0;
  }

  output.stateNum = state;
  var encodedTargets = Math.round(targetLow) * 1000 + Math.round(targetHigh);
  output.hrTargetNum = encodedTargets;
  output.timeRemaining = timeRem;

  output.testModeNum = 0; // Statically 0 (Standard only)
  output.dfaCurrent = 0; // ZoneSense removed

  if (state === STATE_COOLDOWN || state === STATE_DONE) {
    output.lt1HR = Math.round(lt1_hr * 60) / 60;
    output.lt2HR = Math.round(lt2_hr * 60) / 60;
    output.lt1Pace = lt1_pace;
    output.lt2Pace = lt2_pace;
    output.lt2Power = lt2_power;
  }

  var hr = Math.round((input.HeartRate || 0) * 60);
  var zone = 0;
  if (maxHR > 0 && hr > 0) {
    var limit5 = Math.round(maxHR * 0.87);
    var limit4 = Math.round(maxHR * 0.82);
    var limit3 = Math.round(maxHR * 0.77);
    var limit2 = Math.round(maxHR * 0.72);

    if (hr >= limit5) {
      zone = 5;
    } else if (hr >= limit4) {
      zone = 4;
    } else if (hr >= limit3) {
      zone = 3;
    } else if (hr >= limit2) {
      zone = 2;
    } else {
      zone = 1;
    }
  }
  output.hrZoneNum = zone;
}

function getUserInterface(input, output) {
  return {
    template: currentTemplate || 't',
    zn: { input: '/Activity/Zones/HeartRate/CurrentZone' },
    segm: 5,
    currentHR: { input: '/Activity/Move/-1/HeartRate/Current' },
    hrTarget: { input: '/Zapp/{zapp_index}/Output/hrTargetNum' },
    stateNum: { input: '/Zapp/{zapp_index}/Output/stateNum' },
    hrZone: { input: '/Zapp/{zapp_index}/Output/hrZoneNum' }
  };
}

function getSummaryOutputs(input, output) {
  return [
    {
      id: 'lt1HR',
      name: "LT1 HR",
      format: 'HeartRate_Fourdigits',
      value: output.lt1HR
    },
    {
      id: 'lt2HR',
      name: "LT2 HR",
      format: 'HeartRate_Fourdigits',
      value: output.lt2HR
    },
    {
      id: 'lt2Pace',
      name: "LT2 Pace",
      format: 'Pace_Fourdigits',
      value: output.lt2Pace
    },
    {
      id: 'lt2Power',
      name: "Critical Power",
      format: 'Power_Accurate',
      value: output.lt2Power
    }
  ];
}
