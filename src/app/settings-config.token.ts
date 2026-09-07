import { InjectionToken } from '@angular/core';

export interface SettingsUiConfig {
  version: string;
  previewMode?: boolean;
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
    validateHostedApi: string;
    registerHostedSite: string;
    refreshHostedStatus: string;
    runHostedSync: string;
    openAiModels: string;
    claudeModels: string;
  };
  nonces: {
    load: string;
    save: string;
    queueIndex: string;
    validateHostedApi: string;
    registerHostedSite: string;
    refreshHostedStatus: string;
    runHostedSync: string;
    openAiModels: string;
    claudeModels: string;
  };
  extensions: {
    manifestUrl: string;
    assetsBaseUrl: string;
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
  previewMode: false,
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
    validateHostedApi: 'myobserver_rag_validate_hosted_api',
    registerHostedSite: 'myobserver_rag_register_hosted_site',
    refreshHostedStatus: 'myobserver_rag_refresh_hosted_status',
    runHostedSync: 'myobserver_rag_run_hosted_sync',
    openAiModels: 'myobserver_rag_list_openai_models',
    claudeModels: 'myobserver_rag_list_claude_models',
  },
  nonces: {
    load: 'dev',
    save: 'dev',
    queueIndex: 'dev',
    validateHostedApi: 'dev',
    registerHostedSite: 'dev',
    refreshHostedStatus: 'dev',
    runHostedSync: 'dev',
    openAiModels: 'dev',
    claudeModels: 'dev',
  },
  extensions: {
    manifestUrl: '/wp-content/plugins/my-observer-rag-chat-assistant-for-woocommerce/assets/settings-ui-extensions/manifest.json',
    assetsBaseUrl: '/wp-content/plugins/my-observer-rag-chat-assistant-for-woocommerce/assets/settings-ui-extensions/',
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
        extensions: { ...fallbackConfig.extensions, ...(provided.extensions ?? {}) },
      };
    },
  }
);
