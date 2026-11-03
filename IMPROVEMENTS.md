# Mejoras de infraestructura

Pendientes de infraestructura, para ir haciendo de a poco. Cada ítem tiene su issue en GitHub (label `infra`). **Solo lo que falta:** cuando una mejora se termina, se borra de acá y lo que haya que saber queda en `DEPLOY.md`, `INFRA.md` o el `CLAUDE.md` que corresponda.

---

## 1. Activar EAS Update automático — [#6](https://github.com/kachingga/kachingga/issues/6)

El workflow ya existe (`.github/workflows/eas-update.yml`): al mergear a `main` un cambio de la app publica un update OTA. **Está inactivo** hasta que haya a quién mandárselo y un token.

**Falta:** Railway deployado ([#5](https://github.com/kachingga/kachingga/issues/5), bloqueado por presupuesto) → variables de prod en EAS (`production`) → primer build `preview` instalado → secret `EXPO_TOKEN` en GitHub. Pasos en `DEPLOY.md` → "Activar EAS Update automático".

**Criterio de éxito:** se mergea un PR de la app y al rato todos ven el cambio al abrir la app.

---

## 2. Entorno de staging (opcional) — [#7](https://github.com/kachingga/kachingga/issues/7)

**Ya hay base de dev** (`kachingga-dev`, ver `INFRA.md` → "Entornos"): las migraciones se prueban ahí antes de prod y todo lo local la usa.

**Falta (solo si hace falta más adelante):** una API de staging en Railway apuntando a `kachingga-dev` y un canal `staging` de EAS Update, para probar builds/updates sin tocar prod. Hoy no hace falta: se desarrolla en local contra dev.

---

## 3. Backup semanal de la base de datos — [#8](https://github.com/kachingga/kachingga/issues/8)

**Objetivo:** snapshot semanal de la DB de producción (`pg_dump`) guardado fuera de Supabase.
