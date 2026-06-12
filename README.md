# SuuntoPlus™ Dual Threshold App

**Dual Threshold** is a sports app for Suunto watches designed to estimate your lactate thresholds: **LT1 (Aerobic Threshold)** and **LT2 (Anaerobic Threshold)**, along with their corresponding pace and power, in a guided, reliable, and straightforward manner.

The app analyzes **aerobic decoupling (pace vs. heart rate)** by comparing the first half and the second half of each stable phase of the test to estimate the deflections of the LT1 and LT2 thresholds, using your heart rate zones configured on the watch (based on your `MaxHR`).

---

## ⏱️ Test Structure (Fixed Durations)

The protocol consists of 6 structured guided blocks designed to progressively raise intensity. The stage durations are **permanently fixed** to ensure physiological stabilization and the mathematical validity of the test:

1. **Warm Up:** 10 minutes at 62% - 69% of `MaxHR` to stabilize heart rate and calibrate the initial signal.
2. **Phase 1 (Baseline):** 10 minutes at 65% - 76% of `MaxHR`. Objective: Establish the physiological baseline below LT1.
3. **Phase 2 (LT1 Detection):** 10 minutes at 72% - 84% of `MaxHR`. Objective: Cross the aerobic threshold and detect pace/heart rate decoupling.
4. **Phase 3 (LT2 and Power Detection):** 10 minutes at 80% - 91% of `MaxHR`. Objective: Enter the instability zone and register the anaerobic threshold.
5. **Phase 4 (LT2 Validation):** 5 minutes at 87% - 100% of `MaxHR`. Objective: Confirm LT2 under maximum metabolic stress.
6. **Cool Down:** 5 minutes of easy recovery at 50% - 64% of `MaxHR`.

> [!NOTE]
> The test durations are permanently fixed (**10 minutes for Warm Up and Phases 1-3, and 5 minutes for Phase 4 and Cool Down**) to guarantee that the algorithm accumulates sufficient stable samples. The physical bottom button (DOWN) does not alter the times in production, preserving its native behavior on the watch.

---

## 📌 Fixed vs. Dynamic Parameters

To provide clarity on the application's internal behavior, here are the details of which aspects are **fixed** (estáticos/hardcoded) and which are **dynamic** (variables en tiempo real o ajustados por el usuario):

### 🔒 Fixed Parameters (Static/Hardcoded)
* **Stage Durations:**
  * **Warm Up:** 10 minutes (600s).
  * **Phase 1 (Stable 1/4):** 10 minutes (600s).
  * **Phase 2 (Stable 2/4):** 10 minutes (600s).
  * **Phase 3 (Stable 3/4):** 10 minutes (600s).
  * **Phase 4 (Peak Stage 4/4):** 5 minutes (300s).
  * **Cool Down:** 5 minutes (300s).
  * *Note: The option to skip or adjust stage durations with the physical bottom button (DOWN) has been removed in production to avoid invalidating the test protocol.*
* **Recommended Heart Rate Percentages:**
  The recommended target heart rate range shown during each phase is calculated using fixed percentages of Maximum Heart Rate (`MaxHR`):
  * **Warm Up:** 62% - 69% of `MaxHR`.
  * **Phase 1 (1/4):** 65% - 76% of `MaxHR`.
  * **Phase 2 (2/4):** 72% - 84% of `MaxHR`.
  * **Phase 3 (3/4):** 80% - 91% of `MaxHR`.
  * **Phase 4 (4/4):** 87% - 100% of `MaxHR`.
  * **Cool Down:** 50% - 64% of `MaxHR`.
* **Threshold Detection Criteria (Decoupling):**
  * **LT1 (Aerobic):** The first phase where aerobic decoupling of pace/heart rate exceeds **5.0%** (or Phase 1 by default if none exceed it).
  * **LT2 (Anaerobic):** The first phase where decoupling exceeds **10.0%** (or Phase 4 by default if none exceed it).
* **Mandatory Physiological Consistency:**
  * The algorithm strictly enforces that `LT2 >= LT1`. If due to heart rate variations or fatigue the calculated LT2 is lower than LT1, the heart rate and pace for LT2 will automatically match those calculated for LT1.
* **LT2 Threshold Power Calculation:**
  * Power is averaged over the entirety of Phase 3, considering only seconds with active power (`Power > 0 W`), and discarding the first transition minute to filter out initial noise.
* **Automatic Redirection on Finish:**
  * Upon completing the Cool Down, the watch immediately executes an `unload('_cm')` to automatically load the final results dashboard, preventing accidental exits or the need for button presses.

### ⚡ Dynamic Parameters (Variables)
* **Maximum Heart Rate (MaxHR):**
  * Obtained in real-time from the value configured in the watch's user profile (`input.MaxHR`). If not detected or if it is an invalid value (less than or equal to zero), a fallback value of **194 bpm** is applied. It supports beats per minute (BPM) and beats per second (BPS) formats.
* **Real-time Sensors (Pace, Heart Rate, and Power):**
  * Live values for speed/pace (GPS/Footpod), heart rate (optical sensor or chest strap), and running power are updated dynamically every second on the watch screen.
* **Exercise Pause Control:**
  * When pausing the workout on the watch, the native `onExercisePause` and `onExerciseContinue` callbacks pause or resume the algorithm. During pause, the stage timer freezes, and data accumulation for aerobic decoupling and average power is suspended, preventing rest periods from corrupting threshold calculations.
* **Pace/Heart Rate Decoupling Calculation:**
  * Dynamically compares aerobic efficiency averages between the first and second half of each stage. The algorithm automatically filters out the first minute of each phase to discard the cardiovascular adjustment period to the new intensity.
* **Smart Outputs Writing:**
  * Output variables (`lt1HR`, `lt1Pace`, `lt2HR`, `lt2Pace`, `lt2Power`) are only written dynamically to the activity file upon entering the **Cool Down** or **TEST DONE** stages, preventing flat, zero-filled time series graphs in the Suunto mobile app.

---

## 🧠 Advanced Algorithm Features

* **Smart Pause Support:**
  When pausing the workout on the watch, the lifecycle callbacks (`onExercisePause` and `onExerciseContinue`) automatically freeze the stage timer and halt data accumulation. This prevents rests from skewing averages or offset timing.
  
* **Stable Power Calculation in Phase 3:**
  Rather than capturing instantaneous power at the end of Phase 3, the algorithm calculates a robust average of all active seconds (where power is greater than zero) across the entire 10-minute stage, providing a highly accurate LT2 power estimate free of noise spikes.

* **LT2 Threshold Locking (Anti-Fatigue):**
  The algorithm locks the LT2 threshold during the first phase that experiences an aerobic decoupling greater than **10%**. This prevents cardiovascular drift and extreme fatigue in Phase 4 (Peak Stage) from incorrectly overwriting the calculated anaerobic threshold.

* **Physiological Safety Restraint:**
  To prevent inconsistencies in workouts with unusual heart rate drift, the algorithm enforces a safety rule where the heart rate and pace of LT2 are always greater than or equal to those of LT1 (`LT2 >= LT1`).

* **Smart Recording in Cooldown (Clean Graphs):**
  To prevent the Suunto mobile app from drawing a flat line at `0` in your summaries and time series since the beginning of the test, the threshold output variables are only updated and recorded to the physical activity file once the **Cool Down** or **Done** stage is reached.

---

## 🎮 Watch Controls & Interface

### Main Workout Screen
* **Top Area:** Displays the active stage name (*Warm Up, Stable, Peak Stage, etc.*) inside the curved yellow banner, aligned to prevent side clipping.
* **Central Range:** Recommended heart rate target range for the active stage.
* **Center Screen:** Displays current Pace (left, accompanied by a **green speedometer icon**) and real-time Heart Rate (right, accompanied on its right by a **heart icon**). Both the heart rate value and heart icon synchronize their color in real-time based on the active target zone (Blue if below target, Green if inside range, Red if above target).
* **3-Zone Cardio Ring with Dynamic Needle:** A circular ring divided into 3 segments on the outer border (Blue for below target, Green for inside target, Red for above target). The active segment is highlighted with an `8px` thickness and vibrant color, while inactive segments are reduced to `4px` thickness and darker shades. Directly above the corona, a **white triangular needle with a black border** points inwards and moves dynamically based on live heart rate to display your exact position in the target zone.
* **Bottom Area:** Countdown timer with remaining time for the current stage, and the stage indicator (*PRE, 1/4, 2/4, 3/4, 4/4, POST*).

### Final Results Screen
* Upon completing the 5-minute Cool Down stage, the watch performs an **automatic redirection** (`unload('_cm')`) to immediately load the results screen without any button presses.
* Displays clean, independent summaries for **LT1 (Aerobic)** and **LT2 (Anaerobic)** thresholds, including their respective heart rate (bpm) and pace (/km or /mi), alongside the **LT2 Threshold Power (W)**.
* Stacks the title **LACTATE THRESHOLDS** vertically into two centered lines inside a custom yellow header to prevent display edge clipping.

---

## 🔧 Diagnostic Mode (Debug)

The app includes a diagnostic mode to view internal variables live and verify algorithm calculations during development.

### Enable Diagnostic Mode
1. Open the [main.js](main.js) file.
2. Change the `DEBUG_MODE` variable value to `1`:
   ```javascript
   var DEBUG_MODE = 1;
   ```
3. Compile the application by running in the terminal:
   ```bash
   node build.js
   ```

* **If `DEBUG_MODE = 0` (Production):** Physical button overrides are removed from templates, guaranteeing that the watch's physical center and bottom buttons function natively at all times.
* **If `DEBUG_MODE = 1` (Debug):** The physical top button (UP) is mapped to let you toggle to the technical diagnostic screen during the test.
