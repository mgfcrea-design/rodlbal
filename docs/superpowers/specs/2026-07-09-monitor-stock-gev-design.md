# Monitor de Stock de la Competencia (GEV-Online) — Diseño

## 1. Contexto y objetivo

MGF es propietario de MGFPROSPART, negocio B2B de recambios para maquinaria de cocina profesional. Uno de sus diferenciadores es el sourcing de piezas originales/bajo pedido (resistencias, elementos calefactores, etc.).

**Objetivo:** monitorizar el catálogo público (tras login B2B legítimo) del competidor GEV-Online (`https://www.gev-online.com`), familia de resistencias/elementos calefactores, para inferir qué códigos vende más (mediante caídas de stock a lo largo del tiempo) y así poder incorporar esos códigos de alta rotación al catálogo propio.

**Metodología de captura:** copiar y pegar manualmente texto plano desde la webshop de GEV (login requerido, sin API pública, sin scraping automatizado — se evita deliberadamente para no arriesgar el acceso). URL de ejemplo: `https://www.gev-online.com/es/webshop/search/groups/003500051?s=100` (100 artículos por página, 79 páginas totales para la familia de resistencias).

**Cadencia:** ~3 "cierres" (fotos de stock) por semana, durante varios meses. El primer cierre se hace pegando tantas páginas como haga falta hasta que el usuario decida manualmente un punto de corte (ej. página 32), basándose en que a partir de cierto punto los códigos tienen cantidades mínimas / poca rotación. **A partir de ahí, ese rango de páginas se mantiene fijo en todos los cierres siguientes** — la app no necesita saber nada de páginas, solo procesa el texto que se le pega.

Se descarta expresamente un prototipo anterior (artefacto HTML de Claude.ai con `window.storage`) por inestabilidad del sandbox y falta de confianza para sostener meses de datos críticos. Esta es una reconstrucción completa desde cero.

## 2. Preferencias del usuario

- No es programador, pero tiene experiencia manejando apps HTML propias con Supabase (varias en producción).
- Prioridad #1: **estabilidad** — el histórico no se puede perder bajo ninguna circunstancia.
- Prefiere cero infraestructura de pago / mínimo coste. Se descarta explícitamente una VPS propia (ej. Hostinger) por la carga operativa de mantenimiento (backups, parches, gestión de base de datos) que contradice la prioridad de estabilidad y bajo mantenimiento.
- Solo familia "resistencias" por ahora; multi-familia queda fuera de alcance explícitamente (se abordará más adelante si hace falta).

## 3. Arquitectura general

- **Frontend:** aplicación HTML/JS de una sola página (single-file, sin frameworks pesados), alojada en GitHub Pages.
- **Backend/datos:** proyecto Supabase **nuevo y dedicado** (Postgres + Auth + Row Level Security), separado del proyecto Supabase existente del usuario (`hcgcclftyfhgsemylpef`, usado para otra app) para no mezclar datos de inteligencia competitiva con datos de negocio.
- **Autenticación:** login real de Supabase (email + contraseña), una única cuenta. RLS exige sesión autenticada en todas las tablas para leer o escribir. Se eligió login real (en vez de sin protección o PIN simple) porque el repositorio en GitHub Pages será público y expondría la clave `anon` de Supabase.
- **Sin scraping/automatización:** el flujo es y seguirá siendo 100% copiar-pegar manual.

## 4. Formato del texto pegado (fuente de datos)

Cada "página" copiada de la web es un bloque de texto plano con este patrón, repetido por artículo (validado con ejemplo real de 92 artículos y captura de pantalla del listado original):

```
preview
Resistencia 1000 W 380 V L 445 mm
Nº REPA PT00003994
Precio lista: 167,26 €
Precio Neto: 150,53 €
en Stock
1600 CANT en stock Barcelona 14 CANT

1

Articulo no ubicado en tienda, consultar en mostrador
preview
Radiador cerámico 400 W 230 V L 245 mm H 35 mm An 60 mm cable cordón trenzado
Nº REPA 415102
Precio lista: 15,99 €
Precio Neto: 15,99 €
1-2 días
776 CANT en stock

1

Articulo no ubicado en tienda, consultar en mostrador
```

### Casos especiales observados

1. **"preview"** marca habitualmente el inicio de cada ficha (resto textual de la miniatura de imagen no copiable), pero **no es fiable como delimitador único** — en capturas reales el primer artículo de un pegado puede no llevarlo (p. ej. si el pegado empieza a media página). El parser no depende de esta palabra.
2. **"Un artículo alternativo está disponible"** — línea opcional tras la descripción. Se descarta.
3. **"sustituido por [código]"** — aparece en vez de la anterior en artículos descontinuados. Se descarta (no es el código del propio artículo); no se persigue esa relación en esta fase.
4. **Estado de disponibilidad** (`en Stock`, `1-2 días`, `1-2 Semanas`, `temp. no disponible`, `ya no disponible`) — **se ignora explícitamente por decisión del usuario**. Solo importa el número de "CANT/Metro en stock", sea cual sea el estado.
5. **Precio Neto ausente** — cuando no hay línea de precio, `precio_neto` queda `null`, sin romper el parseo.
6. **Cantidad en Barcelona opcional** — si no aparece, `cantidad_barcelona = 0`.
7. **Unidad "Metro" en vez de "CANT"** — para artículos a granel (cable, resistencia). Se trata igual que CANT.
8. **Código con formato variable** — 6 dígitos normalmente (`415101`), o con prefijo `PT` (`PT00003994`) o `LF` (`LF3355363`). Siempre es el token que sigue a "Nº REPA".

### Lógica de parseo

En vez de anclar cada bloque en "preview" (poco fiable, ver punto 1), el parser ancla cada producto en la línea **"Nº REPA \<código\>"**, que aparece siempre exactamente una vez por artículo:

```
por cada aparición de "Nº REPA <código>" en el texto:
  descripción = línea no vacía más cercana ANTES de esta línea, saltándose
                "preview", "Un artículo alternativo está disponible"
                y "sustituido por ..."
  precio_neto = primer "Precio Neto: X €" que aparezca DESPUÉS del código
                y ANTES del siguiente "Nº REPA" (si no aparece, precio = null)
  cantidad_total / cantidad_barcelona = primera línea que matchee
                "<núm> (CANT|Metro) en stock" (+ opcional "Barcelona <núm> (CANT|Metro)")
                después del código
  si no se encuentra código+cantidad → se descarta el bloque y se avisa al usuario
```

Regex de referencia:
```js
const reRepa   = /^N[ºo°]\s*REPA\s+(\S+)/i;
const rePrecio = /^Precio Neto:\s*([\d.,]+)\s*€/i;
const reCant   = /^(\d+)\s*(?:CANT|Metro)\s+en stock(?:\s+Barcelona\s+(\d+)\s*(?:CANT|Metro))?/i;
```

Conversión de precio: quitar puntos de miles y sustituir la coma decimal por punto → `parseFloat(precio.replace(/\./g,'').replace(',','.'))`.

## 5. Modelo de datos (Supabase / Postgres)

```sql
-- Catálogo de productos vistos (una fila por código, no se repite por fecha)
create table productos (
  codigo text primary key,
  descripcion text not null,
  primera_vez_visto date not null default current_date,
  ultima_vez_visto date not null default current_date
);

-- Cabecera de cada cierre (una "foto" completa de stock)
create table cierres (
  id bigint generated always as identity primary key,
  fecha date not null unique,
  estado text not null default 'en_progreso' check (estado in ('en_progreso','finalizado')),
  n_codigos integer not null default 0,
  created_at timestamptz not null default now(),
  finalizado_at timestamptz
);

-- Una fila por código y por cierre
create table lecturas_stock (
  id bigint generated always as identity primary key,
  cierre_id bigint not null references cierres(id) on delete cascade,
  codigo text not null references productos(codigo),
  cantidad_total integer not null,
  cantidad_barcelona integer not null default 0,
  precio_neto numeric(10,2),
  created_at timestamptz not null default now(),
  unique (cierre_id, codigo)
);

create index idx_lecturas_codigo on lecturas_stock (codigo);
create index idx_lecturas_cierre on lecturas_stock (cierre_id);
```

Todas las tablas tienen RLS activado, con políticas que exigen `auth.role() = 'authenticated'` para select/insert/update/delete.

La tabla `cierres` (nueva respecto al primer borrador) permite:
- Guardar el progreso de un cierre a medio hacer directamente en Supabase (`estado = 'en_progreso'`), sobreviviendo a cerrar el navegador o cambiar de equipo.
- Borrar un cierre entero en cascada si hubo un error de carga, desde la pantalla "Listado de cierres".

## 6. Flujo de carga de un cierre

1. **Abrir/reanudar cierre:** al entrar en "Cargar cierre", si existe un `cierre` con `estado='en_progreso'` se reanuda (mostrando cuántos códigos lleva ya acumulados); si no, se crea uno nuevo al pegar el primer bloque, con fecha por defecto hoy (editable).
2. **Pegar bloque:** el usuario pega el texto de una página; se parsea al instante, se muestra un resumen (códigos detectados, líneas no reconocidas) y se guarda ya en Supabase contra ese `cierre_id`. No existe estado "solo en el navegador" que se pueda perder.
3. **Duplicado dentro del mismo cierre:** si un código pegado ya existe en `lecturas_stock` para ese `cierre_id`, la app avisa explícitamente y deja elegir sobrescribir o ignorar ese código concreto.
4. **Finalizar cierre:** al pulsar "Finalizar cierre":
   - Upsert en `productos` (descripción, `ultima_vez_visto`).
   - Se marca el `cierre` como `finalizado`.
   - Se compara contra el cierre finalizado anterior y se muestra un aviso con **códigos nuevos** (no vistos en el cierre anterior) y **códigos desaparecidos** (vistos antes, ausentes ahora). No se asume automáticamente ningún significado (venta total, error de rango de páginas, reordenación del catálogo, etc.) — el usuario decide.
5. **Códigos ausentes:** no reciben fila nueva ese día; su histórico se queda "congelado" en el último valor conocido. Nunca se interpreta una ausencia como stock = 0.

## 7. Métricas de ranking

Para cada código, calculadas a partir de los deltas entre lecturas consecutivas (mismo código, cierres finalizados ordenados por fecha):

| Métrica | Cálculo |
|---|---|
| Vendido estimado (total) | Suma de las bajadas de stock entre cierres consecutivos |
| Repuesto estimado (total) | Suma de las subidas de stock entre cierres consecutivos |
| Nº de eventos de venta | Nº de bajadas de stock registradas |
| Nº de eventos de reposición | Nº de subidas de stock registradas |
| Días medios entre ventas | Promedio de días entre un evento de bajada y el siguiente evento de bajada |
| Días medios entre reposiciones | Promedio de días entre una subida y la siguiente subida |
| Stock inicial / actual | Primera y última lectura registrada |
| Nº de cierres con datos | Tamaño de muestra detrás del cálculo |

Regla de negocio: una bajada de stock entre dos fotos consecutivas = venta estimada (se suma). Una subida = reposición (se contabiliza aparte, no resta de las ventas).

Se implementa como vista SQL (`lag()` sobre `lecturas_stock` unida con `cierres` para la fecha) o cálculo equivalente en cliente. El ranking es ordenable por cualquiera de estas columnas, con buscador por código/descripción y exportación a CSV.

## 8. Pantallas de la aplicación

1. **Cargar cierre** — flujo descrito en la sección 6.
2. **Ranking de más vendidos** — tabla con las métricas de la sección 7, buscador, ordenable, exportar CSV.
3. **Ficha histórica por código** — búsqueda de un código, tabla + gráfico de evolución de stock por fecha de cierre, marcando visualmente bajadas (venta) vs subidas (reposición).
4. **Listado de cierres** — fechas guardadas, nº de códigos por cierre, estado (en progreso/finalizado), opción de eliminar un cierre completo (con confirmación).
5. **Comparador estacional** — selección de dos rangos de fechas (ej. verano vs invierno) para comparar venta estimada por código entre ambos periodos.

## 9. Seguridad, exportación y despliegue

- **Auth:** pantalla de login (email + contraseña) contra Supabase Auth obligatoria antes de cargar cualquier dato.
- **Exportación completa:** botón para descargar todo el histórico (`lecturas_stock` + `productos` + `cierres`) en CSV, además del CSV específico del ranking y del backup automático de Supabase.
- **Despliegue:** repositorio en GitHub, servido como sitio estático vía GitHub Pages. Actualizaciones futuras se despliegan con commit + push.

## 10. Fuera de alcance (explícitamente descartado)

- Scraping o automatización del login/captura — se mantiene 100% manual por decisión del usuario (riesgo de bloqueo de la cuenta B2B).
- Soporte multi-familia de producto — se revisará más adelante si hace falta.
- VPS propia / base de datos autogestionada — descartada por carga de mantenimiento, contradice la prioridad de estabilidad.
- Registro de página/posición dentro del catálogo — el rango de páginas de cada cierre es responsabilidad manual del usuario (fijo desde el primer cierre), la app no necesita saberlo.
