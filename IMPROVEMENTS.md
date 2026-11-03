# Mejoras de infraestructura

Tareas de infraestructura pendientes, para ir haciendo de a poco.

---

## 1. EAS Update automático en push a `main`

**Objetivo:** que nadie tenga que correr `eas update` a mano.

**Plan:**
- `.github/workflows/eas-update.yml` con `expo/expo-github-action`
- En push a `main` que toque `apps/mobile/**`: `eas update --channel main --auto`
- Secret `EXPO_TOKEN` en GitHub

**Criterio de éxito:** se mergea un PR y al rato todos ven el cambio al abrir la app.

---

## 2. CI en Pull Requests

**Objetivo:** typecheck y lint automáticos en cada PR.

**Plan:**
- `.github/workflows/ci.yml`: en `pull_request` a `main`, instalar con Bun y correr typecheck/lint de `apps/mobile` y `apps/api`
- Validar el título del PR con Conventional Commits (squash merge usa el título como mensaje)
- Branch protection en `main`

**Criterio de éxito:** un PR con errores de tipos muestra un check rojo y no se puede mergear.

---

## 3. Entorno de staging

**Objetivo:** probar migraciones y deploys sin tocar los datos reales del grupo.

**Plan:** segunda DB + segundo servicio de Railway + canal `staging` de EAS Update.

---

## 4. Backup semanal de la base de datos

**Objetivo:** snapshot semanal de la DB de producción (`pg_dump`) guardado fuera del proveedor.
