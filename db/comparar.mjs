// Compara lo que hay en la base de PRUEBAS con el mock y con el cálculo de la aplicación.
// Uso:  npm run db:comparar
//
// Para cada uno de los 10 bienes compara la vista estado_actual_bien con:
//   (a) la tabla de resultado esperado de la sección 6 de docs/DB_DISENO.md, y
//   (b) el cálculo actual de la aplicación (calcularEstado en src/lib/patrimonio.ts, sobre src/data/mock.ts).
// Además comprueba que la carga copió bien los datos del mock (bienes, personas y movimientos).
// Las fechas se comparan como texto AAAA-MM-DD, para evitar errores de zona horaria.
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { conectar } from "./conexion.mjs";

// Node ejecuta los .ts directamente (sin instalar nada): son los mismos archivos que usa la app.
const mock = await import("../src/data/mock.ts");
const { calcularEstado } = await import("../src/lib/patrimonio.ts");

const CAMPOS = ["responsable", "ubicacion", "situacion", "a_cargo_desde", "condicion", "en_custodia"];
const nombrePersona = (id) => (id ? (mock.personas.find((p) => p.id === id)?.nombre ?? null) : null);
const sinNulo = (v) => (v === undefined || v === "" ? null : v);

/** Lista de diferencias entre dos objetos, solo en los campos indicados. */
function diferencias(real, esperado, campos) {
  return campos
    .filter((k) => sinNulo(real[k]) !== sinNulo(esperado[k]))
    .map((k) => `${k}: base=${JSON.stringify(sinNulo(real[k]))} · referencia=${JSON.stringify(sinNulo(esperado[k]))}`);
}

// ---------- 1. Mapa de códigos del mock -> códigos nuevos (correlativo por tipo) ----------
const porCatalogo = new Map();
for (const b of mock.bienes) {
  const catalogo = b.codigoPatrimonial.slice(0, 8);
  if (!porCatalogo.has(catalogo)) porCatalogo.set(catalogo, []);
  porCatalogo.get(catalogo).push(b);
}
const nuevoCodigo = new Map(); // id del mock -> código nuevo
for (const [catalogo, lista] of porCatalogo) {
  lista
    .sort((a, b) => a.codigoPatrimonial.localeCompare(b.codigoPatrimonial))
    .forEach((b, i) => nuevoCodigo.set(b.id, catalogo + String(i + 1).padStart(4, "0")));
}

// ---------- 2. (a) Tabla de resultado esperado de docs/DB_DISENO.md, sección 6 ----------
const rutaDoc = fileURLToPath(new URL("../docs/DB_DISENO.md", import.meta.url));
const doc = await readFile(rutaDoc, "utf8");
const esperadoDoc = new Map();
for (const linea of doc.split("\n")) {
  if (!/^\| \d{12} \|/.test(linea)) continue; // solo las filas de la tabla de resultado esperado
  const c = linea.split("|").map((x) => x.trim()).slice(1, -1);
  const custodia = /^CUSTODIA \(de (.+)\)$/.exec(c[5]);
  esperadoDoc.set(c[0], {
    responsable: c[1] === "*sin responsable*" ? null : c[1],
    ubicacion: c[2],
    situacion: c[3],
    a_cargo_desde: c[4].startsWith("*vac") ? null : c[4],
    condicion: custodia ? "CUSTODIA" : c[5],
    en_custodia: custodia ? custodia[1] : null,
  });
}

// ---------- 3. (b) Cálculo actual de la aplicación ----------
function calculoApp(bien) {
  const e = calcularEstado(bien, mock.movimientos);
  return {
    responsable: nombrePersona(e.responsableId),
    ubicacion: e.ubicacion,
    situacion: e.situacion,
    a_cargo_desde: e.aCargoDesde, // ya viene como AAAA-MM-DD
    condicion: e.custodiaDeId ? "CUSTODIA" : "PROPIO",
    en_custodia: nombrePersona(e.custodiaDeId),
  };
}

// ---------- 4. Lo que hay en la base ----------
const cliente = await conectar();
let vista, bienesBD, movimientosBD, personasBD, conteos;
try {
  vista = new Map(
    (
      await cliente.query(`
        SELECT codigo_patrimonial AS codigo, responsable, ubicacion, situacion,
               a_cargo_desde::text AS a_cargo_desde, condicion,
               en_custodia_por_cuenta_de AS en_custodia
          FROM estado_actual_bien`)
    ).rows.map((r) => [r.codigo, r]),
  );
  bienesBD = new Map(
    (
      await cliente.query(`
        SELECT b.codigo_patrimonial AS codigo, b.descripcion, b.marca, b.modelo, b.serie, b.medidas, b.color,
               b.estado_conservacion AS estado, p.nombre_completo AS responsable_inicial, b.ubicacion_inicial
          FROM bien b LEFT JOIN persona p ON p.id = b.responsable_inicial_id`)
    ).rows.map((r) => [r.codigo, r]),
  );
  movimientosBD = (
    await cliente.query(`
      SELECT a.numero AS acta, a.fecha::text AS fecha, a.tipo_movimiento AS tipo, b.codigo_patrimonial AS codigo,
             pa.nombre_completo AS anterior, pn.nombre_completo AS nuevo, m.ubicacion_nueva AS ubicacion,
             m.motivo, m.creado_por
        FROM movimiento m
        JOIN acta a ON a.id = m.acta_id
        JOIN bien b ON b.id = m.bien_id
        LEFT JOIN persona pa ON pa.id = m.responsable_anterior_id
        LEFT JOIN persona pn ON pn.id = m.responsable_nuevo_id
       ORDER BY m.id`)
  ).rows;
  personasBD = new Map(
    (
      await cliente.query(`
        SELECT p.nombre_completo AS nombre, p.cargo, p.oficina, p.condicion, j.nombre_completo AS jefe
          FROM persona p LEFT JOIN persona j ON j.id = p.jefe_inmediato_id`)
    ).rows.map((r) => [r.nombre, r]),
  );
  const n = async (t) => (await cliente.query(`SELECT count(*)::int AS n FROM ${t}`)).rows[0].n;
  conteos = { bienes: await n("bien"), personas: await n("persona"), actas: await n("acta"), movimientos: await n("movimiento"), catalogo: await n("catalogo_sbn") };
} finally {
  await cliente.end();
}

// ---------- 5. Comparaciones ----------
const detalles = []; // explicaciones de lo que difiera
const filas = [];

for (const bien of mock.bienes) {
  const codigo = nuevoCodigo.get(bien.id);
  const real = vista.get(codigo);
  const hallazgo = { codigo, viejo: bien.codigoPatrimonial, datos: "PASÓ", contraDoc: "PASÓ", contraApp: "PASÓ" };

  // Datos del bien: lo cargado debe ser lo mismo que el mock ("S/S" y "S/M" pasan a NULL).
  const original = {
    descripcion: bien.descripcion,
    marca: bien.marca === "S/M" ? null : bien.marca,
    modelo: bien.modelo === "S/M" ? null : bien.modelo,
    serie: bien.serie === "S/S" ? null : bien.serie,
    medidas: bien.medidas,
    color: bien.color,
    estado: bien.estado,
    responsable_inicial: nombrePersona(bien.responsableInicialId),
    ubicacion_inicial: bien.ubicacionInicial,
  };
  const cargado = bienesBD.get(codigo);
  const difDatos = cargado ? diferencias(cargado, original, Object.keys(original)) : ["el bien no existe en la base"];
  if (difDatos.length) {
    hallazgo.datos = "DIFIERE";
    detalles.push(`[${codigo}] datos del bien: ${difDatos.join(" | ")}`);
  }

  if (!real) {
    hallazgo.contraDoc = hallazgo.contraApp = "DIFIERE";
    detalles.push(`[${codigo}] la vista no devolvió este bien`);
  } else {
    const ref = esperadoDoc.get(codigo);
    const difDoc = ref ? diferencias(real, ref, CAMPOS) : ["la tabla de la sección 6 no tiene este código"];
    if (difDoc.length) {
      hallazgo.contraDoc = "DIFIERE";
      detalles.push(`[${codigo}] vista vs tabla de la sección 6: ${difDoc.join(" | ")}`);
    }
    const difApp = diferencias(real, calculoApp(bien), CAMPOS);
    if (difApp.length) {
      hallazgo.contraApp = "DIFIERE";
      detalles.push(`[${codigo}] vista vs cálculo de la app: ${difApp.join(" | ")}`);
    }
  }
  filas.push(hallazgo);
}

// Personas cargadas.
const difPersonas = [];
for (const p of mock.personas) {
  const cargada = personasBD.get(p.nombre);
  const original = {
    nombre: p.nombre,
    cargo: p.cargo,
    oficina: p.oficina,
    condicion: p.activo ? "ACTIVO" : "CESADO",
    jefe: nombrePersona(p.jefeId),
  };
  const dif = cargada ? diferencias(cargada, original, Object.keys(original)) : ["no existe en la base"];
  if (dif.length) difPersonas.push(`${p.nombre}: ${dif.join(" | ")}`);
}

// Movimientos cargados (mismo orden, fechas y datos que m01…m11).
const difMovs = [];
if (movimientosBD.length !== mock.movimientos.length) {
  difMovs.push(`cantidad: base=${movimientosBD.length} · mock=${mock.movimientos.length}`);
}
mock.movimientos.forEach((m, i) => {
  const b = mock.bienes.find((x) => x.id === m.bienId);
  const original = {
    acta: m.acta,
    fecha: m.fecha,
    tipo: m.tipo,
    codigo: nuevoCodigo.get(b.id),
    anterior: nombrePersona(m.responsableAnteriorId),
    nuevo: nombrePersona(m.responsableNuevoId),
    ubicacion: m.ubicacion,
    motivo: m.motivo ?? null,
    creado_por: null,
  };
  const real = movimientosBD[i];
  const dif = real ? diferencias(real, original, Object.keys(original)) : ["falta en la base"];
  if (dif.length) difMovs.push(`${m.id}: ${dif.join(" | ")}`);
});

const actasMock = new Set(mock.movimientos.map((m) => m.acta)).size;
const difConteos = [];
if (conteos.bienes !== mock.bienes.length) difConteos.push(`bienes: base=${conteos.bienes} · mock=${mock.bienes.length}`);
if (conteos.personas !== mock.personas.length) difConteos.push(`personas: base=${conteos.personas} · mock=${mock.personas.length}`);
if (conteos.movimientos !== mock.movimientos.length) difConteos.push(`movimientos: base=${conteos.movimientos} · mock=${mock.movimientos.length}`);
if (conteos.actas !== actasMock) difConteos.push(`actas: base=${conteos.actas} · mock=${actasMock}`);

// ---------- 6. Informe en pantalla ----------
const col = (t, n) => String(t).padEnd(n);
console.log("Comparación de la base de pruebas con el mock\n");
console.log(
  `${col("Código nuevo", 14)}${col("Código del mock", 17)}${col("Datos del bien", 16)}${col("Vista vs tabla §6", 20)}Vista vs cálculo de la app`,
);
console.log("-".repeat(88));
for (const f of filas) {
  const marca = (t) => (t === "PASÓ" ? "PASÓ   " : "DIFIERE");
  console.log(`${col(f.codigo, 14)}${col(f.viejo, 17)}${col(marca(f.datos), 16)}${col(marca(f.contraDoc), 20)}${marca(f.contraApp)}`);
}

const linea = (titulo, dif, ok) => console.log(`${dif.length ? "DIFIERE" : "PASÓ   "}  ${titulo}${dif.length ? "" : ok}`);
console.log("");
linea("Conteos (bienes, personas, actas, movimientos)", difConteos, `: ${conteos.catalogo} códigos de catálogo, ${conteos.personas} personas, ${conteos.bienes} bienes, ${conteos.actas} actas, ${conteos.movimientos} movimientos`);
linea("Personas cargadas (nombres, cargo, oficina, condición, jefe)", difPersonas, "");
linea("Movimientos cargados (acta, fecha, tipo, bien, de quién a quién, ubicación)", difMovs, ` (${movimientosBD.length} de ${mock.movimientos.length})`);

const problemas = [...detalles, ...difConteos.map((d) => `conteos: ${d}`), ...difPersonas.map((d) => `persona ${d}`), ...difMovs.map((d) => `movimiento ${d}`)];
if (problemas.length) {
  console.log("\nDiferencias encontradas (NO se corrigió nada):");
  for (const p of problemas) console.log(`  - ${p}`);
  process.exitCode = 1;
} else {
  const total = filas.length;
  console.log(`\nResultado: los ${total} bienes coinciden con la tabla de la sección 6 y con el cálculo de la aplicación.`);
}
