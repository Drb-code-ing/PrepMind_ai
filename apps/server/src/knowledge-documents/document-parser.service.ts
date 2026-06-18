import { HttpStatus, Injectable } from '@nestjs/common';
import type { KnowledgeDocumentType } from '@repo/types/api/knowledge';
import mammoth from 'mammoth';
import { PDFParse } from 'pdf-parse';

import { AppError } from '../common/errors/app-error';

export type ParseDocumentInput = {
  name: string;
  type: KnowledgeDocumentType;
  mimeType: string;
  buffer: Buffer;
};

export type ParsedDocument = {
  text: string;
  metadata: {
    sourceName: string;
    mimeType: string;
    parser: string;
    pageCount?: number;
    headings?: string[];
  };
};

@Injectable()
export class DocumentParserService {
  async parse(input: ParseDocumentInput): Promise<ParsedDocument> {
    switch (input.type) {
      case 'TXT':
        return this.createParsedDocument(input, input.buffer.toString('utf8'), 'txt-basic');
      case 'MD':
        return this.createMarkdownDocument(input);
      case 'DOCX':
        return this.createDocxDocument(input);
      case 'PDF':
        return this.createPdfDocument(input);
    }
  }

  private createParsedDocument(
    input: ParseDocumentInput,
    rawText: string,
    parser: string,
    extraMetadata: Partial<ParsedDocument['metadata']> = {},
  ): ParsedDocument {
    const text = this.normalizeText(rawText);
    if (!text) {
      throw new AppError(
        'KNOWLEDGE_DOCUMENT_EMPTY_TEXT',
        '资料中没有可解析的文本',
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }

    return {
      text,
      metadata: {
        sourceName: input.name,
        mimeType: input.mimeType,
        parser,
        ...extraMetadata,
      },
    };
  }

  private createMarkdownDocument(input: ParseDocumentInput) {
    const rawText = input.buffer.toString('utf8');
    const text = this.normalizeText(rawText);
    const headings = this.extractMarkdownHeadings(text);

    return this.createParsedDocument(input, text, 'markdown-basic', { headings });
  }

  private async createDocxDocument(input: ParseDocumentInput) {
    const result = await mammoth.extractRawText({ buffer: input.buffer });
    return this.createParsedDocument(input, result.value, 'docx-mammoth');
  }

  private async createPdfDocument(input: ParseDocumentInput) {
    const parser = new PDFParse({ data: input.buffer });
    let parseError: unknown;

    try {
      const result = await parser.getText();
      return this.createParsedDocument(input, result.text, 'pdf-basic', {
        pageCount: result.total,
      });
    } catch (error) {
      parseError = error;
      throw error;
    } finally {
      try {
        await parser.destroy();
      } catch (error) {
        if (!parseError) {
          throw error;
        }
      }
    }
  }

  private normalizeText(text: string) {
    return text
      .replace(/\r\n?/g, '\n')
      .replace(/[\u0000-\u0009\u000B-\u001F\u007F]/g, '')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  private extractMarkdownHeadings(text: string) {
    return text
      .split('\n')
      .map((line) => line.match(/^#{1,6}\s+(.+?)\s*#*\s*$/)?.[1]?.trim())
      .filter((heading): heading is string => Boolean(heading));
  }
}
