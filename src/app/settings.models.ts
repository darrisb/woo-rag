export interface GuardrailSettings {
  systemPrompt: string;
  chatTitle: string;
  welcomeMessage: string;
  maskPII: boolean;
  blockProfanity: boolean;
  blockCompetitors: boolean;
  competitorTokens: string;
}

export interface SettingsPayload {
  sharedKeysAvailable: boolean;
  useSeparateLlmKeys: boolean;
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
  widgetAutoInject: boolean;
  guardrails: GuardrailSettings;
  effective: {
    chatProvider: string;
    embeddingsProvider: string;
    openAiConfigured: boolean;
    claudeConfigured: boolean;
    chatReady: boolean;
    embeddingsReady: boolean;
    claudeEmbeddingsUrl: string;
  };
}

export interface QueueIndexResponse {
  message: string;
  queued: number;
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
