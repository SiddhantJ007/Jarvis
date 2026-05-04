import { ToolRegistry, ToolContext, ToolResult } from "./types";
import { openApplicationTool } from "./openApplication";
import { openUrlTool } from "./openUrl";
import { createNoteTool } from "./createNote";
import { listFilesTool } from "./listFiles";
import { getSystemInfoTool } from "./getSystemInfo";
import {
  addAgendaItemTool,
  listAgendaTool,
  updateAgendaStatusTool,
  updateAgendaByTitleTool,
  deleteAgendaByTitleTool,
} from "./agenda";
import { uiClickTool } from "./uiClick";
import { uiTypeTool } from "./uiType";
import { uiSnapshotTool } from "./uiSnapshot";
import { uiKeysTool } from "./uiKeys";
import { uiFindAndClickTool } from "./uiFindAndClick";
import { uiScrollTool } from "./uiScroll";
import { uiOcrClickTool } from "./uiOcrClick";
import { browserClickTextTool } from "./browserClickText";
import { getCurrentTimeTool } from "./getCurrentTime";
import { fetchNewsTool } from "./fetchNews";
import { playMusicTool } from "./playMusic";
import { fetchWeatherTool } from "./fetchWeather";
import { browserClickSelectorTool } from "./browserClickSelector";
import { closeTabTool } from "./closeTab";
import { screenReadTool } from "./screenRead";
import { copyClipboardTool } from "./copyClipboard";
import { closeApplicationTool } from "./closeApplication";

const registry: ToolRegistry = {
  [openApplicationTool.name]: openApplicationTool,
  [openUrlTool.name]: openUrlTool,
  [createNoteTool.name]: createNoteTool,
  [listFilesTool.name]: listFilesTool,
  [getSystemInfoTool.name]: getSystemInfoTool,
  [addAgendaItemTool.name]: addAgendaItemTool,
  [listAgendaTool.name]: listAgendaTool,
  [updateAgendaStatusTool.name]: updateAgendaStatusTool,
  [updateAgendaByTitleTool.name]: updateAgendaByTitleTool,
  [deleteAgendaByTitleTool.name]: deleteAgendaByTitleTool,
  [uiClickTool.name]: uiClickTool,
  [uiTypeTool.name]: uiTypeTool,
  [uiSnapshotTool.name]: uiSnapshotTool,
  [uiKeysTool.name]: uiKeysTool,
  [uiFindAndClickTool.name]: uiFindAndClickTool,
  [uiScrollTool.name]: uiScrollTool,
  [uiOcrClickTool.name]: uiOcrClickTool,
  [browserClickTextTool.name]: browserClickTextTool,
  [getCurrentTimeTool.name]: getCurrentTimeTool,
  [fetchNewsTool.name]: fetchNewsTool,
  [playMusicTool.name]: playMusicTool,
  [fetchWeatherTool.name]: fetchWeatherTool,
  [browserClickSelectorTool.name]: browserClickSelectorTool,
  [closeTabTool.name]: closeTabTool,
  [screenReadTool.name]: screenReadTool,
  [copyClipboardTool.name]: copyClipboardTool,
  [closeApplicationTool.name]: closeApplicationTool,
};

export function getToolRegistry(): ToolRegistry {
  return registry;
}

export async function executeTool(
  name: string,
  args: any,
  ctx: ToolContext,
  toolRegistry: ToolRegistry = registry
): Promise<ToolResult> {
  const tool = toolRegistry[name];
  if (!tool) {
    throw new Error(`Tool not found: ${name}`);
  }

  const ctxWithUser = { userId: ctx.userId || "local-user", ...ctx };
  return tool.handler(args, ctxWithUser);
}
