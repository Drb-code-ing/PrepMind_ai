import { HttpStatus } from '@nestjs/common';
import mammoth from 'mammoth';
import { PDFParse } from 'pdf-parse';

import { AppError } from '../common/errors/app-error';
import { DocumentParserService } from './document-parser.service';

jest.mock('mammoth', () => ({
  __esModule: true,
  default: {
    extractRawText: jest.fn().mockResolvedValue({ value: 'Docx text\n\n第二段' }),
  },
}));

jest.mock('pdf-parse', () => ({
  __esModule: true,
  PDFParse: jest.fn().mockImplementation(() => ({
    destroy: jest.fn().mockResolvedValue(undefined),
    getText: jest.fn().mockResolvedValue({ text: 'Pdf text\n\n第二页', total: 2 }),
  })),
}));

describe('DocumentParserService', () => {
  function createService() {
    return new DocumentParserService();
  }

  it('parses txt with normalized text and txt metadata', async () => {
    const result = await createService().parse({
      name: 'notes.txt',
      type: 'TXT',
      mimeType: 'text/plain',
      buffer: Buffer.from('第一行\r\n第二行\u0000\u0007\t\r\n\r\n\r\n第三行'),
    });

    expect(result).toEqual({
      text: '第一行\n第二行\n\n第三行',
      metadata: {
        sourceName: 'notes.txt',
        mimeType: 'text/plain',
        parser: 'txt-basic',
      },
    });
  });

  it('parses markdown headings with markdown metadata', async () => {
    const result = await createService().parse({
      name: 'green.md',
      type: 'MD',
      mimeType: 'text/markdown',
      buffer: Buffer.from('# 第一章\n正文\n## 格林公式\n### 小节'),
    });

    expect(result).toEqual({
      text: '# 第一章\n正文\n## 格林公式\n### 小节',
      metadata: {
        sourceName: 'green.md',
        mimeType: 'text/markdown',
        parser: 'markdown-basic',
        headings: ['第一章', '格林公式', '小节'],
      },
    });
  });

  it('parses docx with mammoth raw text extraction', async () => {
    const buffer = Buffer.from('docx bytes');

    const result = await createService().parse({
      name: 'chapter.docx',
      type: 'DOCX',
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      buffer,
    });

    expect(mammoth.extractRawText).toHaveBeenCalledWith({ buffer });
    expect(result).toEqual({
      text: 'Docx text\n\n第二段',
      metadata: {
        sourceName: 'chapter.docx',
        mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        parser: 'docx-mammoth',
      },
    });
  });

  it('parses pdf text and page count', async () => {
    const buffer = Buffer.from('pdf bytes');

    const result = await createService().parse({
      name: 'calculus.pdf',
      type: 'PDF',
      mimeType: 'application/pdf',
      buffer,
    });

    expect(PDFParse).toHaveBeenCalledWith({ data: buffer });
    expect(result).toEqual({
      text: 'Pdf text\n\n第二页',
      metadata: {
        sourceName: 'calculus.pdf',
        mimeType: 'application/pdf',
        parser: 'pdf-basic',
        pageCount: 2,
      },
    });
  });

  it('throws app error for empty parsed text', async () => {
    await expect(
      createService().parse({
        name: 'empty.txt',
        type: 'TXT',
        mimeType: 'text/plain',
        buffer: Buffer.from('\u0000\u0007\r\n\r\n'),
      }),
    ).rejects.toMatchObject<AppError>({
      code: 'KNOWLEDGE_DOCUMENT_EMPTY_TEXT',
      message: '资料中没有可解析的文本',
      statusCode: HttpStatus.UNPROCESSABLE_ENTITY,
    });
  });
});
