/**
 * API Connector Interface for External Services
 */

export interface ConnectorAction {
  id: string;
  name: string;
  description: string;
  requiresConfirmation?: boolean;
  execute: (params: Record<string, any>) => Promise<any>;
}

export interface ApiConnector {
  id: string;
  name: string;
  description: string;
  auth: {
    type: 'token' | 'oauth' | 'none';
    isConfigured: boolean;
    tokenKey?: string;
  };
  actions: ConnectorAction[];
}
