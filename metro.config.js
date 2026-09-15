const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

/**
 * La API vive en `servidor/`, dentro de esta misma carpeta. Metro recorre todo
 * el proyecto buscando código, así que sin esto se metería en las dependencias
 * del servidor y rompería el empaquetado con módulos duplicados o con paquetes
 * de Node que no existen en el celular.
 *
 * El servidor no se empaqueta nunca: se deploya aparte.
 */
const config = getDefaultConfig(__dirname);

const servidor = path.resolve(__dirname, 'servidor');
config.resolver.blockList = [
  new RegExp(`^${servidor.replace(/[\\/]/g, '[\\\\/]')}[\\\\/].*`),
];
config.watchFolders = [];

module.exports = config;
