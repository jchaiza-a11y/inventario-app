# Diseño de la base de datos — Sistema de Control Patrimonial

**Etapa 2, paso 2A: solo diseño (versión 2, aprobada).** Este documento no instala nada, no se conecta a ninguna base y no toca el código. Cuando lo apruebes, el SQL se ejecutará en PostgreSQL (Neon) en un paso posterior.

El diseño sale de lo que ya existe: los tipos de `src/lib/patrimonio.ts`, los datos de `src/data/mock.ts` y las pantallas Bienes, Personas, Movimientos, la ficha y el acta.

> **Cambios de la versión 2** (según tus respuestas finales):
> el correlativo ahora es **por tipo de bien** (regla 2 corregida) y se asigna con un **bloqueo por tipo**; las personas tienen **nombres y apellidos por separado**; los datos opcionales del bien no admiten texto vacío; el número de acta se **normaliza solo**; los bienes con código de catálogo EXCLUIDO se aceptan **solo en importaciones** y quedan marcados; los movimientos guardan **quién los creó**; y los códigos del mock se **renumeran por tipo**. Las validaciones de negocio en la base quedan para la **Etapa 4**.

---

## 1. La idea en pocas palabras

Hoy el sistema guarda **los movimientos** en memoria y **calcula** el estado de cada bien con la función `calcularEstado`. En la base de datos haremos lo mismo:

- Se **guardan hechos**: bienes, personas, actas y movimientos.
- Lo que cambia con el tiempo (quién tiene el bien, dónde está, si está en custodia…) **no se guarda**: lo calcula una **vista** a partir del último movimiento.

Así nunca puede haber un estado "escrito a mano" que contradiga la historia.

---

## 2. Mini glosario (para ir entendiendo el SQL)

| Palabra | Qué significa, en sencillo |
|---|---|
| **Tabla** | Una hoja de Excel con columnas fijas; cada fila es un registro. |
| **Clave primaria (PK)** | La columna que identifica a cada fila sin repetirse (como el DNI de una persona). |
| **Clave foránea (FK)** | Una columna que apunta a la PK de otra tabla (como escribir el DNI en vez de todos los datos). La base **no deja** apuntar a algo que no existe. |
| **UNIQUE** | Prohíbe que un valor (o una combinación de columnas) se repita en la tabla. |
| **CHECK** | Una condición que cada fila debe cumplir o la base la rechaza. |
| **Índice** | Un "índice de libro": hace que buscar por esa columna sea rápido. Cuesta un poco de espacio. |
| **Columna generada** | Una columna que la base calcula sola a partir de otras (nadie la escribe). Ej.: el código patrimonial. |
| **Trigger** | Un vigilante automático: cuando pasa algo en una tabla (insertar, editar, borrar), la base ejecuta una función que puede aceptar, corregir o rechazar. |
| **Bloqueo "advisory"** | Un cartel de "ocupado" con un nombre que nosotros inventamos (aquí, el código de catálogo). Quien llega segundo espera a que el primero termine. No frena a las demás tablas ni a los demás tipos de bien. |
| **Vista** | Una consulta guardada con nombre. Se usa como si fuera una tabla, pero siempre calcula con los datos actuales. No guarda datos propios. |
| **`text` y no `integer` para códigos** | Un número pierde los ceros a la izquierda (`0001` sería `1`). Un código es una etiqueta, no se suma: va como texto. |

---

## 3. Diagrama de las tablas

`PK` = clave primaria · `FK` = clave foránea · `U` = único

```
┌──────────────────┐
│  catalogo_sbn    │
│ codigo        PK │ ◄───────────────┐
│ denominacion     │                 │
│ estado           │                 │ codigo_bien (FK)
└──────────────────┘                 │
                                     │
┌──────────────────┐        ┌────────┴─────────────────┐
│    persona       │        │          bien            │
│ id            PK │ ◄──────┤ id                    PK │
│ nombres          │  resp. │ codigo_bien           FK │ ┐ UNIQUE juntos:
│ apellidos        │ inicial│ correlativo              │ ┘ el correlativo es POR TIPO
│ nombre_completo* │        │ codigo_patrimonial*    U │  ← 12 dígitos, único en la entidad
│ cargo            │        │ descripcion, marca,      │
│ oficina          │        │ modelo, serie, medidas,  │
│ condicion        │        │ color                    │
│ jefe_inmediato_id│ ─┐     │ estado_conservacion      │
└───────▲──────────┘  │     │ responsable_inicial_id FK│
        │ ◄───────────┘     │ ubicacion_inicial        │
        │  (se apunta       │ excepcion_catalogo*      │
        │   a sí misma)     └────────────▲─────────────┘
        │                                │ bien_id (FK)
        │   responsable_anterior_id (FK) │
        │   responsable_nuevo_id    (FK) │
        │            ┌───────────────────┴─────────────┐
        └────────────┤          movimiento             │
                     │ id                           PK │
                     │ acta_id                      FK │──┐
                     │ bien_id                      FK │  │ UNIQUE (acta_id, bien_id)
                     │ responsable_anterior_id      FK │  │
                     │ responsable_nuevo_id         FK │  │
                     │ ubicacion_nueva                 │  │
                     │ motivo                          │  │
                     │ creado_en                       │  │
                     │ creado_por                      │  │
                     └─────────────────────────────────┘  │
                                                          │
┌──────────────────┐        ┌─────────────────────────┐   │
│ tipo_movimiento  │        │         acta            │ ◄─┘
│ codigo        PK │ ◄──────┤ id                   PK │
│ titulo_acta      │ tipo   │ numero                U │  ← "ACTA-0045-2025"
│ situacion_       │        │ fecha                   │
│   resultante     │        │ tipo_movimiento      FK │
│ exige_nuevo_     │        └─────────────────────────┘
│   responsable    │
│ exige_destino    │          * = columna que la base llena o calcula sola
│ efecto_custodia  │   INICIA · CONSERVA · LIMPIA
└──────────────────┘

VISTA estado_actual_bien  =  bien + movimiento + acta + tipo_movimiento + persona
                             (no guarda nada: calcula el estado de cada bien)
```

**Cómo leerlo:** una **acta** (la hoja que se firma) agrupa varios **movimientos**; cada movimiento es **un bien** que cambia de manos o de lugar. El **tipo** y la **fecha** viven en la acta, no en cada movimiento (esto es lo que garantiza la regla 5).

---

## 4. El SQL completo

El orden importa: primero las tablas que no dependen de otras.

### 4.1 Catálogo SBN

```sql
-- Catálogo de bienes: el "código del bien" de 8 dígitos y su nombre oficial.
CREATE TABLE catalogo_sbn (
  codigo       text PRIMARY KEY,              -- 8 dígitos, texto para conservar ceros
  denominacion text NOT NULL,                 -- Ej.: "COMPUTADORA PERSONAL PORTATIL"
  estado       text NOT NULL DEFAULT 'ACTIVO',
  CONSTRAINT catalogo_codigo_8_digitos      CHECK (codigo ~ '^[0-9]{8}$'),
  CONSTRAINT catalogo_estado_valido         CHECK (estado IN ('ACTIVO', 'EXCLUIDO')),
  CONSTRAINT catalogo_denominacion_no_vacia CHECK (btrim(denominacion) <> '')
);
```

- `~ '^[0-9]{8}$'` significa: "desde el inicio (`^`) hasta el final (`$`), exactamente 8 caracteres y todos dígitos del 0 al 9".

### 4.2 Personas

```sql
-- Personas de la entidad. El jefe inmediato es otra fila de esta misma tabla.
CREATE TABLE persona (
  id                bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, -- numeración automática
  nombres           text   NOT NULL,
  apellidos         text   NOT NULL,
  -- Columna generada: "Carlos" + "Mendoza Rivas" = "Carlos Mendoza Rivas". Es lo que muestran
  -- las pantallas y los documentos. Nadie la escribe: la base la mantiene sola.
  nombre_completo   text   GENERATED ALWAYS AS (btrim(nombres) || ' ' || btrim(apellidos)) STORED,
  cargo             text   NOT NULL,
  oficina           text   NOT NULL,                  -- texto libre por ahora
  condicion         text   NOT NULL DEFAULT 'ACTIVO',
  jefe_inmediato_id bigint REFERENCES persona (id),   -- NULL = no tiene jefe (ej.: el Director)
  CONSTRAINT persona_nombres_no_vacio  CHECK (btrim(nombres) <> ''),
  CONSTRAINT persona_apellidos_no_vacio CHECK (btrim(apellidos) <> ''),
  CONSTRAINT persona_condicion_valida  CHECK (condicion IN ('ACTIVO', 'CESADO')),
  CONSTRAINT persona_no_es_su_jefe     CHECK (jefe_inmediato_id IS DISTINCT FROM id)
);

-- Buscar "los subordinados de X" será frecuente (pase a custodia, organigrama).
CREATE INDEX persona_jefe_idx      ON persona (jefe_inmediato_id);
-- Para ordenar y buscar listas por apellido.
CREATE INDEX persona_apellidos_idx ON persona (apellidos, nombres);
```

- `GENERATED ALWAYS AS IDENTITY`: la base numera sola (1, 2, 3…); nadie puede escribir el número a mano.
- `IS DISTINCT FROM`: igual que "distinto de", pero tratando bien el `NULL` (sin jefe).

### 4.3 Bienes

```sql
-- Cada bien físico. El código patrimonial se arma solo: 8 dígitos + 4 de correlativo.
CREATE TABLE bien (
  id                     bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  codigo_bien            text   NOT NULL REFERENCES catalogo_sbn (codigo),  -- 8 dígitos
  -- 4 dígitos, contado POR TIPO de bien. Si no se escribe, un trigger lo asigna (ver 4.3.1).
  correlativo            text   NOT NULL,
  codigo_patrimonial     text   GENERATED ALWAYS AS (codigo_bien || correlativo) STORED,
  descripcion            text   NOT NULL,
  marca                  text,           -- NULL = sin dato (los documentos imprimen "S/M")
  modelo                 text,           -- NULL = sin dato (los documentos imprimen "S/M")
  serie                  text,           -- NULL = sin dato (los documentos imprimen "S/S")
  medidas                text,           -- NULL = sin dato (los documentos imprimen "S/M")
  color                  text,           -- NULL = sin dato (los documentos lo dejan en blanco)
  estado_conservacion    text   NOT NULL,                                   -- N, B, R, M
  -- Datos migrados del sistema anterior (opcionales):
  responsable_inicial_id bigint REFERENCES persona (id),
  ubicacion_inicial      text,
  -- La base la marca sola: TRUE si el bien se cargó en una importación con un código EXCLUIDO.
  excepcion_catalogo     boolean NOT NULL DEFAULT false,

  CONSTRAINT bien_descripcion_no_vacia       CHECK (btrim(descripcion) <> ''),
  CONSTRAINT bien_estado_conservacion_valido CHECK (estado_conservacion IN ('N', 'B', 'R', 'M')),
  -- "Sin dato" siempre es NULL, nunca un texto vacío:
  CONSTRAINT bien_marca_sin_vacios    CHECK (marca    IS NULL OR btrim(marca)    <> ''),
  CONSTRAINT bien_modelo_sin_vacios   CHECK (modelo   IS NULL OR btrim(modelo)   <> ''),
  CONSTRAINT bien_serie_sin_vacios    CHECK (serie    IS NULL OR btrim(serie)    <> ''),
  CONSTRAINT bien_medidas_sin_vacios  CHECK (medidas  IS NULL OR btrim(medidas)  <> ''),
  CONSTRAINT bien_color_sin_vacios    CHECK (color    IS NULL OR btrim(color)    <> ''),
  -- Regla 1: el código patrimonial son SIEMPRE 12 dígitos y no se repite en toda la entidad.
  CONSTRAINT bien_correlativo_1_a_9999      CHECK (correlativo ~ '^[0-9]{4}$' AND correlativo <> '0000'),
  CONSTRAINT bien_codigo_patrimonial_12     CHECK (codigo_patrimonial ~ '^[0-9]{12}$'),
  CONSTRAINT bien_codigo_patrimonial_unico  UNIQUE (codigo_patrimonial),
  -- Regla 2: el correlativo es único DENTRO de cada código de catálogo (cada tipo cuenta de 0001 a 9999).
  CONSTRAINT bien_correlativo_unico_por_tipo UNIQUE (codigo_bien, correlativo)
);

CREATE INDEX bien_responsable_inicial_idx ON bien (responsable_inicial_id);
-- No hace falta un índice por codigo_bien: el UNIQUE (codigo_bien, correlativo) ya lo cubre.
```

- `GENERATED ALWAYS AS (...) STORED`: una columna que la base **calcula y guarda sola** al insertar. Nadie puede escribir un código patrimonial distinto de `codigo_bien` + `correlativo`.
- **Por qué dos `UNIQUE`:** como el código del bien siempre mide 8 y el correlativo siempre 4, dos bienes de distinto tipo nunca pueden formar el mismo código de 12 dígitos. Entonces `UNIQUE (codigo_bien, correlativo)` ya garantiza que el código patrimonial no se repita. Dejamos también el `UNIQUE` del código de 12 dígitos como **red de seguridad explícita**: es la regla que más importa y así queda a la vista.
- La clave foránea `codigo_bien → catalogo_sbn` impide usar un código de 8 dígitos que no esté en el catálogo.
- Se usa `id` (número interno) como PK y el código patrimonial como "nombre público": si algún día se corrigiera un código, no habría que reescribir todos los movimientos.
- **Tope:** cada tipo de bien admite hasta 9 999 bienes (0001 a 9999). Ya no hay un tope global.

#### 4.3.1 El siguiente correlativo, sin huecos ni repetidos

```sql
-- Devuelve el siguiente correlativo libre de UN tipo de bien: el mayor que existe + 1.
CREATE FUNCTION siguiente_correlativo(p_codigo_bien text) RETURNS text
LANGUAGE plpgsql AS $$
DECLARE
  v_siguiente integer;
BEGIN
  -- Bloqueo ligero (advisory lock) SOLO para este código de catálogo y solo mientras dure
  -- la transacción. Si otra persona está creando un bien del MISMO tipo, esta espera su turno.
  -- Los bienes de otros tipos y las demás tablas no se frenan. (1001 es un "apellido" de bloqueo
  -- inventado por nosotros para no chocar con otros usos.)
  PERFORM pg_advisory_xact_lock(1001, hashtext(p_codigo_bien));

  -- El mayor correlativo ya usado en este tipo (como siempre tiene 4 dígitos con ceros,
  -- ordenar como texto equivale a ordenar como número). Si no hay ninguno, parte de 0.
  SELECT (COALESCE(MAX(correlativo), '0000'))::integer + 1
    INTO v_siguiente
    FROM bien
   WHERE codigo_bien = p_codigo_bien;

  IF v_siguiente > 9999 THEN
    RAISE EXCEPTION 'El código de catálogo % ya usó todos los correlativos (0001 a 9999).', p_codigo_bien;
  END IF;

  RETURN lpad(v_siguiente::text, 4, '0');   -- 7 -> '0007'
END;
$$;
```

**Cómo evita huecos y repetidos:**

1. La persona A empieza a crear una computadora portátil. La función toma el cartel "ocupado: 74645223" y calcula el mayor + 1 (supongamos 0002).
2. Mientras A no termine, la persona B (otra computadora portátil) llega al mismo cartel y **espera**. Si B fuera a registrar una silla, no esperaría: es otro tipo.
3. A termina su transacción (guarda el bien 0002) y el cartel se suelta. B recién calcula y ve que el mayor es 0002, así que obtiene 0003.
4. Si A cancelara su registro, no se gasta ningún número: B obtendría 0002.

Un hueco solo puede aparecer si se **escribe a mano** un número alto (por ejemplo, al migrar bienes antiguos) o si se elimina un bien que todavía no tenía movimientos. Para evitar bloqueos cruzados cuando una importación mezcla varios tipos, conviene insertar los bienes ordenados por código de catálogo.

#### 4.3.2 El trigger que prepara cada bien nuevo

```sql
-- Se ejecuta ANTES de guardar cada bien nuevo: completa el correlativo y vigila el catálogo.
CREATE FUNCTION preparar_bien() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  v_estado_catalogo text;
BEGIN
  -- 1. Si no se escribió el correlativo, la base asigna el siguiente de ese tipo.
  --    Si se escribió (migración de bienes antiguos), se respeta; los CHECK y el UNIQUE lo validan.
  IF NEW.correlativo IS NULL THEN
    NEW.correlativo := siguiente_correlativo(NEW.codigo_bien);
  END IF;

  -- 2. ¿El código de catálogo está EXCLUIDO? (Si el código no existe, no hacemos nada aquí:
  --    la clave foránea se encargará de rechazarlo.)
  SELECT estado INTO v_estado_catalogo FROM catalogo_sbn WHERE codigo = NEW.codigo_bien;

  IF v_estado_catalogo = 'EXCLUIDO' THEN
    -- Solo se permite dentro de una importación, que se anuncia con:  SET LOCAL app.importacion = 'on';
    IF current_setting('app.importacion', true) = 'on' THEN
      NEW.excepcion_catalogo := true;      -- queda marcado como excepción
    ELSE
      RAISE EXCEPTION 'El código de catálogo % está EXCLUIDO: no se pueden registrar bienes nuevos con él.',
        NEW.codigo_bien;
    END IF;
  ELSE
    NEW.excepcion_catalogo := false;       -- nadie puede marcar excepciones a mano
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER bien_prepara_alta
  BEFORE INSERT ON bien
  FOR EACH ROW EXECUTE FUNCTION preparar_bien();
```

- Un trigger `BEFORE` corre **antes** de las comprobaciones (`NOT NULL`, `CHECK`, `UNIQUE`), por eso puede completar el correlativo. La columna generada `codigo_patrimonial` se calcula **después** del trigger, con el correlativo ya completo.
- `current_setting('app.importacion', true)` lee una "etiqueta" de la sesión; el `true` evita un error si nadie la puso (devuelve vacío). Solo el proceso de importación la activa, y solo dentro de su transacción (`SET LOCAL`).
- Un bien cuyo código **pasó a EXCLUIDO después** de ser creado no se toca: era válido cuando se registró y no es una excepción.

### 4.4 Tipos de movimiento

```sql
-- Los tipos de movimiento son DATOS, no código: así agregar uno nuevo no obliga a cambiar la vista.
CREATE TABLE tipo_movimiento (
  codigo                  text    PRIMARY KEY,
  titulo_acta             text    NOT NULL,   -- título que se imprime en el acta
  situacion_resultante    text    NOT NULL,   -- cómo queda el bien después del movimiento
  exige_nuevo_responsable boolean NOT NULL,   -- ¿el usuario debe ELEGIR al nuevo responsable?
  exige_destino           boolean NOT NULL,   -- ¿el usuario debe ELEGIR la ubicación nueva?
  efecto_custodia         text    NOT NULL,   -- INICIA, CONSERVA o LIMPIA (ver abajo)
  CONSTRAINT tipo_situacion_valida CHECK (situacion_resultante IN ('EN USO', 'EN REPARACION', 'SIN ASIGNAR')),
  CONSTRAINT tipo_efecto_valido    CHECK (efecto_custodia IN ('INICIA', 'CONSERVA', 'LIMPIA'))
);

INSERT INTO tipo_movimiento
  (codigo, titulo_acta, situacion_resultante, exige_nuevo_responsable, exige_destino, efecto_custodia)
VALUES
  ('ASIGNACION',
   'ACTA DE ENTREGA / ASIGNACIÓN DE BIENES',          'EN USO',        true,  true,  'LIMPIA'),
  ('SALIDA A REPARACION',
   'PAPELETA DE SALIDA DE BIENES PARA REPARACIÓN',    'EN REPARACION', false, true,  'CONSERVA'),
  ('REINGRESO DE REPARACION',
   'ACTA DE REINGRESO DE BIENES REPARADOS',           'EN USO',        false, true,  'CONSERVA'),
  ('PASE A CUSTODIA DEL JEFE INMEDIATO',
   'ACTA DE CUSTODIA TEMPORAL DE BIENES',             'EN USO',        false, false, 'INICIA');
```

**Qué significa `efecto_custodia`:**

| Valor | Qué hace con la custodia | Tipo que lo usa | ¿Cambia quién tiene el bien? |
|---|---|---|---|
| `INICIA` | Empieza una custodia (si no había una) o la conserva con el mismo trabajador original. | Pase a custodia | Sí (pasa al jefe) |
| `CONSERVA` | No toca la custodia: si había, sigue; si no, sigue sin ella. | Salida y reingreso de reparación | No |
| `LIMPIA` | Borra la custodia: el bien queda propio de su nuevo responsable. | Asignación | Sí |

La vista usa esta columna para saber cuándo "alguien recibió el bien": son los movimientos `INICIA` o `LIMPIA`.

### 4.5 Actas

```sql
-- Una acta es la hoja que se firma. Agrupa varios movimientos del MISMO tipo y fecha.
CREATE TABLE acta (
  id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  numero          text   NOT NULL,                       -- Ej.: ACTA-0045-2025
  fecha           date   NOT NULL,                       -- solo día, sin hora
  tipo_movimiento text   NOT NULL REFERENCES tipo_movimiento (codigo),
  CONSTRAINT acta_numero_unico        UNIQUE (numero),
  -- Red de seguridad: el número siempre queda en mayúsculas y sin espacios en los extremos.
  CONSTRAINT acta_numero_normalizado  CHECK (numero <> '' AND numero = upper(btrim(numero)))
);

CREATE INDEX acta_fecha_idx ON acta (fecha);   -- la vista ordena los movimientos por fecha

-- La base normaliza el número SOLA: "  acta-0045-2025 " se guarda como "ACTA-0045-2025".
-- (La app ya no tiene que preocuparse por esto.)
CREATE FUNCTION normalizar_numero_acta() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW.numero := upper(btrim(NEW.numero));
  RETURN NEW;
END;
$$;

CREATE TRIGGER acta_normaliza_numero
  BEFORE INSERT OR UPDATE OF numero ON acta
  FOR EACH ROW EXECUTE FUNCTION normalizar_numero_acta();
```

### 4.6 Movimientos

```sql
-- Cada fila es UN bien que se mueve dentro de UNA acta. Solo se agregan; nunca se editan ni borran.
CREATE TABLE movimiento (
  id                      bigint      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  acta_id                 bigint      NOT NULL REFERENCES acta (id),
  bien_id                 bigint      NOT NULL REFERENCES bien (id),
  responsable_anterior_id bigint      REFERENCES persona (id),  -- NULL = estaba SIN ASIGNAR
  responsable_nuevo_id    bigint      REFERENCES persona (id),
  ubicacion_nueva         text        NOT NULL,                 -- dónde queda el bien
  motivo                  text,                                 -- opcional
  creado_en               timestamptz NOT NULL DEFAULT now(),   -- cuándo se registró (fecha y hora)
  -- Quién lo registró. Queda vacío hasta que exista el inicio de sesión (como los movimientos
  -- no se pueden actualizar, esta columna hay que tenerla desde el primer día).
  creado_por              text,
  CONSTRAINT movimiento_bien_una_vez_por_acta UNIQUE (acta_id, bien_id),
  CONSTRAINT movimiento_ubicacion_no_vacia    CHECK (btrim(ubicacion_nueva) <> '')
);

CREATE INDEX movimiento_bien_idx             ON movimiento (bien_id, id);       -- historial de un bien
CREATE INDEX movimiento_responsable_nuevo_idx ON movimiento (responsable_nuevo_id);
```

- **Siempre se guardan** `responsable_nuevo_id` y `ubicacion_nueva`, aunque no cambien (por ejemplo en una salida a reparación el responsable se repite). Así la vista siempre lee del último movimiento sin tener que "buscar hacia atrás". Es lo mismo que hace hoy el mock.
- `UNIQUE (acta_id, bien_id)`: un mismo bien no puede aparecer dos veces en la misma acta. Su índice sirve también para buscar "todos los movimientos de una acta" (pantalla del acta).
- `timestamptz` guarda fecha, hora y zona horaria; sirve de auditoría ("cuándo se capturó"), distinta de la **fecha del acta** (la fecha del hecho).
- `creado_por` es `text` para poder guardar el identificador del usuario que entregue el sistema de login (que suele ser un texto), sin atarnos todavía a una tabla de usuarios.

### 4.7 Los movimientos solo se agregan (regla 3)

```sql
-- Función "vigilante": cada vez que alguien intente editar o borrar, falla con un mensaje claro.
CREATE FUNCTION rechazar_cambios_movimiento() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION
    'Los movimientos no se pueden editar ni borrar (operación % sobre la tabla %). Registre un nuevo movimiento.',
    TG_OP, TG_TABLE_NAME
    USING ERRCODE = 'restrict_violation';
END;
$$;

-- Se dispara ANTES de cada UPDATE o DELETE, fila por fila → la operación nunca llega a ejecutarse.
CREATE TRIGGER movimiento_solo_se_agrega
  BEFORE UPDATE OR DELETE ON movimiento
  FOR EACH ROW EXECUTE FUNCTION rechazar_cambios_movimiento();

-- TRUNCATE (vaciar toda la tabla de golpe) NO activa los triggers "por fila": necesita el suyo.
CREATE TRIGGER movimiento_no_se_vacia
  BEFORE TRUNCATE ON movimiento
  FOR EACH STATEMENT EXECUTE FUNCTION rechazar_cambios_movimiento();
```

**Cómo funciona, paso a paso:**

1. Alguien (la app, o una persona con un cliente SQL) ejecuta `UPDATE movimiento SET ...` o `DELETE FROM movimiento ...`.
2. Antes de tocar ninguna fila, PostgreSQL ve que hay un trigger `BEFORE UPDATE OR DELETE` y ejecuta `rechazar_cambios_movimiento()`.
3. La función lanza un error (`RAISE EXCEPTION`). Un error cancela toda la operación: **no se modifica ni se borra nada**.
4. `TG_OP` es la operación que se intentó (`UPDATE` o `DELETE`) y `TG_TABLE_NAME` el nombre de la tabla; sirven para armar el mensaje.

**Límites honestos:** un superusuario o el dueño de la tabla *podría* desactivar el trigger (`ALTER TABLE ... DISABLE TRIGGER`). Por eso, en el paso de conexión recomendaré una **segunda capa**: que el usuario que usa la app solo tenga permiso de `SELECT` e `INSERT` sobre `movimiento` (no de `UPDATE`, `DELETE` ni `TRUNCATE`) y no sea el dueño de las tablas.

Como las FK no tienen `ON DELETE CASCADE`, tampoco se puede borrar un bien, una acta o una persona que ya tenga movimientos: la base lo rechaza.

### 4.8 Una acta con movimientos tampoco se toca (complemento de la regla 3)

El tipo y la fecha viven en la **acta**. Si se pudieran editar, se reescribiría la historia aunque los movimientos estén protegidos. Por eso:

```sql
CREATE FUNCTION proteger_acta_con_movimientos() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  -- ¿Esta acta ya tiene movimientos? Entonces es intocable.
  IF EXISTS (SELECT 1 FROM movimiento WHERE acta_id = OLD.id) THEN
    RAISE EXCEPTION 'El acta % ya tiene movimientos: no se puede modificar ni borrar.', OLD.numero
      USING ERRCODE = 'restrict_violation';
  END IF;
  -- Sin movimientos todavía, se permite (por ejemplo, corregir un número mal escrito).
  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$$;

CREATE TRIGGER acta_con_movimientos_es_intocable
  BEFORE UPDATE OR DELETE ON acta
  FOR EACH ROW EXECUTE FUNCTION proteger_acta_con_movimientos();
```

Sigue permitido **agregar más movimientos** a una acta existente (la regla 5 exige que sean del mismo tipo y fecha).

### 4.9 Regla 5: una acta solo admite movimientos de su mismo tipo y fecha

No hace falta un trigger: el diseño lo garantiza **por estructura**. La tabla `movimiento` **no tiene** columnas de tipo ni de fecha; siempre las toma de su acta (`acta.tipo_movimiento` y `acta.fecha`). Es imposible que un movimiento tenga un tipo o fecha distintos a los de su acta, porque no existe dónde guardarlos. Y como la acta queda bloqueada (4.8), tampoco pueden cambiarse después.

### 4.10 La vista del estado actual (regla 4)

Se lee así: **para cada bien**, mira su historial ordenado por fecha del acta y luego por orden de registro (igual que `calcularEstado`), y calcula el estado. No guarda nada.

```sql
CREATE VIEW estado_actual_bien AS
WITH

-- PASO 1: el historial de TODOS los bienes en una sola lista, con un número de orden por bien.
movs AS (
  SELECT
    m.bien_id,                                  -- de qué bien es el movimiento
    m.id                    AS movimiento_id,
    a.fecha,                                    -- la fecha viene de la ACTA
    t.situacion_resultante,                     -- cómo deja al bien este tipo de movimiento
    t.efecto_custodia,                          -- INICIA / CONSERVA / LIMPIA
    m.responsable_anterior_id,
    m.responsable_nuevo_id,
    m.ubicacion_nueva,
    -- Numera 1, 2, 3… los movimientos de CADA bien (PARTITION BY) del más antiguo al más nuevo:
    -- primero por fecha del acta y, si empatan, por orden de registro (id).
    ROW_NUMBER() OVER (PARTITION BY m.bien_id ORDER BY a.fecha, m.id) AS orden
  FROM movimiento m
  JOIN acta a            ON a.id = m.acta_id            -- para la fecha y el tipo
  JOIN tipo_movimiento t ON t.codigo = a.tipo_movimiento -- para situación y efecto en custodia
),

-- PASO 2: tres números clave por bien (qué "orden" tiene cada hito).
resumen AS (
  SELECT
    bien_id,
    MAX(orden) AS orden_ultimo,                     -- el último movimiento del bien
    -- El último movimiento en que ALGUIEN RECIBIÓ el bien: asignación (LIMPIA) o pase a custodia (INICIA).
    -- Una salida o reingreso de reparación (CONSERVA) NO cuenta → "a su cargo desde" no cambia al reparar.
    MAX(orden) FILTER (WHERE efecto_custodia IN ('INICIA', 'LIMPIA')) AS orden_recepcion,
    -- El último movimiento que BORRÓ la custodia (asignación). Si nunca hubo, 0.
    COALESCE(MAX(orden) FILTER (WHERE efecto_custodia = 'LIMPIA'), 0) AS orden_ultima_limpia
  FROM movs
  GROUP BY bien_id
),

-- PASO 3: ¿de quién es la custodia? Del trabajador ORIGINAL.
origen_custodia AS (
  -- DISTINCT ON (bien_id) deja una sola fila por bien: la primera según el ORDER BY de abajo.
  SELECT DISTINCT ON (mv.bien_id)
    mv.bien_id,
    mv.responsable_anterior_id AS custodia_de_id    -- quien tenía el bien cuando empezó la custodia
  FROM movs mv
  JOIN resumen r ON r.bien_id = mv.bien_id
  WHERE mv.efecto_custodia = 'INICIA'               -- solo pases a custodia…
    AND mv.orden > r.orden_ultima_limpia            -- …posteriores a la última asignación
  ORDER BY mv.bien_id, mv.orden                     -- …y nos quedamos con el PRIMERO de ellos
  -- Por eso, si un bien en custodia vuelve a pasar a custodia (Rosa → Carlos),
  -- sigue siendo "por cuenta de Luis" (el primero), no de Rosa (el intermediario).
  -- Si después hay una asignación, ninguno cumple "orden > última limpia" → sin custodia.
),

-- PASO 4: se junta todo por bien: último movimiento, última recepción y custodia.
actual AS (
  SELECT
    b.id AS bien_id,
    b.codigo_patrimonial,
    b.descripcion,
    -- Responsable: el del último movimiento; si el bien no tiene movimientos, el inicial (migrado).
    CASE WHEN ultimo.movimiento_id IS NULL
         THEN b.responsable_inicial_id
         ELSE ultimo.responsable_nuevo_id END           AS responsable_id,
    -- Ubicación: igual, la del último movimiento o la inicial.
    CASE WHEN ultimo.movimiento_id IS NULL
         THEN b.ubicacion_inicial
         ELSE ultimo.ubicacion_nueva END                AS ubicacion,
    -- Situación: la que deja el último movimiento. Sin movimientos: EN USO si tiene
    -- responsable inicial; SIN ASIGNAR si no.
    CASE WHEN ultimo.movimiento_id IS NOT NULL THEN ultimo.situacion_resultante
         WHEN b.responsable_inicial_id IS NOT NULL THEN 'EN USO'
         ELSE 'SIN ASIGNAR' END                         AS situacion,
    -- A su cargo desde: la fecha de la última recepción. Si no hubo ninguna (bien migrado
    -- que nunca se asignó de nuevo) queda NULL = "S/F" (sin fecha).
    recepcion.fecha                                     AS a_cargo_desde,
    oc.custodia_de_id                                   AS custodia_de_id
  FROM bien b
  LEFT JOIN resumen  r         ON r.bien_id = b.id                                  -- LEFT: hay bienes sin movimientos
  LEFT JOIN movs     ultimo    ON ultimo.bien_id = b.id    AND ultimo.orden = r.orden_ultimo
  LEFT JOIN movs     recepcion ON recepcion.bien_id = b.id AND recepcion.orden = r.orden_recepcion
  LEFT JOIN origen_custodia oc ON oc.bien_id = b.id
)

-- PASO 5: resultado final, con los nombres en vez de los números.
SELECT
  ac.bien_id,
  ac.codigo_patrimonial,
  ac.descripcion,
  ac.responsable_id,
  p.nombre_completo AS responsable,                     -- NULL = sin responsable
  ac.ubicacion,
  ac.situacion,
  ac.a_cargo_desde,                                     -- NULL = S/F
  CASE WHEN ac.custodia_de_id IS NULL THEN 'PROPIO' ELSE 'CUSTODIA' END AS condicion,
  ac.custodia_de_id,
  pc.nombre_completo AS en_custodia_por_cuenta_de       -- NULL si es propio
FROM actual ac
LEFT JOIN persona p  ON p.id  = ac.responsable_id       -- LEFT: el responsable puede ser NULL
LEFT JOIN persona pc ON pc.id = ac.custodia_de_id;
```

**Frases clave de la vista:**

- `LEFT JOIN`: "trae el bien aunque no encuentre pareja". Es lo que permite que aparezcan los bienes **sin movimientos** (con sus datos iniciales).
- Dónde está cada regla del enunciado:
  - *"A su cargo desde" no cambia con una reparación* → `orden_recepcion` solo mira `INICIA` y `LIMPIA`.
  - *Migrado sin fecha queda vacío* → si no hay recepción, `a_cargo_desde` es `NULL` (la pantalla muestra "S/F").
  - *La custodia se conserva en reparaciones y cambios de ubicación* → esos movimientos son `CONSERVA` y no entran en ninguna condición que la borre.
  - *Se elimina al asignar a otra persona* → una asignación (`LIMPIA`) sube `orden_ultima_limpia` y deja sin cumplir `orden > última limpia`.
  - *Custodia encadenada sigue por cuenta del original* → `ORDER BY ... orden` con `DISTINCT ON` toma el **primer** pase.

---

## 5. Cómo se cumple cada regla (resumen)

| # | Regla | Cómo la garantiza la base |
|---|---|---|
| 1 | Código patrimonial siempre de 12 dígitos, texto, sin repetidos en toda la entidad | Columna `codigo_patrimonial` **generada** (8 + 4); `CHECK` de 12 dígitos; `UNIQUE`. El código del bien y el correlativo tienen sus propios `CHECK` (8 y 4 dígitos). |
| 2 | **Correlativo único por tipo de bien** (corregida) | `UNIQUE (codigo_bien, correlativo)` y correlativo entre 0001 y 9999. El siguiente lo asigna la función con bloqueo por tipo. |
| 3 | Movimientos solo se agregan | Trigger que rechaza `UPDATE`/`DELETE` y otro que rechaza `TRUNCATE`; acta bloqueada; FKs sin cascada; (recomendado) permisos solo de `SELECT`/`INSERT`. |
| 4 | Estado actual calculado, no guardado | No existe ninguna columna de estado en `bien`; todo sale de la vista `estado_actual_bien`. |
| 5 | Una acta solo admite movimientos de su mismo tipo y fecha | Tipo y fecha se guardan solo en `acta`; `movimiento` no tiene dónde guardar otros. La acta queda bloqueada al tener movimientos. |

---

## 6. Resultado esperado con el mock actual

El mock actual se cargaría con **tres adaptaciones**:

1. **Códigos renumerados por tipo.** Antes los correlativos iban 0001 a 0010 en toda la entidad; ahora cada tipo cuenta desde 0001. Solo cambian los bienes marcados:

| Bien | Código de catálogo | Código en el mock hoy | **Código nuevo** |
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

2. **Nombres separados.** Carlos | Mendoza Rivas · Rosa | Quispe Huamán · Luis | Paredes Soto · Ana | Torres Vega.
3. **"S/S" pasa a `NULL`.** La silla Ejecutiva, el escritorio, la silla Operativa y el archivador tienen hoy la serie "S/S" escrita; en la base quedarían vacíos (`NULL`) y el documento imprimiría "S/S".

Las tres adaptaciones se hacen **al cargar el mock en la base (paso 2C)**; no esperan a una etapa posterior.

Con eso, la vista debería devolver **exactamente** lo que hoy muestra la pantalla Bienes (con los códigos nuevos). Sirve como prueba cuando llegue el momento:

| Código patrimonial | Responsable | Ubicación | Situación | A su cargo desde | Condición |
|---|---|---|---|---|---|
| 746452230001 | Rosa Quispe Huamán | Oficina de Abastecimiento | EN USO | 2025-10-01 | CUSTODIA (de Luis Paredes Soto) |
| 746452260001 | Rosa Quispe Huamán | Oficina de Abastecimiento | EN USO | 2025-10-01 | CUSTODIA (de Luis Paredes Soto) |
| 746452240001 | Rosa Quispe Huamán | Oficina de Abastecimiento | EN USO | 2025-10-01 | CUSTODIA (de Luis Paredes Soto) |
| 536096500001 | Rosa Quispe Huamán | Oficina de Abastecimiento | EN USO | *vacío (S/F)* | PROPIO |
| 536042100001 | Carlos Mendoza Rivas | Dirección General | EN USO | *vacío (S/F)* | PROPIO |
| 746452230002 | *sin responsable* | Almacén central | SIN ASIGNAR | *vacío (S/F)* | PROPIO |
| 746415500001 | Rosa Quispe Huamán | Servicio técnico externo | EN REPARACION | *vacío (S/F)* | PROPIO |
| 746452200001 | Ana Torres Vega | Oficina de Abastecimiento | EN USO | 2025-10-15 | PROPIO |
| 536096500002 | Ana Torres Vega | Oficina de Abastecimiento | EN USO | 2025-10-15 | PROPIO |
| 536011800001 | Ana Torres Vega | Oficina de Abastecimiento | EN USO | 2025-10-20 | PROPIO |

Notas sobre los datos de arranque:

- **Catálogo:** el mock usa 8 códigos de bien inventados (74645223, 74645226, 74645224, 53609650, 53604210, 74641550, 74645220, 53601180). Habría que cargarlos en `catalogo_sbn` con una denominación; no son códigos reales de la SBN.
- **Orden de carga:** catálogo → personas (primero sin jefe, luego completar `jefe_inmediato_id`) → bienes → actas → movimientos.
- **Correlativos del mock:** como los bienes antiguos traen correlativo, se cargan **escribiéndolo a mano** (la función automática solo se usa cuando se omite).

### Plan de pruebas (en una rama de Neon separada)

Como los movimientos no se pueden borrar ni vaciar, las pruebas se hacen en una **rama de Neon aparte**, que se descarta entera al terminar. En ella se verificaría:

1. La vista devuelve la tabla de arriba.
2. `UPDATE`, `DELETE` y `TRUNCATE` sobre `movimiento` fallan con el mensaje en español.
3. Un código de 11 dígitos, uno con letras y uno repetido son rechazados.
4. Dos bienes del mismo tipo con el mismo correlativo son rechazados; dos de distinto tipo con el mismo correlativo (`0001`) se aceptan.
5. Un bien nuevo sin correlativo recibe el siguiente de **su** tipo (el 3.º portátil recibe `0003`; una silla nueva recibe `0003`).
6. Un código de catálogo EXCLUIDO es rechazado en un alta normal y aceptado —y marcado como excepción— con `SET LOCAL app.importacion = 'on'`.
7. Acta "  acta-0099-2026 " se guarda como "ACTA-0099-2026".
8. Dos personas creando a la vez bienes del mismo tipo reciben correlativos distintos y seguidos.

---

## 7. Decisiones tomadas

Estas son tus respuestas finales y cómo quedaron reflejadas en el diseño.

| # | Decisión | Tu respuesta | Cómo quedó |
|---|---|---|---|
| 1 | Correlativo | **C, por tipo de bien** (corrige la regla anterior) | `UNIQUE (codigo_bien, correlativo)`, correlativo de 0001 a 9999. El código de 12 dígitos sigue siendo único en toda la entidad. |
| 2 | Quién asigna el correlativo | **C con bloqueo, por tipo** | Función `siguiente_correlativo` (mayor + 1 dentro del código de catálogo) con bloqueo advisory solo para ese tipo; trigger que la usa si no se escribe a mano. Permite escribir el correlativo en migraciones. |
| 3 | Validaciones de negocio en la base | **C (mixto), para la Etapa 4** | No incluidas en este SQL. Hasta entonces las valida la app. |
| 4 | `exige_*` | **A** | "¿Lo elige el usuario?" (pase a custodia: `false/false`). |
| 5 | Nombre de la persona | **C** | `nombres`, `apellidos` y `nombre_completo` (generada). |
| 6 | Oficina y ubicación | **A** | Texto libre. |
| 7 | Datos opcionales del bien | **C** + impresión | `NULL` = sin dato y no se admiten textos vacíos. Los documentos impresos muestran "S/S" si la serie es `NULL`, "S/M" si la marca, el modelo o las medidas son `NULL`, y dejan el color en blanco (lo hace la impresión). |
| 8 | Acta bloqueada y un bien una vez por acta | **A** | Trigger 4.8 y `UNIQUE (acta_id, bien_id)`. |
| 9 | Número de acta | **B** | Trigger que lo normaliza; el `CHECK` queda como red de seguridad. |
| 10 | Catálogo EXCLUIDO | **B con excepción para la importación** | Trigger `preparar_bien` + columna `excepcion_catalogo`; solo se acepta con `SET LOCAL app.importacion = 'on'` y queda marcado. |
| 11 | Bajas | **A ahora, C después** | Nada se borra; la baja será un tipo de movimiento nuevo más adelante. |
| 12 | Entidades | **A** | Una sola entidad. |
| 13 | Quién registró | **B, ahora** | Columna `creado_por` (texto, opcional) en `movimiento`. |
| 14 | Fechas hacia atrás | **C, junto con la 3, en la Etapa 4** | No incluida en este SQL. |
| 15 | Cargar el mock | **A, en una rama de Neon separada** | Ver "Plan de pruebas" (sección 6). |
| 16 | Vista | **A** | Vista normal. |

### Pendientes menores: respuestas y requisitos

Respondidos en la aprobación final de la versión 2:

1. **Medidas y color vacíos en los impresos.** Las medidas `NULL` se imprimen como **"S/M"** (como en las fichas tradicionales) y el color `NULL` se deja **en blanco**. Se aplica al conectar las pantallas (paso 2D).
2. **Corregir un código después de creado — ⚠ REQUISITO OBLIGATORIO antes de cargar datos reales.** Hay que bloquear el cambio de `codigo_bien` y `correlativo` en un bien que ya tiene movimientos (trigger). Se implementa en la Etapa 4, pero **no se carga ningún dato real de la entidad hasta que ese bloqueo exista**. Los datos de prueba (el mock, en la rama de Neon separada) no tienen esta condición.
3. **Etiqueta `app.importacion`.** Aceptada por ahora. **Requisito para el paso de conexión:** el usuario con el que se conecta la app **no debe poder activarla**; solo el proceso de importación, con su propia conexión, la usa. Cómo se logra se define en ese paso.
4. **Códigos renumerados, nombres separados y "S/S" / "S/M".** No esperan una etapa posterior:
   - **Paso 2C (cargar el mock en la base):** renumerar los códigos por tipo, separar los nombres en `nombres` y `apellidos`, y guardar "S/S" como `NULL`.
   - **Paso 2D (conectar las pantallas):** las pantallas, la ficha y el acta usan los códigos y nombres nuevos, e imprimen "S/S" (serie), "S/M" (marca, modelo o medidas) y color en blanco cuando el dato es `NULL`.

---

## 8. Qué NO incluye este diseño (todavía)

- **Etapa 4:** validaciones de negocio dentro de la base (situación válida según el tipo, jefe existente, persona activa para asignar, fecha no anterior al último movimiento) y el **bloqueo de cambios de código en bienes con movimientos, que es obligatorio antes de cargar datos reales**.
- Usuarios, roles y login (solo queda lista la columna `creado_por`).
- Importación masiva del catálogo SBN real.
- Otros tipos de movimiento (baja, devolución, transferencia entre entidades, etc.). Gracias a `tipo_movimiento` se podrán agregar como filas, sin cambiar la vista, siempre que usen los efectos `INICIA`, `CONSERVA` o `LIMPIA`.
- Tablas de oficinas y ubicaciones (por ahora, texto libre).
- Conexión desde Next.js, migraciones y reemplazo del mock: pasos siguientes, uno por uno.
