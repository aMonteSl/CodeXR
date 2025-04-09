# Documentación de la Extensión IntegracionVsCodeAframe

## Estructura general del proyecto

En el desarrollo de esta extensión, decidí seguir un patrón modular con una clara separación de responsabilidades. Esta organización me permite mantener el código limpio y facilita la incorporación de nuevas funcionalidades en el futuro.

## 1. Archivos principales

### extension.ts
- Funciona como el **punto de entrada principal** de la extensión
- Aquí inicializo la barra de estado, el árbol lateral y registro todos los proveedores
- Es responsable de conectar todos los componentes y registrar los comandos disponibles

## 2. Módulos funcionales

### Carpeta `analysis` - Análisis de código JavaScript

Implementé esta funcionalidad para permitir a los usuarios analizar sus archivos de código:

- **`codeAnalyzer.ts`**: Actúa como coordinador central del proceso de análisis
- **`models/analysisModel.ts`**: Define las interfaces necesarias como `FileAnalysis`, `ProjectAnalysis` y `CodeMetrics`
- **`metrics/`**:
  - `commentMetrics.ts`: Analiza comentarios en el código
  - `functionMetrics.ts`: Identifica y cuenta funciones y métodos
  - `locMetrics.ts`: Cuenta líneas de código (total, código, comentarios, vacías)
- **`providers/`**:
  - `analysisTreeProvider.ts`: Proporciona el árbol de archivos JavaScript analizables
  - `analysisViewProvider.ts`: Gestiona la vista webview que muestra los resultados del análisis
- **`utils/fileParser.ts`**: Mi parser personalizado para archivos JS/TS

**Bibliotecas que utilizo en el análisis:**
- **TypeScript Compiler API**: Para realizar análisis estático del código
- **VS Code API**: Para integración con el editor (vistas, árboles)
- **Módulos nativos de Node.js**: `fs` y `path` para manejo de archivos

### Carpeta `babiaxr` - Visualizaciones de datos 3D

Esta es la parte central de la extensión, que permite crear visualizaciones 3D con BabiaXR:

- **`models/chartModel.ts`**: Define tipos para diferentes visualizaciones (bar, pie, donut, etc.)
- **`providers/babiaTreeProvider.ts`**: Gestiona la sección BabiaXR en el panel lateral
- **templates**:
  - `fileManager.ts`: Maneja la creación y guardado de archivos HTML
  - `templateManager.ts`: Gestiona plantillas para los diferentes tipos de gráficos
- **`visualization/`**:
  - `chartManager.ts`: Crea y gestiona visualizaciones
  - `dataCollector.ts`: Extrae datos de archivos JSON/CSV
  - `optionsCollector.ts`: Recopila opciones visuales (colores, entornos)

### Carpeta `server` - Servidor de desarrollo local

Para la visualización en tiempo real, implementé un servidor de desarrollo completo:

- **`certificateManager.ts`**: Gestiona certificados SSL para HTTPS
- **`liveReloadManager.ts`**: Implementa recarga en vivo del navegador
- **`requestHandler.ts`**: Maneja peticiones HTTP/HTTPS con soporte para SSE
- **`serverManager.ts`**: Inicia/detiene servidores y gestiona puertos
- **`models/serverModel.ts`**: Define interfaces para la configuración del servidor
- **`providers/serverTreeProvider.ts`**: Gestiona la sección de servidores en el panel lateral

### Carpeta `ui` - Componentes de interfaz

Para la experiencia de usuario, diseñé varios componentes de interfaz:

- **`statusBarManager.ts`**: Gestiona la barra de estado de VS Code
- **`treeProvider.ts`**: Proveedor principal para el árbol de la extensión
- **`panels/analysisPanel.ts`**: Panel para mostrar resultados detallados
- **`treeItems/`**:
  - `baseItems.ts`: Clases base para elementos del árbol
  - `chartItems.ts`: Elementos específicos para visualizaciones
  - `serverItems.ts`: Elementos específicos para servidores
- **`webviews/colorPickerWebView.ts`**: Selector visual de colores

### Carpeta `commands` - Comandos de la extensión

Organicé los comandos por funcionalidad:

- **`index.ts`**: Punto de entrada que registra todos los comandos
- **`analysisCommands.ts`**: Comandos para análisis de código
- **`babiaCommands.ts`**: Comandos para visualizaciones BabiaXR
- **`serverCommands.ts`**: Comandos para gestión de servidores
- **`uiCommands.ts`**: Comandos para la interfaz de usuario

### Carpeta `utils` - Utilidades generales

Funciones de utilidad que pueden ser usadas en diferentes partes de la extensión:

- **`colorPickerUtils.ts`**: Funciones para trabajar con colores
- **`templateUtils.ts`**: Funciones para procesamiento de plantillas
- **`nonceUtils.ts`**: Generación de nonces para seguridad en webviews
