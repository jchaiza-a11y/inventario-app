-- 001 — Tablas, restricciones e índices
-- Fuente: docs/DB_DISENO.md (versión 2). Se aplica con: npm run db:aplicar

-- Catálogo de bienes: el "código del bien" de 8 dígitos y su nombre oficial.
CREATE TABLE catalogo_sbn (
  codigo       text PRIMARY KEY,              -- 8 dígitos, texto para conservar ceros
  denominacion text NOT NULL,                 -- Ej.: "COMPUTADORA PERSONAL PORTATIL"
  estado       text NOT NULL DEFAULT 'ACTIVO',
  CONSTRAINT catalogo_codigo_8_digitos      CHECK (codigo ~ '^[0-9]{8}$'),
  CONSTRAINT catalogo_estado_valido         CHECK (estado IN ('ACTIVO', 'EXCLUIDO')),
  CONSTRAINT catalogo_denominacion_no_vacia CHECK (btrim(denominacion) <> '')
);

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
