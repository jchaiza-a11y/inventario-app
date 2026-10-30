# Diseño — Sistema de Control Patrimonial

Paso 1A: diseño base + pantalla **Bienes** (mock data). Solo modo claro.

## 1. Principios
- **Sobrio e institucional**, pero moderno: mucho blanco, bordes finos, sombras casi nulas (estilo Linear / shadcn blocks).
- **Densidad cómoda**: es una herramienta de trabajo; la tabla es la protagonista.
- **El color significa algo**: solo se usa color para situación y custodia. Todo lo demás es neutro + un acento.
- **Nunca solo color**: cada situación lleva punto de color **y** texto (accesibilidad).

## 2. Tipografía
- **Poppins** para todo el proyecto (vía `next/font/google` o `@fontsource/poppins`), pesos 400, 500, 600.
- Escala: título de página 24/32 · 600 · subtítulo 14 · 400 gris · tabla 13.5 · 400/500 · encabezados de tabla 12 · 500 · mayúsculas con tracking leve.
- Código patrimonial: Poppins con `font-variant-numeric: tabular-nums` (sin segunda fuente), siempre como texto.

## 3. Paleta (modo claro)

### Neutros y acento
| Token | Hex | Uso |
|---|---|---|
| `--background` | `#FAFAFB` | Fondo de la app |
| `--card` | `#FFFFFF` | Tablas, tarjetas, encabezado |
| `--sidebar` | `#F4F5F7` | Menú lateral |
| `--border` | `#E4E7EC` | Bordes y separadores |
| `--foreground` | `#101828` | Texto principal |
| `--muted-foreground` | `#667085` | Texto secundario |
| `--primary` | `#1E4FD8` | Acento (azul institucional): ítem activo, foco, botones |
| `--primary-soft` | `#EEF3FF` | Fondo del ítem activo del menú |
| `--ring` | `#1E4FD8` al 35 % | Anillo de foco |
| `--radius` | `0.5rem` | Radio base |

### Situación (semáforo)
| Situación | Significado | Texto | Fondo | Punto |
|---|---|---|---|---|
| EN USO | Verde | `#067647` | `#ECFDF3` | `#12B76A` |
| EN REPARACION | Ámbar | `#B54708` | `#FFFAEB` | `#F79009` |
| SIN ASIGNAR | Rojo | `#B42318` | `#FEF3F2` | `#F04438` |

### Condición
| Condición | Texto | Fondo | Borde |
|---|---|---|---|
| Propio | `#475467` | `#F2F4F7` | `#E4E7EC` (neutro, discreto) |
| **Custodia** | `#6941C6` | `#F4EBFF` | `#D9C8FA` (lila) |

Contraste: todos los textos de badge superan 4.5:1 sobre su fondo.

## 4. Layout
```
┌────────────┬──────────────────────────────────────────┐
│ Sidebar    │ Header: título de sección · (usuario)     │
│ 240 px     ├──────────────────────────────────────────┤
│ Logo       │ Bienes                                    │
│ ▸ Bienes   │ Control de los bienes patrimoniales…      │
│   Personas │ [🔍 Buscar…        ] [Situación ▾]  N bienes│
│   (pronto) │ ┌──────────────────────────────────────┐ │
│   Movim.   │ │ tabla                                 │ │
│   (pronto) │ └──────────────────────────────────────┘ │
└────────────┴──────────────────────────────────────────┘
```
- **Sidebar** (240 px, fija en escritorio; en móvil se oculta en un `Sheet`): logo + nombre de la entidad (ficticio), ítems con icono lucide. *Personas* y *Movimientos* deshabilitados con badge gris "Próximamente".
- **Header** (56 px, borde inferior): botón de menú en móvil, migas de pan ("Bienes"), a la derecha un avatar genérico (sin login).
- **Contenido**: ancho máximo 1400 px, padding 24 px.

## 5. Pantalla Bienes

**Barra de herramientas**: `Input` de búsqueda con icono (filtra por código, descripción, responsable, ubicación) · `Select` de situación (Todas / En uso / En reparación / Sin asignar) · contador "X de 10 bienes" a la derecha.

**Columnas de la tabla**
| Columna | Contenido |
|---|---|
| Código patrimonial | 12 dígitos, peso 500, tabular |
| Descripción | Texto principal + línea gris con marca · modelo |
| Responsable | Nombre; si no hay: "Sin responsable" en gris cursiva |
| Ubicación | Texto |
| Situación | `Badge` con punto de color |
| A su cargo desde | Fecha `dd/mm/aaaa`; "S/F" (gris) si es migrado sin fecha |
| Condición | `Propio` neutro, o `Custodia` lila con "de {persona}" en tooltip/línea pequeña |

- Filas con hover `#F9FAFB`, sin cebra; encabezado sticky con fondo `#F9FAFB`.
- Estado vacío: icono + "No se encontraron bienes" + botón "Limpiar filtros".
- Responsive: en móvil la tabla hace scroll horizontal dentro de su contenedor.

## 6. Componentes shadcn/ui
`Sidebar` (o `Sheet` + nav), `Table`, `Input`, `Select`, `Badge`, `Tooltip`, `Button`, `Avatar`, `Separator`, `Breadcrumb`. Iconos: `lucide-react` (ya viene con shadcn). **Sin librerías extra.**

## 7. Interacción
- Transiciones 150 ms (hover/foco), sin animaciones decorativas; respetar `prefers-reduced-motion`.
- Foco visible siempre (anillo `--ring`); objetivos táctiles ≥ 40 px en móvil.
- Búsqueda en vivo, sin botón; insensible a mayúsculas y tildes.

## 8. Stack propuesto (para tu OK)
Next.js (App Router) + TypeScript + Tailwind + shadcn/ui. La lógica de cálculo (último movimiento, "a su cargo desde", custodia) vive en una función pura `calcularEstado(bien, movimientos)`, con mock data en `src/data/`, lista para sustituir por base de datos en pasos posteriores.
