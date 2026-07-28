# Chequeo manual de la experiencia VR/AR

Pasada de validación manual de CodeXR en modo inmersivo: posición de entrada,
vuelo, mandos y pantallas. Sirve igual con el [emulador WebXR](TUTORIAL_EMULADOR_WEBXR.md)
que con unas gafas físicas — con gafas, cada fila vale además como reporte de
hardware (indica el modelo si algo falla).

**Preparación**: lanza un análisis XR (clic derecho → *CodeXR: Analyze
Directory (XR)*), abre la escena en el navegador y date un paseo en modo
escritorio (ratón + WASD): fíjate en **dónde estás y a qué altura ves la
mesa** — son tus referencias para todo lo demás.

## 1. VR

| # | Qué hacer | Resultado esperado |
|---|---|---|
| 1.1 | Entra en VR (Enter XR / botón VR) | Apareces **en el mismo sitio y a la misma altura** que en escritorio: de pie, mesa bajo la línea de los ojos. Ni flotando sobre la sala ni a ras de suelo |
| 1.2 | Mira alrededor | La sala completa sigue ahí (paredes, techo, entorno): en VR no se oculta nada. **No hay ningún anillo/punto blanco** flotando ante tus ojos |
| 1.3 | Stick **izquierdo** adelante | Avance fluido hacia donde miras |
| 1.4 | Mira hacia arriba + stick izquierdo adelante | **Vuelas** (subes); mirando hacia abajo, desciendes |
| 1.5 | Stick **derecho** izquierda/derecha | Giro suave, sin desplazarte |
| 1.6 | Apunta un mando a un gráfico y aprieta el **gatillo** | El rayo sale **recto hacia donde apunta el mando** y el click responde (leyenda/acción). Repite con la otra mano: el láser **cambia de mano** y solo hay **un** láser encendido |
| 1.7 | Agarra una pantalla por su **borde** (gatillo mantenido) y usa el **stick de esa misma mano** | Adelante la **aleja**, atrás la **acerca** (se para antes de llegarte a la cara), izquierda/derecha la **desliza en lateral**; en diagonal se combinan. Mientras agarras, ese stick **no te mueve** y la otra mano sigue andando/girando; el láser no cambia de mano aunque uses la otra |
| 1.8 | Sal de VR | Vuelves **exactamente** al punto y la altura de escritorio, aunque hayas volado a la otra punta |

## 2. AR

| # | Qué hacer | Resultado esperado |
|---|---|---|
| 2.1 | Entra en AR (botón AR) | Recolocado a un paso del pedestal, **mirándolo, a tu altura y sobre tu propio suelo** |
| 2.2 | Mira alrededor | Sala y entorno **fuera** (paredes, suelo virtual, cielo). Se conservan pedestal, gráficos, panel controlador, pantallas y guía. Con gafas reales, de fondo tu habitación física; en el emulador, un fondo vacío |
| 2.3 | Observa el gráfico | **Con relieve y volumen**, no plano ni apagado: las caras de los edificios se distinguen entre sí (la luz direccional de AR está activa) |
| 2.4 | Apunta el láser "al vacío" (donde estaría una pared) | El rayo **no se corta contra nada invisible** ni hace hover fantasma |
| 2.5 | Agarra una pantalla y muévela lejos, en cualquier dirección | Se mueve **libre**, sin chocar contra paredes invisibles (en VR/escritorio sí siguen chocando con la sala — eso es lo correcto ahí) |
| 2.6 | Sticks, vuelo y gatillo | Igual que en VR (filas 1.3-1.7) |
| 2.7 | Sal de AR | La sala y el entorno **reaparecen**, la iluminación vuelve a la normal y regresas a tu punto de escritorio |

## Si algo falla

- Con el **emulador**: consulta los problemas conocidos del
  [tutorial](TUTORIAL_EMULADOR_WEBXR.md) (pestaña en segundo plano congelada,
  gizmos RGB del propio emulador, fondo AR vacío…).
- Con **gafas físicas**: abre un issue en
  <https://github.com/aMonteSl/CodeXR/issues> con la fila que falla, el modelo
  de gafas y el navegador. Esta release se validó a fondo en emulación
  (ver CHANGELOG); los reportes de hardware real son exactamente lo que
  necesitamos.
