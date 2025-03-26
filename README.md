# IntegracionVSAFrame - Servidor Local para Desarrollo de A-Frame

Esta extensión de VS Code proporciona un servidor local con capacidad de recarga en vivo (live reload) especialmente diseñado para el desarrollo de aplicaciones con A-Frame y experiencias de Realidad Virtual/Aumentada en la web.

integracionvsaframe/
├── src/                  - Código fuente de la extensión
│   └── ...               - (estructura actual)
├── templates/            - Plantillas para generar HTML
│   ├── bar-chart.html    - (ya existente)
│   └── pie-chart.html    - (ya existente)
├── examples/             - Ejemplos para los usuarios
│   ├── charts/           - Ejemplos de visualizaciones
│   │   ├── bar-chart/    - Ejemplos de gráficos de barras
│   │   │   ├── simple.html
│   │   │   └── advanced.html
│   │   └── pie-chart/    - Ejemplos de gráficos circulares
│   │       ├── simple.html
│   │       └── donut.html
│   └── data/             - Datos JSON/CSV de ejemplo
│       ├── ventas.json   - (tu ejemplo actual)
│       ├── productos.json
│       └── clima.csv
├── resources/            - Recursos estáticos
│   └── certs/            - Certificados SSL
└── package.json

## Tareas pendientes

Agregar mas templates de graficos
Que se actualize a tiempo real la pestaña si cambio los datos del json (Actualmente se actualiza pero la camra se resetea)

## Por hacer
1. Lanzar html con graficos de BabiaXR
2. LOC (Lines of Code), número de funciones, número de líneas de código, número de comentarios... (JS)
3. Complejidad (CCN), otras metricas de calidad de código (JS) 

🚀 Orden recomendado de trabajo:
Te recomiendo seguir este orden para avanzar de manera eficiente y lógica:

✅ Paso 1 (más prioritario): Lanzar HTML con gráficos de BabiaXR
Motivo:

Esto sigue la línea natural de lo que ya tienes funcionando (servidor HTTPS).
Puedes probar inmediatamente tus escenarios VR con las gafas y resolver pronto cualquier problema técnico que pueda surgir.
🔄 Paso 2: LOC y métricas básicas de JS
Motivo:

Es relativamente sencillo y te da una base sólida sobre la que construir métricas más avanzadas.
Te permite rápidamente tener un resultado visual en la extensión.
🔍 Paso 3: Complejidad ciclomática y métricas avanzadas
Motivo:

Es más complejo, pero puedes hacerlo apoyándote en librerías existentes.
Con los pasos anteriores completados, te será más fácil integrarlo en la extensión.


## Características

- **Servidor local HTTP/HTTPS**: Permite ejecutar tus aplicaciones web en un servidor local.
- **Recarga en vivo**: Los cambios en tus archivos se reflejan automáticamente en el navegador.
- **Soporte para HTTPS**: Configurable con certificados predeterminados o personalizados (necesario para WebXR).
- **Múltiples servidores**: Ejecuta varios servidores simultáneamente para trabajar con diferentes proyectos.
- **Interfaz visual**: Panel lateral para gestionar todos los servidores activos y su configuración.


## Requisitos

- Visual Studio Code 1.98.0 o superior
- Los archivos de certificado para HTTPS se incluyen en la extensión (o puedes usar los tuyos propios)

## Uso

### Iniciar un servidor

1. Abre el panel lateral de "A-Frame Servers"
2. Haz clic en "Iniciar Servidor Local"
3. Selecciona un archivo HTML para servir
4. El navegador se abrirá automáticamente con tu aplicación

### Configurar el modo de servidor

1. En el panel lateral, expande "Configuración del servidor"
2. Selecciona uno de los modos disponibles:
   - **HTTP**: Servidor básico (no compatible con dispositivos de realidad virtual)
   - **HTTPS (certificados predeterminados)**: Usa los certificados incluidos en la extensión
   - **HTTPS (certificados personalizados)**: Te permite seleccionar tus propios certificados

### Gestionar servidores activos

1. Los servidores activos aparecen en la sección "Servidores Activos" del panel lateral
2. Haz clic en cualquier servidor para:
   - Abrir el servidor en el navegador
   - Detener el servidor

También puedes acceder rápidamente a los servidores activos desde la barra de estado.

## Uso con A-Frame y WebXR

Para experiencias de realidad virtual con A-Frame y la API WebXR es **obligatorio** usar HTTPS. Esta extensión facilita este requisito mediante:

- Configuración automática del servidor HTTPS
- Certificados SSL predeterminados incluidos
- Opción para usar certificados personalizados si los necesitas

## Notas importantes

- Es posible que los navegadores muestren advertencias sobre los certificados autofirmados. Es normal y puedes proceder con seguridad en entornos de desarrollo.
- Al cerrar VS Code, todos los servidores activos se detendrán automáticamente.
- El modo HTTP no es compatible con experiencias de VR/AR debido a las restricciones de seguridad de los navegadores.

## Solución de problemas

Si los puertos permanecen bloqueados después de un uso incorrecto:
- Reinicia VS Code
- Si persiste, reinicia tu ordenador
- Usa el comando "Detener Servidor Local" para cerrar correctamente los servidores

## Contribuir

Esta extensión es de código abierto. Si encuentras problemas o tienes sugerencias, por favor crea un issue en el repositorio del proyecto.

**¡Disfruta desarrollando experiencias inmersivas con A-Frame!**
