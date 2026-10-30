// REINICIA la base de PRUEBAS: elimina todo lo que creó este proyecto y vuelve a aplicar las migraciones.
// Los movimientos no se pueden borrar ni vaciar, así que esta es la forma de "empezar de nuevo".
//
// Uso:  npm run db:reiniciar -- --confirmar-borrado
//
// Protecciones:
//   1. Exige el argumento --confirmar-borrado.
//   2. Solo usa DATABASE_URL_PRUEBAS, y se niega si apunta a la misma base que DATABASE_URL (producción).
//   3. Solo elimina tablas, vistas y funciones del esquema "public" que NO pertenezcan a una extensión.
import { conectar, limpiar } from "./conexion.mjs";
import { aplicarMigraciones } from "./migraciones.mjs";

const CONFIRMACION = "--confirmar-borrado";

if (!process.argv.includes(CONFIRMACION)) {
  console.error(
    `✘ Este comando BORRA todas las tablas, la vista y las funciones de la base de PRUEBAS.\n` +
      `  Para continuar, agrega la confirmación:  npm run db:reiniciar -- ${CONFIRMACION}`,
  );
  process.exit(1);
}

// conectar() también se niega a correr si la base de pruebas es la misma que la de producción.
const cliente = await conectar();
try {
  await cliente.query("BEGIN");

  // Objetos del esquema public que creamos nosotros (se excluyen los que pertenecen a extensiones).
  const relaciones = (
    await cliente.query(`
      SELECT c.relname AS nombre, c.relkind AS tipo
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE n.nspname = 'public'
         AND c.relkind IN ('r', 'p', 'v', 'm', 'f')
         AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.objid = c.oid AND d.deptype = 'e')`)
  ).rows;
  const funciones = (
    await cliente.query(`
      SELECT p.oid::regprocedure::text AS firma
        FROM pg_proc p
        JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = 'public'
         AND p.prokind IN ('f', 'p')
         AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.objid = p.oid AND d.deptype = 'e')`)
  ).rows;

  const comillas = (nombre) => `"${nombre.replaceAll('"', '""')}"`;
  for (const r of relaciones.filter((x) => x.tipo === "v" || x.tipo === "m")) {
    await cliente.query(`DROP ${r.tipo === "m" ? "MATERIALIZED VIEW" : "VIEW"} IF EXISTS ${comillas(r.nombre)} CASCADE`);
  }
  for (const r of relaciones.filter((x) => x.tipo !== "v" && x.tipo !== "m")) {
    await cliente.query(`DROP TABLE IF EXISTS ${comillas(r.nombre)} CASCADE`);
  }
  for (const f of funciones) {
    await cliente.query(`DROP FUNCTION IF EXISTS ${f.firma} CASCADE`); // la firma ya viene escrita con comillas seguras
  }
  await cliente.query("COMMIT");
  console.log(`✔ Eliminado: ${relaciones.length} tablas/vistas y ${funciones.length} funciones.`);
} catch (e) {
  await cliente.query("ROLLBACK");
  console.error(`✘ No se pudo reiniciar (no se borró nada): ${limpiar(e.message)}`);
  await cliente.end();
  process.exit(1);
}

try {
  console.log("Aplicando migraciones desde cero…");
  if (!(await aplicarMigraciones(cliente))) process.exitCode = 1;
} finally {
  await cliente.end();
}
