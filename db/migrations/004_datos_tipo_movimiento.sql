-- 004 — Datos iniciales de tipo_movimiento
-- Fuente: docs/DB_DISENO.md (versión 2). Se aplica con: npm run db:aplicar


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
