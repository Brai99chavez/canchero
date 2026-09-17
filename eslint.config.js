const expo = require('eslint-config-expo/flat');

/**
 * El linter está por una sola cosa que TypeScript no puede ver: el orden de
 * los hooks.
 *
 * Un `useState` o un `useEffect` puesto después de un `return` temprano se
 * ejecuta en unos dibujos y en otros no, y React tira la app entera cuando
 * cambia la cantidad. Eso ya pasó —se cerraba al entrar a un partido activo—
 * y el typecheck no dijo nada, porque para él es código válido.
 *
 * Por eso esa regla es error. Las demás están bajadas a propósito: un linter
 * que siempre falla es un linter que nadie corre, y entonces el día que
 * encuentra algo grave nadie lo ve.
 */
module.exports = [
  ...expo,
  {
    ignores: [
      'node_modules/**',
      '.expo/**',
      'dist/**',
      'docs/**',
      'servidor/**',
      'tools/**',
      '.tmp-prueba/**',
    ],
  },
  {
    rules: {
      // La que importa: rompe la app.
      'react-hooks/rules-of-hooks': 'error',

      /*
       * Apagada. Marca `useRef(new Animated.Value(0)).current` leído durante
       * el render, que es el patrón estándar y documentado de las animaciones
       * de React Native y está en toda la app. La regla existe por el
       * compilador de React, que acá no se usa: eran 53 avisos del mismo
       * modismo correcto, y con ese ruido la de arriba no se ve.
       */
      'react-hooks/refs': 'off',

      /*
       * Avisos, no errores. Casi todos son `setState` al abrirse un modal
       * para dejar el formulario en blanco, que es legítimo. Quedan a la
       * vista por si alguno esconde un renderizado de más.
       */
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/exhaustive-deps': 'warn',
    },
  },
];
