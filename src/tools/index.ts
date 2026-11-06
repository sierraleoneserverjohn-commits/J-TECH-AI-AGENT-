import { toolRegistry } from './ToolRegistry';
import { WebSearchTool } from './implementations/WebSearchTool';
import { BrowserAgentTool } from './implementations/BrowserAgentTool';
import { CodeIntelligenceTool } from './implementations/CodeIntelligenceTool';
import { MemoryRetrievalTool } from './implementations/MemoryRetrievalTool';
import { DocumentIntelligenceTool } from './implementations/DocumentIntelligenceTool';
import { AutomationEngineTool } from './implementations/AutomationEngineTool';
import { AndroidToolkitTool } from './implementations/AndroidToolkitTool';
import { ApiConnectorTool } from './implementations/ApiConnectorTool';
import { VisionEngineTool } from './implementations/VisionEngineTool';

// Auto-register default tools
toolRegistry.register(WebSearchTool);
toolRegistry.register(BrowserAgentTool);
toolRegistry.register(CodeIntelligenceTool);
toolRegistry.register(MemoryRetrievalTool);
toolRegistry.register(DocumentIntelligenceTool);
toolRegistry.register(AutomationEngineTool);
toolRegistry.register(AndroidToolkitTool);
toolRegistry.register(ApiConnectorTool);
toolRegistry.register(VisionEngineTool);

export { toolRegistry };
export * from './types';
export * from './ToolRegistry';
export * from './connectors/types';
export * from './connectors/GitHubConnector';
