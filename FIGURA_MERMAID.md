# Arquitectura del Subsistema de Análisis - Code-XR

## Diagrama en Mermaid

```mermaid
flowchart TD
    %% Definición de estilos más claros
    classDef orchestrator fill:#e1f5fe,stroke:#01579b,stroke-width:3px,color:#000
    classDef core fill:#f3e5f5,stroke:#4a148c,stroke-width:2px,color:#000
    classDef processor fill:#e8f5e8,stroke:#1b5e20,stroke-width:2px,color:#000
    classDef manager fill:#fff3e0,stroke:#e65100,stroke-width:2px,color:#000
    classDef storage fill:#fce4ec,stroke:#880e4f,stroke-width:2px,color:#000

    %% Componentes
    AO[Analysis Orchestrator]:::orchestrator
    CS[(Configuration<br/>Storage)]:::storage

    SR[Session Registry]:::core
    PE[Python Engine]:::core

    FRP[File Requirement<br/>Processor]:::processor
    TE[Template Engine]:::processor

    SRF[(Save/Update Requirement<br/>Files)]:::storage

    SWM[Session Watcher<br/>Manager]:::manager
    SSM[Session Server<br/>Manager]:::manager

    %% Flujo principal actualizado
    CS --> AO
    AO --> SR
    SR --> FRP
    FRP --> TE
    TE --> PE
    PE --> SRF
    SRF --> SWM
    SWM --> SSM

    %% Bucle de retroalimentación
    SWM -.->|"🔄 Re-análisis"| PE

    %% Etiquetas de flujo (1–8) en el orden requerido
    AO -.->|"1️⃣ Configuración"| CS
    AO -.->|"2️⃣ Session Registry"| SR
    SR -.->|"3️⃣ File Requirement Processor"| FRP
    FRP -.->|"4️⃣ Template Engine"| TE
    TE -.->|"5️⃣ Python Engine"| PE
    PE -.->|"6️⃣ Save/Update Requirement Files"| SRF
    SRF -.->|"7️⃣ Session Watcher Manager (incluye 🔄 Re-análisis)"| SWM
    SWM -.->|"8️⃣ Session Server Manager"| SSM


```

## Descripción de Componentes

### Control Layer
- **Analysis Orchestrator**: Coordina el proceso completo desde solicitud hasta visualización

### Core Processing
- **Session Registry**: Registro centralizado de sesiones activas con estado y configuración
- **Python Engine**: Extrae métricas del código fuente mediante bibliotecas especializadas

### File & Template Processing
- **File Requirement Processor**: Prepara archivos necesarios (plantillas HTML, scripts JS/CSS, datos)
- **Template Engine**: Combina plantillas con datos de análisis y configuraciones visuales

### Service Management
- **Session Watcher Manager**: Gestiona observadores de archivos para re-análisis automáticos
- **Session Server Manager**: Controla servidores HTTP y canales SSE

### Persistence
- **Configuration Storage**: Almacena configuraciones, preferencias y perfiles de usuario

## Flujo de Datos

1. **Control**: Analysis Orchestrator coordina todo el proceso
2. **Registro**: Session Registry gestiona el ciclo de vida de las sesiones
3. **Análisis**: Python Engine extrae métricas del código
4. **Procesamiento**: File Requirement Processor prepara recursos
5. **Plantillas**: Template Engine combina datos con visualizaciones
6. **Monitoreo**: Session Watcher Manager observa cambios de archivos
7. **Servidor**: Session Server Manager sirve las visualizaciones
8. **Persistencia**: Configuration Storage mantiene configuraciones

## Notas sobre el Diagrama

- Las líneas sólidas (`-->`) representan flujo de control principal
- Las líneas punteadas (`-.->`) representan comunicación de eventos/feedback
- Los colores diferenciados ayudan a identificar los tipos de componentes:
  - Gris: Componentes generales
  - Azul: Managers de servicios
  - Verde: Motores de procesamiento
  - Naranja: Almacenamiento
