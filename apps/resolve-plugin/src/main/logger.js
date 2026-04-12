import pino from "pino";
import fs from "fs";
import path from "path";

export function createPluginLogger({ logDir, level = "info" }) {
  fs.mkdirSync(logDir, { recursive: true });

  const date = new Date().toISOString().slice(0, 10);
  const logFile = path.join(logDir, `piece-studio-${date}.log`);

  const targets = [
    {
      target: "pino/file",
      options: { destination: logFile, mkdir: true },
      level,
    },
    { target: "pino/file", options: { destination: 1 }, level },
  ];

  const transport = pino.transport({ targets });
  const logger = pino({ level }, transport);

  logger.createComponentLogger = function createComponentLogger(name) {
    return logger.child({ component: name });
  };

  return logger;
}
