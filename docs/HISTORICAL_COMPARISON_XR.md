# Comparador histórico XR de CodeXR

## Resumen

CodeXR 1.2.0 incorpora un comparador histórico que permite representar dos
estados del mismo análisis en paralelo sobre una única mesa XR. Cada lado
conserva el tipo de gráfico elegido para el análisis original y utiliza la misma
asignación de métricas, de modo que la comparación sea visualmente equivalente.

El comparador puede enfrentar:

- la copia de trabajo actual;
- una rama local;
- una rama remota disponible localmente;
- una etiqueta;
- uno de los 50 commits más recientes disponibles en el repositorio local.

No se ejecutan `checkout`, `fetch` ni escrituras dentro de `.git`. CodeXR analiza
instantáneas temporales y mantiene intactos la rama activa, el índice y los
archivos del usuario.

## Compatibilidad con GitHub, GitLab y otros servidores Git

El comparador depende de **Git**, no de la API de un proveedor concreto.
`GitRepositoryService` ejecuta el binario local `git` mediante `execFile`, sin
shell, y consulta los objetos y referencias ya presentes en el clon.

| Origen del proyecto | Compatibilidad | Condición |
| --- | --- | --- |
| Repositorio Git local sin remoto | Sí | El objetivo analizado debe estar dentro del repositorio |
| GitHub | Sí | El repositorio debe estar clonado localmente |
| GitLab | Sí | El repositorio debe estar clonado localmente |
| Bitbucket, Gitea, Forgejo o servidor propio | Sí | Debe utilizar un repositorio Git local estándar |
| Carpeta descargada como ZIP | No | No contiene el directorio y los objetos de Git |
| Referencia que solo existe en el servidor | Todavía no | Debe obtenerse previamente con las herramientas Git del usuario |

Los nombres de los remotos son irrelevantes. CodeXR enumera
`refs/remotes/*`, por lo que reconoce por igual referencias como
`origin/main`, `github/main`, `gitlab/develop` o `upstream/release`.

CodeXR no ejecuta `git fetch` automáticamente. Esta decisión evita operaciones
de red inesperadas, solicitudes de credenciales y modificaciones silenciosas de
las referencias locales. Por tanto, la lista representa exactamente la historia
que el usuario tiene disponible en su clon en ese momento.

## Flujo funcional

```text
Análisis XR normal
        |
        | Panel CodeXR Field Mapping > Visualization mode
        v
Selección de History comparison
        |
        | Solicitud WebSocket al servidor local CodeXR
        v
Listado autoritativo de copia de trabajo, ramas, etiquetas y commits
        |
        | Selección independiente de izquierda y derecha
        v
Resolución de referencias a SHA y análisis de ambas fuentes
        |
        | Resultado inmutable y datasets JSON
        v
Mesa en modo historical-compare con dos zonas y dos gráficos
```

El panel impide seleccionar la misma fuente en ambos lados. Los commits se
muestran en páginas de cinco elementos, con hash, fecha y mensaje abreviado.
Las ramas y etiquetas utilizan filas compactas y distintivos `LIVE`, `BRANCH`,
`TAG` y `COMMIT`.

## Evolución de la mesa XR

La implementación anterior utilizaba un componente de pedestal que mezclaba
geometría decorativa, medición, escalado y control del gráfico. Para soportar
varios modos sin duplicar esa lógica se sustituyó por dos piezas:

| Componente | Responsabilidad |
| --- | --- |
| `codexr-analysis-table` | Geometría de la mesa, colores, modo visual y división en zonas |
| `codexr-chart-containment` | Medición, escalado, centrado y estabilización de un gráfico concreto |

No se emplea una jerarquía rígida de clases de mesa. Los modos se componen sobre
el mismo motor:

- `single`: una zona central con el comportamiento normal;
- `historical-compare`: dos zonas simétricas, divisor central y colores
  azul/verde.

`CodeXRAnalysisTableRuntime.getAnalysisTableZones()` devuelve los límites que
deben utilizar los gráficos. En comparación, el ancho útil se divide dejando el
mismo margen exterior y un espacio central explícito. Cada gráfico recibe su
propio `codexr-chart-containment`, anclado al centro de su zona.

El controlador de contención:

- mide la geometría real generada por BabiaXR;
- ignora leyendas y elementos auxiliares;
- aplica límites independientes para los planos `X/Z` y para la altura `Y`;
- impide que el gráfico sobrepase su zona;
- recupera también tamaños demasiado pequeños;
- utiliza estabilización progresiva y PID en lugar de saltos bruscos;
- publica estados `rebuilding`, `valid`, `invalid` y `stabilized`;
- permite esperar de forma conjunta a que varios gráficos sean válidos.

Al activar la comparación, el gráfico normal se oculta, se suspende su
interacción y se retira temporalmente del DOM. Solo después de que los dos
gráficos comparativos estén creados se redirige Field Mapping hacia ellos. Al
salir, se eliminan los recursos comparativos y el gráfico original vuelve a su
posición, mapping e interacción anteriores.

## Creación de los dos gráficos

`historicalComparisonRuntime.js` reutiliza el componente BabiaXR del gráfico
original. Esto conserva el tipo seleccionado:

- `babia-boats`;
- `babia-bars`;
- `babia-barsmap`;
- `babia-bubbles`;
- `babia-pie`;
- `babia-doughnut`;
- `babia-cyls`;
- `babia-cylsmap`.

La secuencia de montaje evita mostrar estados incompletos:

1. cambiar la mesa a `historical-compare`;
2. crear el contenedor comparativo;
3. preparar las fuentes de datos;
4. crear un gráfico por zona;
5. registrar ambos IDs en Field Mapping;
6. retirar el gráfico normal;
7. esperar a la geometría válida y estabilizada;
8. mostrar etiquetas y resumen de diferencias.

Si el objetivo analizado no existía en una revisión, ese lado muestra
`Target not present in this revision`. No es un error de Git: significa que la
ruta concreta del archivo o directorio todavía no existía, ya había sido
eliminada o se encontraba en otra ubicación en ese commit.

### Aislamiento especial de `babia-boats`

BabiaXR genera edificios con IDs derivados de la ruta, por ejemplo
`boat-src/services/auth.ts`. Dos barcos con la misma estructura producirían IDs
globales duplicados. Durante una animación, el segundo gráfico podría localizar
y modificar accidentalmente una geometría del primero.

CodeXR evita esa colisión sin modificar BabiaXR:

- construye un árbol independiente para cada dataset;
- asigna `uid` con namespace `codexr-left:` o `codexr-right:`;
- entrega el árbol como dato propio a cada `babia-boats`;
- conserva todas las métricas originales de cada entrada.

Así, cambiar un eje reconstruye físicamente ambos barcos y cada animación opera
únicamente sobre su zona.

## Servicio Git y materialización segura

`GitRepositoryService` es la única capa que ejecuta comandos Git. Utiliza
argumentos estructurados con `execFile('git', [...])`, `windowsHide` y límites
de buffer. El cliente XR nunca envía comandos, rutas ni revisiones arbitrarias.

### Referencias

El servicio obtiene:

- rama activa mediante `symbolic-ref`;
- estado modificado del objetivo mediante `status --porcelain`;
- ramas locales y remotas mediante `for-each-ref`;
- etiquetas ligeras y anotadas mediante `for-each-ref`;
- commits mediante `log --all --max-count=50`.

Antes de analizar una referencia, se vuelve a resolver con
`rev-parse --verify <ref>^{commit}`. El resultado debe ser un SHA completo de
40 caracteres.

### Instantáneas

Para una revisión histórica:

- `cat-file` comprueba la existencia y el tamaño;
- `ls-tree` enumera archivos de un directorio;
- `show <sha>:<ruta>` recupera el contenido;
- los archivos se escriben en el almacenamiento privado de la extensión;
- nunca se escribe dentro del repositorio ni de `.git`;
- las instantáneas se eliminan al cerrar el servicio.

Controles actuales:

- máximo de 5.000 archivos;
- máximo de 100 MiB por instantánea;
- máximo de 8 MiB por archivo;
- validación de que todo destino permanezca dentro del directorio temporal;
- exclusión de directorios ignorados y formatos no analizables;
- submódulos y entradas no soportadas se omiten con advertencias.

## Análisis, caché y diferencias

`HistoricalComparisonService` coordina el análisis:

- `working-copy` reutiliza el `data.json` del análisis XR activo;
- una referencia histórica se materializa y pasa por el mismo analizador Python;
- los resultados históricos se cachean por versión del analizador, SHA,
  objetivo, tipo de análisis y profundidad;
- cada resultado se publica como una revisión inmutable con datasets izquierdo
  y derecho.

Las claves de comparación son estables:

- directorios: ruta relativa normalizada;
- archivos: nombre del archivo, firma de función, parámetros y ordinal.

El resumen calcula elementos añadidos, eliminados, modificados y sin cambios.
Los cambios de línea que no alteran métricas no se consideran modificaciones.
En esta primera versión, un renombrado se representa como eliminación más
adición.

## Copia de trabajo reactiva

`working-copy` es la única fuente mutable. Después de escribir correctamente un
nuevo `data.json`, CodeXR emite un evento interno de actualización.

Si existe una comparación activa:

- si ambos lados son históricos, no se recalcula nada;
- si un lado es `working-copy`, solo se vuelve a analizar ese lado;
- el dataset y la geometría históricos se conservan;
- se recalculan el delta y el resumen;
- se publica una nueva revisión autoritativa;
- los eventos rápidos se coordinan para evitar trabajos concurrentes.

La actualización viaja por el WebSocket de colaboración y también funciona a
través de Cloudflare Quick Tunnel. No depende de SSE.

## Field Mapping transaccional

El nombre interno del selector es `CodeXRMappingUiRuntime`; su interfaz visible
se denomina **CodeXR Field Mapping**.

El runtime mantiene un ID lógico estable basado en el gráfico original. Al
entrar en comparación, `setChartEntityIds()` cambia temporalmente los destinos
activos a los dos gráficos comparativos sin cambiar la identidad compartida del
mapping.

Al seleccionar una métrica:

1. se guarda el último mapping válido;
2. se cancela cualquier transacción anterior;
3. se aplica el nuevo mapping a ambos gráficos;
4. cada gráfico conserva su datasource y opciones particulares;
5. la mesa espera a que ambos produzcan geometría válida;
6. si ambos son válidos, se confirma y comparte el mapping;
7. si uno falla, ambos vuelven al mapping anterior.

Solo los controles de la vista visible conservan
`babiaxraycasterclass`, evitando que Mapping e History se intercepten clics.
El evento `codexr-mapping-confirmed` actualiza también las variaciones agregadas
del resumen histórico.

## Colaboración y autoridad

La selección y el resultado son compartidos por sala mediante la entidad
`historical-comparison`.

- cualquier participante puede solicitar una comparación;
- el servidor resuelve las fuentes y ejecuta el análisis;
- solo existe un trabajo simultáneo por sala;
- el servidor publica progreso, errores y resultados inmutables;
- todos los clientes representan el mismo modo, referencias y revisión;
- los clientes no pueden fabricar datasets históricos ni ejecutar Git.

## Limpieza y ausencia de código legado

La migración eliminó:

- `codexr-chart-pedestal`;
- `CodeXRChartPedestalRuntime`;
- el asset y las pruebas del pedestal antiguo;
- aliases y referencias asociadas al layout anterior.

Al cerrar una comparación se eliminan datasources, charts, listeners,
controladores y geometría comparativa. El servicio elimina las instantáneas
temporales al destruirse y limpia su caché en memoria.

## Pruebas realizadas

La cobertura automatizada comprueba:

- repositorios raíz y objetivos anidados;
- ramas locales, remotos con nombres arbitrarios, etiquetas y commits;
- árbol de trabajo modificado y detached HEAD;
- ausencia de `checkout`, `fetch`, shell y escrituras en `.git`;
- materialización, límites, rutas seguras y objetivos ausentes;
- dos zonas simétricas y restauración del modo normal;
- selección transaccional de métricas y rollback conjunto;
- dos `babia-boats` con IDs aislados;
- actualización exclusiva de `working-copy`;
- autoridad y sincronización mediante WebSocket.

La validación manual en navegador reprodujo una comparación entre
`working-copy` y una referencia histórica con dos barcos. Tras cambiar la altura
de `totalLines` a `functionCount`, se verificaron los atributos, metadatos y
alturas físicas de las geometrías en ambos lados, antes y después de refrescar
la fuente viva.

## Límites y evolución futura

- Solo se muestran referencias y objetos disponibles localmente.
- No se detectan renombrados como una operación única.
- No hay todavía superposición de revisiones ni coloreado individual por delta.
- El objetivo debe pertenecer a un repositorio Git local.
- Los clones parciales pueden requerir obtener objetos ausentes fuera de CodeXR.
- Los repositorios con Git LFS comparan el contenido disponible en los objetos
  Git; no descargan objetos LFS automáticamente.

Evoluciones previstas:

- detección de renombrados;
- filtros por magnitud, lenguaje y tipo de cambio;
- resaltado espacial de elementos añadidos, eliminados y modificados;
- vista superpuesta;
- paginación o búsqueda avanzada de referencias;
- actualización remota explícita y consentida.
