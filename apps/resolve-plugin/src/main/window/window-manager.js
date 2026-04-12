const BUBBLE_SIZE = { width: 80, height: 80 };
const EXPANDED_SIZE = { width: 420, height: 640 };

export function createWindowManager({ win, logger }) {
  let mode = "bubble";

  function expand() {
    if (mode === "expanded") return;
    mode = "expanded";
    win.setSize(EXPANDED_SIZE.width, EXPANDED_SIZE.height);
    win.webContents.send("window:mode-changed", "expanded");
    logger.info("Window expanded");
  }

  function collapse() {
    if (mode === "bubble") return;
    mode = "bubble";
    win.setSize(BUBBLE_SIZE.width, BUBBLE_SIZE.height);
    win.webContents.send("window:mode-changed", "bubble");
    logger.info("Window collapsed to bubble");
  }

  function hideTemporarily() {
    win.hide();
    logger.debug("Window hidden temporarily");
  }

  function showAgain() {
    win.show();
    logger.debug("Window shown again");
  }

  function getMode() {
    return mode;
  }

  return { expand, collapse, hideTemporarily, showAgain, getMode };
}
