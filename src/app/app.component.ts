import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, ElementRef, ViewChild, ViewEncapsulation, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { finalize } from 'rxjs';
import { SettingsApiService } from './settings-api.service';
import { SETTINGS_UI_CONFIG } from './settings-config.token';
import { DocumentItem, ProductLinkItem, SettingsPayload } from './settings.models';

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
  protected readonly config = inject(SETTINGS_UI_CONFIG);

  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly queueing = signal(false);
  protected readonly statusMessage = signal('');
  protected readonly statusTone = signal<'neutral' | 'success' | 'error'>('neutral');
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

  protected readonly effectiveSummary = computed(() => this.currentSettings()?.effective ?? null);
  @ViewChild('documentQueue') private documentQueue?: ElementRef<HTMLElement>;
  @ViewChild('documentFileInput') private documentFileInput?: ElementRef<HTMLInputElement>;

  protected readonly form = this.fb.nonNullable.group({
    useSeparateLlmKeys: true,
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
            useSeparateLlmKeys: settings.useSeparateLlmKeys,
            providers: settings.providers,
            keys: settings.keys,
            models: settings.models,
            claudeEmbeddingsUrl: settings.claudeEmbeddingsUrl,
            widgetAutoInject: settings.widgetAutoInject,
            guardrails: settings.guardrails,
          });
          this.loadDocuments();
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
    this.setStatus('Saving changes...', 'neutral');
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
          this.setStatus(response.message, 'success');
          this.form.reset({
            useSeparateLlmKeys: response.settings.useSeparateLlmKeys,
            providers: response.settings.providers,
            keys: response.settings.keys,
            models: response.settings.models,
            claudeEmbeddingsUrl: response.settings.claudeEmbeddingsUrl,
            widgetAutoInject: response.settings.widgetAutoInject,
            guardrails: response.settings.guardrails,
          });
        },
        error: (error) => this.setError(error, 'Could not save settings.'),
      });
  }

  protected queueIndex(): void {
    this.queueing.set(true);
    this.setStatus('Queueing product indexing...', 'neutral');
    this.api
      .queueIndex()
      .pipe(finalize(() => this.queueing.set(false)))
      .subscribe({
        next: (response) => this.setStatus(response.message, 'success'),
        error: (error) => this.setError(error, 'Could not queue indexing.'),
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
          this.setStatus(`Loaded ${models.length} OpenAI models.`, 'success');
        },
        error: (error) => this.setError(error, 'Could not load OpenAI models.'),
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
          this.setStatus(`Loaded ${models.length} Claude models.`, 'success');
        },
        error: (error) => this.setError(error, 'Could not load Claude models.'),
      });
  }

  protected isUsingSharedKeys(): boolean {
    return !!this.currentSettings()?.sharedKeysAvailable && !this.form.controls.useSeparateLlmKeys.value;
  }

  protected currentYear(): number {
    return new Date().getFullYear();
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
        error: (error) => this.setError(error, 'Could not load document links.'),
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
    this.setStatus('Uploading document...', 'neutral');
    this.api.uploadDocument(file, this.documentTitle())
      .pipe(finalize(() => {
        this.uploadingDocument.set(false);
        if (input) {
          input.value = '';
        }
      }))
      .subscribe({
        next: (response) => {
          this.setStatus(`${response.document.title} uploaded and queued for processing.`, 'success');
          this.documentTitle.set('');
          this.loadDocuments();
        },
        error: (error) => this.setError(error, 'Could not upload document.'),
      });
  }

  protected setDocumentTitle(value: string): void {
    this.documentTitle.set(value);
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
          this.setStatus(response.message, 'success');
          this.loadDocuments();
        },
        error: (error) => this.setError(error, 'Could not queue document reindex.'),
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

  private loadDocuments(): void {
    this.documentsLoading.set(true);
    this.api.loadDocuments()
      .pipe(finalize(() => this.documentsLoading.set(false)))
      .subscribe({
        next: (response) => {
          this.documents.set(response.documents);
          this.totalDocuments.set(response.pagination.total);
          this.currentQueuePage.set(0);
        },
        error: (error) => this.setError(error, 'Could not load Product Intelligence Engine documents.'),
      });
  }

  private loadProductOptions(query: string): void {
    this.productSearchLoading.set(true);
    this.api.searchProducts(query)
      .pipe(finalize(() => this.productSearchLoading.set(false)))
      .subscribe({
        next: (products) => this.availableProducts.set(products),
        error: (error) => this.setError(error, 'Could not search products.'),
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
          this.setStatus(successMessage, 'success');
          this.loadDocuments();
        },
        error: (error) => this.setError(error, 'Could not update document links.'),
      });
  }

  private setStatus(message: string, tone: 'neutral' | 'success' | 'error'): void {
    this.statusMessage.set(message);
    this.statusTone.set(tone);
  }

  private setError(error: unknown, fallback: string): void {
    const message = error instanceof HttpErrorResponse
      ? (error.error?.data?.message ?? error.error?.message ?? fallback)
      : fallback;
    this.setStatus(String(message || fallback), 'error');
  }
}
