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
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { buildTeams } from './src/balance';
import AppHeader from './src/components/AppHeader';
import { PasoGuia, ProveedorGuia } from './src/components/Guia';
import { Aparecer } from './src/components/motion';
import TabBar from './src/components/TabBar';
import { borrarTodasLasFotos, cleanupPhotos } from './src/photos';
import Cargando from './src/screens/Cargando';
import CuentaModal from './src/screens/CuentaModal';
import HistoryScreen from './src/screens/HistoryScreen';
import MatchResultModal from './src/screens/MatchResultModal';
import MatchScreen from './src/screens/MatchScreen';
import PlayerFormModal from './src/screens/PlayerFormModal';
import NewSquadModal from './src/screens/NewSquadModal';
import PlayersScreen from './src/screens/PlayersScreen';
import SquadConfigModal, {
  CambiosPlantel,
} from './src/screens/SquadConfigModal';
import SquadsScreen from './src/screens/SquadsScreen';
import TeamsModal from './src/screens/TeamsModal';
import { hayNube } from './src/nube/cliente';
import {
  alCambiarSesion,
  planDeLaCuenta,
  sesionActual,
  Sesion,
} from './src/nube/cuenta';
import { bajar, marcarBorrado, subir } from './src/nube/sync';
import {
  idsActivos,
  limites,
  motivoBloqueado,
  Permiso,
  Plan,
  PLAN,
  puedeAgregarJugador,
  puedeCrearPlantel,
} from './src/plan';
import { bancoPrevio, resumenDe } from './src/stats';
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

/** Avisa si la acción no entra en el plan y dice si se puede seguir. */
function dejaSeguir(permiso: Permiso): boolean {
  if (permiso.ok) return true;
  Alert.alert(permiso.titulo, permiso.motivo);
  return false;
}

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
  const [cuentaVisible, setCuentaVisible] = useState(false);
  const [ultimaCopia, setUltimaCopia] = useState<Date | null>(null);
  // El plan sale del servidor cuando hay cuenta. Sin cuenta, el de siempre.
  const [plan, setPlan] = useState<Plan>(PLAN);

  // La sesión puede cambiar desde el modal o sola, cuando vence el token.
  useEffect(() => {
    if (!hayNube) return;
    sesionActual().then(setSesion);
    return alCambiarSesion(setSesion);
  }, []);

  useEffect(() => {
    if (!sesion) {
      setPlan(PLAN);
      setUltimaCopia(null);
      return;
    }
    planDeLaCuenta().then(setPlan);
  }, [sesion]);

  useEffect(() => {
    loadGuia().then(setGuia);
    loadPlanteles().then((guardado) => {
      setPlanteles(guardado.planteles);
      setActivoId(guardado.activoId);
      setPredeterminadoId(guardado.predeterminadoId);
      setVista(guardado.predeterminadoId ? 'plantel' : 'lista');
      setReady(true);
    });
  }, []);

  // Persiste los planteles en el celular ante cualquier cambio.
  useEffect(() => {
    if (!ready) return;
    savePlanteles({ planteles, activoId, predeterminadoId });
  }, [planteles, activoId, predeterminadoId, ready]);

  /**
   * El respaldo sube solo, un rato después del último cambio: guardar en cada
   * tecleada sería una llamada por letra. Que falle no molesta a nadie —se
   * reintenta con el cambio siguiente— así que no interrumpe con un cartel.
   */
  useEffect(() => {
    if (!ready || !sesion || planteles.length === 0) return;
    const id = setTimeout(() => {
      subir(planteles)
        .then(() => setUltimaCopia(new Date()))
        .catch(() => {});
    }, 2500);
    return () => clearTimeout(id);
  }, [planteles, sesion, ready]);

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

  /** Aplica un cambio sólo al plantel que se está usando. */
  const editarPlantel = useCallback(
    (cambio: (plantel: Squad) => Squad) => {
      setPlanteles((prev) =>
        prev.map((p) => (p.id === activoId ? cambio(p) : p))
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
      setFormVisible(false);
      setEditing(null);
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
          avoid,
        }),
        null
      );
      setTeamsVisible(true);
    },
    [players, selectedIds, format, usarTodos, partidos, guardarSorteo]
  );

  const handleGuardarPartido = useCallback(() => {
    if (!split) return;
    const nombres: Record<string, string> = {};
    for (const p of [...split.teamA, ...split.teamB, ...split.bench]) {
      nombres[p.id] = p.nombre;
    }
    const partido: Partido = {
      id: newId(),
      fecha: new Date().toISOString(),
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

  const handleBorrarPartido = useCallback(
    (id: string) => {
      editarPartidos((prev) => prev.filter((p) => p.id !== id));
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

      // Si no se marcara, el plantel volvería la próxima vez que se restaure.
      if (sesion) marcarBorrado(id).catch(() => {});

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
    [planteles, activoId, predeterminadoId, sesion]
  );

  /** Deja la app como recién instalada: sin planteles, sin fotos, sin nada. */
  const handleReiniciar = useCallback(async () => {
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
  }, []);

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

  const handleGuardarAhora = useCallback(async () => {
    if (!sesion) return;
    await subir(planteles);
    setUltimaCopia(new Date());
  }, [planteles, sesion]);

  /**
   * Traer reemplaza en vez de mezclar: sin una fecha de modificación por
   * plantel no hay forma de saber cuál de las dos copias es la buena, y
   * adivinar mal se lleva puestos datos que alguien cargó a mano.
   */
  const handleRestaurar = useCallback(() => {
    Alert.alert(
      'Traer de la nube',
      'Los planteles de este teléfono se reemplazan por los de tu cuenta. Si acá tenés algo que no subiste, se pierde.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Traer',
          style: 'destructive',
          onPress: () => {
            bajar()
              .then((traidos) => {
                if (traidos.length === 0) {
                  Alert.alert(
                    'No hay nada guardado',
                    'Tu cuenta todavía no tiene planteles.'
                  );
                  return;
                }
                setPlanteles(traidos);
                setActivoId(traidos[0].id);
                setPredeterminadoId(null);
                setVista('lista');
                setCuentaVisible(false);
                Alert.alert(
                  'Listo',
                  `Se trajeron ${traidos.length} ${
                    traidos.length === 1 ? 'plantel' : 'planteles'
                  }.`
                );
              })
              .catch((error) =>
                Alert.alert('No se pudo traer', String(error?.message ?? error))
              );
          },
        },
      ]
    );
  }, []);

  const enConfig = planteles.find((p) => p.id === configId) ?? null;

  // Sin las fuentes cargadas el texto saltaría de tipografía al aparecer.
  if (!ready || !fuentesListas) {
    return (
      <>
        <Cargando />
        <StatusBar style="light" />
      </>
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
              ? 'En juego'
              : tab === 'historial'
              ? 'Jugados'
              : 'Tabla'
          }
          onVolver={() => setVista('lista')}
          onConfig={() => setConfigId(activoId)}
        />
      ) : null}

      <Aparecer
        llave={vistaReal === 'lista' ? 'lista' : `${activoId}-${tab}`}
        style={styles.screen}
      >
        {vistaReal === 'lista' ? (
          <SquadsScreen
            planteles={planteles}
            predeterminadoId={predeterminadoId}
            onAbrir={handleAbrirPlantel}
            onConfig={setConfigId}
            limitePlanteles={limites(plan).planteles}
            activos={activos}
            motivoBloqueo={motivoBloqueado(plan)}
            sesion={hayNube ? sesion : undefined}
            onCuenta={() => setCuentaVisible(true)}
            onNuevo={() => {
              if (dejaSeguir(puedeCrearPlantel(planteles.length, plan))) {
                setNuevoVisible(true);
              }
            }}
            onImportar={handleImportarPlanteles}
            onReiniciar={handleReiniciar}
          />
        ) : tab !== 'plantel' && tab !== 'partido' ? (
          <HistoryScreen
            players={players}
            partidos={partidos}
            vista={tab}
            onCargarResultado={(partido) => setResultadoId(partido.id)}
            onBorrarPartido={handleBorrarPartido}
          />
        ) : tab === 'plantel' ? (
          <PlayersScreen
            players={players}
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
            format={format}
            onFormatChange={setFormat}
            usarTodos={usarTodos}
            onUsarTodosChange={setUsarTodos}
            selectedIds={selectedIds}
            onToggle={toggleSelected}
            onSelectAll={() => setSelectedIds(players.map((p) => p.id))}
            onClear={() => setSelectedIds([])}
            onBuild={handleBuild}
            haySorteo={split !== null}
            onVerSorteo={() => setTeamsVisible(true)}
          />
        )}
      </Aparecer>

      {vistaReal === 'plantel' ? <TabBar activa={tab} onChange={setTab} /> : null}

      <PlayerFormModal
        visible={formVisible}
        player={editing}
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
        onClose={() => setConfigId(null)}
        onGuardar={(cambios) =>
          enConfig && handleGuardarConfig(enConfig.id, cambios)
        }
        onBorrar={() => enConfig && handleBorrarPlantel(enConfig.id)}
      />

      <CuentaModal
        visible={cuentaVisible}
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
        onClose={() => setCuentaVisible(false)}
        onGuardarAhora={handleGuardarAhora}
        onRestaurar={handleRestaurar}
      />

      <NewSquadModal
        visible={nuevoVisible}
        onClose={() => setNuevoVisible(false)}
        onCrear={handleCrearPlantel}
      />

      <TeamsModal
        visible={teamsVisible}
        split={split}
        format={format}
        plantel={activo?.nombre ?? 'Plantel'}
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
});
