import { generateNanoBanana } from "./services/nano-banana.js";
import { classifyIntent } from "./services/classify-intent.js";
import {
  createTask as createSjinnTask,
  pollTask as pollSjinnTask,
} from "./services/sjinn.js";
import {
  createTask as createTripoTask,
  pollTask as pollTripoTask,
} from "./services/photo-to-3d.js";
import { generateAmbientImage } from "./services/ambient-image.js";
import { enhancePrompt } from "./services/ambient-prompt.js";
import { smartDistribute } from "./services/smart-distribute.js";
import { createComponentLogger } from "../../utils/logger.js";

const componentLogger = createComponentLogger("AiToolsController");

async function nanoBanana(req, res) {
  try {
    const { prompt, referenceImages, stylePrompt } = req.body;

    if (!prompt || typeof prompt !== "string") {
      return res
        .status(400)
        .json({ error: "VALIDATION_ERROR", message: "prompt is required" });
    }

    const { buffer, mimeType } = await generateNanoBanana({
      prompt,
      referenceImages,
      stylePrompt,
    });

    res.set("Content-Type", mimeType);
    res.set("Cache-Control", "public, max-age=31536000");
    res.send(buffer);
  } catch (error) {
    componentLogger.error("Nano banana failed", { error: error.message });
    res.status(500).json({ error: "INTERNAL_ERROR", message: error.message });
  }
}

async function ambientImage(req, res) {
  try {
    const { prompt } = req.body;

    if (!prompt || typeof prompt !== "string") {
      return res
        .status(400)
        .json({ error: "VALIDATION_ERROR", message: "prompt is required" });
    }

    const { buffer, mimeType } = await generateAmbientImage({ prompt });

    res.set("Content-Type", mimeType);
    res.set("Content-Length", String(buffer.length));
    res.send(buffer);
  } catch (error) {
    componentLogger.error("Ambient image failed", { error: error.message });
    res.status(500).json({ error: "INTERNAL_ERROR", message: error.message });
  }
}

async function ambientPrompt(req, res) {
  try {
    const { description } = req.body;

    if (!description || typeof description !== "string") {
      return res
        .status(400)
        .json({
          error: "VALIDATION_ERROR",
          message: "description is required",
        });
    }

    const result = await enhancePrompt({ description });
    res.json(result);
  } catch (error) {
    componentLogger.error("Ambient prompt failed", { error: error.message });
    res.status(500).json({ error: "INTERNAL_ERROR", message: error.message });
  }
}

async function classifyIntentHandler(req, res) {
  try {
    const { input, system } = req.body;

    if (!input || typeof input !== "string") {
      return res.set("Content-Type", "text/plain").send("chat");
    }

    const result = await classifyIntent({ input, system });
    res.set("Content-Type", "text/plain").send(result);
  } catch (error) {
    componentLogger.error("Classify intent failed", { error: error.message });
    res.set("Content-Type", "text/plain").send("chat");
  }
}

async function sjinnCreate(req, res) {
  try {
    const { tool_type, input } = req.body;

    if (!tool_type || !input) {
      return res
        .status(400)
        .json({
          error: "VALIDATION_ERROR",
          message: "tool_type and input are required",
        });
    }

    const result = await createSjinnTask({ toolType: tool_type, input });
    res.json(result);
  } catch (error) {
    componentLogger.error("SJinn create failed", { error: error.message });
    res.status(500).json({ error: "INTERNAL_ERROR", message: error.message });
  }
}

async function sjinnPoll(req, res) {
  try {
    const { taskId } = req.params;

    if (!taskId) {
      return res
        .status(400)
        .json({ error: "VALIDATION_ERROR", message: "taskId is required" });
    }

    const result = await pollSjinnTask(taskId);
    res.json(result);
  } catch (error) {
    componentLogger.error("SJinn poll failed", { error: error.message });
    res.status(500).json({ error: "INTERNAL_ERROR", message: error.message });
  }
}

async function photoTo3dCreate(req, res) {
  try {
    const { image } = req.body;

    if (!image) {
      return res
        .status(400)
        .json({ error: "VALIDATION_ERROR", message: "image is required" });
    }

    const result = await createTripoTask({ image });
    res.json(result);
  } catch (error) {
    componentLogger.error("Photo-to-3D create failed", {
      error: error.message,
    });
    res.status(500).json({ error: "INTERNAL_ERROR", message: error.message });
  }
}

async function photoTo3dPoll(req, res) {
  try {
    const { taskId } = req.params;

    if (!taskId) {
      return res
        .status(400)
        .json({ error: "VALIDATION_ERROR", message: "taskId is required" });
    }

    const result = await pollTripoTask(taskId);
    res.json(result);
  } catch (error) {
    componentLogger.error("Photo-to-3D poll failed", { error: error.message });
    res.status(500).json({ error: "INTERNAL_ERROR", message: error.message });
  }
}

async function smartDistributeHandler(req, res) {
  try {
    const { segments, sections, scriptText } = req.body;

    if (!segments || !sections || !scriptText) {
      return res.status(400).json({
        error: "VALIDATION_ERROR",
        message: "segments, sections, and scriptText are required",
      });
    }

    const result = await smartDistribute({ segments, sections, scriptText });
    res.json(result);
  } catch (error) {
    componentLogger.error("Smart distribute failed", { error: error.message });
    res.status(500).json({ error: "INTERNAL_ERROR", message: error.message });
  }
}

export const aiToolsController = {
  nanoBanana,
  ambientImage,
  ambientPrompt,
  classifyIntent: classifyIntentHandler,
  sjinnCreate,
  sjinnPoll,
  photoTo3dCreate,
  photoTo3dPoll,
  smartDistribute: smartDistributeHandler,
};
