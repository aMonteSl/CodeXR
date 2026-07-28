# Probar CodeXR en VR y AR sin gafas: el emulador WebXR

Esta guía explica cómo validar la experiencia inmersiva de CodeXR desde un
navegador de escritorio, usando el **Immersive Web Emulator** de Meta — una
extensión de Chrome/Edge que simula unas gafas con sus dos mandos — y, como
alternativa rápida sin instalar nada, los comandos `CodeXRDebug` que toda
escena generada lleva incorporados.

> **Qué puedes validar así**: la altura a la que apareces, el vuelo, el
> movimiento y giro con los sticks, el click con el gatillo, la dirección del
> rayo, y qué se oculta o se conserva en AR.
>
> **Qué NO sustituye**: la sensación real en unas gafas físicas — passthrough
> de verdad, escala percibida, rendimiento y confort siguen necesitando
> hardware.

---

## 1. Instalar el Immersive Web Emulator

1. Abre Chrome o Edge y ve a la ficha de la extensión:
   - Chrome Web Store: busca **"Immersive Web Emulator"** (editor: Meta).
   - Código fuente: <https://github.com/meta-quest/immersive-web-emulator>.
2. Pulsa **Añadir a Chrome** y confirma.
3. Si tenías DevTools abierto, ciérralo y vuelve a abrirlo: el panel del
   emulador solo aparece en sesiones nuevas de DevTools.

No hace falta configurar nada más: con la extensión instalada, el navegador
"anuncia" un dispositivo WebXR y el botón **Enter XR** de las escenas de
CodeXR pasa a lanzar una sesión inmersiva emulada.

## 2. Preparar una escena de CodeXR

1. En VS Code, lanza un análisis XR: clic derecho sobre una carpeta →
   **CodeXR: Analyze Directory (XR)** (o sobre un fichero → *Analyze File (XR)*).
2. Abre la visualización en el navegador (desde ACTIVE SERVERS o con la URL
   que muestra la notificación).
3. Muévete un momento en modo escritorio (ratón para mirar, WASD para andar)
   y fíjate en **a qué altura ves la mesa**: esa misma altura es la que debes
   tener al entrar en VR o AR. Es la primera comprobación del checklist.
4. Abre DevTools (**F12**) y localiza la pestaña **WebXR** (si no la ves,
   está en el menú `»` de pestañas extra de DevTools).

## 3. El panel del emulador

En la pestaña WebXR verás una vista 3D con el casco y los dos mandos:

- **Arrastra el casco o los mandos** con el ratón para moverlos; cada uno
  lleva unos **gizmos de flechas rojas/verdes/azules** para desplazarlo por
  ejes. *Esas flechas las dibuja el emulador, no CodeXR* — no aparecerán en
  unas gafas reales.
- Cada mando tiene sus **controles de stick, gatillo y botones** en el panel:
  puedes empujar el stick con el ratón y mantener pulsado el gatillo.
- El desplegable de dispositivo (Quest 2, Quest 3…) cambia el modelo emulado.
- Si te pierdes, el botón de **reset de pose** del panel devuelve casco y
  mandos a su posición por defecto.

## 4. Probar VR

1. Pulsa **Enter XR** en la escena (con la extensión instalada, el botón
   entra en VR emulado).
2. **Comprobación de altura**: debes ver la sala exactamente a la misma
   altura que en el paso 2 — de pie, con la mesa por debajo de la línea de
   los ojos. Ni flotando por encima de la sala, ni con los ojos a ras de
   suelo. (La altura del "casco" emulado sustituye a la del modo escritorio;
   CodeXR lo compensa automáticamente al detectar la sesión.)
3. **La sala completa sigue visible**: en VR no se oculta nada.
4. **Movimiento** (los sticks del panel del emulador):
   - **Stick izquierdo**: te mueve, de forma fluida, hacia donde estés
     mirando. En VR el vuelo está activo: mira hacia arriba y empuja el
     stick hacia delante para **elevarte** sobre la ciudad; mira hacia abajo
     para descender.
   - **Stick derecho**: te **gira** suavemente.
5. **Apuntar y clicar**: orienta un mando hacia un gráfico o un panel — el
   rayo debe salir **recto, hacia donde apunta el mando** — y aprieta el
   **gatillo**. El puntero pertenece a la mano que usaste por última vez:
   aprieta el gatillo del otro mando y el láser cambia de mano.
6. **Salir** (botón de salida o tecla Esc): debes volver al punto y la
   altura exactos donde estabas en escritorio, andando por el suelo otra vez.

## 5. Probar AR

1. Con la extensión activa, la escena ofrece también el modo AR (según la
   versión del emulador, desde el propio botón Enter XR o desde el panel
   WebXR eligiendo una sesión `immersive-ar`).
2. Al entrar debe pasar esto, todo a la vez:
   - **Desaparecen** la habitación virtual y el entorno (paredes, suelo
     decorado, cielo). En unas gafas reales ahí verías tu habitación física;
     en el emulador queda un fondo vacío — es lo esperado, el emulador no
     tiene cámara passthrough.
   - **Se conservan** el pedestal con su gráfico, el panel controlador, las
     pantallas virtuales y la guía: todo lo interactivo.
   - **Te recoloca** a un paso del pedestal, mirándolo, en lugar de dejarlo a
     siete metros: la mesa aparece delante de ti, sobre tu propio suelo, a tu
     altura.
3. Sticks, vuelo, gatillo y rayo funcionan igual que en VR.
4. Al salir, la sala vuelve a aparecer y regresas a tu posición de
   escritorio.

## 6. Alternativa sin extensión: los comandos `CodeXRDebug`

Si no quieres instalar nada, toda escena generada acepta esto en la consola
del navegador (F12 → Console):

```js
CodeXRDebug.simulateAR();      // oculta sala y entorno, te recoloca junto al pedestal
CodeXRDebug.simulateVR();      // mantiene la sala completa
CodeXRDebug.exitSimulated();   // vuelve a la vista de escritorio
```

Disparan los mismos estados y eventos que una sesión real, así que todo lo
que reacciona a ellos se ejecuta de verdad: ocultación de AR, recentrado,
vuelo activado, relevo de punteros y altura. Lo que **no** tienen es sesión
WebXR: no hay pose de casco, ni estéreo, ni passthrough, y los sticks del
emulador no existen — para movimiento con mandos necesitas la extensión.
`CodeXRDebug.status()` te dice en todo momento el modo activo (`ar`, `vr` o
`desktop`).

## 7. Checklist de validación

| # | Comprobación | Resultado esperado |
|---|---|---|
| 1 | Altura al entrar en VR | La misma que en la pestaña de escritorio: mesa bajo la línea de los ojos |
| 2 | Altura al entrar en AR | Igual, y recolocado a un paso del pedestal, mirándolo |
| 3 | VR: contenido | No se oculta nada; la sala completa sigue ahí |
| 4 | AR: contenido | Sala y entorno fuera; pedestal, gráficos, panel, pantallas y guía se quedan |
| 5 | Stick izquierdo | Movimiento fluido hacia donde miras; mirando arriba, vuelas |
| 6 | Stick derecho | Giro suave; no te desplaza |
| 7 | Gatillo | Click en gráficos y paneles, con cualquiera de las dos manos |
| 8 | Rayo | Sale recto del mando, hacia donde el mando apunta |
| 9 | Salir del modo | Posición, altura y suelo de escritorio restaurados; en AR, la sala reaparece |

Si cualquiera de estas filas falla, abre un issue en
<https://github.com/aMonteSl/CodeXR/issues> indicando la fila, el navegador y
la versión del emulador (o el modelo de gafas).

## 8. Problemas conocidos

- **La pestaña en segundo plano se congela**: A-Frame detiene el bucle de
  render cuando la pestaña no está visible (`document.hidden`). Si la escena
  parece no responder a los comandos, trae la pestaña al frente.
- **Los gizmos RGB "flotando" sobre los mandos** en tus capturas son las
  asas de arrastre del emulador; no forman parte de la escena.
- **El rayo apunta "raro" nada más entrar**: los mandos emulados apuntan
  hacia donde estén orientados en el panel del emulador — reoriéntalos con
  sus gizmos o pulsa el reset de pose.
- **El fondo de AR es negro/vacío**: el emulador no emula la cámara; el
  passthrough real solo se ve en unas gafas físicas.
- **Los límites del emulador**: no hay hand-tracking real, ni audio
  espacial del dispositivo, ni la óptica/escala de unas gafas. Para el
  veredicto final de confort y escala hace falta hardware; cualquier
  divergencia que encuentres en gafas reales es exactamente el tipo de
  reporte que pedimos en el CHANGELOG.

## Referencias

- Comandos de diagnóstico de las escenas XR: [`XR_DEBUG_COMMANDS.md`](XR_DEBUG_COMMANDS.md)
- Emulador: <https://github.com/meta-quest/immersive-web-emulator>
- Panel WebXR nativo de Chrome DevTools (alternativa más limitada, sin
  sticks accionables): DevTools → menú ⋮ → *More tools* → *WebXR*
