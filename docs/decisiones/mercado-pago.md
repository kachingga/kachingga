# Integración con Mercado Pago

**No es parte de ninguna versión.** Queda documentado qué se puede hacer y qué no, por si en algún momento se retoma. No implementar nada de esto sin que el grupo lo decida explícitamente.

Investigado el 3/11/2026. Las comisiones del link de pago salen de la página oficial de Mercado Pago Argentina; el resto, de fuentes no oficiales. Confirmarlas en la ayuda de Mercado Pago antes de decidir algo.

---

## Lo que queríamos

Que desde la app, al ver "le debés $7.775 a Tuke", se pueda **pagar directamente** con Mercado Pago, sin comisiones, y que la deuda quede marcada como pagada sola.

## Resumen

| Qué | ¿Se puede? | Comisión | Notas |
|-----|-----------|----------|-------|
| Mostrar el **alias/CVU** de cada uno y copiar alias + monto para transferir | ✅ Sí | No | No necesita ninguna integración: es un dato que carga cada uno |
| **Abrir la app de Mercado Pago** desde nuestra app | ❓ Probablemente (como cualquier link), sin probar | No | Abre la app en el inicio: el usuario pega el alias y el monto |
| Abrir Mercado Pago **con destinatario y monto ya cargados** para transferir | ❌ No (documentado) | — | No hay un link ni un esquema de URL oficial para eso. Ver "¿Abrir Mercado Pago con destinatario y monto ya cargados?" |
| **Link de pago** con monto fijo (el que cobra lo genera y lo comparte) | ✅ Sí | **Sí, al que cobra** (6,29% al instante) | Es una venta, no una transferencia |
| **Pagar dentro de nuestra app**, de una persona a otra, **sin comisión** | ❌ No | — | No existe en las APIs de Mercado Pago |
| Cobrar con la API (**Checkout Pro / link de pago**) | ✅ Sí | **Sí, al que recibe** | Mercado Pago lo trata como una venta |
| Enviar plata con la API (**Payouts**) | ✅ Sí, pero no sirve | ❓ No documentada | La plata sale de **una cuenta nuestra**. Usarla con la cuenta de cada amigo (OAuth) no está documentado y requeriría habilitación de Mercado Pago (ver abajo) |
| Marcar la deuda como pagada **automáticamente** | Solo con Checkout Pro (con comisión) | — | Con alias o abriendo Mercado Pago, se marca "ya pagué" a mano |

---

## Las formas de integrarlo

### A. Alias + abrir Mercado Pago (sin comisión) — la única viable

- Cada uno carga su **alias/CVU**. En "cómo quedar a mano": "Pagale $7.775 a Tuke — alias `tuke.mp` [Copiar alias] [Copiar monto] [Abrir Mercado Pago]".
- La transferencia se hace en la app de Mercado Pago (o del banco), es una **transferencia común entre cuentas: sin comisión**.
- Al volver, se toca "Ya pagué" y la app registra el pago manual (`Settlement`), como en la V1.
- **No se puede abrir Mercado Pago con el alias y el monto ya cargados** (ver la sección de abajo): a lo sumo se abre la app y el usuario pega lo que copió.
- Ojo con deudas en monedas "mantenidas" (ej. USD): una transferencia de Mercado Pago es en pesos.

### B. Cobro con la API (Checkout Pro / link de pago) — con comisión

- Cada uno vincula su cuenta de Mercado Pago a la app (OAuth). La app genera un cobro (link/QR) por el monto exacto y Mercado Pago avisa a la API cuando se pagó (webhook), que registra el pago sola.
- **Comisión para el que recibe** (página oficial del link de pago en Argentina, sin impuestos):
  - acreditación inmediata: **6,29%**;
  - a 10 días: 4,39%;
  - a 18 días: 3,39%;
  - a 35 días: 1,49%.
  - Con cuotas se suma el costo de las cuotas. Fuentes no oficiales hablan de 6,60% en provincia de Buenos Aires (Ingresos Brutos) y de "+ IVA".
- Ejemplo: una deuda de $100.000 cobrada al instante pierde **~$6.300 a $8.000** según impuestos.
- Complejidad alta: vincular cuentas, webhooks con validación de firma, y temas legales si la app fuera pública.
- Si alguna vez se hiciera: credenciales solo en la API (Railway), y el webhook como ruta Hono normal (no tRPC, porque lo llama Mercado Pago) que valida la firma antes de marcar algo como pagado.

### C. Payouts (API de envío de dinero) — no sirve

- Envía plata **desde una cuenta de Mercado Pago del integrador** (nuestra) hacia otras cuentas.
- No puede sacar plata de la cuenta de un amigo para dársela a otro.
- Para usarla, cada uno tendría que pagarnos primero (forma B, con comisión) y después nosotros reenviar: **quedaríamos con plata ajena** (riesgo legal). Además requiere habilitación de Mercado Pago.

### ¿Abrir Mercado Pago con destinatario y monto ya cargados?

La idea: un botón "Pagar con Mercado Pago" que abra la app de Mercado Pago en la pantalla de transferir, con el alias de Tuke y $7.775 ya puestos, y el usuario solo confirme. **No hay forma documentada de hacerlo.**

- **Sin link de transferencia.** La documentación de desarrolladores de Mercado Pago solo habla de *deep links* para **volver** a tu app después de un pago de Checkout (los define la app integradora, no Mercado Pago). No publica un esquema `mercadopago://` ni un link web para "transferir a este alias por este monto".
- **Lo que existe dentro de Mercado Pago no se puede disparar desde afuera:**
  - **Escanear el alias con la cámara:** Mercado Pago lee el alias y salta a la pantalla del monto. El monto se escribe a mano, y es un atajo dentro de su app, no un link.
  - **"Amigos" (pedir dinero / dividir gastos):** el que cobra le pide un monto a un contacto (por teléfono o mail) y el otro paga desde la notificación. Sin comisión con dinero en cuenta o débito; 7,25% con crédito (dato de 2020). Pero se inicia **dentro de Mercado Pago**, con los contactos del teléfono: no hay API ni link para crearlo desde nuestra app. *(Ojo: es competencia directa de lo que hace Kachingga para dividir gastos.)*
- **Lo único con monto precargado es el link de pago**, y es un **cobro con comisión** (6,29% al instante, ver la forma B). Lo genera el que cobra desde su app de Mercado Pago (o por API con OAuth). Entre amigos no tiene sentido.
- **QR interoperable (Transferencias 3.0, BCRA):** cualquier billetera lee el QR de cualquier otra, pero está pensado para cobros de comercios. No encontramos que una persona pueda generar un QR de transferencia con monto que se pague sin comisión.
- **Esquemas no documentados:** aunque alguien encuentre uno que funcione hoy (inspeccionando la app), **no usarlo**: puede dejar de andar en cualquier actualización, y la app quedaría con un botón roto.

**Conclusión:** lo mejor posible es **[Copiar alias] + [Copiar monto]** (lo de la V1). Un botón extra **[Abrir Mercado Pago]** que solo abra la app en el inicio ahorraría un paso como mucho. Habría que probar en iPhone y Android que el link abra la app y no la web, y agregarlo solo si el grupo lo pide.

### ¿Y usar Payouts con la cuenta de cada uno, para que yo le mande a mi amigo?

En teoría es lo único que se parece a "pagar desde la app", pero en la práctica no es viable:

1. **Permiso para sacar plata de cada cuenta.** Cada amigo tendría que vincular su cuenta a la app (OAuth) dándole permiso para **enviar dinero**. Es el permiso más sensible posible: si alguien compromete nuestro servidor, puede vaciar las cuentas de todos.
2. **Habilitación comercial por cuenta.** Payouts requiere que Mercado Pago lo habilite (según el foro de desarrolladores, a través de un asesor comercial y para cuentas de vendedor). No es algo que cada cuenta personal active sola.
3. **Comisión desconocida.** La documentación de Payouts no menciona costos: "sin comisión" no está confirmado.
4. **Sin documentación** que diga que Payouts funciona con la cuenta de un tercero autorizado por OAuth; la documentación lo describe con la cuenta del integrador.

Para saberlo con certeza habría que **preguntarle a Mercado Pago** (soporte para desarrolladores o un asesor comercial): "¿puede una app, con OAuth, iniciar transferencias desde la cuenta personal de un usuario hacia la de otro usuario, y con qué costo?".

---

## Conclusión

- **Pagar dentro de la app sin comisión no es posible.**
- **Abrir Mercado Pago con destinatario y monto ya cargados tampoco** (no hay link oficial para eso).
- Lo que sí se puede, gratis: **alias de cada uno + copiar alias y monto** (y quizás un botón que solo abra Mercado Pago). Eso es parte de la V1 y no necesita integración.
- Cobro automático con Checkout Pro: posible, pero con comisiones que no tienen sentido entre amigos.

## Fuentes

- Comisiones (no oficiales): [guiadebancos.com](https://www.guiadebancos.com/ar/blog/comisiones-mercado-pago-latam-2026) · [dptiendaonline.com](https://dptiendaonline.com/calculadora-cuotas-sin-interes-mercado-pago/) · [talo.com.ar](https://talo.com.ar/blogs/alternativas-mercado-pago)
- Link de pago (comisiones oficiales): [mercadopago.com.ar/herramientas-para-vender/link-de-pago](https://www.mercadopago.com.ar/herramientas-para-vender/link-de-pago) · [yo-facturo.com](https://yo-facturo.com/blog/link-de-pago-mercado-pago/) · [calcularsueldo.com.ar](https://calcularsueldo.com.ar/?p=13982)
- Deep links (solo para volver a la app integradora): [Checkout Pro mobile](https://www.mercadopago.com.mx/developers/es/docs/checkout-pro/mobile-integration/swift)
- Escanear alias con la cámara: [El Cronista](https://www.cronista.com/informacion-gral/el-truco-para-enviar-dinero-y-pagar-por-mercado-pago-escribir-el-alias-no-todos-lo-conocen-y-se-hace-con-la-camara-del-celular/)
- "Amigos" (pedir dinero / dividir gastos): [InfoNegocios (2020)](https://infonegocios.info/que-esta-pasando/sin-salir-de-casa-mercado-pago-presento-una-funcion-para-enviar-dinero-y-dividir-gastos)
- QR interoperable: [BCRA — Transferencias 3.0](https://www.bcra.gob.ar/noticias/transferencia-con-qr/)
- Payouts: [documentación](https://www.mercadopago.com.mx/developers/es/docs/payouts-v2/overview) · [foro de desarrolladores](https://groups.google.com/g/mercadopago-developers/c/s0gztUHgQ4w)
