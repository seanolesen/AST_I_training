// Isolates the vite-plugin-pwa virtual module so the rest of the app doesn't
// depend on it directly (and so it can be stubbed in tests).
import { registerSW } from "virtual:pwa-register";
export const registerServiceWorker = registerSW;
