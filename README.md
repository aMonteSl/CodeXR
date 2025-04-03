# IntegracionVSAFrame - Servidor Local y Visualizaciones para A-Frame

Esta extensión de VS Code proporciona funcionalidades avanzadas para el desarrollo de aplicaciones con A-Frame:

1. Un servidor local con capacidad de recarga en vivo especialmente diseñado para el desarrollo de experiencias WebXR
2. Un creador de visualizaciones de datos 3D utilizando la biblioteca BabiaXR

## Estructura del Proyecto

```plaintext
src/
├── extension.ts                # Punto de entrada principal
├── models/                     # Modelos y tipos de datos
│   ├── [chartModel.ts](http://_vscodecontentref_/2)           # Modelos para visualizaciones
│   └── serverModel.ts          # Modelos para servidor
├── server/                     # Funcionalidad del servidor 
│   ├── serverManager.ts        # Gestión de servidores
│   ├── requestHandler.ts       # Manejo de peticiones HTTP
│   ├── certificateManager.ts   # Gestión de certificados SSL
│   └── liveReloadManager.ts    # Recarga en vivo
├── ui/                         # Componentes de UI
│   ├── [treeProvider.ts](http://_vscodecontentref_/3)         # Proveedor de árbol principal
│   ├── treeItems/              # Clases de elementos del árbol
│   │   ├── baseItems.ts        # Clases base
│   │   ├── serverItems.ts      # Elementos relacionados con servidor
│   │   └── [chartItems.ts](http://_vscodecontentref_/4)       # Elementos relacionados con gráficos
│   └── statusBarManager.ts     # Gestión de la barra de estado
├── visualization/              # Visualizaciones BabiaXR
│   ├── [chartManager.ts](http://_vscodecontentref_/5)         # Creación y lanzamiento de gráficos
│   ├── dataCollector.ts        # Recopilación de fuentes de datos
│   └── optionsCollector.ts     # Recopilación de opciones de gráficos
└── templates/                  # Procesamiento de plantillas
    ├── templateManager.ts      # Carga/procesamiento de plantillas
    └── fileManager.ts          # Guardado y exportación de archivos
```

## Funcionalidades

### Servidor Local para WebXR
- **Servidor HTTP/HTTPS**: Ejecuta aplicaciones web en un servidor local
- **Recarga en vivo**: Actualización automática al modificar archivos
- **HTTPS configurable**: Con certificados predeterminados o personalizados
- **Múltiples servidores**: Ejecuta varios servidores simultáneamente
- **Interfaz visual**: Gestión intuitiva desde el panel lateral

### Visualizaciones de Datos con BabiaXR
- **Gráficos 3D**: Creación de visualizaciones para entornos VR/AR
- **Múltiples tipos de gráficos**: Gráficos de barras, circulares, etc.
- **Análisis de datos**: Carga datos desde archivos JSON
- **Personalización**: Opciones para ajustar apariencia y comportamiento
- **Exportación**: Genera proyectos A-Frame completos con visualizaciones

## Tareas Pendientes

- **Agregar más plantillas de gráficos**: Implementar nuevos tipos como:
  - Gráficos de dispersión 3D
  - Redes de conectividad
  - Mapas de calor 3D
  - Visualización de terrenos para datos geoespaciales

- **Implementar análisis de código**:
  1. LOC (Lines of Code): Métricas básicas como número de funciones, líneas de código, comentarios en JS
  2. Complejidad ciclomática (CCN) y otras métricas de calidad de código en JS
  3. Visualización de estas métricas en gráficos 3D

## Uso

### Servidor Local

#### Iniciar un servidor
1. Abre el panel lateral de "A-Frame Explorer"
2. Haz clic en "Iniciar Servidor Local" o en "Configuración del servidor"
3. Selecciona un archivo HTML para servir
4. El navegador se abrirá automáticamente con tu aplicación

#### Configurar el modo de servidor
1. En el panel lateral, expande "Configuración del servidor"
2. Selecciona uno de los modos disponibles:
   - **HTTP**: Básico (no compatible con dispositivos VR)
   - **HTTPS con certificados predeterminados**: Usa los certificados incluidos
   - **HTTPS con certificados personalizados**: Selecciona tus propios certificados

#### Gestionar servidores activos
- Los servidores activos aparecen en la sección "Servidores Activos"
- Haz clic en cualquier servidor para ver opciones:
  - Abrir en navegador
  - Ver información detallada
  - Detener servidor

### Visualizaciones BabiaXR

#### Crear una visualización
1. En el panel de A-Frame Explorer, expande "Visualizaciones BabiaXR"
2. Selecciona "Crear Visualización"
3. Elige el tipo de gráfico (Barras, Circular)
4. Selecciona una fuente de datos:
   - Archivo local (CSV/JSON)
   - Datos de ejemplo incluidos
5. Configura los parámetros del gráfico:
   - Título
   - Dimensiones a visualizar
   - Opciones específicas del tipo de gráfico
6. La visualización se creará como un proyecto A-Frame listo para usar

#### Visualizar en VR/AR
1. Después de crear una visualización, puedes iniciar un servidor HTTPS
2. Accede desde un dispositivo compatible con WebXR
3. Explora tus datos en un entorno inmersivo 3D

## Requisitos

- Visual Studio Code 1.98.0 o superior
- Para experiencias WebXR, se recomienda un navegador compatible como Chrome, Edge o Firefox
- Para pruebas en dispositivos VR, es necesario usar HTTPS con certificados

## Notas Importantes

- Es normal que los navegadores muestren advertencias sobre certificados autofirmados durante el desarrollo
- El modo HTTP no es compatible con experiencias VR/AR debido a las restricciones de seguridad
- Todos los servidores se detienen automáticamente al cerrar VS Code
- Al navegar con el nombre del archivo en lugar de "localhost" en la URL, recuerda que la conexión real sigue siendo con localhost

## Solución de Problemas

- **Puertos bloqueados**: Si los puertos quedan bloqueados, reinicia VS Code o usa "Detener Servidor"
- **Certificados SSL**: Si hay problemas con los certificados, intenta usar la opción de certificados personalizados
- **Dispositivos VR**: Asegúrate de usar HTTPS; el modo HTTP no funcionará con dispositivos VR
- **Archivos de datos**: Si hay problemas con los archivos JSON, verifica su formato y codificación


