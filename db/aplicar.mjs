// Aplica en orden los archivos de db/migrations/ a la base de PRUEBAS de Neon.
// Uso:  npm run db:aplicar
// Cada archivo se ejecuta dentro de una transacción: si falla, no queda a medias.
// La tabla schema_migraciones recuerda qué archivos ya se aplicaron, para poder repetir el comando.
import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { conectar, limpiar } from "./conexion.mjs";

const carpeta = fileURLToPath(new URL("./migrations/", import.meta.url));

/** Número de línea (1, 2, 3…) a partir de la posición de un error dentro del texto SQL. */
function lineaDeError(sql, posicion) {
  if (!posicion) return null;
  return sql.slice(0, Number(posicion) - 1).split("\n").length;
}

const cliente = await conectar();
try {
  await cliente.query(`
    CREATE TABLE IF NOT EXISTS schema_migraciones (
      nombre      text        PRIMARY KEY,
      aplicada_en timestamptz NOT NULL DEFAULT now()
    )`);

  const archivos = (await readdir(carpeta)).filter((f) => /^\d{3}_.+\.sql$/.test(f)).sort();
  const hechas = new Set((await cliente.query("SELECT nombre FROM schema_migraciones")).rows.map((r) => r.nombre));

  for (const archivo of archivos) {
    if (hechas.has(archivo)) {
      console.log(`= ${archivo} (ya estaba aplicado)`);
      continue;
    }
    const sql = await readFile(carpeta + archivo, "utf8");
    try {
      await cliente.query("BEGIN");
      await cliente.query(sql);
      await cliente.query("INSERT INTO schema_migraciones (nombre) VALUES ($1)", [archivo]);
      await cliente.query("COMMIT");
      console.log(`✔ ${archivo}`);
    } catch (e) {
      await cliente.query("ROLLBACK");
      const linea = lineaDeError(sql, e.position);
      console.error(`✘ ${archivo}${linea ? ` (línea ${linea})` : ""}: ${limpiar(e.message)}`);
      process.exitCode = 1;
      break;
    }
  }
} finally {
  await cliente.end();
}
