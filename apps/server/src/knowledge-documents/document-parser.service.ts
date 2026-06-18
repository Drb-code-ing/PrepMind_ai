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
        return this.createParsedDocument(
          input,
          input.buffer.toString('utf8'),
          'txt-basic',
        );
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

    return this.createParsedDocument(input, text, 'markdown-basic', {
      headings,
    });
  }

  private async createDocxDocument(input: ParseDocumentInput) {
    let result: Awaited<ReturnType<typeof mammoth.extractRawText>>;

    try {
      result = await mammoth.extractRawText({ buffer: input.buffer });
    } catch (error) {
      throw this.createParseFailedError(error);
    }

    return this.createParsedDocument(input, result.value, 'docx-mammoth');
  }

  private async createPdfDocument(input: ParseDocumentInput) {
    let parser: PDFParse;

    try {
      parser = new PDFParse({ data: input.buffer });
    } catch (error) {
      throw this.createParseFailedError(error);
    }

    let result: Awaited<ReturnType<PDFParse['getText']>>;

    try {
      result = await parser.getText();
    } catch (error) {
      await this.destroyPdfParserBestEffort(parser);
      throw this.createParseFailedError(error);
    }

    let parsedDocument: ParsedDocument;
    try {
      parsedDocument = this.createParsedDocument(
        input,
        result.text,
        'pdf-basic',
        {
          pageCount: result.total,
        },
      );
    } catch (error) {
      await this.destroyPdfParserBestEffort(parser);
      throw error;
    }

    await this.destroyPdfParserBestEffort(parser);
    return parsedDocument;
  }

  private async destroyPdfParserBestEffort(parser: PDFParse) {
    try {
      await parser.destroy();
    } catch {
      // Cleanup must not mask parsed output or the original parse/normalization error.
    }
  }

  private createParseFailedError(cause: unknown) {
    const error = new AppError(
      'KNOWLEDGE_DOCUMENT_PARSE_FAILED',
      '资料解析失败，请稍后重试',
      HttpStatus.UNPROCESSABLE_ENTITY,
    );
    (error as AppError & { cause?: unknown }).cause = cause;
    return error;
  }

  private normalizeText(text: string) {
    return this.collapseExcessiveBlankLines(
      this.normalizeCharacters(text),
    ).trim();
  }

  private normalizeCharacters(text: string) {
    const normalized: string[] = [];

    for (let index = 0; index < text.length; index += 1) {
      const code = text.charCodeAt(index);

      if (code === 13) {
        if (text.charCodeAt(index + 1) === 10) {
          index += 1;
        }
        normalized.push('\n');
        continue;
      }

      if (code === 10) {
        normalized.push('\n');
        continue;
      }

      if (code === 9) {
        normalized.push(' ');
        continue;
      }

      if (code === 11 || code === 12 || (code >= 28 && code <= 31)) {
        normalized.push('\n');
        continue;
      }

      if (
        (code >= 0 && code <= 8) ||
        (code >= 14 && code <= 27) ||
        code === 127 ||
        (code >= 128 && code <= 159)
      ) {
        normalized.push(' ');
        continue;
      }

      normalized.push(text[index]);
    }

    return normalized.join('');
  }

  private collapseExcessiveBlankLines(text: string) {
    const normalizedLines: string[] = [];
    let blankLineCount = 0;

    for (const line of text.split('\n')) {
      if (line.trim() === '') {
        blankLineCount += 1;
        if (blankLineCount <= 1) {
          normalizedLines.push('');
        }
      } else {
        blankLineCount = 0;
        normalizedLines.push(line);
      }
    }

    return normalizedLines.join('\n');
  }

  private extractMarkdownHeadings(text: string) {
    return text
      .split('\n')
      .map((line) => {
        const heading = line.match(/^#{1,6}\s+(.+?)\s*$/)?.[1]?.trim();
        return heading?.replace(/\s+#+$/, '').trim();
      })
      .filter((heading): heading is string => Boolean(heading));
  }
}
