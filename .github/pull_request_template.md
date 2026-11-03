<!-- Título del PR = Conventional Commit (ej. "feat(mobile): pantalla de grupos"). Queda como commit en main (squash). -->

## Qué cambia

<!-- Qué y por qué, en 2-3 líneas. Si toca una regla de negocio, cuál. -->

## Checklist

**Siempre**
- [ ] `bun run check` pasa (lo corre el CI igual)
- [ ] Cumple las reglas de negocio del `CLAUDE.md` raíz
- [ ] Docs actualizados si cambió algo: reglas de negocio (raíz), procedures/modelo (`apps/api/CLAUDE.md`), pantallas/roadmap (`V1.md`)

**Si toca la app (`apps/mobile`)**
- [ ] Cada pantalla con datos tiene los 4 estados: cargando (skeleton), vacío, error con reintentar, datos
- [ ] Mutations: botón deshabilitado mientras carga, invalidación de queries, optimistic update donde aplica
- [ ] Tests de contenido (`renderWithApi`) por estado + interacciones principales
- [ ] Probado en un teléfono real, en modo claro y oscuro
- [ ] Colores del tema, textos en español, montos con `formatMoney`

**Seguridad**
- [ ] No rompe ninguna regla de "Seguridad" del `CLAUDE.md` raíz (permisos por grupo, datos personales, secretos, CORS, RLS)
- [ ] Sin secretos en el código, los `.env.sample` ni la descripción del PR

**Si toca la API (`apps/api`)**
- [ ] Tests de integración: sin login, no miembro, grupo archivado (si escribe), caso feliz y reglas de negocio
- [ ] Procedure nuevo o cambiado → agregado en `authorization.test.ts`; si es caro o adivinable, con límite en `lib/rateLimit.ts`
- [ ] Si cambió el schema: migración con `db:migrate:new`, revisada y aplicada en dev (prod solo cuando se pida)

## Cómo probarlo

<!-- Pasos para verlo funcionar, o "cubierto por tests". -->
