# IntegracionVSAFrame - Servidor Local y Visualizaciones para A-Frame

Esta extensión de VS Code proporciona funcionalidades avanzadas para el desarrollo de aplicaciones con A-Frame:

1. Un servidor local con capacidad de recarga en vivo especialmente diseñado para el desarrollo de experiencias WebXR
2. Un creador de visualizaciones de datos 3D utilizando la biblioteca BabiaXR

## Estructura del Proyecto

```plaintext
src/
├── analysis/                      # Análisis de código JavaScript
│   ├── metrics/                   # Métricas de código
│   │   ├── commentMetrics.ts      # Análisis de comentarios
│   │   ├── functionMetrics.ts     # Análisis de funciones
│   │   └── locMetrics.ts          # Análisis de líneas de código
│   ├── models/                    # Modelos de datos
│   │   └── analysisModel.ts       # Interfaces para análisis
│   ├── providers/                 # Proveedores de UI
│   │   ├── analysisTreeProvider.ts # Árbol de archivos JS
│   │   └── analysisViewProvider.ts # Webview para análisis
│   ├── utils/                     # Utilidades
│   │   └── fileParser.ts          # Parser de archivos
│   └── codeAnalyzer.ts            # Coordinador del análisis
│
├── server/                        # Servidores locales A-Frame
│   ├── models/                    # Modelos de datos
│   │   └── serverModel.ts         # Interfaces para servidores
│   ├── providers/                 # Proveedores de UI
│   │   └── serverTreeProvider.ts  # Árbol de servidores
│   ├── utils/                     # Utilidades
│   │   └── certificateUtils.ts    # Gestión de certificados
│   ├── certificateManager.ts      # Gestor de certificados SSL
│   ├── liveReloadManager.ts       # Recarga en tiempo real
│   ├── requestHandler.ts          # Manejador de peticiones HTTP
│   └── serverManager.ts           # Gestor de servidores
│
├── babiaxr/                       # Visualizaciones BabiaXR
│   ├── models/                    # Modelos de datos
│   │   └── chartModel.ts          # Interfaces para gráficos
│   ├── providers/                 # Proveedores de UI
│   │   └── babiaTreeProvider.ts   # Árbol de visualizaciones
│   ├── templates/                 # Gestión de plantillas
│   │   ├── fileManager.ts         # Manejo de archivos
│   │   └── templateManager.ts     # Procesamiento de plantillas
│   ├── visualization/             # Gestión de visualizaciones
│   │   ├── chartManager.ts        # Gestor de gráficos
│   │   ├── dataCollector.ts       # Recolección de datos
│   │   └── optionsCollector.ts    # Recolección de opciones
│   └── utils/                     # Utilidades
│       └── templateUtils.ts       # Utilidades para plantillas
│
├── ui/                            # Componentes UI compartidos
│   ├── treeItems/                 # Items de árbol
│   │   ├── baseItems.ts           # Items base
│   │   ├── serverItems.ts         # Items de servidor 
│   │   └── chartItems.ts          # Items de gráficos
│   ├── webviews/                  # Componentes webview
│   │   └── colorPickerWebView.ts  # Selector de color
│   ├── statusBarManager.ts        # Gestor de barra de estado
│   └── treeProvider.ts            # Proveedor principal (delegador)
│
├── utils/                         # Utilidades generales
│   ├── colorUtils.ts              # Utilidades de color
│   ├── fileUtils.ts               # Utilidades de archivo
│   ├── nonceUtils.ts              # Generación de nonce para CSP
│   └── debounceUtils.ts           # Funciones debounce para eventos
│
├── commands/                      # Comandos organizados por categoría
│   ├── index.ts                   # Punto de entrada para todos los comandos
│   ├── analysisCommands.ts        # Comandos de análisis
│   ├── serverCommands.ts          # Comandos de servidor
│   ├── babiaCommands.ts           # Comandos de BabiaXR
│   └── uiCommands.ts              # Comandos de UI general
│
└── extension.ts                   # Archivo principal de la extensiónLibrerías y Dependencias
TypeScript: Lenguaje principal de desarrollo
VS Code API: Para integración con el editor
A-Frame: Framework WebXR para crear experiencias 3D/VR/AR
BabiaXR: Componentes de visualización de datos para A-Frame
get-port: Utilidad para obtener puertos disponibles automáticamente
node:http/https: Módulos nativos para crear servidores web
node:fs: Módulo para operaciones de sistema de archivos
TypeScript Compiler API: Para el análisis estático de código
Funcionalidades
Servidor Local para WebXR
Servidor HTTP/HTTPS: Ejecuta aplicaciones web en un servidor local
Recarga en vivo: Actualización automática al modificar archivos
HTTPS configurable: Con certificados predeterminados o personalizados
Múltiples servidores: Ejecuta varios servidores simultáneamente
Interfaz visual: Gestión intuitiva desde el panel lateral
Visualizaciones de Datos con BabiaXR
Gráficos 3D: Creación de visualizaciones para entornos VR/AR
Múltiples tipos de gráficos: Gráficos de barras, cilindros, circulares, etc.
Análisis de datos: Carga datos desde archivos JSON y CSV
Personalización: Opciones para ajustar apariencia y comportamiento
Exportación: Genera proyectos A-Frame completos con visualizaciones
Selección ordenada de atributos: Sistema mejorado para mantener el orden correcto de selección de dimensiones
Análisis de Código JavaScript
Métricas básicas: Líneas de código, comentarios, funciones y clases
Visualización: Panel dedicado para mostrar resultados del análisis
Integración en la barra de estado: Acceso rápido a las métricas del archivo actual
Implementaciones Recientes
Mejora del Sistema de Selección de Atributos
Orden de selección preservado: Corrección que mantiene el orden exacto en que el usuario selecciona atributos para visualizaciones
Reordenamiento inteligente: Las selecciones se reordenan automáticamente según el orden original
Validación por tipo de gráfico: Cada tipo de gráfico mantiene sus propias reglas de selección
Mensajes informativos: Feedback claro sobre el rol de cada atributo seleccionado
Optimización del Proceso de Desarrollo
Sistema de comandos modular: Organización de comandos por categorías para facilitar el mantenimiento
Debounce para eventos: Implementación para evitar actualizaciones demasiado frecuentes
Delegación de responsabilidades: Separación clara entre la lógica de negocio y la interfaz de usuario
Uso
Servidor Local
Iniciar un servidor
Abre el panel lateral de "A-Frame Explorer"
Haz clic en "Iniciar Servidor Local" o en "Configuración del servidor"
Selecciona un archivo HTML para servir
El navegador se abrirá automáticamente con tu aplicación
Configurar el modo de servidor
En el panel lateral, expande "Configuración del servidor"
Selecciona uno de los modos disponibles:
HTTP: Básico (no compatible con dispositivos VR)
HTTPS con certificados predeterminados: Usa los certificados incluidos
HTTPS con certificados personalizados: Selecciona tus propios certificados
Gestionar servidores activos
Los servidores activos aparecen en la sección "Servidores Activos"
Haz clic en cualquier servidor para ver opciones:
Abrir en navegador
Ver información detallada
Detener servidor
Visualizaciones BabiaXR
Crear una visualización
En el panel de A-Frame Explorer, expande "Visualizaciones BabiaXR"
Selecciona "Crear Visualización"
Elige el tipo de gráfico (Barras, Cilindros, Circular, etc.)
Selecciona una fuente de datos:
Archivo local (CSV/JSON)
Datos de ejemplo incluidos
Configura los parámetros del gráfico:
Título
Dimensiones a visualizar (en orden específico)
Opciones específicas del tipo de gráfico
La visualización se creará como un proyecto A-Frame listo para usar
Visualizar en VR/AR
Después de crear una visualización, puedes iniciar un servidor HTTPS
Accede desde un dispositivo compatible con WebXR
Explora tus datos en un entorno inmersivo 3D
Requisitos
Visual Studio Code 1.98.0 o superior
Para experiencias WebXR, se recomienda un navegador compatible como Chrome, Edge o Firefox
Para pruebas en dispositivos VR, es necesario usar HTTPS con certificados
Notas Importantes
Es normal que los navegadores muestren advertencias sobre certificados autofirmados durante el desarrollo
El modo HTTP no es compatible con experiencias VR/AR debido a las restricciones de seguridad
Todos los servidores se detienen automáticamente al cerrar VS Code
Al navegar con el nombre del archivo en lugar de "localhost" en la URL, recuerda que la conexión real sigue siendo con localhost
Solución de Problemas
Puertos bloqueados: Si los puertos quedan bloqueados, reinicia VS Code o usa "Detener Servidor"
Certificados SSL: Si hay problemas con los certificados, intenta usar la opción de certificados personalizados
Dispositivos VR: Asegúrate de usar HTTPS; el modo HTTP no funcionará con dispositivos VR
Archivos de datos: Si hay problemas con los archivos JSON, verifica su formato y codificación
Selección de dimensiones: Si el orden de selección no se mantiene, asegúrate de usar la última versión de la extensión
```
