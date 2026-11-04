# Datos de prueba (`db:seed`)

> **Aplica a:** `apps/api/scripts/seed.ts` y a quien necesite datos para probar la web o los E2E. **Si cambiás el seed, actualizá este archivo en el mismo PR.** Reglas cortas: `apps/api/CLAUDE.md`.

`bun run db:seed` (desde `apps/api/`) llena la base de **dev** con usuarios y grupos de prueba para ver el front con datos reales. Usa los procedures tRPC de verdad (mismas reglas de negocio que la app).

- **Usuarios** (contraseña = `SEED_USER_PASSWORD` del `.env`, se la pide a Galo): `juan.demo@example.com` (el principal), `tuke.demo@example.com`, `roman.demo@example.com`.
- **Grupos de Juan:**
  - **Viaje a Florianópolis:** todos los casos de moneda (ARS, USD convertido con el blue automático, BRL con tipo de cambio manual, USD y BRL mantenidos → 3 saldos) y las 3 formas de dividir. También: quien paga fuera de la división, alguien sin cuenta (Sofi), alias de la cuenta y por grupo, Román sin alias, pagos y un gasto borrado.
  - **Depto Palermo:** 6 meses de alquiler, servicios y súper (más de 50 gastos, para el scroll infinito) y 3 filtros guardados.
  - **Asado del sábado:** saldado (todos a mano).
  - **Bariloche 2025:** archivado.
  - **Cumple de Román:** vacío.
- **Correrlo de nuevo** borra los grupos donde participa algún usuario de prueba y los vuelve a crear. Las fechas son relativas a hoy (a las 12:00 UTC, como toda fecha de gasto), así que "este mes" siempre tiene datos. Si te uniste con tu cuenta a un grupo de prueba, eso también se borra.
- **La base de dev es compartida**: lo que cargues o borres probando lo ven todos.
- **Solo corre contra dev:** frena si `SUPABASE_URL` o `DATABASE_URL` no son de `kachingga-dev`. Nunca adaptarlo para prod.
- Si cambia una regla de negocio o un procedure que usa, actualizarlo (si no, falla al correrlo).
