// Aplica en orden los archivos de db/migrations/ a la base de PRUEBAS de Neon.
// Uso:  npm run db:aplicar
import { conectar } from "./conexion.mjs";
import { aplicarMigraciones } from "./migraciones.mjs";

const cliente = await conectar();
try {
  if (!(await aplicarMigraciones(cliente))) process.exitCode = 1;
} finally {
  await cliente.end();
}
