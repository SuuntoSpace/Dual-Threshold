# SuuntoPlus™ Dual Threshold App

**Dual Threshold** es una aplicación deportiva para relojes Suunto diseñada para estimar de forma guiada, fiable y sencilla tus umbrales de lactato: **LT1 (Umbral Aeróbico)** y **LT2 (Umbral Anaeróbico)**, junto con el ritmo y la potencia correspondientes.

La aplicación analiza el **desacoplamiento aeróbico (ritmo vs. pulso)** comparando la primera mitad y la segunda mitad de cada fase estable del test para estimar las deflexiones de los umbrales LT1 y LT2, utilizando tus zonas de frecuencia cardíaca configuradas en el reloj (basadas en tu `MaxHR`).

---

## ⏱️ Estructura del Test (Duraciones Fijadas)

El protocolo consta de 6 bloques guiados estructurados para elevar la intensidad progresivamente. Las duraciones están **fijadas de manera permanente** para asegurar la estabilización fisiológica y la validez matemática del test:

1. **Warm Up (Calentamiento):** 10 minutos al 62% - 69% de `MaxHR` para estabilizar el pulso y calibrar la señal inicial.
2. **Fase 1 (Línea base):** 10 minutos al 65% - 76% de `MaxHR`. Objetivo: Establecer la base fisiológica por debajo del LT1.
3. **Fase 2 (Detección LT1):** 10 minutos al 72% - 84% de `MaxHR`. Objetivo: Cruzar el umbral aeróbico y detectar el desacoplamiento de ritmo/pulso.
4. **Fase 3 (Detección LT2 y Potencia):** 10 minutos al 80% - 91% de `MaxHR`. Objetivo: Entrar en la zona de inestabilidad y registrar el umbral anaeróbico.
5. **Fase 4 (Validación LT2):** 5 minutos al 87% - 100% de `MaxHR`. Objetivo: Confirmar el LT2 bajo máximo estrés metabólico.
6. **Cool Down (Enfriamiento):** 5 minutos suaves al 50% - 64% de `MaxHR`.

> [!NOTE]
> Las duraciones del test están fijadas permanentemente (**10 minutos para Calentamiento y Fases 1-3, y 5 minutos para la Fase 4 y Cool Down**) para garantizar que el algoritmo acumule suficientes muestras estables. El botón inferior (DOWN) no altera los tiempos en producción, preservando su comportamiento nativo en el reloj.

---

## 📌 Elementos Fijados vs. Elementos Dinámicos

Para mayor claridad sobre el comportamiento interno de la aplicación, a continuación se detallan cuáles aspectos están **fijados** (estáticos/hardcoded) y cuáles son **dinámicos** (variables en tiempo real o ajustados por el usuario):

### 🔒 Parámetros Fijados (Estáticos/Hardcoded)
* **Duración de las Etapas:**
  * **Warm Up:** 10 minutos (600s).
  * **Fase 1 (Estable 1/4):** 10 minutos (600s).
  * **Fase 2 (Estable 2/4):** 10 minutos (600s).
  * **Fase 3 (Estable 3/4):** 10 minutos (600s).
  * **Fase 4 (Peak Stage 4/4):** 5 minutos (300s).
  * **Cool Down:** 5 minutos (300s).
  * *Nota: La opción de cambiar la duración con el botón físico inferior (DOWN) está eliminada en producción para evitar invalidar el protocolo del test.*
* **Porcentajes de Frecuencia Cardíaca Recomendada:**
  El rango objetivo de frecuencia cardíaca mostrado en cada fase se calcula usando porcentajes fijos de la Frecuencia Cardíaca Máxima (`MaxHR`):
  * **Warm Up:** 62% - 69% de `MaxHR`.
  * **Fase 1 (1/4):** 65% - 76% de `MaxHR`.
  * **Fase 2 (2/4):** 72% - 84% de `MaxHR`.
  * **Fase 3 (3/4):** 80% - 91% de `MaxHR`.
  * **Fase 4 (4/4):** 87% - 100% de `MaxHR`.
  * **Cool Down:** 50% - 64% de `MaxHR`.
* **Criterios de Detección de Umbrales (Desacoplamiento):**
  * **LT1 (Aeróbico):** Primera fase donde el desacoplamiento aeróbico de ritmo/pulso supera el **5.0%** (o la Fase 1 por defecto si ninguna la supera).
  * **LT2 (Anaeróbico):** Primera fase donde el desacoplamiento supera el **10.0%** (o la Fase 4 por defecto si ninguna lo supera).
* **Consistencia Fisiológica Obligatoria:**
  * El algoritmo impone de manera estricta que `LT2 >= LT1`. Si por variaciones de pulso o fatiga el LT2 calculado resultase menor que el LT1, el pulso y el ritmo de LT2 se igualarán automáticamente a los calculados para LT1.
* **Cálculo de Potencia de Umbral LT2:**
  * Se promedia la potencia durante toda la Fase 3, considerando únicamente segundos con potencia activa (`Power > 0 W`), descartando el primer minuto de transición para evitar el ruido inicial.
* **Redirección Automática al Finalizar:**
  * Al completar el Cool Down, el reloj ejecuta inmediatamente un `unload('_cm')` para redirigir de forma automática al panel de resultados final, impidiendo salidas accidentales o la necesidad de pulsar botones.

### ⚡ Parámetros Dinámicos (Variables)
* **Frecuencia Cardíaca Máxima (MaxHR):**
  * Se obtiene en tiempo real a partir del valor configurado en el perfil de usuario del reloj (`input.MaxHR`). Si no se detecta o es un valor inválido (menor o igual a cero), se aplica un valor de resguardo de **190 bpm**. Soporta formatos de latidos por minuto (LPM) y latidos por segundo (LPS).
* **Sensores en Tiempo Real (Ritmo, Pulso y Potencia):**
  * Los valores de velocidad/ritmo (GPS/Footpod), frecuencia cardíaca (sensor de pulso óptico o banda) y potencia de carrera se actualizan dinámicamente cada segundo en la pantalla del reloj.
* **Control de Pausa de la Actividad (Exercise Pause):**
  * Al pausar el entrenamiento en el reloj, las funciones nativas `onExercisePause` y `onExerciseContinue` detienen o reanudan el algoritmo. Durante la pausa, se congela por completo el segundero de la etapa y se suspende la acumulación de datos del desacoplamiento aeróbico y potencia media, evitando corromper los cálculos de los umbrales con los tiempos de descanso.
* **Cálculo del Desacoplamiento de Ritmo/Pulso:**
  * Se comparan dinámicamente los promedios de eficiencia aeróbica de la primera mitad y de la segunda mitad de cada etapa. El algoritmo filtra automáticamente el primer minuto de cada fase para omitir el periodo de adaptación cardiovascular a la nueva intensidad.
* **Escritura Inteligente de Resultados:**
  * Las variables de salida (`lt1HR`, `lt1Pace`, `lt2HR`, `lt2Pace`, `lt2Power`) solo se escriben dinámicamente en el archivo de actividad al ingresar a la fase de **Cool Down** o **TEST DONE**, evitando gráficos planos y sucios de series temporales en la aplicación móvil de Suunto.

---

## 🧠 Características Avanzadas del Algoritmo

* **Soporte de Pausa Inteligente:**
  Al pausar el entrenamiento en el reloj, las funciones de ciclo de vida (`onExercisePause` y `onExerciseContinue`) congelan automáticamente el tiempo de la etapa y detienen la acumulación de datos de frecuencia cardíaca, ritmo y potencia. Esto evita que se calculen promedios erróneos o desfases temporales debido a descansos.
  
* **Cálculo de Potencia Estable en Fase 3:**
  En lugar de capturar la potencia instantánea al final de la Fase 3, el algoritmo calcula el promedio robusto de todos los segundos activos (donde la potencia sea mayor que cero) a lo largo de los 10 minutos de la etapa, proporcionando una estimación de potencia de umbral LT2 muy precisa y libre de picos de ruido.

* **Bloqueo del Umbral LT2 (Anti-Fatiga):**
  El algoritmo fija el umbral LT2 en la primera fase que experimente un desacoplamiento aeróbico mayor al **10%**. Esto evita que el desgaste y la fatiga cardíaca extrema de la Fase 4 (Peak Stage) sobrescriban de manera incorrecta el umbral anaeróbico calculado previamente.

* **Restricción de Seguridad Fisiológica:**
  Para evitar incoherencias en entrenamientos con deriva cardíaca inusual, el algoritmo incluye una regla de resguardo donde el pulso y ritmo de LT2 siempre serán mayores o iguales a los de LT1 (`LT2 >= LT1`).

* **Escritura Inteligente en Cooldown (Gráficos Limpios):**
  Para evitar que la app móvil de Suunto dibuje una línea plana en `0` en tus resúmenes y series temporales desde el inicio del test, las variables de salida de los umbrales solo se actualizan y graban en el archivo de actividad física una vez que se accede a la fase de **Cool Down** o **Done**, asegurando gráficos limpios y correctos.

---

## 🎮 Controles e Interfaz en el Reloj

### Pantalla Principal de Entrenamiento
* **Parte Superior:** Muestra la fase actual en la que te encuentras (*Warm Up, Stable, Peak Stage, etc.*) con un posicionamiento optimizado para pantallas curvas.
* **Rango Central:** Frecuencia cardíaca recomendada (objetivo) para esa etapa.
* **Centro de pantalla:** Muestra tu Ritmo actual (izquierda, acompañado por un **icono de velocímetro verde**) y tus Pulsaciones en tiempo real (derecha, acompañado a su derecha por un **icono de corazón**). Tanto el valor del pulso como el icono de corazón se sincronizan de color en tiempo real según la zona de cardio activa (Azul si estás por debajo del objetivo, Verde si estás dentro del rango, y Rojo si estás por encima).
* **Corona de Cardio de 3 Zonas con Aguja Dinámica:** Un anillo dividido en 3 segmentos en el contorno exterior (Azul para nivel inferior al rango objetivo, Verde para rango objetivo y Rojo para nivel superior). El segmento activo se resalta con un grosor de `8px` y colores intensos, mientras que los inactivos se reducen a `4px` de grosor y tonos oscuros. Directamente encima de la corona se dibuja una **aguja triangular blanca con contorno negro** que apunta hacia el centro del reloj ("mirando al revés") y se mueve dinámicamente según tu ritmo cardíaco en tiempo real para mostrar tu posición exacta en la zona.
* **Parte Inferior:** Cuenta atrás con el tiempo restante para finalizar la fase actual y el indicador de etapa (*PRE, 1/4, 2/4, 3/4, 4/4, POST*).

### Pantalla de Resultados Finales
* Al finalizar los 5 minutos de Cool Down, el reloj realiza una **redirección automática** (`unload('_cm')`) para cargar de manera inmediata el panel de resultados sin necesidad de tocar la pantalla.
* Muestra de forma limpia e independiente las tarjetas de **LT1 (Aeróbico)** y **LT2 (Anaeróbico)** con su respectivo pulso (bpm), ritmo (/km) y la **Potencia de Umbral LT2 (W)**.

---

## 🔧 Modo Diagnóstico (Debug)

La aplicación incluye un modo diagnóstico que permite visualizar variables en directo y verificar el funcionamiento técnico del algoritmo durante el desarrollo.

### Activar el Modo Diagnóstico
1. Abre el archivo [main.js](main.js).
2. Cambia el valor de la variable `DEBUG_MODE` a `1`:
   ```javascript
   var DEBUG_MODE = 1;
   ```
3. Compila la aplicación ejecutando en la terminal:
   ```bash
   node build.js
   ```

* **Si `DEBUG_MODE = 0` (Producción):** Se elimina el override de botones físicos en las plantillas, garantizando que puedas usar el botón central y el botón abajo para las funciones nativas del reloj en todo momento.
* **Si `DEBUG_MODE = 1`:** Se añade el botón superior (UP) en la plantilla para permitirte alternar a la pantalla de diagnóstico técnico durante el test.
