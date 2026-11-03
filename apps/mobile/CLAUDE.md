# CLAUDE.md — apps/mobile

> Ver el `CLAUDE.md` raíz para alcance (v1/v2), stack, convenciones y formato de commits. Consultalo antes de implementar una feature.

App mobile con Expo / React Native. Priorizar patrones mobile-first, performance y compatibilidad entre plataformas.

## Expo cambió — no confiar en lo que sabés de memoria

Expo mete breaking changes en cada SDK. Las APIs que recordás probablemente se renombraron, se movieron o se eliminaron. Antes de escribir código que toque una API de Expo, EAS o React Native:

1. Leer la versión major del paquete `expo` en `package.json`.
2. Consultar la documentación de esa versión: `https://docs.expo.dev/versions/v<major>.0.0/`
3. Para todo lo demás, leer https://docs.expo.dev/llms.txt — un índice de toda la documentación de Expo con correcciones a errores comunes de los LLMs. Seguir sus links a la página específica; nunca responder de memoria.

## Comandos

Usamos Bun, así que siempre `bunx` en lugar de `npx`.

```bash
bunx expo install <paquete>  # usar SIEMPRE en lugar de bun add — resuelve versiones compatibles con el SDK
bunx expo start              # levantar el dev server
bunx expo lint               # lint
bunx tsc --noEmit            # typecheck
bunx expo-doctor             # diagnosticar problemas de dependencias y config
bunx expo install --fix      # arreglar versiones incompatibles
```

Correr lint y typecheck antes de dar una tarea por terminada.

## Navegación y rutas

- Usar **Expo Router** para toda la navegación. Las rutas viven en `src/app/` — cada archivo ahí es una pantalla, y los `_layout.tsx` definen los navegadores. Lo que no es ruta (componentes, hooks, utils) va fuera de `src/app/`.
- Importar `Link`, `router` y `useLocalSearchParams` desde `expo-router`.
- Docs: https://docs.expo.dev/router/introduction.md

## Builds con EAS

Usamos EAS para compilar, firmar y publicar la app en la nube (`eas build`, `eas submit`) y para mandar updates over-the-air (`eas update`) — no hace falta Xcode ni Android Studio local. Correr el CLI como `bunx eas-cli <comando>` en lugar de `eas` a secas como aparece en los ejemplos de la documentación. Ver `DEPLOY.md` en la raíz.
Docs: https://docs.expo.dev/eas/index.md

## Reglas

- Si no existen `ios/` y `android/`, se generan solos (Continuous Native Generation). Nunca crearlos ni editarlos a mano — el comportamiento nativo se configura en `app.json` y con config plugins.
- Expo Go solo incluye sus módulos nativos propios. Después de agregar una librería con código nativo, hace falta un development build (`bunx eas-cli build --profile development`) y un nuevo build `preview` para todos — un `eas update` no alcanza.
- Preferir los módulos recomendados de Expo antes que librerías de terceros, y revisar las skills disponibles antes de sumar dependencias. Docs: https://docs.expo.dev/versions/latest/index.md
- Textos de la UI en español; código en inglés.
