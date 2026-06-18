# CodeXR 1.2.0 Roadmap

## Objetivo

CodeXR 1.2.0 evoluciona la visualizacion de codigo hacia un espacio de trabajo XR colaborativo, extensible y accesible desde distintos dispositivos. La version prioriza una arquitectura modular, presencia humana comprensible, colaboracion administrable y bases tecnicas para nuevos graficos, inteligencia artificial local y conexion entre redes.

## Estado general

| Apartado | Estado | Alcance de 1.2.0 |
| --- | --- | --- |
| 1. Fundamentos y arquitectura | En progreso | Unificar versiones WebXR, contratos y componentes propios |
| 2. Workspace multiestacion | Planificado | Estaciones XR y organizacion espacial persistente |
| 3. Grafo de dependencias | Implementado; validacion multiusuario pendiente | Analisis bajo demanda, 23 lenguajes, tres layouts y colaboracion |
| 4. Comparador temporal | Implementado; validación multiusuario pendiente | Mesa dual, Git local independiente del proveedor, selector transaccional y fuente Live |
| 5. Colaboracion 2.0 | Implementado; validacion XR pendiente | Perfil por instalacion, avatares, presencia y puntero |
| 6. Conexion entre redes | Implementado; prueba real pendiente | Quick Tunnel, emparejamiento, sesiones y revocacion |
| 7. Asistencia con IA | En estudio | IA local o gratuita, privada y opcional |
| 8. Calidad y publicacion | En progreso | Pruebas, rendimiento XR, documentacion y release |

## 1. Fundamentos y arquitectura

- Mantener componentes CodeXR desacoplados del transporte, de BabiaXR y de la interfaz de VS Code.
- Unificar las escenas XR y DOM sobre A-Frame 1.7.1.
- Conservar `loadedFiles` como contrato de contenido textual generado.
- Evitar incluir recursos grandes cuando puedan obtenerse de forma opcional y consentida.
- Mantener el identificador tecnico compatible `code-xr`, usando `CodeXR` como nombre visible.
- Definir APIs publicas pequenas para que graficos, pantallas y futuros componentes puedan colaborar sin conocer WebSocket.

## 2. Workspace multiestacion

- Crear estaciones XR configurables para analisis, graficos, pantallas, documentacion y conversacion.
- Permitir guardar, restaurar y compartir su distribucion espacial.
- Anadir anclajes y navegacion rapida entre estaciones.
- Preparar la sincronizacion de estaciones en el protocolo de sala.
- Disenar limites de rendimiento para escritorio, movil y visores autonomos.

## 3. Grafo de dependencias

- Componente propio `codexr-dependency-graph`, sin modificar BabiaXR.
- Aristas direccionales con presets por tipo e intensidad, flujo adaptativo y
  portal agregado para dependencias externas ocultas.
- Tercer modo de `codexr-analysis-table`, activado desde el panel compacto.
- Analisis bajo demanda de los 23 lenguajes del contrato de metricas.
- Imports, includes, requires, herencia, implementacion y llamadas con confianza explicita.
- Vista por archivos o grupos, dependencias externas opcionales y deteccion de ciclos.
- Layouts `force-3d`, `hierarchical` y `metric-space` calculados en Web Worker.
- Mapping independiente para tamano, altura, color y posicion por metricas de grafo.
- Estado autoritativo y configuracion compartida mediante WebSocket.

La arquitectura, resolucion, limites, compatibilidad con proveedores Git y
estrategia de pruebas se describen en
[Grafo XR de dependencias](DEPENDENCY_GRAPH_XR.md).

## 4. Comparador temporal

El análisis XR arranca con la mesa normal y permite abrir desde la escena una
comparación compartida entre el árbol de trabajo, ramas, etiquetas o commits
disponibles localmente. CodeXR materializa instantáneas sin cambiar la rama
activa, presenta dos gráficos en paralelo y aplica el mismo selector de métricas
a ambos.

La primera entrega incluye un resumen de elementos añadidos, eliminados,
modificados y sin cambios. La superposición y el resaltado individual se
reservan para una iteración posterior.

La arquitectura se divide en una mesa `codexr-analysis-table`, controladores
`codexr-chart-containment` por gráfico, un servicio Git sin shell y un
coordinador autoritativo por servidor. Las solicitudes compartidas viajan por
WebSocket para seguir funcionando mediante Quick Tunnel.

La arquitectura, compatibilidad con GitHub y GitLab, materialización segura,
reactividad Live, Field Mapping y estrategia de pruebas se describen en
[Comparador histórico XR](HISTORICAL_COMPARISON_XR.md).

- Comparar dos revisiones, ramas o capturas del mismo analisis.
- Representar altas, bajas y cambios de complejidad en el espacio.
- Permitir una vista superpuesta y otra paralela.
- Incorporar filtros por archivo, lenguaje, autor y magnitud del cambio.
- Preparar integracion con Git sin bloquear el analisis local normal.

## 5. Colaboracion 2.0

### Implementado

- Estado autoritativo `ParticipantState` con `host` y `guest`.
- Primer participante como host y promocion automatica del invitado mas antiguo.
- Transferencia de host, expulsion de la conexion actual y parada administrativa de presentaciones.
- Identidad anonima predeterminada con alias de Star Wars estable durante la sesion.
- Nombre personalizado Unicode de 2 a 32 caracteres, sin controles y con sufijos para duplicados.
- Perfil persistente y centralizado en el almacenamiento global de la extension.
- Seis skins intercambiables y sincronizadas en directo.
- Componente independiente `codexr-avatar`, sin logica de red.
- Cuerpo procedural inmediato y fallback offline.
- Avatar glTF animado opcional, con interpolacion, deteccion de `idle`, `walk` y `run`, LOD y ocultacion por distancia.
- Seccion principal `COLLABORATION` en el panel lateral de VS Code.
- Consentimiento explicito en VS Code antes de descargar el modelo: se informa de 2,16 MiB, procedencia y licencia.
- Descarga unica en `globalStorage`, reutilizada por todos los analisis.
- Las seis skins reutilizan una sola geometria descargada para reducir trafico y memoria.
- Manos en la pose real de los controladores, cuerpo estable desde el rig y orientacion desde la cabeza.
- El escenario no muestra paneles de configuracion, roles, participantes ni presentacion.
- Se han retirado seguimiento y teletransporte para mantener una experiencia espacial simple.
- Un unico presentador principal por sala.
- Rayo compartido desde el controlador derecho o cursor de escritorio.
- Empaquetado de los runtimes en analisis de archivo, directorio y DOM.
- Cada navegador directo recibe siempre identidad anonima.
- Las pestaanas abiertas por CodeXR reciben el perfil de esa instalacion mediante un token de navegador de un solo uso.
- Los perfiles de instalaciones distintas permanecen aislados y sus cambios se propagan solo a sus propias conexiones.
- Las manos procedurales se ocultan cuando el glTF esta activo y solo se transmiten poses de controladores XR realmente rastreados.
- El movimiento se calcula en el plano horizontal y el reposo solo usa clips `idle`, `stand` o equivalentes; sin clip valido se conserva la pose base.

### Protocolo

```ts
type CollaborationRole = 'host' | 'guest';
type IdentityMode = 'anonymous' | 'custom';

interface ParticipantState {
    peerId: string;
    displayName: string;
    identityMode: IdentityMode;
    avatarId: string;
    role: CollaborationRole;
    isPresenter: boolean;
    connectedAt: string;
}
```

Mensajes de sala:

- `participant-updated`
- `participant-kick`
- `host-transfer`
- `role-updated`
- `presenter-started`
- `presenter-stopped`

La identidad ya no se modifica mediante mensajes editables del navegador. El servidor la obtiene de una sesion emitida por CodeXR o fuerza anonimato para conexiones directas. Tambien valida skin, autoridad administrativa y exclusividad del presentador. El cliente no puede asignarse el rol de host.

### Componentes

| Componente | Responsabilidad |
| --- | --- |
| `CollaborationRoomServer` | Sala, autoridad, roles, identidad, presentacion y estado compartido |
| `codexrCollaborationRuntime.js` | Transporte, estado cliente, presencia y API publica |
| `codexrAvatarRuntime.js` | Render humanoide, animacion, skins, LOD y recursos consentidos |
| `CollaborationProfileManager` | Perfil global, descarga opcional y propagacion a los servidores activos |
| `CollaborationSectionProvider` | Configuracion central desde el panel lateral de VS Code |
| `RemoteSessionAuthority` | Invitaciones, codigos, tokens, cookies, caducidad, limites y revocacion |
| `RemoteAccessManager` | Ciclo de vida de tuneles, acciones de servidor y conexiones invitadas |
| `CloudflaredBinaryManager` | Descubrimiento, consentimiento, descarga fijada y verificacion SHA-256 |

### Recursos de avatar

La implementacion final no empaqueta GLB dentro del VSIX. El usuario decide si descarga el recurso al utilizar los avatares completos:

- Descarga actual: 2.266.136 bytes, mostrados como 2,16 MiB.
- Geometria: aproximadamente 13.744 triangulos.
- Fuente: Quaternius, distribuido mediante Poly Pizza.
- Licencia del recurso descargado: CC BY 3.0.
- Sin consentimiento o sin red: avatar procedural.
- Con consentimiento: descarga unica de la extension y reutilizacion entre analisis y skins.

Este diseno sustituye la copia de binarios propuesta inicialmente. No se anade un pipeline binario al plugin porque no existe ningun binario propio que empaquetar.

### Pruebas incorporadas

- Asignacion de host e invitados.
- Promocion automatica y transferencia de host.
- Restriccion de acciones administrativas.
- Expulsion de una conexion.
- Identidad autoritativa, navegadores anonimos, duplicados, perfiles manipulados y skins invalidas.
- Exclusividad y liberacion del presentador.
- Consentimiento previo, tamano anunciado y descarga global unica.
- Inclusion de avatar y colaboracion en escenas XR y DOM sin panel superpuesto.
- Compatibilidad del cliente de colaboracion en contextos sin DOM.

### Trabajo pendiente

- Validacion manual con dos navegadores y dos dispositivos fisicos.
- Medicion real con dos, cuatro y ocho avatares en Quest.
- Ajuste de huesos/manos para modelos adicionales si se adopta otro pack.
- Sincronizacion especifica de estaciones XR cuando exista el workspace multiestacion.
- TURN autenticado para redes donde falle la conexion WebRTC directa.

## 6. Conexion entre redes

### Implementado

- Capacidad desactivada por defecto mediante `ServerSettings.remoteAccess`.
- Accion explicita por servidor desde `Active Servers`; habilitar la capacidad no publica servidores automaticamente.
- Cloudflare Quick Tunnel temporal sin cuenta ni configuracion de router.
- Guia operativa, limites y modelo de seguridad: [Acceso remoto con Cloudflare Quick Tunnel](CLOUDFLARE_REMOTE_ACCESS.md).
- Deteccion de una instalacion existente de `cloudflared` y descarga opcional unica en `globalStorage`.
- Version `2026.5.2` fijada, descarga sin shell, ventana oculta y verificacion SHA-256 antes de ejecutar.
- Directorio personal aislado para que una configuracion `~/.cloudflared/config.yaml` del usuario no interfiera con Quick Tunnel.
- Estados `stopped`, `starting`, `shared` y `error`, con copia de invitacion, solicitudes pendientes y parada explicita.
- Enlace con token criptografico, solicitud pendiente, codigo de seis cifras, caducidad de cinco minutos y cinco intentos.
- Codigos almacenados solo como hash con sal; no se escriben tokens ni codigos en los logs HTTP.
- Token separado para la extension invitada y token de navegador de un solo uso.
- Cookie de sesion `HttpOnly`, `Secure` en acceso remoto, `SameSite=Lax` y limitada a la sesion.
- HTTP, WebSocket de sala y senalizacion de pantallas rechazan el acceso remoto sin sesion como recurso inexistente.
- Limite de solicitudes por direccion, limite global, vinculacion del codigo a la direccion y revocacion al cerrar el tunel.
- Accion `Unirse a sesion remota` dentro de `COLLABORATION`, usando el perfil configurado en el CodeXR invitado.
- Pantalla previa minima para navegadores directos; tras emparejarse permanecen anonimos.
- STUN gratuito de Cloudflare en WebRTC: `stun:stun.cloudflare.com:3478`.

### Limites conocidos

- Quick Tunnel es temporal y de desarrollo, no infraestructura de produccion.
- Cloudflare Quick Tunnel no soporta SSE; la colaboracion funciona, pero las actualizaciones de analisis basadas en SSE quedan limitadas durante el acceso remoto.
- La pantalla compartida depende de que la conexion WebRTC directa atraviese ambos NAT.
- TURN queda preparado como ampliacion posterior porque requiere credenciales y trafico de relay.
- Falta validar el flujo completo con dos redes fisicas antes de considerar cerrada la aceptacion.

## 7. Asistencia con IA

- Disenar IA opcional, nunca necesaria para abrir una visualizacion.
- Priorizar modelos locales mediante WebGPU o runtimes instalables.
- Evaluar proveedores gratuitos unicamente como alternativa explicita.
- Proponer resumenes de zonas complejas, agrupacion semantica y rutas de exploracion.
- No enviar codigo a terceros sin consentimiento informado.
- Mostrar modelo, proveedor, limites y datos transmitidos antes de activar la funcion.

## 8. Calidad y publicacion

- Ejecutar pruebas TypeScript, ESLint, Node y Python antes de cada candidato.
- Anadir validacion visual en escritorio y navegador movil.
- Probar al menos un visor autonomo y un visor conectado a PC.
- Medir FPS, memoria, tiempo de carga y trafico de presencia.
- Validar reconexion, restauracion de perfil y degradacion offline.
- Preparar notas de migracion desde 1.1.0 y avisos de privacidad.

Estado automatizado actual: TypeScript y ESLint limpios, 160 pruebas Node y 22 pruebas Python superadas.

## Secuencia de entrega

1. `1.2.0-alpha.1`: Colaboracion 2.0 en red local.
2. `1.2.0-alpha.2`: workspace multiestacion y primer grafico propio.
3. `1.2.0-beta.1`: conexion entre redes e invitaciones.
4. `1.2.0-beta.2`: IA opcional y comparador temporal.
5. `1.2.0-rc.1`: rendimiento, accesibilidad, documentacion y pruebas de hardware.
6. `1.2.0`: publicacion estable.

## Criterios de salida

- No se rompe ningun flujo de analisis existente.
- Todas las operaciones administrativas son validadas por el servidor.
- La colaboracion funciona sin descargar avatares.
- Ningun modelo se descarga sin consentimiento.
- La escena sigue siendo utilizable si falla la red o el recurso glTF.
- La suite automatizada y las pruebas manuales de dos clientes quedan documentadas.
