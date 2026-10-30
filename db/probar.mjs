// Plan de pruebas de docs/DB_DISENO.md (sección 6) contra la base de PRUEBAS de Neon.
// Uso:  npm run db:probar
// Casi todas las pruebas corren dentro de una transacción que se DESHACE (ROLLBACK), así no
// queda ningún dato. Solo la prueba 8 (dos personas a la vez) necesita confirmar datos, y los limpia.
import { conectar, contieneSecretos, limpiar } from "./conexion.mjs";

const salida = []; // todo lo que se imprime, para comprobar al final que no hay credenciales
const imprimir = (linea = "") => {
  salida.push(linea);
  console.log(linea);
};

const resultados = [];
function registrar(n, titulo, pasa, detalle) {
  resultados.push({ n, titulo, pasa });
  imprimir(`${pasa ? "✔ PASÓ  " : "✘ FALLÓ "} ${n}. ${titulo}`);
  for (const l of detalle) imprimir(`        ${l}`);
}

/** Ejecuta una sentencia que PUEDE fallar sin estropear la transacción (usa un savepoint). */
async function intenta(c, sql, params = []) {
  await c.query("SAVEPOINT intento");
  try {
    const r = await c.query(sql, params);
    await c.query("RELEASE SAVEPOINT intento");
    return { fallo: false, filas: r.rows };
  } catch (e) {
    await c.query("ROLLBACK TO SAVEPOINT intento");
    return { fallo: true, mensaje: limpiar(e.message), restriccion: e.constraint ?? null };
  }
}

/** Comprueba que una sentencia sea RECHAZADA y que el motivo coincida con el patrón. */
async function debeRechazar(c, descripcion, sql, patron, params = []) {
  const r = await intenta(c, sql, params);
  const ok = r.fallo && patron.test(`${r.mensaje} ${r.restriccion ?? ""}`);
  const motivo = r.fallo ? (r.restriccion ? `restricción ${r.restriccion}` : r.mensaje) : "NO fue rechazada";
  return { ok, linea: `${ok ? "✓" : "✗"} ${descripcion} → ${motivo}` };
}

/** Compara el estado real con el esperado y devuelve las diferencias. */
function diferencias(real, esperado) {
  return Object.entries(esperado)
    .filter(([k, v]) => (real?.[k] ?? null) !== v)
    .map(([k, v]) => `${k}: esperado ${JSON.stringify(v)}, real ${JSON.stringify(real?.[k] ?? null)}`);
}

// ---------------------------------------------------------------- datos de prueba

async function sembrarCatalogo(c) {
  await c.query(`
    INSERT INTO catalogo_sbn (codigo, denominacion) VALUES
      ('74645223', 'COMPUTADORA PERSONAL PORTATIL'),
      ('53609650', 'SILLA GIRATORIA'),
      ('74645224', 'IMPRESORA LASER'),
      ('74645226', 'MONITOR LED')`);
}

async function sembrarPersonas(c) {
  const alta = async (nombres, apellidos, cargo, condicion, jefeId) =>
    (
      await c.query(
        `INSERT INTO persona (nombres, apellidos, cargo, oficina, condicion, jefe_inmediato_id)
         VALUES ($1, $2, $3, 'Oficina de Abastecimiento', $4, $5) RETURNING id`,
        [nombres, apellidos, cargo, condicion, jefeId],
      )
    ).rows[0].id;
  const carlos = await alta("Carlos", "Mendoza Rivas", "Director", "ACTIVO", null);
  const rosa = await alta("Rosa", "Quispe Huamán", "Encargada de Abastecimiento", "ACTIVO", carlos);
  const luis = await alta("Luis", "Paredes Soto", "Técnico", "CESADO", rosa);
  const ana = await alta("Ana", "Torres Vega", "Auxiliar", "ACTIVO", rosa);
  return { carlos, rosa, luis, ana };
}

const altaBien = async (c, codigoBien, correlativo, descripcion, responsableInicial = null, ubicacionInicial = null) =>
  (
    await c.query(
      `INSERT INTO bien (codigo_bien, correlativo, descripcion, estado_conservacion, responsable_inicial_id, ubicacion_inicial)
       VALUES ($1, $2, $3, 'B', $4, $5) RETURNING id, codigo_patrimonial`,
      [codigoBien, correlativo, descripcion, responsableInicial, ubicacionInicial],
    )
  ).rows[0];

const altaActa = async (c, numero, fecha, tipo) =>
  (await c.query("INSERT INTO acta (numero, fecha, tipo_movimiento) VALUES ($1, $2, $3) RETURNING id", [numero, fecha, tipo]))
    .rows[0].id;

const altaMov = (c, actaId, bienId, anterior, nuevo, ubicacion) =>
  c.query(
    `INSERT INTO movimiento (acta_id, bien_id, responsable_anterior_id, responsable_nuevo_id, ubicacion_nueva)
     VALUES ($1, $2, $3, $4, $5)`,
    [actaId, bienId, anterior, nuevo, ubicacion],
  );

const estado = async (c, bienId) =>
  (
    await c.query(
      `SELECT responsable, ubicacion, situacion, a_cargo_desde::text AS a_cargo_desde,
              condicion, en_custodia_por_cuenta_de
         FROM estado_actual_bien WHERE bien_id = $1`,
      [bienId],
    )
  ).rows[0];

const resumen = (e) =>
  `${e.responsable ?? "(sin responsable)"} | ${e.ubicacion ?? "(sin ubicación)"} | ${e.situacion} | desde ${e.a_cargo_desde ?? "S/F"} | ${e.condicion}${e.en_custodia_por_cuenta_de ? ` de ${e.en_custodia_por_cuenta_de}` : ""}`;

const OFICINA = "Oficina de Abastecimiento";
const TALLER = "Servicio técnico externo";
const PASE = "PASE A CUSTODIA DEL JEFE INMEDIATO";

// ---------------------------------------------------------------- pruebas 1 y 2

async function pruebas1y2(c) {
  const d1 = [];
  const d2 = [];
  let ok1 = true;
  let ok2 = true;
  await c.query("BEGIN");
  try {
    await sembrarCatalogo(c);
    const p = await sembrarPersonas(c);
    const imp = await altaBien(c, "74645224", "0001", "Impresora láser multifuncional", p.luis, OFICINA); // migrada, de Luis
    const monitor = await altaBien(c, "74645226", "0001", "Monitor sin responsable"); // sin responsable ni movimientos
    const proyector = await altaBien(c, "74645226", "0002", "Proyector migrado", p.rosa, OFICINA);

    const verificar = async (etiqueta, bienId, esperado) => {
      const real = await estado(c, bienId);
      const dif = diferencias(real, esperado);
      if (dif.length) ok1 = false;
      d1.push(`${dif.length ? "✗" : "✓"} ${etiqueta}: ${resumen(real)}${dif.length ? `  ← ${dif.join("; ")}` : ""}`);
    };

    d1.push(`Impresora de la prueba: código patrimonial ${imp.codigo_patrimonial} (migrada, a cargo inicial de Luis, que luego renuncia)`);
    await verificar("sin movimientos (rige el responsable inicial, sin fecha = S/F)", imp.id, {
      responsable: "Luis Paredes Soto", ubicacion: OFICINA, situacion: "EN USO", a_cargo_desde: null, condicion: "PROPIO", en_custodia_por_cuenta_de: null,
    });

    const a1 = await altaActa(c, "ACTA-0045-2025", "2025-10-01", PASE);
    await altaMov(c, a1, imp.id, p.luis, p.rosa, OFICINA);
    await verificar("1) renuncia: pase a custodia al jefe (01/10/2025)", imp.id, {
      responsable: "Rosa Quispe Huamán", ubicacion: OFICINA, situacion: "EN USO", a_cargo_desde: "2025-10-01", condicion: "CUSTODIA", en_custodia_por_cuenta_de: "Luis Paredes Soto",
    });

    const a2 = await altaActa(c, "ACTA-0060-2025", "2025-11-05", "SALIDA A REPARACION");
    await altaMov(c, a2, imp.id, p.rosa, p.rosa, TALLER);
    await verificar("2) sale a reparación (05/11/2025): la fecha y la custodia NO cambian", imp.id, {
      responsable: "Rosa Quispe Huamán", ubicacion: TALLER, situacion: "EN REPARACION", a_cargo_desde: "2025-10-01", condicion: "CUSTODIA", en_custodia_por_cuenta_de: "Luis Paredes Soto",
    });

    const a3 = await altaActa(c, "ACTA-0067-2025", "2025-11-26", "REINGRESO DE REPARACION");
    await altaMov(c, a3, imp.id, p.rosa, p.rosa, OFICINA);
    const final = await estado(c, imp.id);
    await verificar("3) reingresa (26/11/2025): CASO DE LA IMPRESORA", imp.id, {
      responsable: "Rosa Quispe Huamán", ubicacion: OFICINA, situacion: "EN USO", a_cargo_desde: "2025-10-01", condicion: "CUSTODIA", en_custodia_por_cuenta_de: "Luis Paredes Soto",
    });

    const a4 = await altaActa(c, "ACTA-0070-2025", "2025-12-01", PASE);
    await altaMov(c, a4, imp.id, p.rosa, p.carlos, OFICINA);
    await verificar("4) vuelve a pasar a custodia (Rosa → Carlos): sigue por cuenta del ORIGINAL", imp.id, {
      responsable: "Carlos Mendoza Rivas", ubicacion: OFICINA, situacion: "EN USO", a_cargo_desde: "2025-12-01", condicion: "CUSTODIA", en_custodia_por_cuenta_de: "Luis Paredes Soto",
    });

    const a5 = await altaActa(c, "ACTA-0075-2026", "2026-01-15", "ASIGNACION");
    await altaMov(c, a5, imp.id, p.carlos, p.ana, OFICINA);
    await verificar("5) se asigna a Ana: la custodia desaparece", imp.id, {
      responsable: "Ana Torres Vega", ubicacion: OFICINA, situacion: "EN USO", a_cargo_desde: "2026-01-15", condicion: "PROPIO", en_custodia_por_cuenta_de: null,
    });

    await verificar("bien sin responsable ni movimientos", monitor.id, {
      responsable: null, ubicacion: null, situacion: "SIN ASIGNAR", a_cargo_desde: null, condicion: "PROPIO", en_custodia_por_cuenta_de: null,
    });

    const a6 = await altaActa(c, "ACTA-0008-2026", "2026-02-10", "SALIDA A REPARACION");
    await altaMov(c, a6, proyector.id, p.rosa, p.rosa, TALLER);
    await verificar("migrado que sale a reparación (sin fecha de recepción: S/F)", proyector.id, {
      responsable: "Rosa Quispe Huamán", ubicacion: TALLER, situacion: "EN REPARACION", a_cargo_desde: null, condicion: "PROPIO", en_custodia_por_cuenta_de: null,
    });

    d1.unshift(`Resultado final de la impresora tras el reingreso: ${resumen(final)}`);
    d1.push("Nota: la comparación con la tabla completa del mock (10 bienes) queda para el paso 2C, cuando se cargue el mock.");

    // ---- Prueba 2: los movimientos solo se agregan ----
    const antes = (await c.query("SELECT count(*)::int AS n FROM movimiento WHERE bien_id = $1", [imp.id])).rows[0].n;
    const intentos = [
      await debeRechazar(c, "UPDATE de un movimiento", "UPDATE movimiento SET ubicacion_nueva = 'Otro lugar' WHERE bien_id = $1", /no se pueden editar ni borrar/, [imp.id]),
      await debeRechazar(c, "DELETE de un movimiento", "DELETE FROM movimiento WHERE bien_id = $1", /no se pueden editar ni borrar/, [imp.id]),
      await debeRechazar(c, "TRUNCATE de movimiento", "TRUNCATE movimiento", /no se pueden editar ni borrar/),
      await debeRechazar(c, "UPDATE de la fecha de una acta con movimientos", "UPDATE acta SET fecha = '2030-01-01' WHERE id = $1", /ya tiene movimientos/, [a1]),
      await debeRechazar(c, "DELETE de una acta con movimientos", "DELETE FROM acta WHERE id = $1", /ya tiene movimientos/, [a1]),
      await debeRechazar(c, "DELETE de un bien con movimientos", "DELETE FROM bien WHERE id = $1", /foreign key|movimiento/, [imp.id]),
    ];
    const despues = (await c.query("SELECT count(*)::int AS n FROM movimiento WHERE bien_id = $1", [imp.id])).rows[0].n;
    ok2 = intentos.every((i) => i.ok) && antes === despues;
    for (const i of intentos) d2.push(i.linea);
    d2.push(`${antes === despues ? "✓" : "✗"} Los movimientos de la impresora siguen siendo ${despues} (había ${antes} antes de los intentos)`);
    d2.push("✓ Agregar movimientos nuevos sí funciona (los 5 de la prueba 1 se insertaron sin problema)");
  } finally {
    await c.query("ROLLBACK");
  }
  registrar(1, "Vista del estado actual: impresora con reparación y custodia", ok1, d1);
  registrar(2, "Movimientos solo se agregan: UPDATE, DELETE y TRUNCATE rechazados", ok2, d2);
}

// ---------------------------------------------------------------- pruebas 3, 4 y 5

async function prueba3(c) {
  const detalle = [];
  await c.query("BEGIN");
  try {
    await sembrarCatalogo(c);
    // Nota: un correlativo mal formado puede ser rechazado por cualquiera de las dos reglas (4 dígitos o código de
    // 12 dígitos); PostgreSQL informa la primera que revisa, en orden alfabético.
    const res = [
      await debeRechazar(c, "código de catálogo de 7 dígitos", "INSERT INTO catalogo_sbn (codigo, denominacion) VALUES ('7464522', 'X')", /catalogo_codigo_8_digitos/),
      await debeRechazar(c, "código de catálogo con una letra", "INSERT INTO catalogo_sbn (codigo, denominacion) VALUES ('7464522A', 'X')", /catalogo_codigo_8_digitos/),
      await debeRechazar(c, "correlativo de 3 dígitos ('123')", "INSERT INTO bien (codigo_bien, correlativo, descripcion, estado_conservacion) VALUES ('74645223', '123', 'X', 'B')", /bien_correlativo_1_a_9999|bien_codigo_patrimonial_12/),
      await debeRechazar(c, "correlativo con letras ('AB12')", "INSERT INTO bien (codigo_bien, correlativo, descripcion, estado_conservacion) VALUES ('74645223', 'AB12', 'X', 'B')", /bien_correlativo_1_a_9999|bien_codigo_patrimonial_12/),
      await debeRechazar(c, "correlativo '0000'", "INSERT INTO bien (codigo_bien, correlativo, descripcion, estado_conservacion) VALUES ('74645223', '0000', 'X', 'B')", /bien_correlativo_1_a_9999/),
      await debeRechazar(c, "código de catálogo que no existe en el catálogo", "INSERT INTO bien (codigo_bien, correlativo, descripcion, estado_conservacion) VALUES ('11111111', '0001', 'X', 'B')", /foreign key|bien_codigo_bien_fkey/),
      await debeRechazar(c, "escribir el código patrimonial a mano", "INSERT INTO bien (codigo_bien, correlativo, codigo_patrimonial, descripcion, estado_conservacion) VALUES ('74645223', '0001', '999999999999', 'X', 'B')", /codigo_patrimonial/),
    ];
    const bueno = await intenta(c, "INSERT INTO bien (codigo_bien, correlativo, descripcion, estado_conservacion) VALUES ('74645223', '0001', 'Laptop', 'B') RETURNING codigo_patrimonial");
    const codigo = bueno.filas?.[0]?.codigo_patrimonial;
    const codigoOk = !bueno.fallo && typeof codigo === "string" && /^[0-9]{12}$/.test(codigo) && codigo === "746452230001";
    res.push({ ok: codigoOk, linea: `${codigoOk ? "✓" : "✗"} bien válido → código patrimonial "${codigo}" (texto de ${codigo?.length} dígitos, conserva los ceros)` });
    res.push(await debeRechazar(c, "el mismo código repetido", "INSERT INTO bien (codigo_bien, correlativo, descripcion, estado_conservacion) VALUES ('74645223', '0001', 'Otra', 'B')", /bien_codigo_patrimonial_unico|bien_correlativo_unico_por_tipo/));
    for (const r of res) detalle.push(r.linea);
    registrar(3, "Código patrimonial de 12 dígitos (texto) y sin repetidos", res.every((r) => r.ok), detalle);
  } finally {
    await c.query("ROLLBACK");
  }
}

async function prueba4(c) {
  const detalle = [];
  await c.query("BEGIN");
  try {
    await sembrarCatalogo(c);
    const a = await altaBien(c, "74645223", "0001", "Laptop");
    const b = await altaBien(c, "53609650", "0001", "Silla"); // mismo correlativo, OTRO tipo
    const mismoTipo = await debeRechazar(c, "dos del mismo tipo con correlativo 0001", "INSERT INTO bien (codigo_bien, correlativo, descripcion, estado_conservacion) VALUES ('74645223', '0001', 'Otra laptop', 'B')", /bien_correlativo_unico_por_tipo|bien_codigo_patrimonial_unico/);
    const distintos = a.codigo_patrimonial !== b.codigo_patrimonial;
    detalle.push(`${mismoTipo.ok ? "✓" : "✗"} ${mismoTipo.linea.slice(2)}`);
    detalle.push(`${distintos ? "✓" : "✗"} distinto tipo con correlativo 0001 → aceptado: ${a.codigo_patrimonial} (portátil) y ${b.codigo_patrimonial} (silla)`);
    registrar(4, "Correlativo único por tipo de bien (no global)", mismoTipo.ok && distintos, detalle);
  } finally {
    await c.query("ROLLBACK");
  }
}

async function prueba5(c) {
  const detalle = [];
  await c.query("BEGIN");
  try {
    await sembrarCatalogo(c);
    await altaBien(c, "74645223", "0001", "Laptop 1");
    await altaBien(c, "74645223", "0002", "Laptop 2");
    await altaBien(c, "53609650", "0001", "Silla 1");
    await altaBien(c, "53609650", "0002", "Silla 2");
    const auto = async (codigo, descripcion) =>
      (await c.query("INSERT INTO bien (codigo_bien, descripcion, estado_conservacion) VALUES ($1, $2, 'B') RETURNING codigo_patrimonial, correlativo", [codigo, descripcion])).rows[0];
    const l3 = await auto("74645223", "Laptop 3 (sin correlativo)");
    const s3 = await auto("53609650", "Silla 3 (sin correlativo)");
    const m1 = await auto("74645226", "Primer monitor (tipo nuevo)");
    const l4 = await auto("74645223", "Laptop 4 (sin correlativo)");
    const esperado = [[l3, "0003", "3.ª laptop"], [s3, "0003", "3.ª silla"], [m1, "0001", "1.er monitor"], [l4, "0004", "4.ª laptop"]];
    let ok = true;
    for (const [fila, corr, que] of esperado) {
      const bien = fila.correlativo === corr;
      ok &&= bien;
      detalle.push(`${bien ? "✓" : "✗"} ${que} sin correlativo → ${fila.codigo_patrimonial} (correlativo ${fila.correlativo}, esperado ${corr})`);
    }
    // Tope: cuando un tipo llega a 9999, el automático avisa.
    await altaBien(c, "53609650", "9999", "Silla 9999");
    const lleno = await debeRechazar(c, "tipo con correlativo 9999 ya usado, pedir el siguiente", "INSERT INTO bien (codigo_bien, descripcion, estado_conservacion) VALUES ('53609650', 'Una más', 'B')", /todos los correlativos/);
    ok &&= lleno.ok;
    detalle.push(lleno.linea);
    registrar(5, "Correlativo automático por tipo, sin huecos", ok, detalle);
  } finally {
    await c.query("ROLLBACK");
  }
}

// ---------------------------------------------------------------- pruebas 6 y 7

async function prueba6(c) {
  const detalle = [];
  await c.query("BEGIN");
  try {
    await c.query("INSERT INTO catalogo_sbn (codigo, denominacion, estado) VALUES ('99999001', 'CODIGO EXCLUIDO', 'EXCLUIDO'), ('99999002', 'CODIGO ACTIVO', 'ACTIVO')");
    const normal = await debeRechazar(c, "alta normal con código EXCLUIDO", "INSERT INTO bien (codigo_bien, descripcion, estado_conservacion) VALUES ('99999001', 'Bien nuevo', 'B')", /EXCLUIDO/);
    await c.query("SELECT set_config('app.importacion', 'on', true)"); // equivale a SET LOCAL
    const importado = await intenta(c, "INSERT INTO bien (codigo_bien, correlativo, descripcion, estado_conservacion) VALUES ('99999001', '0001', 'Bien antiguo', 'B') RETURNING excepcion_catalogo");
    const importadoOk = !importado.fallo && importado.filas[0].excepcion_catalogo === true;
    await c.query("SELECT set_config('app.importacion', 'off', true)");
    const activo = await intenta(c, "INSERT INTO bien (codigo_bien, correlativo, descripcion, estado_conservacion, excepcion_catalogo) VALUES ('99999002', '0001', 'Bien activo', 'B', true) RETURNING excepcion_catalogo");
    const activoOk = !activo.fallo && activo.filas[0].excepcion_catalogo === false;
    detalle.push(normal.linea);
    detalle.push(`${importadoOk ? "✓" : "✗"} con importación activada ('app.importacion' = on) → ${importado.fallo ? importado.mensaje : `aceptado y marcado excepcion_catalogo = ${importado.filas[0].excepcion_catalogo}`}`);
    detalle.push(`${activoOk ? "✓" : "✗"} código ACTIVO con excepcion_catalogo = true escrito a mano → ${activo.fallo ? activo.mensaje : `la base lo corrigió a ${activo.filas[0].excepcion_catalogo}`}`);
    registrar(6, "Código de catálogo EXCLUIDO: rechazado salvo importación (queda marcado)", normal.ok && importadoOk && activoOk, detalle);
  } finally {
    await c.query("ROLLBACK");
  }
}

async function prueba7(c) {
  const detalle = [];
  await c.query("BEGIN");
  try {
    const r = await intenta(c, "INSERT INTO acta (numero, fecha, tipo_movimiento) VALUES ('  acta-0099-2026 ', '2026-03-01', 'ASIGNACION') RETURNING numero");
    const guardado = r.filas?.[0]?.numero;
    const ok = !r.fallo && guardado === "ACTA-0099-2026";
    detalle.push(`${ok ? "✓" : "✗"} "  acta-0099-2026 " se guardó como "${guardado}"`);
    const repetida = await debeRechazar(c, 'el mismo número escrito en minúsculas ("acta-0099-2026")', "INSERT INTO acta (numero, fecha, tipo_movimiento) VALUES ('acta-0099-2026', '2026-03-01', 'ASIGNACION')", /acta_numero_unico/);
    detalle.push(repetida.linea);
    registrar(7, "N° de acta normalizado por la base (mayúsculas, sin espacios)", ok && repetida.ok, detalle);
  } finally {
    await c.query("ROLLBACK");
  }
}

// ---------------------------------------------------------------- prueba 8

const espera = (ms) => new Promise((r) => setTimeout(r, ms));
const conLimite = (promesa, ms) => Promise.race([promesa, espera(ms).then(() => "TIEMPO_AGOTADO")]);

async function prueba8(c0) {
  const detalle = [];
  const A = await conectar();
  const B = await conectar();
  const tipos = "('99999998', '99999999')";
  try {
    await c0.query(`DELETE FROM bien WHERE codigo_bien IN ${tipos}`);
    await c0.query(`DELETE FROM catalogo_sbn WHERE codigo IN ${tipos}`);
    await c0.query("INSERT INTO catalogo_sbn (codigo, denominacion) VALUES ('99999999', 'TIPO DE PRUEBA A'), ('99999998', 'TIPO DE PRUEBA B')");
    const insertar = (tipo) => `INSERT INTO bien (codigo_bien, descripcion, estado_conservacion) VALUES ('${tipo}', 'prueba', 'B') RETURNING correlativo`;

    await A.query("BEGIN");
    const deA = (await A.query(insertar("99999999"))).rows[0].correlativo; // A toma el bloqueo del tipo A y NO confirma todavía
    await B.query("BEGIN");
    let bTermino = false;
    const pendienteB = B.query(insertar("99999999")).then((r) => {
      bTermino = true;
      return r.rows[0].correlativo;
    });

    // Un bien de OTRO tipo no debe esperar a nadie.
    const otroTipo = await conLimite(c0.query(insertar("99999998")).then((r) => r.rows[0].correlativo), 8000);
    await espera(2000);
    const bEsperaba = !bTermino; // sigue esperando el turno mientras A no confirma

    await A.query("COMMIT");
    const deB = await conLimite(pendienteB, 15000);
    await B.query("COMMIT");

    const ok = deA === "0001" && deB === "0002" && bEsperaba && otroTipo === "0001";
    detalle.push(`${deA === "0001" ? "✓" : "✗"} persona A (tipo A) recibió el correlativo ${deA}`);
    detalle.push(`${bEsperaba ? "✓" : "✗"} persona B (mismo tipo, a la vez) ${bEsperaba ? "ESPERÓ su turno mientras A no confirmaba" : "NO esperó (los dos pudieron correr a la vez)"}`);
    detalle.push(`${deB === "0002" ? "✓" : "✗"} persona B recibió el correlativo ${deB} (distinto y seguido al de A)`);
    detalle.push(`${otroTipo === "0001" ? "✓" : "✗"} un bien de OTRO tipo no esperó a nadie: recibió ${otroTipo} de inmediato`);
    registrar(8, "Dos personas a la vez: correlativos distintos y seguidos, bloqueo solo por tipo", ok, detalle);
  } finally {
    for (const cli of [A, B]) {
      try { await cli.query("ROLLBACK"); } catch { /* sin transacción abierta */ }
      await cli.end();
    }
    await c0.query(`DELETE FROM bien WHERE codigo_bien IN ${tipos}`);
    await c0.query(`DELETE FROM catalogo_sbn WHERE codigo IN ${tipos}`);
  }
}

// ---------------------------------------------------------------- limpieza final

/** Las pruebas gastan números de identificación (1, 2, 3…): si las tablas quedaron vacías, se reinician. */
async function dejarLimpia(c) {
  const tablas = ["persona", "bien", "acta", "movimiento"];
  const cuentas = {};
  for (const t of tablas) cuentas[t] = (await c.query(`SELECT count(*)::int AS n FROM ${t}`)).rows[0].n;
  const vacia = Object.values(cuentas).every((n) => n === 0);
  const catalogos = (await c.query("SELECT count(*)::int AS n FROM catalogo_sbn")).rows[0].n;
  if (vacia) for (const t of tablas) await c.query(`ALTER TABLE ${t} ALTER COLUMN id RESTART`);
  imprimir(
    `Limpieza: ${tablas.map((t) => `${t}=${cuentas[t]}`).join(", ")}, catalogo_sbn=${catalogos}. ` +
      (vacia ? "Tablas vacías: numeración de ids reiniciada a 1." : "OJO: quedaron datos; no se reinició la numeración."),
  );
  return vacia && catalogos === 0;
}

// ---------------------------------------------------------------- ejecución

const c = await conectar();
let limpia = false;
try {
  imprimir("Plan de pruebas de docs/DB_DISENO.md — base de PRUEBAS de Neon\n");
  await pruebas1y2(c);
  await prueba3(c);
  await prueba4(c);
  await prueba5(c);
  await prueba6(c);
  await prueba7(c);
  await prueba8(c);
  imprimir("");
  limpia = await dejarLimpia(c);
} catch (e) {
  imprimir(`✘ La ejecución se interrumpió: ${limpiar(e.message)}`);
  process.exitCode = 1;
} finally {
  await c.end();
}

const pasaron = resultados.filter((r) => r.pasa).length;
imprimir(`\nResumen: ${pasaron} de ${resultados.length} pruebas pasaron${limpia ? "; la rama quedó sin datos de prueba." : "."}`);
const fuga = contieneSecretos(salida.join("\n"));
imprimir(`Comprobación de seguridad: ${fuga ? "✘ la salida contenía credenciales" : "✔ la salida no contiene credenciales"}.`);
if (pasaron !== resultados.length || fuga || resultados.length !== 8) process.exitCode = 1;
