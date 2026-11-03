# Integración con Mercado Pago

**No es parte de ninguna versión.** Queda documentado qué se puede hacer y qué no, por si en algún momento se retoma. No implementar nada de esto sin que el grupo lo decida explícitamente.

Investigado el 3/11/2026. Las comisiones salen de fuentes no oficiales: confirmarlas en la ayuda de Mercado Pago antes de decidir algo.

---

## Lo que queríamos

Que desde la app, al ver "le debés $7.775 a Tuke", se pueda **pagar directamente** con Mercado Pago, sin comisiones, y que la deuda quede marcada como pagada sola.

## Resumen

| Qué | ¿Se puede? | Comisión | Notas |
|-----|-----------|----------|-------|
| Mostrar el **alias/CVU** de cada uno y copiar alias + monto para transferir | ✅ Sí | No | No necesita ninguna integración: es un dato que carga cada uno |
| **Abrir la app de Mercado Pago** desde nuestra app | ✅ Probablemente (como cualquier link) | No | El usuario termina la transferencia en Mercado Pago |
| Abrir Mercado Pago **con destinatario y monto ya cargados** | ❓ Sin confirmar | No | No encontramos documentación oficial de un link que lo permita |
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
- **Pendiente de investigar:** si Mercado Pago permite abrir su app con destinatario y monto precargados, o solo abrirla y que el usuario pegue el alias.
- Ojo con deudas en monedas "mantenidas" (ej. USD): una transferencia de Mercado Pago es en pesos.

### B. Cobro con la API (Checkout Pro / link de pago) — con comisión

- Cada uno vincula su cuenta de Mercado Pago a la app (OAuth). La app genera un cobro (link/QR) por el monto exacto y Mercado Pago avisa a la API cuando se pagó (webhook), que registra el pago sola.
- **Comisión para el que recibe** (fuentes no oficiales, no coinciden del todo):
  - acreditación inmediata: **~6,3–6,6% + IVA**;
  - a 14 días: ~3,4% + IVA;
  - a 30–35 días: ~1,5–1,8% + IVA.
- Ejemplo: una deuda de $100.000 cobrada al instante pierde **~$8.000**.
- Complejidad alta: vincular cuentas, webhooks con validación de firma, y temas legales si la app fuera pública.
- Si alguna vez se hiciera: credenciales solo en la API (Railway), y el webhook como ruta Hono normal (no tRPC, porque lo llama Mercado Pago) que valida la firma antes de marcar algo como pagado.

### C. Payouts (API de envío de dinero) — no sirve

- Envía plata **desde una cuenta de Mercado Pago del integrador** (nuestra) hacia otras cuentas.
- No puede sacar plata de la cuenta de un amigo para dársela a otro.
- Para usarla, cada uno tendría que pagarnos primero (forma B, con comisión) y después nosotros reenviar: **quedaríamos con plata ajena** (riesgo legal). Además requiere habilitación de Mercado Pago.

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
- Lo que sí se puede, gratis: **alias de cada uno + copiar alias y monto** (y quizás abrir Mercado Pago). Eso es parte de la V1 y no necesita integración.
- Cobro automático con Checkout Pro: posible, pero con comisiones que no tienen sentido entre amigos.

## Fuentes

- Comisiones (no oficiales): [guiadebancos.com](https://www.guiadebancos.com/ar/blog/comisiones-mercado-pago-latam-2026) · [dptiendaonline.com](https://dptiendaonline.com/calculadora-cuotas-sin-interes-mercado-pago/) · [talo.com.ar](https://talo.com.ar/blogs/alternativas-mercado-pago)
- Payouts: [documentación](https://www.mercadopago.com.mx/developers/es/docs/payouts-v2/overview) · [foro de desarrolladores](https://groups.google.com/g/mercadopago-developers/c/s0gztUHgQ4w)
