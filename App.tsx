import { Anton_400Regular } from '@expo-google-fonts/anton';
import {
  Barlow_400Regular,
  Barlow_500Medium,
  Barlow_600SemiBold,
  Barlow_700Bold,
  Barlow_800ExtraBold,
  Barlow_900Black,
} from '@expo-google-fonts/barlow';
import { useFonts } from 'expo-font';
import { StatusBar } from 'expo-status-bar';
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { buildTeams } from './src/balance';
import { ajustesDe } from './src/elo';
import AppHeader from './src/components/AppHeader';
import { Logotipo } from './src/components/Logo';
import { useDialogo } from './src/components/Dialogo';
import { PasoGuia, ProveedorGuia } from './src/components/Guia';
import { Aparecer } from './src/components/motion';
import TabBar, { NavPrincipal, SeccionKey } from './src/components/TabBar';
import { planteesDesde } from './src/backup';
import { borrarTodasLasFotos, cleanupPhotos } from './src/photos';
import Cargando from './src/screens/Cargando';
import AmigosScreen from './src/screens/AmigosScreen';
import ChatScreen from './src/screens/ChatScreen';
import PerfilScreen from './src/screens/PerfilScreen';
import HistoryScreen from './src/screens/HistoryScreen';
import MatchResultModal from './src/screens/MatchResultModal';
import MatchScreen from './src/screens/MatchScreen';
import PlayerFormModal from './src/screens/PlayerFormModal';
import NewSquadModal from './src/screens/NewSquadModal';
import PlayersScreen from './src/screens/PlayersScreen';
import RecuperarModal from './src/screens/RecuperarModal';
import SquadConfigModal, {
  CambiosPlantel,
} from './src/screens/SquadConfigModal';
import SquadsScreen from './src/screens/SquadsScreen';
import TeamsModal from './src/screens/TeamsModal';
import { hayNube } from './src/nube/cliente';
import {
  alCambiarSesion,
  entrarConCodigo,
  explicar,
  sesionActual,
  Sesion,
} from './src/nube/cuenta';
import { alConfirmar, alRecuperar, Recuperacion } from './src/nube/enlaces';
import { Amigo, listarAmigos } from './src/nube/amigos';
import {
  alLlegarNovedad,
  registrarTelefono,
} from './src/nube/avisos';
import {
  aceptarEnvio,
  Envio,
  pendientes,
  rechazarEnvio,
} from './src/nube/envios';
import { leerPerfil, usarNombreReservado } from './src/nube/perfil';
import { subirFotosPendientes } from './src/nube/fotos';
import { EstadoSync, sincronizar, sinSubir } from './src/nube/sync';
import {
  AVISO_PRO,
  idsActivos,
  limites,
  motivoBloqueado,
  Permiso,
  Plan,
  PLAN,
  puedeAgregarJugador,
  puedeCrearPlantel,
} from './src/plan';
import { bancoPrevio, duplasPrevias, resumenDe } from './src/stats';
import {
  borrarTodo,
  EstadoGuia,
  loadGuia,
  loadPlanteles,
  newId,
  plantelVacio,
  saveGuia,
  savePlanteles,
} from './src/storage';
import { colors, spacing } from './src/theme';
import {
  Actuacion,
  Format,
  Partido,
  Player,
  Squad,
  TeamSplit,
} from './src/types';

import type { TabKey as Tab } from './src/components/TabBar';
/** La app arranca en la lista, salvo que haya un plantel por defecto. */
type Vista = 'lista' | 'plantel';

/**
 * Lo mínimo que se queda la pantalla de carga.
 *
 * Con los planteles ya guardados en el teléfono la app está lista en un par de
 * cuadros, y el logo pasaba como un parpadeo: alcanzaba a verse un destello y
 * nada más. No es tiempo perdido —es el único lugar donde la app dice cómo se
 * llama— y la barra de abajo entra a los 320 ms, así que con menos de esto ni
 * se la ve moverse.
 */
const CARGA_MINIMA = 1000;

/**
 * Cuánto se espera después del último cambio antes de subir.
 *
 * Mover el deslizador de una estadística dispara veinte cambios en dos
 * segundos: sin esta pausa se mandaría veinte veces el mismo plantel. Y no
 * puede ser mucho más largo, porque lo que no subió todavía es lo que se
 * pierde si el teléfono se apaga.
 */
const ESPERA_ANTES_DE_SUBIR = 1500;




export default function App() {
  return (
    <SafeAreaProvider>
      <Root />
    </SafeAreaProvider>
  );
}

function Root() {
  const [fuentesListas] = useFonts({
    Anton_400Regular,
    Barlow_400Regular,
    Barlow_500Medium,
    Barlow_600SemiBold,
    Barlow_700Bold,
    Barlow_800ExtraBold,
    Barlow_900Black,
  });
  const [ready, setReady] = useState(false);
  /** Si ya pasó el mínimo que la pantalla de carga se queda en pantalla. */
  const [tiempoCumplido, setTiempoCumplido] = useState(false);
  const [planteles, setPlanteles] = useState<Squad[]>([]);
  const [activoId, setActivoId] = useState('');
  const [predeterminadoId, setPredeterminadoId] = useState<string | null>(null);
  const [vista, setVista] = useState<Vista>('lista');
  const [tab, setTab] = useState<Tab>('plantel');

  const [formVisible, setFormVisible] = useState(false);
  const [editing, setEditing] = useState<Player | null>(null);
  const [configId, setConfigId] = useState<string | null>(null);
  const [nuevoVisible, setNuevoVisible] = useState(false);

  const [teamsVisible, setTeamsVisible] = useState(false);
  const [resultadoId, setResultadoId] = useState<string | null>(null);
  const [guia, setGuia] = useState<EstadoGuia>({ activa: false, vistos: [] });
  const [sesion, setSesion] = useState<Sesion | null>(null);
  /** Si ya se preguntó si había una sesión guardada. Antes no se sabe nada. */
  const [sesionMirada, setSesionMirada] = useState(false);
  /** Quién entró. Lo que decide de quién son los datos de este teléfono. */
  const idSesion = sesion?.id ?? null;
  /** En cuál de las tres secciones está. Planteles es a lo que se entra. */
  const [seccion, setSeccion] = useState<SeccionKey>('planteles');
  const [amigos, setAmigos] = useState<Amigo[]>([]);
  const [cargandoAmigos, setCargandoAmigos] = useState(false);
  /** Con quién está abierta la conversación, si hay alguna. */
  const [chatCon, setChatCon] = useState<string | null>(null);
  /**
   * Sube cuando llega un aviso de que hay algo nuevo. Es lo que dispara
   * recargar la conversación abierta, en lugar de un reloj.
   */
  const [refrescos, setRefrescos] = useState(0);
  /** Mi nombre de usuario, o null si todavía no elegí uno. */
  const [miUsuario, setMiUsuario] = useState<string | null>(null);
  /** Lo que trajo el link del mail para cambiar la contraseña. */
  const [recuperacion, setRecuperacion] = useState<Recuperacion | null>(null);
  /** Los planteles que otros te mandaron y todavía no aceptaste ni rechazaste. */
  const [envios, setEnvios] = useState<Envio[]>([]);
  /** Cuándo terminó la última sincronización que salió bien. */
  const [ultimaCopia, setUltimaCopia] = useState<Date | null>(null);
  /** Qué se confirmó arriba de cada plantel, y hasta cuándo se leyó. */
  const [estadoSync, setEstadoSync] = useState<EstadoSync>({
    subido: {},
    hasta: null,
  });
  const [sincronizando, setSincronizando] = useState(false);
  /** De quién es lo que hay guardado en este teléfono. */
  const [duenoLocal, setDuenoLocal] = useState<string | null>(null);
  /**
   * Los planteles borrados acá que todavía siguen en la nube. Viajan con el
   * backup y no en el momento de borrar, por lo mismo: un borrado sin querer
   * no tiene por qué llevarse la copia puesta.
   */
  const [borradosPendientes, setBorrados] = useState<string[]>([]);
  // El plan sale del servidor cuando hay cuenta. Sin cuenta, el de siempre.
  const [plan, setPlan] = useState<Plan>(PLAN);
  const { dialogo, avisar, preguntar } = useDialogo();

  /** Avisa si la acción no entra en el plan y dice si se puede seguir. */
  const dejaSeguir = useCallback(
    (permiso: Permiso) => {
      if (permiso.ok) return true;
      preguntar({
        titulo: permiso.titulo,
        mensaje: permiso.motivo,
        destacado: permiso.pro,
      });
      return false;
    },
    [preguntar]
  );

  // La sesión puede cambiar desde el modal o sola, cuando vence el token.
  useEffect(() => {
    if (!hayNube) return;
    sesionActual()
      .then(setSesion)
      .finally(() => setSesionMirada(true));
    return alCambiarSesion(setSesion);
  }, []);

  /*
   * El link del mail para cambiar la contraseña. Puede llegar con la app
   * cerrada —y ahí es lo primero que pasa— o con la app abierta, así que se
   * escucha desde el arranque y no desde la pantalla de cuenta, que capaz ni
   * está montada.
   */
  useEffect(() => {
    if (!hayNube) return;
    return alRecuperar(setRecuperacion);
  }, []);

  /*
   * La vuelta de confirmar el mail. Trae un código de un solo uso que se
   * canjea por la sesión: así se entra sin volver a escribir la contraseña,
   * que es lo que uno espera después de tocar el link del mail.
   */
  useEffect(() => {
    if (!hayNube) return;
    return alConfirmar((dato) => {
      if (!dato.codigo) {
        avisar(
          'Ese link ya no sirve',
          'Se usó una vez o venció. Entrá con tu mail y tu contraseña, o pedí ' +
            'uno nuevo desde "no me llegó el mail de confirmación".'
        );
        return;
      }
      entrarConCodigo(dato.codigo)
        .then(() =>
          avisar(
            'Cuenta confirmada',
            'Listo, ya estás adentro. Lo único que falta es elegir tu nombre ' +
              'de usuario, si todavía no lo hiciste.'
          )
        )
        .catch((problema) =>
          avisar('No se pudo confirmar', explicar(problema).detalle)
        );
    });
  }, [avisar]);

  useEffect(() => {
    if (!sesion) {
      setPlan(PLAN);
      setUltimaCopia(null);
        // Los borrados pendientes se quedan: siguen siendo verdad aunque no
      // haya sesión, y hay que propagarlos cuando se vuelva a entrar.
      return;
    }
    /*
     * Un solo pedido: el plan y el nombre de usuario salen los dos del perfil.
     *
     * Ante cualquier problema se asume gratis, que es el lado seguro para
     * equivocarse: mostrar los límites de más es un cartel, dar Pro de más es
     * regalar el producto.
     */
    /*
     * `usarNombreReservado` primero: si al registrarse se eligió un nombre, se
     * guarda ahora, que es la primera vez que hay sesión para hacerlo. Si no
     * había ninguno anotado no pide nada y sigue de largo.
     */
    usarNombreReservado()
      .then((puesto) => puesto ?? leerPerfil())
      .then((perfil) => {
        setPlan(perfil.plan === 'pro' ? 'pro' : 'gratis');
        setMiUsuario(perfil.usuario);
      })
      .catch(() => {
        setPlan(PLAN);
        setMiUsuario(null);
      });
  }, [sesion]);

  /**
   * Lo que te mandaron. Se mira al entrar y nada más: no hay aviso al momento,
   * así que el que manda avisa por otro lado y esto aparece la próxima vez.
   * Un plantel no es algo urgente.
   */
  const revisarEnvios = useCallback(() => {
    if (!sesion) {
      setEnvios([]);
      return;
    }
    // Si falla —sin señal, servidor dormido— no se avisa: la bandeja queda
    // vacía y se vuelve a mirar la próxima. No hay nada que el usuario pueda
    // hacer con ese error.
    pendientes().then(setEnvios).catch(() => {});
  }, [sesion]);

  useEffect(revisarEnvios, [revisarEnvios]);

  /*
   * Los avisos: este teléfono se anota para recibirlos, y cuando llega uno se
   * recarga lo que haya que recargar. Es lo que reemplaza al refresco
   * periódico — sin esto habría que preguntarle al servidor cada tantos
   * segundos si pasó algo, y como casi nunca pasa nada eso es despertar la
   * base todo el día para que conteste que no.
   */
  useEffect(() => {
    if (!sesion) return;
    registrarTelefono();
  }, [sesion]);

  useEffect(
    () =>
      alLlegarNovedad(() => {
        // Sube el contador y con eso se recargan los amigos y, si hay una
        // conversación abierta, también ella.
        setRefrescos((n) => n + 1);
        revisarEnvios();
      }),
    [revisarEnvios]
  );

  /**
   * Los amigos y lo que está sin leer. Se piden al entrar y después de cada
   * acción, nunca en un reloj: la base se suspende sola cuando nadie la usa, y
   * consultarla cada tantos segundos la mantendría despierta al pedo.
   */
  const revisarAmigos = useCallback(async () => {
    if (!sesion) {
      setAmigos([]);
      return;
    }
    setCargandoAmigos(true);
    try {
      setAmigos(await listarAmigos());
    } catch {
      // Sin señal la lista queda como estaba: no hay nada que decirle al
      // usuario que no vea solo cuando vuelva a tener internet.
    } finally {
      setCargandoAmigos(false);
    }
  }, [sesion]);

  useEffect(() => {
    revisarAmigos();
  }, [revisarAmigos, refrescos]);

  /** Lo que espera algo tuyo: solicitudes por responder y mensajes sin leer. */
  const pendientesDeAmigos = useMemo(
    () =>
      amigos.reduce(
        (acc, a) =>
          acc +
          (a.estado === 'pendiente' && !a.loPediYo ? 1 : 0) +
          (a.estado === 'aceptada' ? a.sinLeer : 0),
        0
      ),
    [amigos]
  );

  useEffect(() => {
    const reloj = setTimeout(() => setTiempoCumplido(true), CARGA_MINIMA);
    return () => clearTimeout(reloj);
  }, []);

  useEffect(() => {
    loadGuia().then(setGuia);
  }, []);

  /*
   * Lo guardado se lee recién cuando se sabe de quién es la sesión, y no al
   * arrancar.
   *
   * Leerlo antes fue la causa de que los planteles de una cuenta aparecieran
   * en otra: quedaban en memoria mientras se averiguaba quién había entrado, y
   * cualquier cosa que corriera en ese rato los tomaba por propios. Limpiar
   * después no alcanza — siempre hay una ventana.
   *
   * Si lo guardado es de otra cuenta, o no dice de quién es, se descarta: está
   * todo en el servidor y se vuelve a bajar. Lo que no se puede hacer es
   * adivinar de quién era.
   */
  useEffect(() => {
    if (hayNube && !sesionMirada) return;

    let vigente = true;
    loadPlanteles().then((guardado) => {
      if (!vigente) return;

      const dueno = idSesion;
      const esMio = !hayNube || guardado.dueno === dueno;

      setPlanteles(esMio ? guardado.planteles : []);
      setActivoId(esMio ? guardado.activoId : '');
      setPredeterminadoId(esMio ? guardado.predeterminadoId : null);
      setBorrados(esMio ? guardado.borrados : []);
      setEstadoSync(
        esMio
          ? { subido: guardado.subido, hasta: guardado.hasta }
          : { subido: {}, hasta: null }
      );
      setDuenoLocal(dueno);
      setVista(esMio && guardado.predeterminadoId ? 'plantel' : 'lista');
      setReady(true);
    });

    return () => {
      vigente = false;
    };
    /*
     * Se depende del id y no del objeto de la sesión: si el objeto cambiara de
     * identidad sin cambiar de persona, esto recargaría del disco y se llevaría
     * puesto lo que todavía no se guardó.
     */
  }, [hayNube, sesionMirada, idSesion]);

  // Persiste los planteles en el celular ante cualquier cambio.
  useEffect(() => {
    if (!ready) return;
    // Nunca escribir con un dueño que no es el de la sesión: seria dejarle lo
    // de uno al que entre después.
    if (hayNube && duenoLocal !== idSesion) return;
    savePlanteles({
      planteles,
      activoId,
      predeterminadoId,
      borrados: borradosPendientes,
      subido: estadoSync.subido,
      hasta: estadoSync.hasta,
      dueno: duenoLocal,
    });
  }, [
    planteles,
    activoId,
    predeterminadoId,
    borradosPendientes,
    estadoSync,
    duenoLocal,
    idSesion,
    ready,
  ]);

  /**
   * Si hay algo que todavía no llegó al servidor.
   *
   * El guardado es automático, pero no instantáneo: sin señal queda acá hasta
   * que vuelva. Se muestra para que nadie dé por guardado lo que no lo está.
   */
  const haySinSubir =
    Boolean(sesion) &&
    (sinSubir(planteles, estadoSync.subido).length > 0 ||
      borradosPendientes.length > 0);

  const activo = useMemo(
    () => planteles.find((p) => p.id === activoId) ?? planteles[0],
    [planteles, activoId]
  );

  /** Los que el plan deja usar. Los demás se ven en la lista y nada más. */
  const activos = useMemo(
    () => idsActivos(planteles, plan),
    [planteles, plan]
  );


  // Sin planteles no hay adónde entrar, y a uno bloqueado tampoco: puede
  // quedar abierto si venía de Pro o si al importar entró uno más viejo.
  const vistaReal: Vista =
    planteles.length === 0 || !activos.has(activo?.id ?? '') ? 'lista' : vista;
  const players = activo?.jugadores ?? [];
  const partidos = activo?.partidos ?? [];
  /**
   * La media corregida por los resultados. Se recalcula del historial, así que
   * borrar un partido de prueba la deshace sola.
   */
  const ajustes = useMemo(
    () => ajustesDe(players, partidos),
    [players, partidos]
  );

  /** Lo mismo pero sólo el número, que es lo que piden las pantallas. */
  const medias = useMemo(() => {
    const salida: Record<string, number> = {};
    for (const id in ajustes) salida[id] = ajustes[id].elo;
    return salida;
  }, [ajustes]);

  /**
   * Aplica un cambio sólo al plantel que se está usando, y le pone la fecha.
   *
   * Todo lo que cambia un plantel pasa por acá, y por eso la fecha se estampa
   * acá: si cada pantalla tuviera que acordarse de ponerla, la primera que se
   * olvidara dejaría ese cambio sin subir para siempre.
   */
  const editarPlantel = useCallback(
    (cambio: (plantel: Squad) => Squad) => {
      setPlanteles((prev) =>
        prev.map((p) =>
          p.id === activoId
            ? { ...cambio(p), actualizado: new Date().toISOString() }
            : p
        )
      );
    },
    [activoId]
  );

  const editarActivo = useCallback(
    (cambio: (jugadores: Player[]) => Player[]) => {
      editarPlantel((p) => ({ ...p, jugadores: cambio(p.jugadores) }));
    },
    [editarPlantel]
  );

  /** Aplica un cambio a los partidos del plantel que se está usando. */
  const editarPartidos = useCallback(
    (cambio: (partidos: Partido[]) => Partido[]) => {
      editarPlantel((p) => ({ ...p, partidos: cambio(p.partidos) }));
    },
    [editarPlantel]
  );

  /**
   * La convocatoria vive en el plantel, no en memoria: como juegan casi
   * siempre los mismos, volver a tildar catorce personas cada sábado era el
   * trabajo más tonto de la app.
   */
  const convocatoria = activo?.convocatoria;
  const format = convocatoria?.formato ?? 5;
  const usarTodos = convocatoria?.usarTodos ?? false;
  const selectedIds = useMemo(
    () => convocatoria?.seleccionados ?? [],
    [convocatoria]
  );

  const editarConvocatoria = useCallback(
    (cambio: Partial<Squad['convocatoria']>) => {
      editarPlantel((p) => ({
        ...p,
        convocatoria: { ...p.convocatoria, ...cambio },
      }));
    },
    [editarPlantel]
  );

  const setFormat = useCallback(
    (formato: Format) => editarConvocatoria({ formato }),
    [editarConvocatoria]
  );
  const setUsarTodos = useCallback(
    (valor: boolean) => editarConvocatoria({ usarTodos: valor }),
    [editarConvocatoria]
  );
  const setSelectedIds = useCallback(
    (ids: string[]) => editarConvocatoria({ seleccionados: ids }),
    [editarConvocatoria]
  );

  /** El sorteo se guarda por id y se rearma con los jugadores de ahora. */
  const split: TeamSplit | null = useMemo(() => {
    const guardado = activo?.sorteo;
    if (!guardado) return null;
    const buscar = (ids: string[]) =>
      ids
        .map((id) => players.find((p) => p.id === id))
        .filter((p): p is Player => p !== undefined);
    const teamA = buscar(guardado.equipoA);
    const teamB = buscar(guardado.equipoB);
    if (teamA.length === 0 || teamB.length === 0) return null;
    return { teamA, teamB, bench: buscar(guardado.banco) };
  }, [activo, players]);

  const guardadoId = activo?.sorteo?.partidoId ?? null;

  const guardarSorteo = useCallback(
    (nuevo: TeamSplit | null, partidoId: string | null = null) => {
      editarPlantel((p) => ({
        ...p,
        sorteo: nuevo
          ? {
              equipoA: nuevo.teamA.map((j) => j.id),
              equipoB: nuevo.teamB.map((j) => j.id),
              banco: nuevo.bench.map((j) => j.id),
              partidoId,
            }
          : null,
      }));
    },
    [editarPlantel]
  );

  const handleSavePlayer = useCallback(
    (player: Player) => {
      // Al guardar quedan sólo la foto vigente y ninguna de las descartadas.
      cleanupPhotos(player.id, player.foto);
      editarActivo((jugadores) =>
        jugadores.some((p) => p.id === player.id)
          ? jugadores.map((p) => (p.id === player.id ? player : p))
          : [...jugadores, player]
      );
      // Guardar un jugador no cambia de pantalla: se vuelve a la lista del
      // plantel en el que se estaba, que es donde se lo acaba de agregar.
      setFormVisible(false);
      setEditing(null);
      setVista('plantel');
      setTab('plantel');
    },
    [editarActivo]
  );

  const handleDeletePlayer = useCallback(
    (id: string) => {
      cleanupPhotos(id);
      editarPlantel((p) => ({
        ...p,
        jugadores: p.jugadores.filter((j) => j.id !== id),
        convocatoria: {
          ...p.convocatoria,
          seleccionados: p.convocatoria.seleccionados.filter((x) => x !== id),
        },
      }));
      setFormVisible(false);
      setEditing(null);
    },
    [editarPlantel]
  );

  const toggleSelected = useCallback(
    (id: string) => {
      setSelectedIds(
        selectedIds.includes(id)
          ? selectedIds.filter((pid) => pid !== id)
          : [...selectedIds, id]
      );
    },
    [selectedIds, setSelectedIds]
  );

  // `avoid` hace que al volver a sortear no repita el reparto en pantalla.
  const draw = useCallback(
    (avoid: TeamSplit | null) => {
      const convocados = players.filter((p) =>
        selectedIds.includes(p.id)
      );
      if (convocados.length < 2) return;
      // Cada sorteo nuevo vuelve a estar sin guardar en el historial.
      guardarSorteo(
        buildTeams(convocados, format, {
          usarTodos,
          bancoPrevio: bancoPrevio(partidos),
          duplasPrevias: duplasPrevias(partidos),
          elo: medias,
          avoid,
        }),
        null
      );
      setTeamsVisible(true);
    },
    [players, selectedIds, format, usarTodos, partidos, guardarSorteo]
  );

  const handleGuardarPartido = useCallback((fecha: Date) => {
    if (!split) return;
    const nombres: Record<string, string> = {};
    for (const p of [...split.teamA, ...split.teamB, ...split.bench]) {
      nombres[p.id] = p.nombre;
    }
    const partido: Partido = {
      id: newId(),
      fecha: fecha.toISOString(),
      formato: format,
      equipoA: split.teamA.map((p) => p.id),
      equipoB: split.teamB.map((p) => p.id),
      banco: split.bench.map((p) => p.id),
      nombres,
      golesA: null,
      golesB: null,
      actuaciones: [],
    };
    editarPlantel((p) => ({
      ...p,
      partidos: [...p.partidos, partido],
      sorteo: p.sorteo ? { ...p.sorteo, partidoId: partido.id } : null,
    }));
    // Queda en curso esperando el resultado. Se lleva al usuario a la lista
    // para que vea dónde quedó, en vez de pedirle el marcador de un partido
    // que todavía no se jugó.
    setTeamsVisible(false);
    setTab('activos');
  }, [split, format, editarPlantel]);

  /**
   * Intercambia dos jugadores de lugar. El algoritmo propone, pero en la
   * cancha siempre hay una razón que no está en los números.
   */
  const handleSwap = useCallback(
    (unoId: string, otroId: string) => {
      editarPlantel((p) => {
        if (!p.sorteo) return p;
        const cambiar = (ids: string[]) =>
          ids.map((id) =>
            id === unoId ? otroId : id === otroId ? unoId : id
          );
        return {
          ...p,
          sorteo: {
            ...p.sorteo,
            equipoA: cambiar(p.sorteo.equipoA),
            equipoB: cambiar(p.sorteo.equipoB),
            banco: cambiar(p.sorteo.banco),
          },
        };
      });
    },
    [editarPlantel]
  );

  const handleGuardarResultado = useCallback(
    (cambios: {
      fecha: string;
      equipoA: string[];
      equipoB: string[];
      golesA: number;
      golesB: number;
      actuaciones: Actuacion[];
    }) => {
      if (!resultadoId) return;
      editarPlantel((p) => ({
        ...p,
        partidos: p.partidos.map((x) =>
          x.id === resultadoId ? { ...x, ...cambios } : x
        ),
        // El partido terminó: el sorteo en pantalla ya no tiene sentido.
        sorteo: p.sorteo?.partidoId === resultadoId ? null : p.sorteo,
      }));
      setResultadoId(null);
      setTab('historial');
    },
    [resultadoId, editarPlantel]
  );

  /** Si entra otro plantel, avisando con el cartel del plan cuando no. */
  const hayLugar = useCallback(
    () => dejaSeguir(puedeCrearPlantel(planteles.length, plan)),
    [dejaSeguir, planteles.length, plan]
  );

  const handleBorrarPartidos = useCallback(
    (ids: string[]) => {
      const fuera = new Set(ids);
      editarPartidos((prev) => prev.filter((p) => !fuera.has(p.id)));
    },
    [editarPartidos]
  );

  const handleBuild = useCallback(() => draw(null), [draw]);
  const handleReshuffle = useCallback(() => draw(split), [draw, split]);

  // Cada plantel se acuerda de su propia convocatoria, así que abrir otro
  // no borra nada: simplemente se muestra la suya.
  const handleAbrirPlantel = useCallback(
    (id: string) => {
      if (!activos.has(id)) return;
      setActivoId(id);
      setTab('plantel');
      setVista('plantel');
    },
    [activos]
  );

  const handleCrearPlantel = useCallback((nombre: string) => {
    const nuevo = plantelVacio(nombre);
    setPlanteles((prev) => [...prev, nuevo]);
    setActivoId(nuevo.id);
    setNuevoVisible(false);
    setTab('plantel');
    setVista('plantel');
  }, []);

  /** La config se aplica entera al tocar Guardar, no campo por campo. */
  const handleGuardarConfig = useCallback(
    (id: string, cambios: CambiosPlantel) => {
      setPlanteles((prev) =>
        prev.map((p) => (p.id === id ? { ...p, nombre: cambios.nombre } : p))
      );
      setPredeterminadoId((prev) =>
        cambios.predeterminado ? id : prev === id ? null : prev
      );
      setConfigId(null);
    },
    []
  );

  const handleBorrarPlantel = useCallback(
    (id: string) => {
      const plantel = planteles.find((p) => p.id === id);
      plantel?.jugadores.forEach((j) => cleanupPhotos(j.id));

      // Queda anotado para el próximo backup, no se borra en la nube ahora.
      // Se anota haya sesión o no: si entrás después, la nube todavía tiene
      // ese plantel y hay que decírselo, si no reaparece al restaurar.
      setBorrados((prev) => [...new Set([...prev, id])]);

      const quedan = planteles.filter((p) => p.id !== id);
      setPlanteles(quedan);
      setConfigId(null);
      if (id === predeterminadoId) setPredeterminadoId(null);
      if (id === activoId) {
        // El plantel que se estaba usando ya no existe: se vuelve a la lista.
        setVista('lista');
        setActivoId(quedan.length > 0 ? quedan[0].id : '');
      }
    },
    [planteles, activoId, predeterminadoId]
  );

  /**
   * Deja la app como recién instalada: sin planteles, sin fotos, sin nada.
   *
   * Los planteles se marcan como borrados antes de irse, así el servidor se
   * entera. Sin eso quedarían arriba y la próxima vuelta de sincronización los
   * traería de vuelta, que es lo contrario de empezar de cero. Van a la
   * papelera como cualquier borrado, así que hay treinta días para arrepentirse.
   */
  const handleReiniciar = useCallback(async () => {
    setBorrados((prev) => [
      ...new Set([...prev, ...planteles.map((p) => p.id)]),
    ]);
    try {
      borrarTodasLasFotos();
    } catch {
      // Si las fotos no se pueden borrar, igual se limpia lo guardado.
    }
    await borrarTodo();
    setGuia({ activa: true, vistos: [] });

    setPlanteles([]);
    setActivoId('');
    setPredeterminadoId(null);
    setConfigId(null);
    setTeamsVisible(false);
    setResultadoId(null);
    setVista('lista');
  }, [planteles]);

  /**
   * Con un solo jugador no se puede convocar a dos ni armar equipos: esos
   * pasos esperan en vez de activarse y bloquear la pantalla.
   */
  const pasosBloqueados = useMemo<PasoGuia[]>(() => {
    const lista: PasoGuia[] = [];
    if (players.length < 2) lista.push('convocar');
    if (selectedIds.length < 2) lista.push('armar-equipos');
    return lista;
  }, [players.length, selectedIds.length]);

  const completarPaso = useCallback((paso: PasoGuia) => {
    setGuia((prev) => {
      if (prev.vistos.includes(paso)) return prev;
      const siguiente = { ...prev, vistos: [...prev.vistos, paso] };
      saveGuia(siguiente);
      return siguiente;
    });
  }, []);

  const apagarGuia = useCallback(() => {
    setGuia((prev) => {
      const siguiente = { ...prev, activa: false };
      saveGuia(siguiente);
      return siguiente;
    });
  }, []);

  /**
   * Los hitos que dependen del estado de la app. Los que pasan adentro de un
   * modal los marca el propio modal, que es quien sabe cuándo ocurrieron.
   */
  useEffect(() => {
    if (!ready || !guia.activa) return;
    if (planteles.length > 0) completarPaso('crear-plantel');
    if (players.length >= 1) completarPaso('agregar-jugador');
    if (players.length >= 2) completarPaso('segundo-jugador');
    if (tab === 'partido') completarPaso('ir-a-partido');
    if (selectedIds.length >= 2) completarPaso('convocar');
    if (split) completarPaso('armar-equipos');
  }, [
    ready,
    guia.activa,
    planteles.length,
    players.length,
    tab,
    selectedIds.length,
    split,
    completarPaso,
  ]);

  // Entra todo, aunque pase el tope del plan: perder planteles de un respaldo
  // sería peor que mostrarlos bloqueados. Cuáles se pueden usar lo decide
  // después la fecha de creación.
  const handleImportarPlanteles = useCallback((nuevos: Squad[]) => {
    setPlanteles((prev) => [...prev, ...nuevos]);
  }, []);

  /**
   * Acepta un plantel que te mandaron y lo guarda como uno más.
   *
   * Entra aunque pase el tope del plan, igual que al importar: perder algo que
   * alguien te mandó sería peor que verlo bloqueado. Cuáles se pueden usar lo
   * decide después el orden de llegada.
   */
  const handleAceptarEnvio = useCallback(async (id: string) => {
    const traido = await aceptarEnvio(id);
    const { planteles: nuevos } = planteesDesde([
      { nombre: traido.nombre, ...traido.datos },
    ]);
    if (nuevos.length > 0) {
      setPlanteles((prev) => [...prev, ...nuevos]);
      setActivoId(nuevos[0].id);
    }
    setEnvios((prev) => prev.filter((e) => e.id !== id));
  }, []);

  const handleRechazarEnvio = useCallback(async (id: string) => {
    await rechazarEnvio(id);
    setEnvios((prev) => prev.filter((e) => e.id !== id));
  }, []);

  /**
   * Mandar un plantel sube sus fotos: se guardan las URLs que quedaron.
   *
   * Con fecha nueva: si no, el servidor se quedaría con los jugadores sin foto
   * para siempre —el plantel ya figuraba como subido y nada lo volvería a
   * mandar—, y cambiar de teléfono traería las cartas vacías.
   */
  const handleFotosSubidas = useCallback((cambiado: Squad) => {
    setPlanteles((prev) =>
      prev.map((p) =>
        p.id === cambiado.id
          ? { ...cambiado, actualizado: new Date().toISOString() }
          : p
      )
    );
  }, []);

  /**
   * Sube lo que falta y trae lo que cambió.
   *
   * Corre sola después de cada cambio, con un respiro de por medio: mover un
   * deslizador de estadísticas dispara veinte cambios en dos segundos y no
   * tiene sentido mandar veinte veces el mismo plantel.
   *
   * No avisa de los errores. Sin señal esto va a fallar seguido y es normal:
   * lo que hay que mostrar no es un cartel cada vez, es que todavía queda algo
   * sin subir, y de eso se encarga `haySinSubir`.
   */
  const sincronizarAhora = useCallback(async () => {
    if (!sesion || sincronizando) return;
    // Doble llave: si lo de acá todavía figura de otra cuenta, no se sube nada.
    if (duenoLocal !== sesion.id) return;
    setSincronizando(true);
    try {
      const salida = await sincronizar(planteles, borradosPendientes, estadoSync);

      setEstadoSync(salida.estado);
      // Sólo si cambió algo: asignar el mismo arreglo dispararía otra vuelta.
      if (salida.planteles !== planteles) setPlanteles(salida.planteles);
      if (salida.borradosListos.length > 0) {
        const listos = new Set(salida.borradosListos);
        setBorrados((prev) => prev.filter((id) => !listos.has(id)));
      }
      if (!salida.faltaSubir) setUltimaCopia(new Date());
    } finally {
      setSincronizando(false);
    }
  }, [sesion, sincronizando, planteles, borradosPendientes, estadoSync, duenoLocal]);

  /*
   * El disparador: cualquier cambio en los planteles o en lo borrado deja la
   * sincronización agendada para dentro de un rato. Cada cambio nuevo corre el
   * reloj, así que se manda una sola vez cuando la persona deja de tocar.
   */
  useEffect(() => {
    if (!ready || !sesion || !haySinSubir) return;
    const reloj = setTimeout(sincronizarAhora, ESPERA_ANTES_DE_SUBIR);
    return () => clearTimeout(reloj);
  }, [ready, sesion, haySinSubir, sincronizarAhora]);

  /*
   * Y al entrar, una vuelta para traer lo que se haya hecho en otro teléfono.
   * Una sola vez por sesión: lo que llegue después llega por el aviso.
   */
  /*
   * Se guarda para qué sesión se hizo, y no un simple sí/no. Con un booleano
   * que se marcaba antes de llamar, si esa primera vuelta no llegaba a correr
   * —porque todavía no se sabía de quién eran los datos— no se reintentaba
   * nunca y la cuenta quedaba sin sus planteles hasta que se tocara algo.
   */
  const trajoDe = useRef<string | null>(null);
  useEffect(() => {
    if (!ready || !sesion || duenoLocal !== sesion.id) return;
    if (trajoDe.current === sesion.id) return;
    trajoDe.current = sesion.id;
    sincronizarAhora();
  }, [ready, sesion, duenoLocal, sincronizarAhora]);

  const enConfig = planteles.find((p) => p.id === configId) ?? null;

  // Sin las fuentes cargadas el texto saltaría de tipografía al aparecer.
  if (!ready || !fuentesListas || !tiempoCumplido || (hayNube && !sesionMirada)) {
    return (
      <>
        <Cargando />
        <StatusBar style="light" />
      </>
    );
  }

  /*
   * Sin cuenta no se entra. Todo lo que se hace se guarda en el servidor, así
   * que sin saber de quién es no hay dónde guardarlo.
   *
   * Se muestra la pantalla de cuenta sola, sin la barra de abajo: no hay a qué
   * otra sección ir, y una barra con dos pestañas que no llevan a ningún lado
   * es peor que no tenerla.
   */
  if (hayNube && !sesion) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <StatusBar style="light" />
        <View style={styles.marca}>
          <Logotipo size={30} />
        </View>
        <PerfilScreen
          sesion={null}
          cuantosPlanteles={planteles.length}
          ultimaCopia={null}
          haySinSubir={false}
          onRecuperado={() => {}}
        />
        {dialogo}
      </SafeAreaView>
    );
  }

  return (
    <ProveedorGuia
      activa={ready && guia.activa}
      completados={guia.vistos}
      bloqueados={pasosBloqueados}
      onCompletar={completarPaso}
      onSaltar={apagarGuia}
    >
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <StatusBar style="light" />

      {vistaReal === 'plantel' ? (
        <AppHeader
          titulo={activo?.nombre ?? 'Plantel'}
          subtitulo={
            tab === 'plantel'
              ? 'Plantel'
              : tab === 'partido'
              ? 'Armar partido'
              : tab === 'activos'
              ? 'Activos'
              : tab === 'historial'
              ? 'Historial'
              : 'Tabla'
          }
          onVolver={() => setVista('lista')}
          onConfig={() => setConfigId(activoId)}
        />
      ) : null}

      <Aparecer
        llave={vistaReal === 'lista' ? seccion : `${activoId}-${tab}`}
        style={styles.screen}
      >
        {vistaReal === 'lista' && seccion === 'perfil' ? (
          <PerfilScreen
            sesion={sesion}
            cuantosPlanteles={planteles.length}
            ultimaCopia={
              ultimaCopia
                ? ultimaCopia.toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })
                : null
            }
            haySinSubir={haySinSubir}
            onRecuperado={() => {
              // El que volvió está en el servidor: la próxima vuelta lo trae.
              setEstadoSync((prev) => ({ ...prev, hasta: null }));
              sincronizarAhora();
            }}
          />
        ) : vistaReal === 'lista' && seccion === 'amigos' ? (
          <AmigosScreen
            amigos={amigos}
            cargando={cargandoAmigos}
            tengoUsuario={Boolean(miUsuario)}
            onRecargar={revisarAmigos}
            onAbrir={setChatCon}
            onIrAPerfil={() => setSeccion('perfil')}
          />
        ) : vistaReal === 'lista' ? (
          <SquadsScreen
            planteles={planteles}
            predeterminadoId={predeterminadoId}
            onAbrir={handleAbrirPlantel}
            onConfig={setConfigId}
            limitePlanteles={limites(plan).planteles}
            activos={activos}
            motivoBloqueo={motivoBloqueado(plan)}
            avisoPro={AVISO_PRO}
            envios={envios}
            onAceptarEnvio={handleAceptarEnvio}
            onRechazarEnvio={handleRechazarEnvio}
            onNuevo={() => {
              if (hayLugar()) setNuevoVisible(true);
            }}
            hayLugar={hayLugar}
            onImportar={handleImportarPlanteles}
            onReiniciar={handleReiniciar}
          />
        ) : tab !== 'plantel' && tab !== 'partido' ? (
          <HistoryScreen
            players={players}
            partidos={partidos}
            ajustes={ajustes}
            vista={tab}
            onCargarResultado={(partido) => setResultadoId(partido.id)}
            onBorrarPartidos={handleBorrarPartidos}
          />
        ) : tab === 'plantel' ? (
          <PlayersScreen
            players={players}
            ajustes={ajustes}
            onAdd={() => {
              if (!dejaSeguir(puedeAgregarJugador(players.length, plan))) return;
              setEditing(null);
              setFormVisible(true);
            }}
            onEdit={(player) => {
              // Se edita la media base: si se mandara la ajustada, al guardar
              // el bono quedaría escrito y se volvería a sumar encima.
              setEditing(players.find((p) => p.id === player.id) ?? player);
              setFormVisible(true);
            }}
          />
        ) : (
          <MatchScreen
            players={players}
            ajustes={ajustes}
            format={format}
            onFormatChange={setFormat}
            usarTodos={usarTodos}
            onUsarTodosChange={setUsarTodos}
            selectedIds={selectedIds}
            onToggle={toggleSelected}
            onSelectAll={setSelectedIds}
            onClear={() => setSelectedIds([])}
            onBuild={handleBuild}
          />
        )}
      </Aparecer>

      {/*
        Adentro de un plantel manda la barra del plantel; afuera, la de las
        secciones. Nunca las dos: dos barras iguales una encima de la otra no
        se entienden.
      */}
      {vistaReal === 'plantel' ? (
        <TabBar activa={tab} onChange={setTab} />
      ) : (
        <NavPrincipal
          activa={seccion}
          onChange={setSeccion}
          pendientes={pendientesDeAmigos}
        />
      )}

      <PlayerFormModal
        visible={formVisible}
        player={editing}
        ajuste={editing ? ajustes[editing.id] : undefined}
        resumen={editing ? resumenDe(editing.id, partidos) : undefined}
        onClose={() => {
          setFormVisible(false);
          setEditing(null);
        }}
        onSave={handleSavePlayer}
        onDelete={handleDeletePlayer}
      />

      <SquadConfigModal
        visible={enConfig !== null}
        plantel={enConfig}
        esPredeterminado={enConfig?.id === predeterminadoId}
        haySesion={Boolean(sesion)}
        onFotosSubidas={handleFotosSubidas}
        onClose={() => setConfigId(null)}
        onGuardar={(cambios) =>
          enConfig && handleGuardarConfig(enConfig.id, cambios)
        }
        onBorrar={() => enConfig && handleBorrarPlantel(enConfig.id)}
      />

      <RecuperarModal
        pedido={recuperacion}
        onClose={() => setRecuperacion(null)}
        onListo={() => {
          setRecuperacion(null);
          setSeccion('perfil');
        }}
      />

      <ChatScreen
        con={chatCon}
        refrescos={refrescos}
        onClose={() => {
          setChatCon(null);
          revisarAmigos();
        }}
        onAceptar={handleAceptarEnvio}
        onRechazar={handleRechazarEnvio}
      />

      {dialogo}

      <NewSquadModal
        visible={nuevoVisible}
        onClose={() => setNuevoVisible(false)}
        onCrear={handleCrearPlantel}
      />

      <TeamsModal
        visible={teamsVisible}
        split={split}
        plantel={activo?.nombre ?? 'Plantel'}
        medias={medias}
        guardado={guardadoId !== null}
        onClose={() => setTeamsVisible(false)}
        onReshuffle={handleReshuffle}
        onGuardar={handleGuardarPartido}
        onSwap={handleSwap}
        onDescartar={() => {
          guardarSorteo(null);
          setTeamsVisible(false);
        }}
      />

      <MatchResultModal
        visible={resultadoId !== null}
        partido={partidos.find((p) => p.id === resultadoId) ?? null}
        onClose={() => setResultadoId(null)}
        onGuardar={handleGuardarResultado}
      />
      </SafeAreaView>
    </ProveedorGuia>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  screen: {
    flex: 1,
    paddingTop: spacing.lg,
  },
  marca: {
    alignItems: 'center',
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
  },
});
