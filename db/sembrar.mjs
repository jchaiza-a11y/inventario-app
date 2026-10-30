// Carga los datos del mock (db/seeds/001_mock.sql) en la base de PRUEBAS, dentro de una transacción.
// Uso:  npm run db:sembrar
// Si la base ya tiene datos se niega: primero hay que reiniciarla (npm run db:reiniciar -- --confirmar-borrado).
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { conectar, limpiar } from "./conexion.mjs";

const archivo = fileURLToPath(new URL("./seeds/001_mock.sql", import.meta.url));
const cliente = await conectar();
try {
  const migraciones = await cliente.query("SELECT to_regclass('public.schema_migraciones') IS NOT NULL AS hay");
  if (!migraciones.rows[0].hay) {
    console.error("✘ La base todavía no tiene las tablas. Primero: npm run db:aplicar");
    process.exit(1);
  }
  const existentes = (await cliente.query("SELECT (SELECT count(*) FROM persona) + (SELECT count(*) FROM bien) + (SELECT count(*) FROM movimiento) AS n")).rows[0].n;
  if (Number(existentes) > 0) {
    console.error("✘ La base ya tiene datos. Para volver a empezar: npm run db:reiniciar -- --confirmar-borrado");
    process.exit(1);
  }

  const sql = await readFile(archivo, "utf8");
  try {
    await cliente.query("BEGIN");
    await cliente.query(sql);
    await cliente.query("COMMIT");
  } catch (e) {
    await cliente.query("ROLLBACK");
    console.error(`✘ No se cargó nada (se deshizo la transacción): ${limpiar(e.message)}`);
    process.exit(1);
  }

  const n = async (tabla) => (await cliente.query(`SELECT count(*)::int AS n FROM ${tabla}`)).rows[0].n;
  console.log(
    `✔ Mock cargado: ${await n("catalogo_sbn")} códigos de catálogo, ${await n("persona")} personas, ` +
      `${await n("bien")} bienes, ${await n("acta")} actas, ${await n("movimiento")} movimientos.`,
  );
} finally {
  await cliente.end();
}
