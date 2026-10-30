-- 001_mock.sql — Carga del mock (src/data/mock.ts) adaptado al diseño v2 (docs/DB_DISENO.md).
-- SOLO para la rama de PRUEBAS de Neon. Se aplica con:  npm run db:sembrar
--
-- Adaptaciones respecto al mock original:
--   1. Los códigos patrimoniales se RENUMERAN POR TIPO de bien (cada código de catálogo cuenta desde 0001).
--   2. Los nombres se separan en "nombres" y "apellidos" (nombre_completo lo genera la base).
--   3. La serie "S/S" se guarda como NULL (los documentos imprimirán "S/S").
--   4. creado_por queda NULL (todavía no hay inicio de sesión).
--
-- Códigos del mock -> códigos nuevos:
--   746452230001 -> 746452230001   Computadora portátil Lenovo
--   746452260002 -> 746452260001   Monitor Samsung
--   746452240003 -> 746452240001   Impresora HP
--   536096500004 -> 536096500001   Silla Forli Ejecutiva
--   536042100005 -> 536042100001   Escritorio de madera
--   746452230006 -> 746452230002   Computadora portátil Dell (2.ª del tipo)
--   746415500007 -> 746415500001   Proyector Epson
--   746452200008 -> 746452200001   Computadora de escritorio HP
--   536096500009 -> 536096500002   Silla Forli Operativa (2.ª del tipo)
--   536011800010 -> 536011800001   Archivador metálico

-- 1. Catálogo (códigos y denominaciones ficticios, no son de la SBN real) -------------------------
INSERT INTO catalogo_sbn (codigo, denominacion, estado) VALUES
  ('74645223', 'COMPUTADORA PERSONAL PORTATIL',      'ACTIVO'),
  ('74645226', 'MONITOR LED',                        'ACTIVO'),
  ('74645224', 'IMPRESORA LASER',                    'ACTIVO'),
  ('53609650', 'SILLA GIRATORIA',                    'ACTIVO'),
  ('53604210', 'ESCRITORIO DE MADERA',               'ACTIVO'),
  ('74641550', 'PROYECTOR MULTIMEDIA',               'ACTIVO'),
  ('74645220', 'COMPUTADORA PERSONAL DE ESCRITORIO', 'ACTIVO'),
  ('53601180', 'ARCHIVADOR METALICO',                'ACTIVO');

-- 2. Personas: primero quien no tiene jefe, y luego sus subordinados --------------------------------
INSERT INTO persona (nombres, apellidos, cargo, oficina, condicion, jefe_inmediato_id)
VALUES ('Carlos', 'Mendoza Rivas', 'Director', 'Dirección General', 'ACTIVO', NULL);

INSERT INTO persona (nombres, apellidos, cargo, oficina, condicion, jefe_inmediato_id)
VALUES ('Rosa', 'Quispe Huamán', 'Encargada de Abastecimiento', 'Oficina de Abastecimiento', 'ACTIVO',
        (SELECT id FROM persona WHERE nombre_completo = 'Carlos Mendoza Rivas'));

INSERT INTO persona (nombres, apellidos, cargo, oficina, condicion, jefe_inmediato_id)
VALUES ('Luis', 'Paredes Soto', 'Técnico', 'Oficina de Abastecimiento', 'CESADO',   -- renunció el 30/09/2025
        (SELECT id FROM persona WHERE nombre_completo = 'Rosa Quispe Huamán'));

INSERT INTO persona (nombres, apellidos, cargo, oficina, condicion, jefe_inmediato_id)
VALUES ('Ana', 'Torres Vega', 'Auxiliar', 'Oficina de Abastecimiento', 'ACTIVO',
        (SELECT id FROM persona WHERE nombre_completo = 'Rosa Quispe Huamán'));

-- 3. Bienes (el correlativo se escribe a mano, ya renumerado por tipo) ----------------------------
-- responsable_inicial / ubicacion_inicial son los datos migrados; NULL = no había responsable.
INSERT INTO bien
  (codigo_bien, correlativo, descripcion, marca, modelo, serie, medidas, color, estado_conservacion,
   responsable_inicial_id, ubicacion_inicial)
VALUES
  ('74645223', '0001', 'Computadora portátil', 'Lenovo', 'ThinkPad E14', 'PF3K91AA', '32.4 × 22.8 × 1.9 cm', 'Negro', 'B',
   (SELECT id FROM persona WHERE nombre_completo = 'Luis Paredes Soto'), 'Oficina de Abastecimiento'),
  ('74645226', '0001', 'Monitor LED 24 pulgadas', 'Samsung', 'S24R350', 'ZZ4PH1KT', '54.0 × 41.0 × 18.0 cm', 'Negro', 'B',
   NULL, 'Almacén central'),
  ('74645224', '0001', 'Impresora láser multifuncional', 'HP', 'LaserJet M428', 'VNB3K20117', '40.5 × 36.0 × 31.0 cm', 'Blanco', 'R',
   (SELECT id FROM persona WHERE nombre_completo = 'Luis Paredes Soto'), 'Oficina de Abastecimiento'),
  ('53609650', '0001', 'Silla giratoria de oficina', 'Forli', 'Ejecutiva 220', NULL, '60 × 60 × 95 cm', 'Negro', 'R',
   (SELECT id FROM persona WHERE nombre_completo = 'Rosa Quispe Huamán'), 'Oficina de Abastecimiento'),
  ('53604210', '0001', 'Escritorio de madera', 'Muebles Lima', 'ML-180', NULL, '150 × 70 × 75 cm', 'Caoba', 'B',
   (SELECT id FROM persona WHERE nombre_completo = 'Carlos Mendoza Rivas'), 'Dirección General'),
  ('74645223', '0002', 'Computadora portátil', 'Dell', 'Latitude 3420', '7HX2N34', '32.1 × 21.5 × 1.8 cm', 'Gris', 'N',
   NULL, 'Almacén central'),
  ('74641550', '0001', 'Proyector multimedia', 'Epson', 'PowerLite X49', 'X8JK7701234', '30.2 × 23.5 × 8.4 cm', 'Blanco', 'B',
   (SELECT id FROM persona WHERE nombre_completo = 'Rosa Quispe Huamán'), 'Oficina de Abastecimiento'),
  ('74645220', '0001', 'Computadora de escritorio', 'HP', 'ProDesk 400 G7', 'MXL1230PQ8', '29.5 × 28.0 × 9.5 cm', 'Negro', 'N',
   NULL, 'Almacén central'),
  ('53609650', '0002', 'Silla giratoria de oficina', 'Forli', 'Operativa 110', NULL, '58 × 58 × 90 cm', 'Azul', 'N',
   NULL, 'Almacén central'),
  ('53601180', '0001', 'Archivador metálico de 4 cajones', 'Metalmecánica Sur', 'AM-4C', NULL, '47 × 62 × 132 cm', 'Gris', 'R',
   (SELECT id FROM persona WHERE nombre_completo = 'Luis Paredes Soto'), 'Oficina de Abastecimiento');

-- 4. Actas (7): el tipo y la fecha viven aquí ----------------------------------------------------
INSERT INTO acta (numero, fecha, tipo_movimiento) VALUES
  ('ACTA-0012-2024', '2024-03-12', 'ASIGNACION'),
  ('ACTA-0045-2025', '2025-10-01', 'PASE A CUSTODIA DEL JEFE INMEDIATO'),
  ('ACTA-0051-2025', '2025-10-15', 'ASIGNACION'),
  ('ACTA-0053-2025', '2025-10-20', 'ASIGNACION'),
  ('ACTA-0060-2025', '2025-11-05', 'SALIDA A REPARACION'),
  ('ACTA-0067-2025', '2025-11-26', 'REINGRESO DE REPARACION'),
  ('ACTA-0008-2026', '2026-02-10', 'SALIDA A REPARACION');

-- 5. Movimientos (11), en el mismo orden m01…m11 del mock -----------------------------------------
-- La columna "orden" solo sirve para insertarlos en ese orden; los nombres y códigos se buscan por su valor.
INSERT INTO movimiento (acta_id, bien_id, responsable_anterior_id, responsable_nuevo_id, ubicacion_nueva)
SELECT a.id, b.id, pa.id, pn.id, v.ubicacion
  FROM (VALUES
    ( 1, 'ACTA-0012-2024', '746452260001', NULL::text,          'Luis Paredes Soto',   'Oficina de Abastecimiento'),  -- m01 monitor: asignado al Técnico
    ( 2, 'ACTA-0045-2025', '746452230001', 'Luis Paredes Soto', 'Rosa Quispe Huamán',  'Oficina de Abastecimiento'),  -- m02 renuncia: laptop a custodia del jefe
    ( 3, 'ACTA-0045-2025', '746452260001', 'Luis Paredes Soto', 'Rosa Quispe Huamán',  'Oficina de Abastecimiento'),  -- m03 monitor
    ( 4, 'ACTA-0045-2025', '746452240001', 'Luis Paredes Soto', 'Rosa Quispe Huamán',  'Oficina de Abastecimiento'),  -- m04 impresora
    ( 5, 'ACTA-0045-2025', '536011800001', 'Luis Paredes Soto', 'Rosa Quispe Huamán',  'Oficina de Abastecimiento'),  -- m05 archivador
    ( 6, 'ACTA-0051-2025', '746452200001', NULL,                'Ana Torres Vega',     'Oficina de Abastecimiento'),  -- m06 computadora a la Auxiliar nueva
    ( 7, 'ACTA-0051-2025', '536096500002', NULL,                'Ana Torres Vega',     'Oficina de Abastecimiento'),  -- m07 silla
    ( 8, 'ACTA-0053-2025', '536011800001', 'Rosa Quispe Huamán','Ana Torres Vega',     'Oficina de Abastecimiento'),  -- m08 archivador: sale de la custodia
    ( 9, 'ACTA-0060-2025', '746452240001', 'Rosa Quispe Huamán','Rosa Quispe Huamán',  'Servicio técnico externo'),   -- m09 impresora a reparación
    (10, 'ACTA-0067-2025', '746452240001', 'Rosa Quispe Huamán','Rosa Quispe Huamán',  'Oficina de Abastecimiento'),  -- m10 impresora reingresa
    (11, 'ACTA-0008-2026', '746415500001', 'Rosa Quispe Huamán','Rosa Quispe Huamán',  'Servicio técnico externo')    -- m11 proyector a reparación
  ) AS v (orden, acta, codigo, anterior, nuevo, ubicacion)
  JOIN acta    a  ON a.numero = v.acta
  JOIN bien    b  ON b.codigo_patrimonial = v.codigo
  LEFT JOIN persona pa ON pa.nombre_completo = v.anterior
  LEFT JOIN persona pn ON pn.nombre_completo = v.nuevo
 ORDER BY v.orden;
