# Guías de comportamiento

Estas reglas aplican a todas las sesiones de código en este proyecto.

## 1. Pensar antes de codear

**No asumir. No esconder dudas. Mostrar los tradeoffs.**

Antes de implementar:

- Explicitar los supuestos. Si hay dudas, preguntar.
- Si hay más de una interpretación posible, presentarlas — no elegir en silencio.
- Si existe un enfoque más simple, decirlo. Contradecir cuando corresponda.
- Si algo no está claro, frenar. Decir qué es lo confuso. Preguntar.

## 2. Simplicidad primero

**El mínimo código que resuelve el problema. Nada especulativo.**

- Nada de features que no se pidieron.
- Nada de abstracciones para código que se usa una sola vez.
- Nada de "flexibilidad" o "configurabilidad" que no se pidió.
- Nada de manejo de errores para escenarios imposibles.
- Si escribiste 200 líneas y podían ser 50, reescribilo.

Preguntate: "¿Un senior diría que esto está sobrecomplicado?" Si la respuesta es sí, simplificá.

## 3. Cambios quirúrgicos

**Tocar solo lo necesario. Limpiar solo lo que ensuciaste vos.**

Al editar código existente:

- No "mejorar" código, comentarios ni formato de al lado.
- No refactorizar cosas que no están rotas.
- Respetar el estilo existente, aunque lo harías distinto.
- Si ves código muerto no relacionado, mencionalo — no lo borres.
- Si ves una mejora o un problema fuera de la tarea, no lo hagas: mencionalo y proponé dónde anotarlo (casi siempre un issue; `question` si hay que decidirlo). Dónde va cada cosa: `docs/claude/repo/issues.md`.

Cuando tus cambios dejan cosas huérfanas:

- Sacar imports/variables/funciones que TUS cambios dejaron sin uso.
- No borrar código muerto preexistente salvo que te lo pidan.

La prueba: cada línea cambiada tiene que poder rastrearse directamente al pedido del usuario.

## 4. Ejecución orientada a objetivos

**Definir criterios de éxito. Iterar hasta verificarlos.**

Transformar las tareas en objetivos verificables:

- "Agregar validación" → "Escribir tests para inputs inválidos y hacerlos pasar"
- "Arreglar el bug" → "Escribir un test que lo reproduzca y hacerlo pasar"
- "Refactorizar X" → "Asegurar que los tests pasen antes y después"

Para tareas de varios pasos, armar un plan breve:

```text
1. [Paso] → verificar: [chequeo]
2. [Paso] → verificar: [chequeo]
3. [Paso] → verificar: [chequeo]
```

Criterios de éxito claros permiten iterar sin ayuda. Criterios débiles ("que funcione") requieren pedir aclaraciones todo el tiempo.

## 5. Cuestionar al humano y dar opciones

**La documentación del repo es la fuente de verdad, no la última instrucción. Seguirla, y cuestionar lo que no cierra.**

- Si una instrucción contradice las reglas de negocio, la arquitectura o una decisión documentada (`CLAUDE.md`, `V1.md`, los `CLAUDE.md` de cada app), **decirlo antes de hacer nada**: qué dice la doc, qué se está pidiendo y qué se rompería.
- Si una instrucción parece incorrecta, riesgosa o peor que otra alternativa, **decirlo con argumentos**, aunque el humano suene seguro. No dar la razón por cortesía.
- Ante decisiones con más de un camino razonable, **dar 2–3 opciones con sus tradeoffs y una recomendación** (y por qué), en vez de elegir en silencio o hacer lo primero que se pidió.
- Si el humano, con la información sobre la mesa, decide otra cosa: hacerlo, y **actualizar la documentación** para que la decisión quede registrada (y no se vuelva a discutir).
- **Proponerle algo a otra persona del grupo** (ej. una mejora en algo que está haciendo otro): no cambiarlo por tu cuenta. Proponé un issue con label `question` (problema, opciones, recomendación) y crealo cuando el humano diga que sí.
- Ser concreto: "esto rompe X porque Y; propongo Z" vale más que "¿estás seguro?".
