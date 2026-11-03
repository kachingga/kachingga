# Contras: costos y limitaciones de seguir con Kachingga

Para decidir si vale la pena seguir con la app propia o volver a **Tricount**. Investigado el 3/11/2026; los precios cambian, así que antes de pagar algo conviene confirmarlo en la página oficial (links al final).

---

## TL;DR

- **Pagar "desde la app" de una persona a otra sin comisiones no existe** con las APIs de Mercado Pago. Lo único sin comisión es que la app **abra Mercado Pago con el alias y el monto** y la transferencia se haga ahí (después se marca "ya pagué" a mano).
- Usarla solo entre nosotros cuesta **~USD 13/mes + impuestos** (Railway + cuenta de Apple), **siempre que Supabase vuelva al plan gratis**. Hoy, con Supabase en Pro, son **~USD 48/mes + impuestos**.
- Tricount es **gratis**, sin publicidad y sin límites, y ya funciona. Lo que no tiene es lo nuestro: **dólar blue automático** y "mantener la deuda en USD".

---

## 1. Mercado Pago: ¿se puede pagar desde la app sin comisiones?

| Forma | Cómo funciona | Comisión | ¿Sirve? |
|-------|---------------|----------|---------|
| **A. Abrir Mercado Pago con el alias** | La app guarda el alias/CVU de cada uno. "Pagar" copia alias + monto y abre la app de Mercado Pago; se transfiere ahí y al volver se marca "ya pagué" | **No** (transferencia común) | ✅ Es lo único sin costo. No es "pagar dentro de la app": se termina en Mercado Pago y la confirmación es manual. Falta confirmar si se puede abrir Mercado Pago con destinatario y monto precargados o solo abrirla |
| **B. Cobro con la API (Checkout Pro / link de pago)** | Cada uno vincula su cuenta; la app genera un cobro por el monto exacto y Mercado Pago avisa cuando se pagó | **Sí, al que recibe**: ~6,3–6,6% + IVA con acreditación inmediata; ~3,4% + IVA a 14 días; ~1,5–1,8% + IVA a 30–35 días (fuentes no oficiales, no coinciden) | ❌ Una deuda de $100.000 cobrada al instante pierde ~$8.000 |
| **C. Payouts (API de envío de dinero)** | La plata sale **de una cuenta de Mercado Pago nuestra** hacia otra cuenta | — | ❌ No mueve plata de un amigo a otro. Habría que cobrar primero (forma B, con comisión) y después reenviar, **quedándonos con plata ajena** (riesgo legal). Además requiere habilitación de Mercado Pago |

**Conclusión:** la "integración con Mercado Pago" que diferenciaba a la app solo es viable sin costo como **atajo para abrir Mercado Pago** (forma A). Si eso no alcanza, la razón principal de la V2 desaparece.

---

## 2. Costos fijos

Precios en USD; a todo lo que se paga con tarjeta argentina en dólares se le suman impuestos (ver sección 3).

| Servicio | Para qué | Plan | Costo | ¿Hace falta para usarla entre nosotros? |
|----------|----------|------|-------|----------------------------------------|
| **Railway** | Hostear la API | Hobby | **USD 5/mes** (incluye USD 5 de uso; la API chica entra) — estimado por Galo: **~ARS 10.000/mes** con impuestos | ✅ Sí. El plan Free da USD 1/mes de uso: probablemente no alcanza para tenerla prendida todo el mes |
| **Supabase** | Base de datos + login | Free (hasta 2 proyectos: prod + dev) | **USD 0** — pero el proyecto **se pausa tras 1 semana sin uso** (la app deja de andar hasta reactivarlo) | ✅ Free alcanza |
| **Supabase hoy** | — | **Pro** (org `kachingga`) | **USD 25/mes + USD 10/mes** por el segundo proyecto (dev) = **USD 35/mes** | ❌ Pasarla a Free (ya planeado) |
| **Apple Developer** | Instalar la app en iPhone (TestFlight) | Individual | **USD 99/año** (~USD 8,25/mes) | ✅ Sí, sin esto no hay app en iPhone (Expo Go solo sirve para desarrollar) |
| **Google Play** | Publicar en Android | — | **USD 25** (una vez) | ❌ No: entre nosotros se instala el APK gratis. Solo para publicar |
| **Expo / EAS** | Builds y updates OTA | Free | **USD 0**: 15 builds Android + 15 iOS, 1.000 usuarios/mes de updates, cola de builds lenta | ✅ Free alcanza |
| **GitHub** | Repo y CI | Free | **USD 0** (repo público: Actions sin costo) | ✅ |

### Totales

| Escenario | USD/mes | USD/año | Por persona (5 personas) |
|-----------|---------|---------|--------------------------|
| **Mínimo entre nosotros** (Railway + Apple; Supabase Free) | ~13,25 | ~159 | ~USD 2,65/mes |
| **Como está hoy** (Supabase Pro + Railway + Apple) | ~48,25 | ~579 | ~USD 9,65/mes |
| **Publicada en las stores** (estimado: + Supabase Pro para que no se pause, + Google Play, + mail, dominio) | ~40+ | ~500+ | — |

*Sin impuestos. Con impuestos sumar ~23% fijo y un 30% de percepción recuperable (sección 3).*

---

## 3. Impuestos al pagar con tarjeta en dólares (Argentina, 2026)

- **IVA 21%** sobre servicios digitales del exterior (RG 4240): se paga igual con pesos o con dólares propios.
- **Ingresos Brutos** provincial: ~2% en CABA y Buenos Aires (varía por provincia).
- **Percepción 30%** a cuenta de Ganancias / Bienes Personales: **recuperable** si no pagás esos impuestos; no aplica si pagás el resumen con dólares propios.
- El Impuesto PAIS ya no rige (venció en diciembre de 2024).

---

## 4. Otros contras (no son plata)

- **Tiempo:** falta toda la app (pantallas, login) y lo hace una persona (Juan). Tricount ya está terminado.
- **Mantenimiento:** Expo saca un SDK nuevo varias veces por año; hay que actualizar dependencias, revisar que nada se rompa, y Apple/Google cambian requisitos.
- **TestFlight vence:** cada build de TestFlight dura **90 días**; aunque los updates OTA lleguen, hay que subir un build nuevo al menos cada 3 meses.
- **Pausas del plan gratis de Supabase:** si nadie la usa una semana (ej. en vacaciones sin gastos), la app deja de andar hasta que alguien la reactive desde el dashboard.
- **Responsabilidad:** los datos y la plata del grupo dependen de nuestro código, backups y seguridad.
- **Un solo pagador:** las cuentas (Apple, Railway) quedan a nombre de una persona.
- **Publicarla** suma requisitos legales y de las stores (`LANZAMIENTO.md` → Fase 2) y probablemente más costo.

---

## 5. Lo que tendríamos que Tricount no tiene

- **Dólar blue promedio automático** al cargar un gasto en USD (editable), en vez de cargar el tipo de cambio a mano.
- **"Mantener en USD"**: deudas que se saldan en dólares, separadas de las de pesos.
- **Atajo a Mercado Pago** con el alias y el monto (forma A), sin comisiones.
- Totales por filtro ("¿cuánto gasté en noviembre?") y filtros guardados a medida.
- Los datos son nuestros y la app se adapta a lo que queramos.

---

## 6. Alternativas

| App | Costo | Notas |
|-----|-------|-------|
| **Tricount** | Gratis, sin publicidad ni límites (según varias fuentes; hoy es de bunq) | Lo que ya usamos |
| **Splitwise** | Gratis con publicidad y **3–4 gastos por día**; Pro ~USD 40–50/año | El límite diario lo hace incómodo en un viaje |

---

## Fuentes

- Railway: [planes](https://docs.railway.com/reference/pricing/plans)
- Supabase: [precios](https://supabase.com/pricing) · [facturación y proyectos gratis](https://supabase.com/docs/guides/platform/billing-on-supabase)
- Expo / EAS: [precios](https://expo.dev/pricing)
- Mercado Pago comisiones (no oficiales, verificar en la ayuda de Mercado Pago): [guiadebancos.com](https://www.guiadebancos.com/ar/blog/comisiones-mercado-pago-latam-2026) · [dptiendaonline.com](https://dptiendaonline.com/calculadora-cuotas-sin-interes-mercado-pago/) · [talo.com.ar](https://talo.com.ar/blogs/alternativas-mercado-pago)
- Mercado Pago Payouts: [documentación](https://www.mercadopago.com.mx/developers/es/docs/payouts-v2/overview) · [foro de desarrolladores](https://groups.google.com/g/mercadopago-developers/c/s0gztUHgQ4w)
- Impuestos: [nacho.com.ar (RG 4240)](https://nacho.com.ar/iva-netflix-cobraran-el-impuesto-a-los-usuarios-de-servicios-digitales/) · [global66](https://www.global66.com/blog/como-afectan-los-impuestos-a-tus-gastos-digitales/) · [economis.com.ar (fin del Impuesto PAIS)](https://economis.com.ar/desde-2026-pagar-con-tarjeta-en-dolares-cuesta-menos-tras-el-fin-del-impuesto-pais/)
- Tricount / Splitwise (blogs comparativos, verificar en las stores): [app-partly](https://app-partly.web.app/en/blog/splitwise-vs-tricount-vs-partly-2026/) · [endlesstravelplans](https://www.endlesstravelplans.com/guides/family-dynamics/family-trip-cost-splitting-2026)
