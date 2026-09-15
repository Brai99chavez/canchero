import { File } from 'expo-file-system';
import { esLocal } from '../photos';
import { Squad } from '../types';
import { API, pedir } from './cliente';

/**
 * Las fotos viajan con el backup, pero no adentro del JSON: se suben a R2 y en
 * el plantel queda la URL.
 *
 * El archivo va derecho de este teléfono al bucket. El servidor sólo firma un
 * permiso que vale unos minutos y no toca ni un byte de la imagen: pasarla por
 * el medio ocuparía el contenedor —512 MB, y que además se duerme— para mover
 * algo que no lo necesita.
 */
interface Permiso {
  /** Adónde mandar el archivo. Vence en minutos. */
  url: string;
  /** Con qué URL se va a poder mirar después. */
  publica: string;
}

function tipoDe(uri: string): string {
  const limpio = uri.split('?')[0].toLowerCase();
  if (limpio.endsWith('.png')) return 'image/png';
  if (limpio.endsWith('.webp')) return 'image/webp';
  return 'image/jpeg';
}

/** Sube una foto del teléfono y devuelve la URL con la que se ve. */
export async function subirFoto(uri: string): Promise<string> {
  const tipo = tipoDe(uri);
  const permiso = await pedir<Permiso>('/fotos/permiso', {
    metodo: 'POST',
    cuerpo: { tipo },
  });

  // Los bytes en crudo: R2 espera el archivo tal cual, no un formulario.
  const bytes = await new File(uri).bytes();
  const respuesta = await fetch(permiso.url, {
    method: 'PUT',
    headers: { 'content-type': tipo },
    body: bytes,
  });
  if (!respuesta.ok) {
    throw new Error(`No se pudo subir la foto (${respuesta.status}).`);
  }
  return permiso.publica;
}

/**
 * Sube las fotos que todavía viven sólo en este teléfono y devuelve los
 * planteles con las URLs ya puestas.
 *
 * Una foto que falla no frena el backup: queda local, se reintenta en el
 * próximo, y el resto del plantel se guarda igual. Perder el respaldo entero
 * porque una imagen no subió sería mucho peor que quedarse sin esa imagen.
 */
export async function subirFotosPendientes(
  planteles: Squad[]
): Promise<{ planteles: Squad[]; subidas: number; fallaron: number }> {
  if (!API) return { planteles, subidas: 0, fallaron: 0 };

  let subidas = 0;
  let fallaron = 0;
  const actualizados: Squad[] = [];

  for (const plantel of planteles) {
    const jugadores = [];
    for (const jugador of plantel.jugadores) {
      if (!esLocal(jugador.foto)) {
        jugadores.push(jugador);
        continue;
      }
      try {
        const publica = await subirFoto(jugador.foto as string);
        jugadores.push({ ...jugador, foto: publica });
        subidas++;
      } catch {
        jugadores.push(jugador);
        fallaron++;
      }
    }
    actualizados.push({ ...plantel, jugadores });
  }

  return { planteles: actualizados, subidas, fallaron };
}

/*
 * Todavía no se borran las fotos del bucket, y no es un olvido: mientras el
 * backup sea manual, una foto que acá ya no se usa puede seguir siendo la que
 * referencia la copia de la nube. Borrarla dejaría esa copia con la carta
 * rota, que es peor que dejar el archivo dando vueltas.
 *
 * El endpoint del servidor existe (`/fotos/borrar`). Lo que falta es hacer la
 * limpieza en el momento correcto: durante el backup, contra lo que queda
 * efectivamente referenciado después de subir. Una foto son unos 50 KB y el
 * plan gratis son 10 GB, así que hay tiempo de sobra para hacerlo bien.
 */
