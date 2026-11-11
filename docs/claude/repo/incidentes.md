# Incidentes de seguridad con datos personales

> **Aplica a:** cuando alguien sin permiso pudo ver, copiar, cambiar o borrar datos de usuarios de prod, o hay señales de que pasó. Lo recomienda la Res. AAIP 47/2018 (Anexo I, punto G), que acompaña la Ley 25.326 (#157). **Si cambia cómo respondemos, actualizá este archivo en el mismo PR.** Las reglas cortas están en el `CLAUDE.md` raíz → "Seguridad".

## Qué es un incidente

- **Sí es:** se usó una falla de permisos para leer o tocar grupos ajenos; se filtraron la base, un backup junto con su passphrase, o los datos de un export; entraron a una cuenta de un servicio con datos (Supabase, Railway, GitHub, Resend, Sentry, Cloudflare, Lovable); alguien cambió alias de cobro o gastos que no eran suyos.
- **Todavía no es** (pero se maneja igual de rápido):
  - **Un secreto filtrado sin señales de uso:** `CLAUDE.md` → "Seguridad" → "Si se filtra un secreto".
  - **Una vulnerabilidad avisada que nadie usó:** un *security advisory* privado.
  - Cualquiera de los dos pasa a ser un incidente si aparece una señal de que se accedió a datos.
- **Cómo se detecta:** un aviso (`hola@kachingga.com` o Security → Report a vulnerability, ver `kachingga.com/seguridad`), Sentry, UptimeRobot, el aviso de tamaño del backup (`DEPLOY.md` → "Monitoreo"), una alerta de escaneo de secretos de GitHub o algo raro en la app (un alias que nadie cambió, gastos que desaparecen).

## Quién

- **Responsable: Galo**, que figura como responsable de los datos en la política de privacidad y es el dueño de las cuentas (`INFRA.md` → "Accesos"). Decide qué se hace y es quien avisa a los usuarios y a la AAIP.
- **Quien lo detecta le avisa por privado** (el chat del grupo), nunca en un issue, un PR ni un commit: el repo es público.

## Pasos

1. **Contener, enseguida.** Cortar el acceso antes de investigar:
   - rotar lo que pueda estar comprometido ("Si se filtra un secreto");
   - banear en Supabase (Authentication → Users, o la API de admin con `ban_duration`) la cuenta que abusa o la que comprometieron;
   - si la falla está en el código, sacarla de prod: *Redeploy* del deploy anterior en Railway, o un `revert` en `main` y `bun run promote` (`DEPLOY.md` → "Rollback");
   - si no hay otra forma, bajar el servicio `api` de prod en Railway: la app deja de andar, pero nadie más accede a los datos.
2. **Guardar la evidencia** antes de que se pierda. Los logs de Railway y de Supabase duran poco: bajarlos o sacar capturas. Lo mismo con los eventos de Sentry. Anotar desde el principio qué se vio y a qué hora.
3. **Evaluar:** qué pasó, desde cuándo, cómo, **qué datos** (los de la política de privacidad: email, alias y CVU/CBU, gastos, pagos…) y **de qué usuarios**. Si se cambiaron o borraron datos, ver si hay que restaurarlos desde un backup (`DEPLOY.md` → "Restaurar": en una base aparte, nunca encima de prod sin pensarlo).
4. **Arreglar** la causa por un *security advisory* privado, como cualquier vulnerabilidad (`CLAUDE.md` → "Seguridad"), y pasarla a prod.
5. **Avisar.** Apenas se sepa qué datos se afectaron y de quiénes; no hace falta esperar a tener el informe completo. No encontramos un plazo legal fijo.
   - **A los usuarios afectados, por mail** desde Resend (la cuenta de Galo), con `no-responder@kachingga.com` como remitente y `hola@kachingga.com` para responder. Los emails salen de la base (`auth.users`). El mail dice:
     - qué pasó y cuándo;
     - qué datos suyos se afectaron;
     - qué hicimos;
     - qué conviene que hagan: cambiar la contraseña si hace falta, y **antes de transferir, revisar que el nombre del destinatario que muestra su banco sea el esperado**, si pudieron cambiar alias;
     - a quién escribir.
   - **Si no se puede saber a quiénes afectó, o son más de 100** (el tope diario del plan gratis de Resend), además un aviso en `kachingga.com`.
   - **A la AAIP:** el informe del paso 6, por mail a `incidente.seguridad@aaip.gob.ar` (la dirección que nombra la Res. 47/2018).
6. **Dejar el informe** en el *security advisory* privado del incidente. Tiene que decir:
   - cuándo se detectó y cómo;
   - qué pasó;
   - qué datos y qué usuarios se afectaron;
   - qué se hizo y cuándo;
   - a quién se avisó y cuándo;
   - qué se cambió para que no vuelva a pasar.

## Después

- **Que no vuelva a pasar:** un test que lo cubra (si fue de permisos, en `authorization.test.ts`) y el doc que corresponda actualizado.
- **Si cambió qué datos se guardan o quién los recibe,** actualizar la política de privacidad y la inscripción en la AAIP (#139).
- **Publicar el advisory** recién con el arreglo en prod, como siempre. Cuenta la falla y el arreglo, nunca datos de los usuarios afectados.
