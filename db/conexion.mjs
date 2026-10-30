// Conexión a la base de PRUEBAS de Neon.
// - Lee la cadena de DATABASE_URL_PRUEBAS (que se carga desde .env.local con --env-file).
// - NUNCA imprime la cadena, el usuario, la contraseña ni el servidor: todo texto que se muestre
//   pasa antes por limpiar().
import pg from "pg";

const variable = "DATABASE_URL_PRUEBAS";

/** Cadena de conexión; con DB_DIRECTA=1 usa el servidor directo (sin "-pooler"). */
function cadena() {
  const original = process.env[variable];
  if (!original) {
    throw new Error(`Falta la variable ${variable} en .env.local.`);
  }
  const url = new URL(original);
  if (process.env.DB_DIRECTA === "1") {
    url.hostname = url.hostname.replace("-pooler", "");
  }
  return url.toString();
}

/** Valores secretos que jamás deben aparecer en pantalla. */
function secretos() {
  const lista = [];
  for (const nombre of [variable, "DATABASE_URL"]) {
    const valor = process.env[nombre];
    if (!valor) continue;
    lista.push(valor);
    try {
      const u = new URL(valor);
      lista.push(u.hostname, u.hostname.replace("-pooler", ""), decodeURIComponent(u.username), decodeURIComponent(u.password));
    } catch {
      // Si la cadena no se puede analizar, igual se oculta completa (ya está en la lista).
    }
  }
  return lista.filter((s) => s && s.length > 3);
}

/** Reemplaza por *** cualquier secreto que aparezca dentro de un texto. */
export function limpiar(texto) {
  let salida = String(texto);
  for (const s of secretos()) salida = salida.split(s).join("***");
  return salida;
}

/** true si el texto contiene alguna credencial (se usa para comprobar la salida de las pruebas). */
export function contieneSecretos(texto) {
  return secretos().some((s) => String(texto).includes(s));
}

/** Evita que el script apunte por error a la base de producción. */
function verificarQueNoEsProduccion() {
  const prueba = process.env[variable];
  const produccion = process.env.DATABASE_URL;
  if (!prueba || !produccion) return;
  const a = new URL(prueba);
  const b = new URL(produccion);
  const mismoServidor = a.hostname.replace("-pooler", "") === b.hostname.replace("-pooler", "");
  if (mismoServidor && a.pathname === b.pathname) {
    throw new Error(`${variable} apunta a la misma base que DATABASE_URL (producción). Se cancela por seguridad.`);
  }
}

/** Abre una conexión nueva a la base de pruebas. */
export async function conectar() {
  verificarQueNoEsProduccion();
  const cliente = new pg.Client({ connectionString: cadena(), connectionTimeoutMillis: 30000 });
  try {
    await cliente.connect();
  } catch (e) {
    throw new Error(limpiar(`No se pudo conectar a la base de pruebas: ${e.message}`));
  }
  return cliente;
}
