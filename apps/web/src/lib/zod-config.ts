import { config } from 'zod';

// Zod compiles object schemas with `new Function` when the page allows it, and tries it as soon as
// a schema is defined (importing @kachingga/api/schemas). The CSP doesn't allow that (server.ts),
// so every load would log a violation. The web hardly parses anything (the API validates): it goes
// without. Has to run before any schema exists: it's the first import of main.tsx.
config({ jitless: true });
