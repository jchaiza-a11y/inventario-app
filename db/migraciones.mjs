// Lógica compartida para aplicar los archivos de db/migrations/ (la usan aplicar.mjs y reiniciar.mjs).
// Cada archivo se ejecuta dentro de una transacción: si falla, no queda a medias.
// La tabla schema_migraciones recuerda qué archivos ya se aplicaron, para poder repetir el comando.
import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { limpiar } from "./conexion.mjs";

const carpeta = fileURLToPath(new URL("./migrations/", import.meta.url));

/** Número de línea (1, 2, 3…) a partir de la posición de un error dentro del texto SQL. */
function lineaDeError(sql, posicion) {
  if (!posicion) return null;
  return sql.slice(0, Number(posicion) - 1).split("\n").length;
}

/** Aplica las migraciones pendientes. Devuelve true si todas salieron bien. */
export async function aplicarMigraciones(cliente) {
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
      return false;
    }
  }
  return true;
}
