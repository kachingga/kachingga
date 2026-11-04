import '@testing-library/jest-dom/vitest';

import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

afterEach(() => cleanup());

// The app formats in the browser's language; tests run as a browser in Argentina.
Object.defineProperty(window.navigator, 'language', { value: 'es-AR', configurable: true });
