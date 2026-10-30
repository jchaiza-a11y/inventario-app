# Informe del paso 2B — Base de datos creada y probada (rama de pruebas de Neon)

**Resultado:** las tablas, funciones, triggers y la vista del diseño v2 (`docs/DB_DISENO.md`) se crearon en la **rama de pruebas** de Neon y las **8 pruebas del plan pasaron (8/8)**. No se tocó la rama de producción, no se cargó el mock y no se cambió el código de la aplicación.

---

## 1. Qué se hizo

1. **SQL versionado.** El SQL del diseño se guardó en archivos numerados dentro de `db/migrations/`. Se copió por programa desde los bloques del documento de diseño para no introducir errores al retipearlo.
2. **Script para aplicarlo.** `npm run db:aplicar` ejecuta los archivos en orden contra la base de pruebas. Cada archivo corre en una transacción (si falla, no queda a medias) y una tabla de control, `schema_migraciones`, recuerda cuáles ya se aplicaron.
3. **Paquete instalado.** Solo `pg` (cliente de PostgreSQL para Node, versión 8.23.1). No se usó ningún ORM ni `dotenv`: el archivo `.env.local` se lee con la opción `--env-file` de Node.
4. **Aplicación del SQL.** Las 4 migraciones se aplicaron **sin errores** y sin necesidad de corregir el SQL. Funcionó con la conexión con pooler; si algún día falla al crear objetos, existe la opción `DB_DIRECTA=1`, que usa el servidor directo (sin `-pooler`), porque el pooler comparte conexiones y algunas operaciones de estructura necesitan una conexión propia.
5. **Pruebas.** `npm run db:probar` ejecuta las 8 pruebas del plan. Casi todas corren dentro de transacciones que se deshacen, así que no dejan datos; la prueba 8 (dos personas a la vez) sí confirma datos temporales y los borra al terminar.
6. **Seguridad.** Los scripts nunca imprimen la cadena de conexión, el usuario, la contraseña ni el servidor: todo texto pasa antes por un filtro que los oculta, y el script se niega a correr si la variable de pruebas apuntara a la misma base que la de producción. Al final de las pruebas se comprueba automáticamente que la salida no contenga credenciales.

---

## 2. Archivos creados o modificados

### Creados

| Archivo | Para qué sirve |
|---|---|
| `db/migrations/001_tablas.sql` | Las 6 tablas del diseño, sus restricciones e índices. |
| `db/migrations/002_funciones_triggers.sql` | Función del siguiente correlativo, trigger de alta de bienes (correlativo y catálogo EXCLUIDO), normalización del N° de acta y bloqueo de editar o borrar movimientos y actas con movimientos. |
| `db/migrations/003_vista_estado_actual.sql` | La vista `estado_actual_bien`. |
| `db/migrations/004_datos_tipo_movimiento.sql` | Los 4 tipos de movimiento iniciales. |
| `db/conexion.mjs` | Conexión a la base de pruebas, con ocultamiento de credenciales y protección contra producción. |
| `db/aplicar.mjs` | Aplica las migraciones en orden. |
| `db/probar.mjs` | Las 8 pruebas del plan. |
| `docs/informes/INFORME_2B.md` | Este informe. |

### Modificados

| Archivo | Cambio |
|---|---|
| `package.json` | Dependencia `pg` y dos comandos: `db:aplicar` y `db:probar`. |
| `package-lock.json` | Se actualizó solo por la instalación de `pg`. |

### Fuera del repositorio (no se tocó)

- `.env.local` no se modificó y sigue ignorado por git.

### Objetos creados en la base de pruebas

- **Tablas:** `catalogo_sbn`, `persona`, `bien`, `tipo_movimiento`, `acta`, `movimiento` y la de control `schema_migraciones` (esta última no estaba en el diseño; se agregó solo para llevar el control de las migraciones).
- **Vista:** `estado_actual_bien`.
- **Funciones:** `siguiente_correlativo`, `preparar_bien`, `normalizar_numero_acta`, `rechazar_cambios_movimiento`, `proteger_acta_con_movimientos`.
- **Triggers:** `bien_prepara_alta`, `acta_normaliza_numero`, `movimiento_solo_se_agrega`, `movimiento_no_se_vacia`, `acta_con_movimientos_es_intocable`.

---

## 3. Resultado de las 8 pruebas

| # | Prueba | Resultado | Resultado real |
|---|---|---|---|
| 1 | Vista del estado actual (impresora con reparación y custodia) | **PASÓ** | Tras la reparación y el reingreso: Rosa Quispe Huamán, EN USO, a su cargo desde 2025-10-01, CUSTODIA de Luis Paredes Soto. En el pase encadenado (Rosa → Carlos) sigue siendo de Luis; al asignarse a Ana pasa a PROPIO. También se comprobó un bien sin movimientos ni responsable (SIN ASIGNAR) y un migrado que sale a reparación (sin fecha, "S/F"). |
| 2 | Los movimientos solo se agregan | **PASÓ** | `UPDATE`, `DELETE` y `TRUNCATE` sobre `movimiento` fueron rechazados con el mensaje en español. Una acta con movimientos y un bien con movimientos tampoco se pueden modificar ni borrar. Los 5 movimientos quedaron intactos. |
| 3 | Código de 12 dígitos (texto) y sin repetidos | **PASÓ** | Se rechazaron: catálogo de 7 dígitos, catálogo con letra, correlativo `123`, `AB12` y `0000`, código de catálogo inexistente, escribir el código patrimonial a mano y un código repetido. Un bien válido produjo `746452230001` (texto de 12 dígitos, conserva los ceros). |
| 4 | Correlativo único por tipo | **PASÓ** | Una laptop y una silla con correlativo `0001` conviven (`746452230001` y `536096500001`); dos laptops con `0001` son rechazadas. |
| 5 | Correlativo automático sin huecos | **PASÓ** | La 3.ª laptop recibió `0003`, la 3.ª silla `0003`, el primer monitor `0001` y la 4.ª laptop `0004`. Con un tipo que ya usó el `9999`, avisa que no quedan correlativos. |
| 6 | Código de catálogo EXCLUIDO | **PASÓ** | Rechazado en un alta normal. Con la importación activada se acepta y queda marcado como excepción. Un código ACTIVO no puede marcarse como excepción a mano (la base lo corrige). |
| 7 | N° de acta normalizado | **PASÓ** | `"  acta-0099-2026 "` se guardó como `ACTA-0099-2026`; el mismo número en minúsculas fue rechazado por repetido. |
| 8 | Dos personas a la vez | **PASÓ** | La persona B esperó su turno mientras A no confirmaba; recibieron los correlativos `0001` y `0002`. Un bien de otro tipo no esperó a nadie. |

**Nota sobre la prueba 3.** En la primera corrida marcó fallo en dos líneas, pero la base se comportó bien: los correlativos `123` y `AB12` **sí fueron rechazados**. Lo que no coincidió fue el nombre de la restricción que lo informó: PostgreSQL revisa las restricciones en orden alfabético y la de los 12 dígitos (`bien_codigo_patrimonial_12`) se evalúa antes que la del correlativo. La prueba exigía un nombre de restricción concreto, lo cual estaba mal planteado; se corrigió para aceptar cualquiera de las dos y se volvió a correr todo (8/8). Consecuencia práctica: el mensaje de error para un correlativo mal escrito hablará del "código patrimonial"; la aplicación puede traducirlo a algo más claro.

**Estado de la rama de pruebas al terminar:** todas las tablas de datos vacías y la numeración de ids reiniciada a 1, lista para cargar el mock. `tipo_movimiento` conserva sus 4 filas iniciales.

---

## 4. Pendiente para el paso 2C (cargar el mock en la base)

1. **Catálogo:** cargar en `catalogo_sbn` los 8 códigos de bien del mock con una denominación cada uno (son códigos inventados, no reales de la SBN).
2. **Personas:** cargar las 4 con **nombres y apellidos separados** (Carlos | Mendoza Rivas, Rosa | Quispe Huamán, Luis | Paredes Soto, Ana | Torres Vega). Primero sin jefe y luego completar `jefe_inmediato_id`.
3. **Bienes:** cargar los 10 con los **códigos renumerados por tipo** (las dos laptops quedan `…0001` y `…0002`; las dos sillas, `…0001` y `…0002`; el resto, `…0001`; la tabla de equivalencias está en `docs/DB_DISENO.md`, sección 6). Se cargan con el correlativo escrito a mano. La serie "S/S" se guarda como `NULL`.
4. **Actas y movimientos:** cargar las 7 actas y los 11 movimientos del mock.
5. **Verificación:** comparar la vista `estado_actual_bien` con la tabla de resultado esperado de 10 bienes (`docs/DB_DISENO.md`, sección 6). Hasta ahora la vista se probó con la impresora y otros casos, **no con el mock completo**.
6. **Después de la verificación:** decidir si se vacía la rama de pruebas. Como los movimientos no se pueden borrar ni vaciar, vaciarla significa descartar o recrear la rama de Neon, no ejecutar un `DELETE`.

### Recordatorios de los pasos siguientes (ya acordados)

- **Paso 2D (conectar las pantallas):** las pantallas, la ficha y el acta usan los códigos y nombres nuevos, e imprimen "S/S" (serie), "S/M" (marca, modelo o medidas) y el color en blanco cuando el dato es `NULL`.
- **Antes de cargar datos reales (obligatorio):** bloquear el cambio de `codigo_bien` y `correlativo` en bienes que ya tienen movimientos (Etapa 4). No se carga ningún dato real hasta que exista.
- **En el paso de conexión de la aplicación:** el usuario con el que se conecta la app no debe poder activar la etiqueta `app.importacion`, y conviene que solo tenga permiso de lectura e inserción sobre `movimiento` (no `UPDATE`, `DELETE` ni `TRUNCATE`).
- **Etapa 4:** validaciones de negocio dentro de la base (situación válida según el tipo, jefe existente, persona activa para asignar, fecha no anterior al último movimiento).

---

## 5. Qué debe revisar el usuario

1. **Pruebas 1 y 8**, las más importantes: son el caso de la impresora (reparación y custodia) y el bloqueo por tipo que evita correlativos repetidos o con huecos.
2. **La nota de la prueba 3:** confirmar que está de acuerdo en que un correlativo mal escrito se informe mediante la regla de los 12 dígitos, con el mensaje técnico de la base (la app lo traducirá).
3. **Que la vista aún no se ha comparado con el mock completo:** eso es parte del paso 2C.
4. **La tabla `schema_migraciones`:** no estaba en el diseño; se agregó solo para llevar el control de las migraciones aplicadas.
5. **Aviso de `pg`:** en cada ejecución aparece un aviso sobre el parámetro `sslmode` de la conexión. Es un cambio futuro de `pg` y hoy no afecta, pero conviene ajustar la cadena de conexión antes de actualizar `pg`.
6. **Seguridad:** ningún archivo del proyecto contiene credenciales (se revisaron los 68 archivos, sin contar `node_modules`, `.next` ni `.env.local`) y `.env.local` sigue ignorado por git.
