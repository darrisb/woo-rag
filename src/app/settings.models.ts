export interface GuardrailSettings {
  systemPrompt: string;
  chatTitle: string;
  welcomeMessage: string;
  maskPII: boolean;
  blockProfanity: boolean;
  blockCompetitors: boolean;
  competitorTokens: string;
}

export interface HostedApiCapabilities {
  service: string;
  version: string;
  timestamp: string;
  billing: {
    enabled: boolean;
    checkout: boolean;
    proKeyValidation: boolean;
  };
  runtime: {
    enabled: boolean;
    mode: string;
    registerSite: boolean;
    init: boolean;
    chat: boolean;
    sessionReset: boolean;
    syncProducts: boolean;
  };
  widgetLoader: {
    enabled: boolean;
    path: string;
  };
}

export interface HostedSyncStatus {
  status: string;
  productCount: number;
  pageCount: number;
  sourceUrl: string;
  startedAt: string;
  completedAt: string;
  lastSuccessfulSyncAt: string;
  lastModifiedSince: string;
  lastError: string;
}

export interface HostedActivationStatus {
  usage?: MessageUsage | null;
  siteId: string;
  apiTokenConfigured: boolean;
  bootstrapStatus: string;
  registeredAt: string;
  lastBootstrapCheckAt: string;
  baseUrl: string;
  registerUrl: string;
  initUrl: string;
  runtimeMode: string;
  message: string;
  access: {
    available: boolean;
    plan: string;
    subscriptionStatus: string;
    runtimeEnabled: boolean;
    billingEnabled: boolean;
    checkoutRequired: boolean;
    paidActive?: boolean;
    entitlementSource?: string;
    upgradeRequired?: boolean;
    upgradeAvailable?: boolean;
  };
  sync: HostedSyncStatus;
}

export interface SettingsPayload {
  runtimeMode: 'local' | 'saas';
  providers: {
    chat: 'openai' | 'claude';
    embeddings: 'openai' | 'claude';
  };
  keys: {
    openai: string;
    claude: string;
  };
  models: {
    openaiChat: string;
    openaiEmbeddings: string;
    claudeChat: string;
    claudeEmbeddings: string;
  };
  claudeEmbeddingsUrl: string;
  hostedApiBaseUrl: string;
  saasRegisterUrl: string;
  widgetAutoInject: boolean;
  guardrails: GuardrailSettings;
  hosted: HostedActivationStatus;
  effective: {
    runtimeMode: 'local' | 'saas';
    chatProvider: string;
    embeddingsProvider: string;
    openAiConfigured: boolean;
    claudeConfigured: boolean;
    hostedApiConfigured: boolean;
    saasRegisterConfigured: boolean;
    chatReady: boolean;
    embeddingsReady: boolean;
    claudeEmbeddingsUrl: string;
    hostedApiBaseUrl: string;
  };
}

export interface QueueIndexResponse {
  message: string;
  queued: number;
}

export interface IndexStatsResponse {
  ok: boolean;
  status: string;
  vectorsTotal: number;
  productsIndexed: number;
  documentVectors: number;
  storageBytes: number;
  files: {
    vector: number;
    meta: number;
    graph: number;
    payload: number;
  };
  lastOptimizeAt: string;
}

export interface RetrievalDiagnosticResult {
  productId: number;
  title: string;
  score: number;
  distance: number;
  latencyMs: number;
  matchedChunk: string;
  vectorRank: number | null;
  keywordRank: number | null;
}

export interface RetrievalDiagnosticsResponse {
  ok: boolean;
  latencyMs: number;
  results: RetrievalDiagnosticResult[];
  cache: {
    hits: number;
    misses: number;
    exactHits: number;
    semanticHits: number;
    hitRate: number;
  };
}

export interface ProductLinkItem {
  id: number;
  name: string;
  sku: string;
  status: string;
}

export interface DocumentChunk {
  id: number;
  document_id: number;
  chunk_index: number;
  content: string;
  content_hash: string;
  token_estimate: number;
  vector_key: string;
  created_at: string;
}

export interface DocumentItem {
  id: number;
  title: string;
  source_file: string;
  source_path: string;
  mime_type: string;
  file_size: number;
  status: string;
  scope: string;
  chunk_count: number;
  last_indexed_at: string | null;
  last_error: string | null;
  created_at: string;
  updated_at: string;
  linked_product_ids: number[];
}

export interface DocumentsResponse {
  ok: boolean;
  documents: DocumentItem[];
  pagination: {
    page: number;
    perPage: number;
    total: number;
  };
}

export interface DocumentDetailResponse {
  ok: boolean;
  document: DocumentItem;
  linkedProducts: ProductLinkItem[];
  chunks: DocumentChunk[];
}

export interface ProductSearchResponse {
  ok: boolean;
  products: ProductLinkItem[];
}

export interface DocumentUploadResponse {
  ok: boolean;
  document: DocumentItem;
}

export interface DocumentLinksResponse {
  ok: boolean;
  document: DocumentItem;
  linkedProducts: ProductLinkItem[];
}

export interface DocumentReindexResponse {
  ok: boolean;
  message: string;
  document: DocumentItem;
}

export interface DocumentDeleteResponse {
  ok: boolean;
  message: string;
}

export interface SettingsUiExtensionTab {
  id: string;
  label: string;
  section: 'widget';
  type: 'custom-element';
  elementTag: string;
  scriptUrl: string;
  order?: number;
}

export interface SettingsUiExtensionManifest {
  version: string;
  tabs: SettingsUiExtensionTab[];
}

export interface SettingsUiShellTab {
  id: string;
  label: string;
  section: 'widget';
  type: 'builtin' | 'custom-element';
  elementTag?: string;
  scriptUrl?: string;
  order: number;
}

export interface MessageUsage {
  used: number;
  limit: number;
  remaining: number;
  reached: boolean;
  resetsAt: string;
  freeUsed?: number;
  freeRemaining?: number;
  purchasedRemaining?: number;
}

export interface MessagePack {
  id: string;
  messages: number;
  available: boolean;
  amount: number | null;
  currency: string;
}

export interface MessageRefill {
  enabled: boolean;
  packId: string;
  monthlyCap: number;
  spent: number;
  currency: string;
  lastError: string;
}

export interface MessageBillingResponse {
  terms?: { version: string; url: string } | null;
  termsAccepted?: boolean;
  refill?: MessageRefill;
  ok: boolean;
  packs?: MessagePack[];
  usage?: MessageUsage;
  enabled?: boolean;
  url?: string;
  paid?: boolean;
}
