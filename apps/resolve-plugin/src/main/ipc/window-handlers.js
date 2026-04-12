import { WINDOW_CHANNELS } from "../../shared/ipc-channels.js";

export function registerWindowHandlers(handlers, { windowManager }) {
  handlers[WINDOW_CHANNELS.expand] = () => {
    windowManager.expand();
  };

  handlers[WINDOW_CHANNELS.collapse] = () => {
    windowManager.collapse();
  };

  handlers[WINDOW_CHANNELS.getMode] = () => {
    return windowManager.getMode();
  };

  handlers[WINDOW_CHANNELS.hideTemporarily] = () => {
    windowManager.hideTemporarily();
  };

  handlers[WINDOW_CHANNELS.showAgain] = () => {
    windowManager.showAgain();
  };
}
