-- 003 — Vista del estado actual de cada bien
-- Fuente: docs/DB_DISENO.md (versión 2). Se aplica con: npm run db:aplicar


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
