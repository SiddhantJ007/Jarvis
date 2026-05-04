import fs from "fs";
import os from "os";
import path from "path";
import { execFile } from "child_process";
import { promisify } from "util";
import { ToolDefinition, ToolResult } from "./types";

const execFileAsync = promisify(execFile);

async function runAppleScript(script: string, args: string[]): Promise<string> {
  const { stdout } = await execFileAsync("osascript", ["-l", "AppleScript", "-e", script, ...args]);
  return stdout.trim();
}

async function screenshotFull(pathname: string): Promise<void> {
  await execFileAsync("screencapture", ["-x", pathname]);
}

async function runVisionOcrWithFile(
  scriptPath: string,
  imagePath: string
): Promise<{ text: string; x: number; y: number; width: number; height: number }[]> {
  const { stdout } = await execFileAsync("swift", [scriptPath, imagePath]);
  const parsed = JSON.parse(stdout || "[]");
  if (!Array.isArray(parsed)) return [];
  return parsed as any;
}

async function ocrFindAndClick(target: string): Promise<ToolResult<{ clicked: boolean }>> {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "jarvis-ocr-"));
  const imagePath = path.join(tmpDir, "shot.png");
  const scriptPath = path.join(tmpDir, "vision_ocr.swift");

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
    const detections = await runVisionOcrWithFile(scriptPath, imagePath);
    const needle = target.toLowerCase();
    let best: { text: string; x: number; y: number; width: number; height: number } | null = null;
    for (const d of detections) {
      const txt = (d.text || "").toString();
      if (txt.toLowerCase().includes(needle)) {
        best = d;
        break;
      }
    }
    if (!best) {
      return { ok: false, message: `OCR did not find "${target}".` };
    }

    // Click at center
    const cx = best.x + best.width / 2;
    const cy = best.y + best.height / 2;
    const clickScript = `
on run argv
  set cx to item 1 of argv as real
  set cy to item 2 of argv as real
  tell application "System Events" to click at {cx, cy}
  return "clicked"
end run
    `.trim();
    const clickArgs = [cx.toString(), cy.toString()];
    await runAppleScript(clickScript, clickArgs);
    return { ok: true, data: { clicked: true } };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, message };
  } finally {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  }
}

export interface UiOcrClickArgs {
  target: string;
}

export const uiOcrClickTool: ToolDefinition<UiOcrClickArgs> = {
  name: "uiOcrClick",
  description:
    "Screenshot the screen, OCR it, and click the first text occurrence matching the target substring. Requires Screen Recording + Accessibility.",
  parameters: {
    type: "object",
    properties: {
      target: { type: "string", description: "Substring of on-screen text to click." },
    },
    required: ["target"],
  },
  handler: async (args) => {
    if (process.platform !== "darwin") {
      return { ok: false, message: "uiOcrClick is only supported on macOS." };
    }
    const target = (args.target || "").trim();
    if (!target) return { ok: false, message: "Target cannot be empty." };
    return ocrFindAndClick(target);
  },
};
