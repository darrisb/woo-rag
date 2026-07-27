import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, ElementRef, OnDestroy, ViewChild, ViewEncapsulation, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { finalize } from 'rxjs';
import { SettingsApiService } from './settings-api.service';
import { SETTINGS_UI_CONFIG } from './settings-config.token';
import { SettingsUiExtensionsService } from './settings-ui-extensions.service';
import { DocumentItem, IndexStatsResponse, ProductLinkItem, RetrievalDiagnosticResult, SettingsPayload, SettingsUiShellTab } from './settings.models';

@Component({
  selector: 'myobserver-rag-settings-ui',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
  encapsulation: ViewEncapsulation.ShadowDom,
})
export class AppComponent {
  private readonly fb = inject(FormBuilder);
  private readonly api = inject(SettingsApiService);
  private readonly extensions = inject(SettingsUiExtensionsService);
  protected readonly config = inject(SETTINGS_UI_CONFIG);
  private readonly statusTimeouts = new Map<string, number>();
  private documentRefreshTimeoutId: number | null = null;

  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly queueing = signal(false);
  protected readonly statusMessage = signal('');
  protected readonly statusTone = signal<'neutral' | 'success' | 'error'>('neutral');
  protected readonly modelsStatusMessage = signal('');
  protected readonly modelsStatusTone = signal<'neutral' | 'success' | 'error'>('neutral');
  protected readonly diagnosticsStatusMessage = signal('');
  protected readonly diagnosticsStatusTone = signal<'neutral' | 'success' | 'error'>('neutral');
  protected readonly indexingStatusMessage = signal('');
  protected readonly indexingStatusTone = signal<'neutral' | 'success' | 'error'>('neutral');
  protected readonly uploadStatusMessage = signal('');
  protected readonly uploadStatusTone = signal<'neutral' | 'success' | 'error'>('neutral');
  protected readonly libraryStatusMessage = signal('');
  protected readonly libraryStatusTone = signal<'neutral' | 'success' | 'error'>('neutral');
  protected readonly modalStatusMessage = signal('');
  protected readonly modalStatusTone = signal<'neutral' | 'success' | 'error'>('neutral');
  protected readonly currentSettings = signal<SettingsPayload | null>(null);
  protected readonly openAiModels = signal<string[]>([]);
  protected readonly claudeModels = signal<string[]>([]);
  protected readonly refreshingOpenAi = signal(false);
  protected readonly refreshingClaude = signal(false);
  protected readonly documentsLoading = signal(false);
  protected readonly uploadingDocument = signal(false);
  protected readonly reindexingDocumentId = signal<number | null>(null);
  protected readonly productSearchLoading = signal(false);
  protected readonly acceptedDocumentTypes = ['PDF', 'DOCX', 'TXT', 'CSV'];
  protected readonly documents = signal<DocumentItem[]>([]);
  protected readonly totalDocuments = signal(0);
  protected readonly availableProducts = signal<ProductLinkItem[]>([]);
  protected readonly selectedDocument = signal<DocumentItem | null>(null);
  protected readonly linkedProducts = signal<ProductLinkItem[]>([]);
  protected readonly productToLink = signal('');
  protected readonly documentTitle = signal('');
  protected readonly currentQueuePage = signal(0);
  protected readonly productSearchQuery = signal('');
  protected readonly pendingDeleteDocument = signal<DocumentItem | null>(null);
  protected readonly widgetTabs = signal<SettingsUiShellTab[]>([
    { id: 'assistant', label: 'Assistant', section: 'widget', type: 'builtin', order: 10 },
    { id: 'diagnostics', label: 'Diagnostics', section: 'widget', type: 'builtin', order: 20 },
  ]);
  protected readonly activeWidgetTab = signal('assistant');
  protected readonly indexStatsLoading = signal(false);
  protected readonly indexStats = signal<IndexStatsResponse | null>(null);
  protected readonly diagnosticsQuery = signal('');
  protected readonly diagnosticsMode = signal<'vector' | 'keyword' | 'hybrid'>('hybrid');
  protected readonly diagnosticsLoading = signal(false);
  protected readonly diagnosticsLatency = signal<number | null>(null);
  protected readonly diagnosticsResults = signal<RetrievalDiagnosticResult[]>([]);
  protected readonly diagnosticsResultsOpen = signal(false);
  protected readonly diagnosticsHasRun = signal(false);

  protected readonly effectiveSummary = computed(() => this.currentSettings()?.effective ?? null);
  @ViewChild('documentQueue') private documentQueue?: ElementRef<HTMLElement>;
  @ViewChild('documentFileInput') private documentFileInput?: ElementRef<HTMLInputElement>;
  @ViewChild('externalWidgetTabHost') private externalWidgetTabHost?: ElementRef<HTMLElement>;

  protected readonly form = this.fb.nonNullable.group({
    providers: this.fb.nonNullable.group({
      chat: 'openai' as 'openai' | 'claude',
      embeddings: 'openai' as 'openai' | 'claude',
    }),
    keys: this.fb.nonNullable.group({
      openai: '',
      claude: '',
    }),
    models: this.fb.nonNullable.group({
      openaiChat: 'gpt-4o-mini',
      openaiEmbeddings: 'text-embedding-3-small',
      claudeChat: 'claude-3-5-sonnet-latest',
      claudeEmbeddings: 'claude-embedding-v1',
    }),
    claudeEmbeddingsUrl: '',
    widgetAutoInject: false,
    guardrails: this.fb.nonNullable.group({
      chatTitle: 'Woo Rag Assistant',
      welcomeMessage: 'Hi! I can help you find products and answer questions about your catalog.',
      systemPrompt: 'You are a WooCommerce assistant. Use only provided product context when possible and be concise.',
      maskPII: true,
      blockProfanity: false,
      blockCompetitors: false,
      competitorTokens: '',
    }),
  });

  constructor() {
    this.load();
  }

  ngOnDestroy(): void {
    this.clearDocumentRefreshTimer();
  }

  protected load(): void {
    this.loading.set(true);
    this.api
      .loadSettings()
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (settings) => {
          this.currentSettings.set(settings);
          this.openAiModels.set(this.uniqueModels([settings.models.openaiChat, settings.models.openaiEmbeddings]));
          this.claudeModels.set(this.uniqueModels([settings.models.claudeChat, settings.models.claudeEmbeddings]));
          this.form.reset({
            providers: settings.providers,
            keys: settings.keys,
            models: settings.models,
            claudeEmbeddingsUrl: settings.claudeEmbeddingsUrl,
            widgetAutoInject: settings.widgetAutoInject,
            guardrails: settings.guardrails,
          });
          this.loadDocuments();
          this.loadIndexStats();
          this.loadExtensionTabs();
        },
        error: (error) => this.setError(error, 'Could not load settings.'),
      });
  }

  protected save(): void {
    const existing = this.currentSettings();
    if (!existing || this.form.invalid) {
      return;
    }

    this.saving.set(true);
    this.setStatus('Saving changes...', 'neutral', 'global');
    const payload: SettingsPayload = {
      ...existing,
      ...this.form.getRawValue(),
      providers: this.form.getRawValue().providers,
      keys: this.form.getRawValue().keys,
      models: this.form.getRawValue().models,
      guardrails: this.form.getRawValue().guardrails,
    };

    this.api
      .saveSettings(payload)
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: (response) => {
          this.currentSettings.set(response.settings);
          this.setStatus(response.message, 'success', 'global');
          this.form.reset({
            providers: response.settings.providers,
            keys: response.settings.keys,
            models: response.settings.models,
            claudeEmbeddingsUrl: response.settings.claudeEmbeddingsUrl,
            widgetAutoInject: response.settings.widgetAutoInject,
            guardrails: response.settings.guardrails,
          });
        },
        error: (error) => this.setError(error, 'Could not save settings.', 'global'),
      });
  }

  protected queueIndex(): void {
    this.queueing.set(true);
    this.setStatus('Queueing product indexing...', 'neutral', 'indexing');
    this.api
      .queueIndex()
      .pipe(finalize(() => this.queueing.set(false)))
      .subscribe({
        next: (response) => this.setStatus(response.message, 'success', 'indexing'),
        error: (error) => this.setError(error, 'Could not queue indexing.', 'indexing'),
      });
  }

  protected refreshOpenAiModels(): void {
    const apiKey = this.form.controls.keys.controls.openai.value;
    this.refreshingOpenAi.set(true);
    this.api
      .listOpenAiModels(apiKey)
      .pipe(finalize(() => this.refreshingOpenAi.set(false)))
      .subscribe({
        next: (models) => {
          this.openAiModels.set(this.uniqueModels(models));
          this.setStatus(`Loaded ${models.length} OpenAI models.`, 'success', 'models');
        },
        error: (error) => this.setError(error, 'Could not load OpenAI models.', 'models'),
      });
  }

  protected refreshClaudeModels(): void {
    const apiKey = this.form.controls.keys.controls.claude.value;
    this.refreshingClaude.set(true);
    this.api
      .listClaudeModels(apiKey)
      .pipe(finalize(() => this.refreshingClaude.set(false)))
      .subscribe({
        next: (models) => {
          this.claudeModels.set(this.uniqueModels(models));
          this.setStatus(`Loaded ${models.length} Claude models.`, 'success', 'models');
        },
        error: (error) => this.setError(error, 'Could not load Claude models.', 'models'),
      });
  }

  protected currentYear(): number {
    return new Date().getFullYear();
  }

  protected setActiveWidgetTab(tabId: string): void {
    this.activeWidgetTab.set(tabId);

    if (tabId === 'diagnostics' && this.indexStats() === null && !this.indexStatsLoading()) {
      this.loadIndexStats();
    }

    if (this.isBuiltInWidgetTab(tabId)) {
      return;
    }

    void this.renderExternalWidgetTab(tabId);
  }

  protected scrollDocumentQueue(direction: 'left' | 'right'): void {
    const nextPage = direction === 'left'
      ? Math.max(0, this.currentQueuePage() - 1)
      : Math.min(this.documents().length - 1, this.currentQueuePage() + 1);
    this.scrollDocumentQueueToPage(nextPage);
  }

  protected scrollDocumentQueueToPage(pageIndex: number): void {
    const queue = this.documentQueue?.nativeElement;
    if (!queue) {
      return;
    }

    const clampedPage = Math.max(0, Math.min(this.documents().length - 1, pageIndex));
    const card = queue.children.item(clampedPage) as HTMLElement | null;
    if (!card) {
      return;
    }

    this.currentQueuePage.set(clampedPage);
    queue.scrollTo({
      left: card.offsetLeft,
      behavior: 'smooth',
    });
  }

  protected openReviewLinks(documentId: number): void {
    this.productToLink.set('');
    this.productSearchQuery.set('');
    this.productSearchLoading.set(true);
    this.api.getDocument(documentId)
      .pipe(finalize(() => this.productSearchLoading.set(false)))
      .subscribe({
        next: (response) => {
          this.selectedDocument.set(response.document);
          this.linkedProducts.set(response.linkedProducts);
          this.loadProductOptions('');
        },
        error: (error) => this.setError(error, 'Could not load document links.', 'modal'),
      });
  }

  protected closeReviewLinks(): void {
    this.selectedDocument.set(null);
    this.linkedProducts.set([]);
    this.productToLink.set('');
    this.availableProducts.set([]);
    this.productSearchQuery.set('');
  }

  protected setProductToLink(value: string): void {
    this.productToLink.set(value);
  }

  protected setProductSearchQuery(value: string): void {
    this.productSearchQuery.set(value);
  }

  protected browseForDocument(): void {
    this.documentFileInput?.nativeElement.click();
  }

  protected uploadSelectedDocument(event: Event): void {
    const input = event.target as HTMLInputElement | null;
    const file = input?.files?.[0];
    if (!file) {
      return;
    }

    this.uploadingDocument.set(true);
    this.setStatus('Uploading document...', 'neutral', 'upload');
    this.api.uploadDocument(file, this.documentTitle())
      .pipe(finalize(() => {
        this.uploadingDocument.set(false);
        if (input) {
          input.value = '';
        }
      }))
      .subscribe({
        next: (response) => {
          this.setStatus(`${response.document.title} uploaded and queued for processing.`, 'success', 'upload');
          this.documentTitle.set('');
          this.loadDocuments();
        },
        error: (error) => this.setError(error, 'Could not upload document.', 'upload'),
      });
  }

  protected setDocumentTitle(value: string): void {
    this.documentTitle.set(value);
  }

  protected setDiagnosticsQuery(value: string): void {
    this.diagnosticsQuery.set(value);
  }

  protected setDiagnosticsMode(value: string): void {
    if (value === 'vector' || value === 'keyword' || value === 'hybrid') {
      this.diagnosticsMode.set(value);
    }
  }

  protected closeDiagnosticsResults(): void {
    this.diagnosticsResultsOpen.set(false);
  }

  protected refreshIndexStats(): void {
    this.loadIndexStats();
  }

  protected runDiagnostics(): void {
    const query = this.diagnosticsQuery().trim();
    if (query === '') {
      this.diagnosticsResultsOpen.set(false);
      this.diagnosticsHasRun.set(false);
      this.setStatus('Enter a product question or keyword to run retrieval diagnostics.', 'error', 'diagnostics');
      return;
    }

    this.diagnosticsLoading.set(true);
    this.diagnosticsHasRun.set(true);
    this.api.runRetrievalDiagnostics(query, this.diagnosticsMode())
      .pipe(finalize(() => this.diagnosticsLoading.set(false)))
      .subscribe({
        next: (response) => {
          this.diagnosticsLatency.set(response.latencyMs);
          this.diagnosticsResults.set(response.results ?? []);
          if ((response.results ?? []).length === 0) {
            this.diagnosticsResultsOpen.set(false);
            this.setStatus('Diagnostics completed, but no matching products were returned for that query.', 'error', 'diagnostics');
            return;
          }

          this.diagnosticsResultsOpen.set(true);
          this.setStatus(`Diagnostics returned ${response.results.length} result${response.results.length === 1 ? '' : 's'}.`, 'success', 'diagnostics');
        },
        error: (error) => {
          this.diagnosticsResultsOpen.set(false);
          this.diagnosticsResults.set([]);
          this.setError(error, 'Could not run retrieval diagnostics.', 'diagnostics');
        },
      });
  }

  protected formatBytes(bytes: number): string {
    if (!Number.isFinite(bytes) || bytes <= 0) {
      return '0 B';
    }

    const units = ['B', 'KB', 'MB', 'GB'];
    let value = bytes;
    let unitIndex = 0;
    while (value >= 1024 && unitIndex < units.length - 1) {
      value /= 1024;
      unitIndex++;
    }

    return `${value >= 10 || unitIndex === 0 ? value.toFixed(0) : value.toFixed(1)} ${units[unitIndex]}`;
  }

  protected addLinkedProduct(): void {
    const selected = this.availableProducts().find((product) => String(product.id) === this.productToLink().trim());
    if (!selected || !this.selectedDocument()) {
      return;
    }

    const nextIds = [...this.linkedProducts().map((product) => product.id), selected.id];
    this.persistLinkedProducts(nextIds, 'Product linked.');
  }

  protected removeLinkedProduct(productId: number): void {
    if (!this.selectedDocument()) {
      return;
    }
    const nextIds = this.linkedProducts()
      .map((product) => product.id)
      .filter((id) => id !== productId);
    this.persistLinkedProducts(nextIds, 'Product link removed.');
  }

  protected reindexDocument(documentId: number): void {
    this.reindexingDocumentId.set(documentId);
    this.api.queueDocumentReindex(documentId)
      .pipe(finalize(() => this.reindexingDocumentId.set(null)))
      .subscribe({
        next: (response) => {
          this.setStatus(response.message, 'success', 'library');
          this.loadDocuments();
          this.scheduleDocumentRefresh();
        },
        error: (error) => this.setError(error, 'Could not queue document reindex.', 'library'),
      });
  }

  protected confirmDeleteDocument(documentId: number): void {
    const document = this.documents().find((item) => item.id === documentId) ?? this.selectedDocument();
    if (!document) {
      return;
    }

    this.pendingDeleteDocument.set(document);
  }

  protected cancelDeleteDocument(): void {
    this.pendingDeleteDocument.set(null);
  }

  protected deleteDocument(): void {
    const document = this.pendingDeleteDocument();
    if (!document) {
      return;
    }

    this.productSearchLoading.set(true);
    this.api.deleteDocument(document.id)
      .pipe(finalize(() => this.productSearchLoading.set(false)))
      .subscribe({
        next: (response) => {
          if (this.selectedDocument()?.id === document.id) {
            this.closeReviewLinks();
          }
          this.pendingDeleteDocument.set(null);
          this.setStatus(response.message, 'success', 'library');
          this.loadDocuments();
        },
        error: (error) => this.setError(error, 'Could not delete document.', 'library'),
      });
  }

  protected searchProducts(): void {
    this.loadProductOptions(this.productSearchQuery());
  }

  protected documentMimeLabel(document: DocumentItem): string {
    const mime = document.mime_type.toLowerCase();
    if (mime.includes('pdf')) {
      return 'PDF';
    }
    if (mime.includes('wordprocessingml')) {
      return 'DOCX';
    }
    if (mime.includes('csv')) {
      return 'CSV';
    }
    return 'TXT';
  }

  protected relativeUpdatedText(value: string): string {
    const date = new Date(value);
    const diffMs = Date.now() - date.getTime();
    if (!Number.isFinite(diffMs)) {
      return value;
    }
    const minutes = Math.max(0, Math.round(diffMs / 60000));
    if (minutes < 1) {
      return 'just now';
    }
    if (minutes < 60) {
      return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
    }
    const hours = Math.round(minutes / 60);
    if (hours < 24) {
      return `${hours} hour${hours === 1 ? '' : 's'} ago`;
    }
    const days = Math.round(hours / 24);
    return `${days} day${days === 1 ? '' : 's'} ago`;
  }

  private uniqueModels(models: string[]): string[] {
    return [...new Set(models.filter((model) => model.trim() !== ''))].sort((a, b) => a.localeCompare(b));
  }

  protected isBuiltInWidgetTab(tabId: string): boolean {
    return tabId === 'assistant' || tabId === 'diagnostics';
  }

  private loadIndexStats(): void {
    this.indexStatsLoading.set(true);
    this.api.loadIndexStats()
      .pipe(finalize(() => this.indexStatsLoading.set(false)))
      .subscribe({
        next: (response) => this.indexStats.set(response),
        error: (error) => this.setError(error, 'Could not load index diagnostics.', 'diagnostics'),
      });
  }

  private loadExtensionTabs(): void {
    this.extensions.loadWidgetTabs().subscribe({
      next: (tabs) => {
        if (tabs.length === 0) {
          return;
        }

        const merged = [...this.widgetTabs(), ...tabs]
          .filter((tab, index, all) => all.findIndex((candidate) => candidate.id === tab.id) === index)
          .sort((a, b) => a.order - b.order || a.label.localeCompare(b.label));
        this.widgetTabs.set(merged);
      },
      error: () => {
        // Manifest loading is optional; ignore missing premium assets silently.
      },
    });
  }

  private async renderExternalWidgetTab(tabId: string): Promise<void> {
    if (this.isBuiltInWidgetTab(tabId)) {
      return;
    }

    const host = this.externalWidgetTabHost?.nativeElement;
    if (!host) {
      window.setTimeout(() => {
        void this.renderExternalWidgetTab(tabId);
      }, 0);
      return;
    }

    host.replaceChildren();
    const tab = this.widgetTabs().find((candidate) => candidate.id === tabId);
    if (!tab || tab.type !== 'custom-element' || !tab.elementTag) {
      return;
    }

    try {
      await this.extensions.ensureTabScript(tab);
      const element = document.createElement(tab.elementTag);
      element.setAttribute('data-tab-id', tab.id);
      host.appendChild(element);
    } catch (error) {
      this.setError(error, `Could not load the ${tab.label} tab.`);
    }
  }

  private loadDocuments(): void {
    this.documentsLoading.set(true);
    this.api.loadDocuments()
      .pipe(finalize(() => this.documentsLoading.set(false)))
      .subscribe({
        next: (response) => {
          this.documents.set(response.documents);
          this.totalDocuments.set(response.pagination.total);
          this.currentQueuePage.set(0);
          if (this.hasPendingDocuments(response.documents)) {
            this.scheduleDocumentRefresh();
          } else {
            this.clearDocumentRefreshTimer();
          }
        },
        error: (error) => this.setError(error, 'Could not load Product Intelligence Engine documents.', 'library'),
      });
  }

  private hasPendingDocuments(documents: DocumentItem[]): boolean {
    return documents.some((document) => {
      const status = String(document.status || '').toLowerCase();
      return status === 'uploaded' || status === 'processing' || status === 'needs_reindex';
    });
  }

  private scheduleDocumentRefresh(delayMs = 4000): void {
    if (this.documentRefreshTimeoutId !== null) {
      return;
    }

    this.documentRefreshTimeoutId = window.setTimeout(() => {
      this.documentRefreshTimeoutId = null;
      this.loadDocuments();
    }, delayMs);
  }

  private clearDocumentRefreshTimer(): void {
    if (this.documentRefreshTimeoutId !== null) {
      window.clearTimeout(this.documentRefreshTimeoutId);
      this.documentRefreshTimeoutId = null;
    }
  }

  private loadProductOptions(query: string): void {
    this.productSearchLoading.set(true);
    this.api.searchProducts(query)
      .pipe(finalize(() => this.productSearchLoading.set(false)))
      .subscribe({
        next: (products) => this.availableProducts.set(products),
        error: (error) => this.setError(error, 'Could not search products.', 'modal'),
      });
  }

  private persistLinkedProducts(productIds: number[], successMessage: string): void {
    const document = this.selectedDocument();
    if (!document) {
      return;
    }

    this.productSearchLoading.set(true);
    this.api.updateDocumentLinks(document.id, productIds)
      .pipe(finalize(() => this.productSearchLoading.set(false)))
      .subscribe({
        next: (response) => {
          this.selectedDocument.set(response.document);
          this.linkedProducts.set(response.linkedProducts);
          this.productToLink.set('');
          this.setStatus(successMessage, 'success', 'modal');
          this.loadDocuments();
        },
        error: (error) => this.setError(error, 'Could not update document links.', 'modal'),
      });
  }

  private setStatus(message: string, tone: 'neutral' | 'success' | 'error', scope: 'global' | 'models' | 'diagnostics' | 'indexing' | 'upload' | 'library' | 'modal' = 'global'): void {
    const normalized = String(message || '');
    this.clearStatusTimeout(scope);
    switch (scope) {
      case 'models':
        this.modelsStatusMessage.set(normalized);
        this.modelsStatusTone.set(tone);
        this.scheduleStatusClear(scope, normalized);
        return;
      case 'diagnostics':
        this.diagnosticsStatusMessage.set(normalized);
        this.diagnosticsStatusTone.set(tone);
        this.scheduleStatusClear(scope, normalized);
        return;
      case 'indexing':
        this.indexingStatusMessage.set(normalized);
        this.indexingStatusTone.set(tone);
        this.scheduleStatusClear(scope, normalized);
        return;
      case 'upload':
        this.uploadStatusMessage.set(normalized);
        this.uploadStatusTone.set(tone);
        this.scheduleStatusClear(scope, normalized);
        return;
      case 'library':
        this.libraryStatusMessage.set(normalized);
        this.libraryStatusTone.set(tone);
        this.scheduleStatusClear(scope, normalized);
        return;
      case 'modal':
        this.modalStatusMessage.set(normalized);
        this.modalStatusTone.set(tone);
        this.scheduleStatusClear(scope, normalized);
        return;
      default:
        this.statusMessage.set(normalized);
        this.statusTone.set(tone);
        this.scheduleStatusClear(scope, normalized);
    }
  }

  private setError(error: unknown, fallback: string, scope: 'global' | 'models' | 'diagnostics' | 'indexing' | 'upload' | 'library' | 'modal' = 'global'): void {
    const message = error instanceof HttpErrorResponse
      ? (error.error?.data?.message ?? error.error?.message ?? fallback)
      : fallback;
    this.setStatus(String(message || fallback), 'error', scope);
  }

  private scheduleStatusClear(scope: 'global' | 'models' | 'diagnostics' | 'indexing' | 'upload' | 'library' | 'modal', message: string): void {
    if (message === '') {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      this.clearStatus(scope);
      this.statusTimeouts.delete(scope);
    }, 5000);
    this.statusTimeouts.set(scope, timeoutId);
  }

  private clearStatusTimeout(scope: 'global' | 'models' | 'diagnostics' | 'indexing' | 'upload' | 'library' | 'modal'): void {
    const timeoutId = this.statusTimeouts.get(scope);
    if (timeoutId !== undefined) {
      window.clearTimeout(timeoutId);
      this.statusTimeouts.delete(scope);
    }
  }

  private clearStatus(scope: 'global' | 'models' | 'diagnostics' | 'indexing' | 'upload' | 'library' | 'modal'): void {
    switch (scope) {
      case 'models':
        this.modelsStatusMessage.set('');
        return;
      case 'diagnostics':
        this.diagnosticsStatusMessage.set('');
        return;
      case 'indexing':
        this.indexingStatusMessage.set('');
        return;
      case 'upload':
        this.uploadStatusMessage.set('');
        return;
      case 'library':
        this.libraryStatusMessage.set('');
        return;
      case 'modal':
        this.modalStatusMessage.set('');
        return;
      default:
        this.statusMessage.set('');
    }
  }
}
