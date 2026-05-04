import { ToolDefinition, ToolResult } from "./types";

export const getCurrentTimeTool: ToolDefinition = {
  name: "getCurrentTime",
  description: "Get the current local time of this machine.",
  parameters: {
    type: "object",
    properties: {},
    required: [],
  },
  handler: async (): Promise<ToolResult<{ iso: string; display: string }>> => {
    const toWords = (n: number): string => {
      const ones = [
        "zero",
        "one",
        "two",
        "three",
        "four",
        "five",
        "six",
        "seven",
        "eight",
        "nine",
        "ten",
        "eleven",
        "twelve",
        "thirteen",
        "fourteen",
        "fifteen",
        "sixteen",
        "seventeen",
        "eighteen",
        "nineteen",
      ];
      const tens = ["", "", "twenty", "thirty", "forty", "fifty"];
      if (n < 20) return ones[n];
      const t = Math.floor(n / 10);
      const o = n % 10;
      if (o === 0) return tens[t];
      return `${tens[t]} ${ones[o]}`;
    };

    const now = new Date();
    const iso = now.toISOString();
    const display = now.toLocaleString();
    const hh24 = now.getHours();
    const mm = now.getMinutes();
    const hh12 = hh24 % 12 == 0 ? 12 : hh24 % 12;
    const meridiem = hh24 >= 12 ? "pm" : "am";
    const hhStr = hh24.toString();
    const mmStr = mm.toString().padStart(2, "0");
    const timeOnly = `${hhStr}${mmStr} hours`;
    const timeSpoken = `${toWords(hh12)} ${toWords(mm)} ${meridiem}`;
    const dateOnly = now.toLocaleDateString();
    const dayName = now.toLocaleDateString(undefined, { weekday: "long" });
    return {
      ok: true,
      data: { iso, display, timeOnly, dateOnly, dayName, timeSpoken } as any,
    };
  },
};
