-- 002 — Funciones y triggers (correlativo, catálogo, acta, movimientos solo-agregar)
-- Fuente: docs/DB_DISENO.md (versión 2). Se aplica con: npm run db:aplicar

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
