# Tipos de edificios y skins

Este documento define los tipos de edificios disponibles y la lógica visual de sus texturas de pared y tejado.  
La idea principal es que todos pertenezcan al mismo mundo visual, pero que cada uno represente un estado distinto de conservación.

## Orden de más viejo a más moderno

```text
aged → legacy → current → fresh
```

| Orden | Tipo | Estado visual | Idea principal |
|---:|---|---|---|
| 1 | `aged` | Muy deteriorado | Edificio abandonado, envejecido y castigado por el tiempo |
| 2 | `legacy` | Antiguo pero sólido | Edificio histórico/tradicional, viejo pero todavía robusto |
| 3 | `current` | Usado pero mantenido | Edificio normal en uso, con desgaste natural |
| 4 | `fresh` | Nuevo o recién restaurado | Edificio limpio, moderno y bien conservado |

---

## `aged`

Representa el edificio más viejo y deteriorado.

### Pared

- Piedra muy envejecida.
- Tonos oscuros, grises, marrones y verdosos.
- Mucho desgaste visual.
- Manchas de humedad.
- Musgo visible.
- Suciedad acumulada en juntas.
- Aspecto de abandono.

### Tejado

- Tejas muy oscuras y gastadas.
- Manchas blancas intensas.
- Musgo abundante.
- Zonas deterioradas.
- Óxido o reparaciones metálicas viejas.
- Sensación de tejado antiguo, húmedo y descuidado.

### Uso recomendado

Para edificios abandonados, ruinas, casas antiguas sin mantenimiento o zonas pobres/deterioradas del mapa.

---

## `legacy`

Representa un edificio antiguo, tradicional o histórico, pero no abandonado.

### Pared

- Piedra antigua tipo mampostería.
- Bloques irregulares.
- Tonos gris cálido, ocre y marrón apagado.
- Juntas profundas.
- Algo de erosión.
- Desgaste visible, pero controlado.
- Aspecto sólido y robusto.

### Tejado

- Teja vieja tradicional.
- Más oscura que `fresh`.
- Algunas manchas blancas.
- Musgo muy sutil.
- Sin roturas fuertes.
- Sin óxido moderno exagerado.
- Aspecto antiguo, pero estable.

### Uso recomendado

Para edificios históricos, casas rurales antiguas, construcciones medievales, edificios nobles o estructuras tradicionales bien conservadas.

---

## `current`

Representa un edificio normal, actualmente en uso.

### Pared

- Piedra o ladrillo con desgaste natural.
- Tonos gris, marrón y beige.
- Pequeñas manchas.
- Algo de suciedad en las juntas.
- Textura realista sin parecer abandonada.
- Estado intermedio entre `fresh` y `legacy`.

### Tejado

- Tejas oscuras o marrones.
- Algo usadas.
- Variación suave de color.
- Algunas manchas discretas.
- Sin musgo protagonista.
- Sin óxido exagerado.

### Uso recomendado

Para edificios comunes, viviendas normales, barrios actuales o construcciones que no son nuevas, pero siguen estando cuidadas.

---

## `fresh`

Representa el edificio más nuevo o recién restaurado.

### Pared

- Piedra o ladrillo uniforme.
- Tonos beige, gris claro o terracota suave.
- Mortero visible y limpio.
- Casi nada de musgo.
- Variación ligera de color para evitar un aspecto artificial.
- Superficie limpia y cuidada.

### Tejado

- Teja nueva.
- Color rojizo o marrón cálido.
- Bordes definidos.
- Pocas manchas.
- Textura visible, pero sin suciedad fuerte.
- Aspecto limpio y recién colocado.

### Uso recomendado

Para edificios nuevos, casas restauradas, zonas modernas, aldeas cuidadas o construcciones recién terminadas.

---

## Resumen visual rápido

| Tipo | Pared | Tejado | Nivel de suciedad | Nivel de antigüedad |
|---|---|---|---:|---:|
| `aged` | Piedra muy sucia y con musgo | Teja muy envejecida, musgo y manchas fuertes | Muy alto | Muy alto |
| `legacy` | Mampostería antigua y sólida | Teja tradicional oscura con desgaste sutil | Medio | Alto |
| `current` | Piedra/ladrillo usado pero mantenido | Teja oscura con manchas suaves | Bajo/medio | Medio |
| `fresh` | Ladrillo/piedra limpia | Teja rojiza nueva | Bajo | Bajo |

---

## Convención de nombres recomendada

```text
aged-wall.png
aged-roof.svg

legacy-wall.png
legacy-roof.png

current-wall.png
current-roof.png

fresh-wall.png
fresh-roof.png
```

Si en el futuro se quiere mantener todo en el mismo formato, lo ideal sería unificar a:

```text
<tipo>-wall.png
<tipo>-roof.png
```

o, si todas las texturas terminan como SVG:

```text
<tipo>-wall.svg
<tipo>-roof.svg
```

---

## Criterio artístico general

La diferencia entre los tipos no debe ser solo el color.  
Debe notarse también en:

- La limpieza de las juntas.
- La cantidad de musgo.
- La intensidad de las manchas.
- La regularidad de los bloques o tejas.
- La profundidad del desgaste.
- La sensación de mantenimiento del edificio.

En resumen:

```text
aged   = viejo y abandonado
legacy = antiguo e histórico
current = usado y mantenido
fresh  = nuevo o restaurado
```
