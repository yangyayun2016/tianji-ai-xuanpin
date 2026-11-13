import { beforeEach, vi } from 'vitest';

declare const jsdom: { window: Window };

// Node 26 exposes its own localStorage; browser tests must use jsdom's store.
const storage = jsdom.window.localStorage;
vi.stubGlobal('localStorage', storage);

beforeEach(() => {
  storage.clear();
});
