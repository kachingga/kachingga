# Fourcount

App mobile para dividir gastos en grupo: viajes, departamentos compartidos, salidas con amigos. Cargás quién pagó qué, la app calcula cuánto debe cada uno y te dice cómo quedar a mano con la menor cantidad de transferencias.

Proyecto de uso personal.

## Features

### Grupos y gastos
- Crear grupos y sumar participantes (sin necesidad de que todos tengan cuenta).
- Cargar gastos indicando quién pagó y entre quiénes se divide.
- División en partes iguales, por monto o por porcentaje.
- Saldos por persona y sugerencia de transferencias mínimas para saldar deudas.
- Soporte multimoneda.

### Filtros
- Por participante (quién pagó / a quién le corresponde).
- Por categoría (comida, transporte, alojamiento, etc.).
- Por rango de fechas.
- Por rango de montos.
- Búsqueda por texto en la descripción.
- Filtros combinables y guardables.

### Agente de gastos
Un asistente con IA integrado en cada grupo que responde preguntas sobre los gastos en lenguaje natural:
- "¿Por qué le debo $15.000 a Juan?"
- "¿En qué gastamos más en el viaje?"
- "¿Cuánto puse yo en comida esta semana?"

El agente explica cómo se llegó a cada saldo, desglosando los gastos que lo componen.

### Integración con Mercado Pago
- Saldar deudas desde la app con Mercado Pago.
- Generar un link de pago o un QR por el monto exacto que se debe.
- Marcar la deuda como saldada automáticamente cuando se confirma el pago.
- Opción de saldar manualmente si el pago se hizo por fuera.

## Stack

> Stack inicial, puede cambiar a medida que avance el proyecto.

| Capa | Tecnología |
|------|------------|
| Mobile | React Native (Expo) |
| Backend | TypeScript con Hono y Bun |
| Base de datos | PostgreSQL |
| Agente | API de LLM con tool calling sobre los datos del grupo |
| Pagos | SDK / API de Mercado Pago |

## Instalación

> El proyecto de Expo todavía no está inicializado. Estos pasos van a funcionar una vez que lo esté.

```bash
git clone https://github.com/romanprs03/fourcount.git
cd fourcount
npm install
npx expo start
```

## Roadmap

- [x] Definir stack mobile (React Native con Expo)
- [x] Definir backend y base de datos (TypeScript con Hono y Bun, PostgreSQL)
- [ ] Inicializar el proyecto de Expo
- [ ] Inicializar el backend
- [ ] Modelo de datos (grupos, participantes, gastos, divisiones)
- [ ] CRUD de grupos y gastos
- [ ] Cálculo de saldos y transferencias mínimas
- [ ] Filtros
- [ ] Multimoneda
- [ ] Agente de gastos
- [ ] Integración con Mercado Pago
- [ ] Build para Android / iOS

## Autores

- [@romanprs03](https://github.com/romanprs03)
