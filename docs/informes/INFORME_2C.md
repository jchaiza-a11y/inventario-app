# Informe del paso 2C — Mock cargado en la base y comparado con la aplicación

**Resultado:** el mock se cargó en la **rama de pruebas** de Neon (8 códigos de catálogo, 4 personas, 10 bienes, 7 actas, 11 movimientos) y la vista `estado_actual_bien` dio **los mismos resultados** que la tabla esperada de `docs/DB_DISENO.md` (sección 6) y que el cálculo actual de la aplicación (`calcularEstado`) para los **10 bienes: 10 de 10 PASÓ, 0 DIFIERE**. La secuencia `db:reiniciar → db:sembrar → db:comparar` se ejecutó dos veces con el mismo resultado. No se tocó producción, el código de la aplicación, las pantallas ni `src/data/mock.ts`, y no hay commit.

---

## 1. Qué se hizo

1. **Reinicio** (`npm run db:reiniciar -- --confirmar-borrado`): elimina todo lo que creó el proyecto en la base de pruebas y vuelve a aplicar las migraciones desde cero. Es la forma de "empezar de nuevo", porque los movimientos no se pueden borrar ni vaciar.
2. **Carga** (`npm run db:sembrar`): aplica `db/seeds/001_mock.sql` en una transacción. Se niega si la base ya tiene datos.
3. **Comparación** (`npm run db:comparar`): compara la vista con (a) la tabla de la sección 6 y (b) `calcularEstado` sobre el mock. Además comprueba que la carga copió bien los bienes, las personas y los movimientos. Las fechas se comparan como texto `AAAA-MM-DD`.
4. **Sin instalar nada nuevo.** Node 24 importa los archivos `.ts` directamente, así que el comparador usa los mismos `mock.ts` y `patrimonio.ts` que la aplicación.
5. **Prueba de que el comparador de verdad detecta diferencias.** Se alteró a propósito un dato (el responsable inicial del escritorio) y salió DIFIERE en las tres columnas de ese bien, con la causa explicada; luego se repitió la secuencia completa y volvió a salir PASÓ.

### Protecciones del reinicio

- Exige el argumento `--confirmar-borrado`; sin él se niega y explica cómo continuar (comprobado).
- Usa solo `DATABASE_URL_PRUEBAS` y se niega si apunta a la misma base y servidor que `DATABASE_URL`. Se comprobó con direcciones **falsas** (nunca con las reales) que la protección corta antes de conectarse.
- Solo elimina tablas, vistas y funciones del esquema `public` que **no pertenezcan a una extensión**, y lo hace dentro de una transacción (si falla, no borra nada).

---

## 2. Archivos creados o modificados

### Creados

| Archivo | Para qué sirve |
|---|---|
| `db/seeds/001_mock.sql` | Los datos del mock adaptados al diseño v2. |
| `db/reiniciar.mjs` | Elimina los objetos y reaplica las migraciones. |
| `db/sembrar.mjs` | Carga el archivo de datos en una transacción. |
| `db/comparar.mjs` | Comparación de la vista con la tabla de la sección 6 y con la aplicación. |
| `db/migraciones.mjs` | Lógica de migraciones, compartida entre `aplicar` y `reiniciar`. |
| `docs/informes/INFORME_2C.md` | Este informe. |

### Modificados

| Archivo | Cambio |
|---|---|
| `db/aplicar.mjs` | Ahora usa `db/migraciones.mjs` (mismo comportamiento que antes). |
| `package.json` | Tres comandos nuevos: `db:reiniciar`, `db:sembrar` y `db:comparar`. |

`.env.local` no se tocó. Ningún archivo del proyecto contiene credenciales (se revisaron todos, sin contar `node_modules`, `.next` ni `.env.local`).

---

## 3. Adaptaciones del mock al diseño v2

1. **Códigos renumerados por tipo.** Cada código de catálogo cuenta desde 0001 (ver el mapa).
2. **Nombres separados** en `nombres` y `apellidos`: Carlos | Mendoza Rivas, Rosa | Quispe Huamán, Luis | Paredes Soto, Ana | Torres Vega (`nombre_completo` lo genera la base).
3. **"S/S" pasa a `NULL`** en la serie de la silla Ejecutiva, el escritorio, la silla Operativa y el archivador. El mock no usa "S/M".
4. **`creado_por` queda `NULL`** (todavía no hay inicio de sesión).
5. **Catálogo ficticio**, con denominaciones coherentes con cada bien (no son códigos reales de la SBN).

### Mapa de códigos: mock → base

| Bien | Código de catálogo | Código en el mock | **Código en la base** |
|---|---|---|---|
| Computadora portátil Lenovo | 74645223 | 746452230001 | 746452230001 *(igual)* |
| Monitor Samsung | 74645226 | 746452260002 | **746452260001** |
| Impresora HP | 74645224 | 746452240003 | **746452240001** |
| Silla Forli Ejecutiva | 53609650 | 536096500004 | **536096500001** |
| Escritorio de madera | 53604210 | 536042100005 | **536042100001** |
| Computadora portátil Dell *(2.ª del tipo)* | 74645223 | 746452230006 | **746452230002** |
| Proyector Epson | 74641550 | 746415500007 | **746415500001** |
| Computadora de escritorio HP | 74645220 | 746452200008 | **746452200001** |
| Silla Forli Operativa *(2.ª del tipo)* | 53609650 | 536096500009 | **536096500002** |
| Archivador metálico | 53601180 | 536011800010 | **536011800001** |

El comparador calcula este mapa por regla (orden del correlativo original dentro de cada código de catálogo) y confirma que coincide con los códigos de la tabla de la sección 6.

---

## 4. Resultado de la comparación, bien por bien

Todos los bienes dieron **PASÓ** en las tres comprobaciones: datos del bien cargados (descripción, marca, modelo, serie, medidas, color, estado de conservación, responsable y ubicación iniciales), vista contra la tabla de la sección 6 y vista contra el cálculo de la aplicación. Los campos comparados en las dos últimas son: responsable, ubicación, situación, "a su cargo desde", condición y "en custodia por cuenta de".

| Código en la base | Responsable | Ubicación | Situación | A su cargo desde | Condición | Datos | Vista vs §6 | Vista vs app |
|---|---|---|---|---|---|---|---|---|
| 746452230001 | Rosa Quispe Huamán | Oficina de Abastecimiento | EN USO | 2025-10-01 | CUSTODIA (de Luis Paredes Soto) | PASÓ | PASÓ | PASÓ |
| 746452260001 | Rosa Quispe Huamán | Oficina de Abastecimiento | EN USO | 2025-10-01 | CUSTODIA (de Luis Paredes Soto) | PASÓ | PASÓ | PASÓ |
| 746452240001 | Rosa Quispe Huamán | Oficina de Abastecimiento | EN USO | 2025-10-01 | CUSTODIA (de Luis Paredes Soto) | PASÓ | PASÓ | PASÓ |
| 536096500001 | Rosa Quispe Huamán | Oficina de Abastecimiento | EN USO | vacío (S/F) | PROPIO | PASÓ | PASÓ | PASÓ |
| 536042100001 | Carlos Mendoza Rivas | Dirección General | EN USO | vacío (S/F) | PROPIO | PASÓ | PASÓ | PASÓ |
| 746452230002 | sin responsable | Almacén central | SIN ASIGNAR | vacío (S/F) | PROPIO | PASÓ | PASÓ | PASÓ |
| 746415500001 | Rosa Quispe Huamán | Servicio técnico externo | EN REPARACION | vacío (S/F) | PROPIO | PASÓ | PASÓ | PASÓ |
| 746452200001 | Ana Torres Vega | Oficina de Abastecimiento | EN USO | 2025-10-15 | PROPIO | PASÓ | PASÓ | PASÓ |
| 536096500002 | Ana Torres Vega | Oficina de Abastecimiento | EN USO | 2025-10-15 | PROPIO | PASÓ | PASÓ | PASÓ |
| 536011800001 | Ana Torres Vega | Oficina de Abastecimiento | EN USO | 2025-10-20 | PROPIO | PASÓ | PASÓ | PASÓ |

### Comprobaciones adicionales de la carga

| Comprobación | Resultado |
|---|---|
| Conteos: 8 códigos de catálogo, 4 personas, 10 bienes, 7 actas, 11 movimientos | PASÓ |
| Personas: nombre, cargo, oficina, condición (Luis queda CESADO) y jefe inmediato | PASÓ |
| Movimientos: acta, fecha, tipo, bien, de quién a quién y ubicación, en el mismo orden m01…m11 | PASÓ (11 de 11) |

**Diferencias encontradas: ninguna**, así que no hubo nada que decidir ni nada que corregir. Los casos más delicados salieron bien: la impresora conserva su fecha (2025-10-01) y su custodia tras salir a reparación y volver; el archivador, asignado a Ana, dejó de ser custodia; y el proyector, migrado y en reparación, queda con "a su cargo desde" vacío.

---

## 5. Qué debe revisar el usuario

1. **Las denominaciones ficticias del catálogo** en `db/seeds/001_mock.sql` (por ejemplo, "COMPUTADORA PERSONAL PORTATIL"), que son inventadas.
2. **Una limitación de la comparación:** la tabla de la sección 6 y el cálculo de la aplicación vienen de la misma lógica de negocio que escribí yo; lo que es independiente es la vista SQL. El acuerdo entre las tres es una buena señal para el SQL, pero la tabla de la sección 6 conviene que la revises con tu propio criterio (¿las filas coinciden con lo que esperabas del negocio?).
3. **La rama de pruebas ahora contiene el mock cargado** (ya no está vacía).
   - `npm run db:probar` (las 8 pruebas del paso 2B) **solo funciona sobre la base vacía**: sus datos de prueba chocan con el catálogo cargado. Para correrlas de nuevo, hay que reiniciar la base y **no** sembrar antes: `npm run db:reiniciar -- --confirmar-borrado` y luego `npm run db:probar`. No lo modifiqué porque no era parte de este paso.
   - Para volver a tener el mock cargado: reiniciar, sembrar y comparar.
4. **Las pantallas y la aplicación siguen usando el mock en memoria.** Conectarlas a la base es el paso 2D.
5. **Recordatorios heredados (sin cambios):**
   - Antes de cargar datos reales es obligatorio bloquear el cambio de código en bienes con movimientos (Etapa 4).
   - En el paso de conexión, el usuario de la app no debe poder activar `app.importacion` y debería tener solo permiso de lectura e inserción sobre `movimiento`.
   - Las pantallas, la ficha y el acta deben imprimir "S/S" (serie), "S/M" (marca, modelo o medidas) y el color en blanco cuando el dato sea `NULL`.
