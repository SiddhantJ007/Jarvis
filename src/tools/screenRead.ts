import fs from "fs";
import os from "os";
import path from "path";
import { execFile } from "child_process";
import { promisify } from "util";
import { ToolDefinition, ToolResult } from "./types";

const execFileAsync = promisify(execFile);

async function screenshotFull(pathname: string): Promise<void> {
  await execFileAsync("screencapture", ["-x", pathname]);
}

async function runVisionOcr(scriptPath: string, imagePath: string) {
  const { stdout } = await execFileAsync("swift", [scriptPath, imagePath]);
  const parsed = JSON.parse(stdout || "[]");
  return Array.isArray(parsed) ? parsed : [];
}

async function captureScreenText(): Promise<
  ToolResult<{ text: string; blocks: { text: string; x: number; y: number; width: number; height: number }[] }>
> {
  if (process.platform !== "darwin") {
    return { ok: false, message: "screenRead is only supported on macOS." };
  }

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "jarvis-screenread-"));
  const imagePath = path.join(tmpDir, "shot.png");
  const scriptPath = path.join(tmpDir, "vision_read.swift");

  const swiftCode = `
import Foundation
import Vision
import AppKit

let args = CommandLine.arguments
guard args.count >= 2 else {
  fputs("[]", stderr)
  exit(1)
}
let imagePath = args[1]
guard let img = NSImage(contentsOfFile: imagePath) else {
  fputs("[]", stderr)
  exit(1)
}
guard let tiff = img.tiffRepresentation, let ciImage = CIImage(data: tiff) else {
  fputs("[]", stderr)
  exit(1)
}

let request = VNRecognizeTextRequest()
request.recognitionLevel = .accurate
request.usesLanguageCorrection = true

let handler = VNImageRequestHandler(ciImage: ciImage, options: [:])
do {
  try handler.perform([request])
  var results: [[String: Any]] = []
  if let observations = request.results as? [VNRecognizedTextObservation] {
    for obs in observations {
      guard let candidate = obs.topCandidates(1).first else { continue }
      let bbox = obs.boundingBox
      let width = img.size.width
      let height = img.size.height
      let x = bbox.origin.x * width
      let y = (1 - bbox.origin.y - bbox.size.height) * height
      let w = bbox.size.width * width
      let h = bbox.size.height * height
      results.append([
        "text": candidate.string,
        "x": x,
        "y": y,
        "width": w,
        "height": h
      ])
    }
  }
  let data = try JSONSerialization.data(withJSONObject: results, options: [])
  if let str = String(data: data, encoding: .utf8) {
    print(str)
  } else {
    print("[]")
  }
} catch {
  fputs("[]", stderr)
  exit(1)
}
  `.trim();

  fs.writeFileSync(scriptPath, swiftCode, "utf8");

  try {
    await screenshotFull(imagePath);
    const detections = await runVisionOcr(scriptPath, imagePath);
    const blocks = detections
      .map((d: any) => ({
        text: (d.text || "").toString(),
        x: Number(d.x) || 0,
        y: Number(d.y) || 0,
        width: Number(d.width) || 0,
        height: Number(d.height) || 0,
      }))
      .filter((b: any) => b.text);

    blocks.sort((a, b) => {
      if (a.y === b.y) return a.x - b.x;
      return a.y - b.y;
    });

    const text = blocks.map((b) => b.text).join("\n").trim();
    return { ok: true, data: { text, blocks } };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, message };
  } finally {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      // ignore cleanup errors
    }
  }
}

export const screenReadTool: ToolDefinition = {
  name: "screenRead",
  description:
    "Capture the entire screen, OCR it, and return the extracted text for summarization. macOS only; requires Screen Recording permission.",
  parameters: {
    type: "object",
    properties: {},
    required: [],
  },
  handler: async () => {
    return captureScreenText();
  },
};
