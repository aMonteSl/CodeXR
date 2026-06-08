# Acceso remoto de CodeXR con Cloudflare Quick Tunnel

## Resumen

CodeXR utiliza **Cloudflare Quick Tunnel** para compartir temporalmente un análisis
con personas que se encuentran en otra red. Esta función evita configurar el
router, abrir puertos entrantes o disponer de una IP pública.

El acceso remoto debe considerarse una función temporal de colaboración y
pruebas. Quick Tunnel no ofrece garantías de producción.

## Cómo circula una conexión

```text
Navegador invitado
        |
        | HTTPS y WebSocket
        v
Cloudflare (*.trycloudflare.com)
        |
        | túnel saliente creado por cloudflared
        v
Servidor local de CodeXR
        |
        v
Análisis XR y sala de colaboración
```

`cloudflared` abre conexiones salientes desde el ordenador anfitrión hacia
Cloudflare. El router no necesita aceptar conexiones nuevas desde Internet y
CodeXR no publica directamente la IP de origen.

Al dejar de compartir, cerrar el servidor o desactivar CodeXR se termina
`cloudflared`, deja de existir la URL aleatoria y CodeXR revoca invitaciones,
sesiones y credenciales remotas.

## Por qué es gratuito

Cloudflare presenta Quick Tunnels como una forma de probar Cloudflare Tunnel sin
crear una cuenta, mover DNS ni poseer un dominio. Lo ofrece para facilitar la
evaluación de Tunnel antes de configurar servicios de producción.

La gratuidad no implica garantía de capacidad o disponibilidad. Cloudflare
también utiliza estos túneles para probar cambios antes de desplegarlos en sus
productos de producción.

## Límites oficiales

A fecha de junio de 2026, Cloudflare documenta estas restricciones:

- máximo de **200 solicitudes simultáneas en curso por túnel**;
- las solicitudes que superan el límite reciben HTTP `429`;
- no se admite Server-Sent Events (SSE);
- el subdominio `*.trycloudflare.com` es aleatorio y temporal;
- la URL solo funciona mientras continúa ejecutándose el proceso;
- no existe SLA ni garantía de disponibilidad;
- el servicio está orientado expresamente a desarrollo, demostraciones y pruebas.

WebSocket sí funciona. CodeXR lo utiliza para la colaboración, presencia y
comparaciones históricas compartidas. La actualización local mediante SSE sigue
disponible en la red local, pero no se considera disponible a través de Quick
Tunnel.

## Seguridad: Cloudflare frente a CodeXR

Cloudflare proporciona el transporte público HTTPS y el túnel hasta el servidor
local. No decide quién puede entrar en una sesión de CodeXR.

CodeXR añade su propia autorización:

- enlace con token criptográfico de invitación;
- solicitud pendiente visible para el anfitrión;
- código temporal de seis cifras;
- caducidad y límite de intentos;
- token de navegador de un solo uso;
- cookie de sesión `HttpOnly` y `Secure`;
- autorización de HTTP, WebSocket y señalización;
- revocación al detener el túnel.

El tráfico remoto atraviesa la infraestructura de Cloudflare. Esto debe tenerse
en cuenta antes de compartir código, métricas o pantallas sensibles.

## Qué ocurre con cientos de usuarios

Cada instalación que comparte un servidor inicia su propio Quick Tunnel. Por
ello, cien anfitriones no consumen un único cupo compartido de 200 solicitudes:
cada túnel tiene su propio límite.

Esto no convierte Quick Tunnel en infraestructura con garantías:

- Cloudflare no publica un compromiso de capacidad global para este uso;
- puede cambiar, limitar o interrumpir el servicio sin SLA;
- una sesión con muchos recursos o clientes puede alcanzar su límite individual;
- CodeXR no controla la disponibilidad de `trycloudflare.com`;
- el arranque y la propagación de una URL nueva pueden introducir demora.

La versión pública debe presentar la función como **best effort**. Un fallo del
túnel no debe afectar al análisis local ni provocar pérdida de datos.

## Evolución recomendada

Para escenarios estables o institucionales se contemplan dos caminos:

1. **Cloudflare Named Tunnels**: cuenta, hostname estable y configuración
   administrable, con posibilidad de integrar Cloudflare Access.
2. **Relay propio de CodeXR**: infraestructura controlada por el proyecto para
   invitaciones, observabilidad, políticas de uso y disponibilidad.

TURN también requerirá infraestructura o credenciales específicas si se desea
garantizar el relay de pantallas WebRTC en redes con NAT restrictivo.

## Fuentes oficiales

- [Cloudflare Quick Tunnels](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/do-more-with-tunnels/trycloudflare/)
- [Cloudflare Tunnel](https://developers.cloudflare.com/tunnel/)
- [Wrangler Tunnel](https://developers.cloudflare.com/workers/wrangler/commands/tunnel/)
