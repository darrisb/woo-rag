import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { delay, map, Observable, of } from 'rxjs';
import { SETTINGS_UI_CONFIG } from './settings-config.token';
import {
  DocumentDetailResponse,
  DocumentItem,
  DocumentLinksResponse,
  DocumentReindexResponse,
  DocumentsResponse,
  DocumentUploadResponse,
  ProductLinkItem,
  ProductSearchResponse,
  QueueIndexResponse,
  SettingsPayload,
} from './settings.models';

interface AjaxEnvelope<T> {
  success: boolean;
  data: T;
}

@Injectable({ providedIn: 'root' })
export class SettingsApiService {
  private readonly http = inject(HttpClient);
  private readonly config = inject(SETTINGS_UI_CONFIG);
  private readonly isLocalPreview = typeof window !== 'undefined'
    && !window.__MYOBSERVER_RAG_SETTINGS_UI__;

  loadSettings(): Observable<SettingsPayload> {
    if (this.isLocalPreview) {
      return of(this.mockSettings()).pipe(delay(150));
    }

    const body = this.ajaxBody(this.config.actions.load, this.config.nonces.load);
    return this.http
      .post<AjaxEnvelope<SettingsPayload>>(this.config.ajaxUrl, body)
      .pipe(map((response) => response.data));
  }

  saveSettings(payload: SettingsPayload): Observable<{ message: string; settings: SettingsPayload }> {
    if (this.isLocalPreview) {
      return of({
        message: 'Local preview save simulated.',
        settings: payload,
      }).pipe(delay(150));
    }

    const body = this.ajaxBody(this.config.actions.save, this.config.nonces.save)
      .set('payload', JSON.stringify(payload));

    return this.http
      .post<AjaxEnvelope<{ message: string; settings: SettingsPayload }>>(this.config.ajaxUrl, body)
      .pipe(map((response) => response.data));
  }

  queueIndex(): Observable<QueueIndexResponse> {
    if (this.isLocalPreview) {
      return of({
        message: 'Local preview queued indexing for 327 products.',
        queued: 327,
      }).pipe(delay(150));
    }

    const body = this.ajaxBody(this.config.actions.queueIndex, this.config.nonces.queueIndex);
    return this.http
      .post<AjaxEnvelope<QueueIndexResponse>>(this.config.ajaxUrl, body)
      .pipe(map((response) => response.data));
  }

  listOpenAiModels(apiKey: string): Observable<string[]> {
    if (this.isLocalPreview) {
      return of([
        'gpt-5-mini',
        'gpt-4.1-mini',
        'gpt-4o-mini',
        'text-embedding-3-small',
        'text-embedding-3-large',
      ]).pipe(delay(150));
    }

    const body = this.ajaxBody(this.config.actions.openAiModels, this.config.nonces.openAiModels)
      .set('api_key', apiKey.trim());
    return this.http
      .post<AjaxEnvelope<{ models: string[] }>>(this.config.ajaxUrl, body)
      .pipe(map((response) => response.data.models ?? []));
  }

  listClaudeModels(apiKey: string): Observable<string[]> {
    if (this.isLocalPreview) {
      return of([
        'claude-sonnet-4-0',
        'claude-haiku-4-0',
        'claude-3-5-sonnet-latest',
        'claude-embedding-v1',
      ]).pipe(delay(150));
    }

    const body = this.ajaxBody(this.config.actions.claudeModels, this.config.nonces.claudeModels)
      .set('api_key', apiKey.trim());
    return this.http
      .post<AjaxEnvelope<{ models: string[] }>>(this.config.ajaxUrl, body)
      .pipe(map((response) => response.data.models ?? []));
  }

  loadDocuments(page = 1, perPage = 12): Observable<DocumentsResponse> {
    if (this.isLocalPreview) {
      return of(this.mockDocumentsResponse()).pipe(delay(150));
    }

    const params = new HttpParams()
      .set('page', String(page))
      .set('perPage', String(perPage));
    return this.http.get<DocumentsResponse>(this.restUrl('/documents'), {
      headers: this.restHeaders(),
      params,
    });
  }

  getDocument(documentId: number): Observable<DocumentDetailResponse> {
    if (this.isLocalPreview) {
      return of(this.mockDocumentDetail(documentId)).pipe(delay(150));
    }

    return this.http.get<DocumentDetailResponse>(this.restUrl(`/documents/${documentId}`), {
      headers: this.restHeaders(),
    });
  }

  uploadDocument(file: File, title: string): Observable<DocumentUploadResponse> {
    if (this.isLocalPreview) {
      const nextId = 100 + Math.floor(Math.random() * 1000);
      return of({
        ok: true,
        document: {
          id: nextId,
          title: title.trim() || file.name.replace(/\.[^/.]+$/, ''),
          source_file: file.name,
          source_path: '/mock/uploads/' + file.name,
          mime_type: file.type || 'text/plain',
          file_size: file.size,
          status: 'uploaded',
          scope: 'global',
          chunk_count: 0,
          last_indexed_at: null,
          last_error: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          linked_product_ids: [],
        },
      }).pipe(delay(150));
    }

    const body = new FormData();
    body.append('file', file);
    body.append('title', title.trim());
    return this.http.post<DocumentUploadResponse>(this.restUrl('/documents/upload'), body, {
      headers: this.restHeaders(),
    });
  }

  searchProducts(query: string, limit = 20): Observable<ProductLinkItem[]> {
    if (this.isLocalPreview) {
      return of(this.mockProductResults(query)).pipe(delay(120));
    }

    const params = new HttpParams()
      .set('q', query.trim())
      .set('limit', String(limit));
    return this.http.get<ProductSearchResponse>(this.restUrl('/documents/search-products'), {
      headers: this.restHeaders(),
      params,
    }).pipe(map((response) => response.products ?? []));
  }

  updateDocumentLinks(documentId: number, productIds: number[]): Observable<DocumentLinksResponse> {
    if (this.isLocalPreview) {
      return of(this.mockLinksResponse(documentId, productIds)).pipe(delay(150));
    }

    return this.http.post<DocumentLinksResponse>(
      this.restUrl(`/documents/${documentId}/links`),
      { productIds },
      {
        headers: this.restHeaders(),
      }
    );
  }

  queueDocumentReindex(documentId: number): Observable<DocumentReindexResponse> {
    if (this.isLocalPreview) {
      return of({
        ok: true,
        message: 'Document reindex queued.',
        document: this.mockDocumentDetail(documentId).document,
      }).pipe(delay(150));
    }

    return this.http.post<DocumentReindexResponse>(
      this.restUrl(`/documents/${documentId}/reindex`),
      {},
      {
        headers: this.restHeaders(),
      }
    );
  }

  private ajaxBody(action: string, nonce: string): HttpParams {
    return new HttpParams()
      .set('action', action)
      .set('nonce', nonce);
  }

  private restHeaders(): HttpHeaders {
    const nonce = this.config.wp.nonce || this.config.restNonce;
    return new HttpHeaders({
      'X-WP-Nonce': nonce,
    });
  }

  private restUrl(path: string): string {
    const base = (this.config.wp.apiBaseUrl || this.config.restBaseUrl || '').replace(/\/$/, '');
    const namespace = (this.config.wp.restNamespace || '').replace(/^\/|\/$/g, '');
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;

    if (base !== '' && namespace !== '') {
      return `${base}/${namespace}${normalizedPath}`;
    }

    return `${this.config.restBaseUrl}${normalizedPath}`;
  }

  private mockSettings(): SettingsPayload {
    return {
      sharedKeysAvailable: true,
      useSeparateLlmKeys: false,
      providers: {
        chat: 'openai',
        embeddings: 'openai',
      },
      keys: {
        openai: '',
        claude: '',
      },
      models: {
        openaiChat: 'gpt-4o-mini',
        openaiEmbeddings: 'text-embedding-3-small',
        claudeChat: 'claude-3-5-sonnet-latest',
        claudeEmbeddings: 'claude-embedding-v1',
      },
      claudeEmbeddingsUrl: 'https://api.anthropic.com/v1/embeddings',
      widgetAutoInject: true,
      guardrails: {
        chatTitle: 'Woo Rag Assistant',
        welcomeMessage: 'Hi! I can help you find products and answer questions about your catalog.',
        systemPrompt: 'You are a WooCommerce assistant. Use only provided product context when possible and be concise.',
        maskPII: true,
        blockProfanity: false,
        blockCompetitors: true,
        competitorTokens: 'Shopify, Magento, BigCommerce',
      },
      effective: {
        chatProvider: 'openai',
        embeddingsProvider: 'openai',
        openAiConfigured: true,
        claudeConfigured: false,
        chatReady: true,
        embeddingsReady: true,
        claudeEmbeddingsUrl: 'https://api.anthropic.com/v1/embeddings',
      },
    };
  }

  private mockDocumentsResponse(): DocumentsResponse {
    const documents = [
      this.buildMockDocument(1, 'Sizing and Fit Guide', 'application/pdf', 'indexed', 'product', 18, 5, '2026-07-25T10:30:00Z'),
      this.buildMockDocument(2, 'Returns and Care Instructions', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'needs_reindex', 'product', 6, 3, '2026-07-24T15:30:00Z'),
      this.buildMockDocument(3, 'Wholesale FAQ', 'text/plain', 'draft', 'global', 0, 0, '2026-07-25T12:30:00Z'),
    ];

    return {
      ok: true,
      documents,
      pagination: {
        page: 1,
        perPage: 12,
        total: documents.length,
      },
    };
  }

  private mockDocumentDetail(documentId: number): DocumentDetailResponse {
    const response = this.mockDocumentsResponse();
    const document = response.documents.find((item) => item.id === documentId) ?? response.documents[0];
    const linkedProducts = this.mockProductResults('').filter((product) => document.linked_product_ids.includes(product.id));

    return {
      ok: true,
      document,
      linkedProducts,
      chunks: [
        {
          id: document.id * 10 + 1,
          document_id: document.id,
          chunk_index: 0,
          content: `Sample chunk for ${document.title}.`,
          content_hash: 'mock-hash',
          token_estimate: 24,
          vector_key: `doc:${document.id}:chunk:0`,
          created_at: document.updated_at,
        },
      ],
    };
  }

  private mockProductResults(query: string): ProductLinkItem[] {
    const products: ProductLinkItem[] = [
      { id: 101, name: 'Trail Runner Pro', sku: 'TRAIL-101', status: 'publish' },
      { id: 102, name: 'All Weather Jacket', sku: 'JACKET-102', status: 'publish' },
      { id: 103, name: 'Summit Pack 24L', sku: 'PACK-103', status: 'publish' },
      { id: 104, name: 'Studio Knit Hoodie', sku: 'HOODIE-104', status: 'publish' },
      { id: 105, name: 'Ridge Shell Vest', sku: 'VEST-105', status: 'draft' },
    ];
    const normalized = query.trim().toLowerCase();
    if (normalized === '') {
      return products;
    }
    return products.filter((product) =>
      product.name.toLowerCase().includes(normalized) || product.sku.toLowerCase().includes(normalized)
    );
  }

  private mockLinksResponse(documentId: number, productIds: number[]): DocumentLinksResponse {
    const detail = this.mockDocumentDetail(documentId);
    return {
      ok: true,
      document: {
        ...detail.document,
        linked_product_ids: [...productIds],
        scope: productIds.length > 0 ? 'product' : 'global',
      },
      linkedProducts: this.mockProductResults('').filter((product) => productIds.includes(product.id)),
    };
  }

  private buildMockDocument(
    id: number,
    title: string,
    mimeType: string,
    status: string,
    scope: string,
    linkedProductCount: number,
    chunkCount: number,
    updatedAt: string,
  ): DocumentItem {
    const productIds = this.mockProductResults('').slice(0, Math.min(linkedProductCount, 3)).map((product) => product.id);
    return {
      id,
      title,
      source_file: title.toLowerCase().replace(/\s+/g, '-') + '.txt',
      source_path: '/mock/uploads/' + title.toLowerCase().replace(/\s+/g, '-') + '.txt',
      mime_type: mimeType,
      file_size: 1024 * (chunkCount + 1),
      status,
      scope,
      chunk_count: chunkCount,
      last_indexed_at: status === 'indexed' ? updatedAt : null,
      last_error: status === 'failed' ? 'Mock failure.' : null,
      created_at: updatedAt,
      updated_at: updatedAt,
      linked_product_ids: productIds,
    };
  }
}
