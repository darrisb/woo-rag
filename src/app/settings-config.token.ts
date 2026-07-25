import { InjectionToken } from '@angular/core';

export interface SettingsUiConfig {
  version: string;
  mount: {
    elementTag: string;
    targetId: string;
  };
  wp: {
    siteUrl: string;
    apiBaseUrl: string;
    restNamespace: string;
    nonce: string;
    ajaxUrl: string;
    currentUserId: number;
    capabilities: {
      manageOptions: boolean;
    };
  };
  ajaxUrl: string;
  restBaseUrl: string;
  restNonce: string;
  actions: {
    load: string;
    save: string;
    queueIndex: string;
    openAiModels: string;
    claudeModels: string;
  };
  nonces: {
    load: string;
    save: string;
    queueIndex: string;
    openAiModels: string;
    claudeModels: string;
  };
  upgradeUrl: string;
}

declare global {
  interface Window {
    __MYOBSERVER_RAG_SETTINGS_UI__?: SettingsUiConfig;
  }
}

const fallbackConfig: SettingsUiConfig = {
  version: 'dev',
  mount: {
    elementTag: 'myobserver-rag-settings-ui',
    targetId: 'myobserver-rag-settings-root',
  },
  wp: {
    siteUrl: '',
    apiBaseUrl: '/wp-json',
    restNamespace: 'myobserver-rag/v1',
    nonce: 'dev',
    ajaxUrl: '/wp-admin/admin-ajax.php',
    currentUserId: 0,
    capabilities: {
      manageOptions: false,
    },
  },
  ajaxUrl: '/wp-admin/admin-ajax.php',
  restBaseUrl: '/wp-json/myobserver-rag/v1',
  restNonce: 'dev',
  actions: {
    load: 'myobserver_rag_get_settings',
    save: 'myobserver_rag_save_settings',
    queueIndex: 'myobserver_rag_queue_index',
    openAiModels: 'myobserver_rag_list_openai_models',
    claudeModels: 'myobserver_rag_list_claude_models',
  },
  nonces: {
    load: 'dev',
    save: 'dev',
    queueIndex: 'dev',
    openAiModels: 'dev',
    claudeModels: 'dev',
  },
  upgradeUrl: 'https://myobserver.io/#roadmap',
};

export const SETTINGS_UI_CONFIG = new InjectionToken<SettingsUiConfig>(
  'SETTINGS_UI_CONFIG',
  {
    providedIn: 'root',
    factory: () => {
      const provided = window.__MYOBSERVER_RAG_SETTINGS_UI__;
      if (!provided) {
        return fallbackConfig;
      }

      return {
        ...fallbackConfig,
        ...provided,
        mount: { ...fallbackConfig.mount, ...(provided.mount ?? {}) },
        wp: { ...fallbackConfig.wp, ...(provided.wp ?? {}) },
        actions: { ...fallbackConfig.actions, ...(provided.actions ?? {}) },
        nonces: { ...fallbackConfig.nonces, ...(provided.nonces ?? {}) },
      };
    },
  }
);
