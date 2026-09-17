import { useNetworkState } from 'expo-network';

/**
 * Si el teléfono tiene internet.
 *
 * Se le pregunta al sistema y no al servidor: preguntarle al servidor si se
 * llega al servidor cuesta un pedido cada vez, y encima tarda todo lo que
 * tarda en darse por vencido. El sistema ya lo sabe sin pedir nada.
 *
 * Ante la duda, conectado. Un cartel de "sin conexión" que aparece cuando sí
 * hay es peor que no tener cartel: se le deja de creer, y entonces tampoco se
 * le va a creer cuando sea cierto. Por eso mientras el sistema todavía no
 * contestó —los primeros instantes, y algún Android que tarda— acá hay
 * internet.
 */
export function useHayInternet(): boolean {
  const estado = useNetworkState();
  /*
   * `isInternetReachable` es el que distingue la peor de las redes: la que
   * está conectada pero no llega a ningún lado —el WiFi del bar que primero
   * te hace aceptar unas condiciones—. Ahí `isConnected` dice que sí y no se
   * puede hacer nada.
   */
  return estado.isInternetReachable ?? estado.isConnected ?? true;
}
