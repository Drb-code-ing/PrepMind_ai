import { HttpStatus } from '@nestjs/common';
import mammoth from 'mammoth';
import { PDFParse } from 'pdf-parse';

import { AppError } from '../common/errors/app-error';
import { DocumentParserService } from './document-parser.service';

jest.mock('mammoth', () => ({
  __esModule: true,
  default: {
    extractRawText: jest
      .fn()
      .mockResolvedValue({ value: 'Docx text\n\n第二段' }),
  },
}));

jest.mock('pdf-parse', () => ({
  __esModule: true,
  PDFParse: jest.fn().mockImplementation(() => ({
    destroy: jest.fn().mockResolvedValue(undefined),
    getText: jest
      .fn()
      .mockResolvedValue({ text: 'Pdf text\n\n第二页', total: 2 }),
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
      buffer: Buffer.from(
        '第一行\r\nA\tB\r\nC\fD\r\nE\vF\r\nG\u001eH\r\nI\u0000J\r\nK\u0007L\r\nM\u0085N\r\n\r\n\r\n第三行',
      ),
    });

    expect(result).toEqual({
      text: '第一行\nA B\nC\nD\nE\nF\nG\nH\nI J\nK L\nM N\n\n第三行',
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
      buffer: Buffer.from(
        '# 第一章\n正文\n## 格林公式\n### 小节\n# C#\n# Title #',
      ),
    });

    expect(result).toEqual({
      text: '# 第一章\n正文\n## 格林公式\n### 小节\n# C#\n# Title #',
      metadata: {
        sourceName: 'green.md',
        mimeType: 'text/markdown',
        parser: 'markdown-basic',
        headings: ['第一章', '格林公式', '小节', 'C#', 'Title'],
      },
    });
  });

  it('parses docx with mammoth raw text extraction', async () => {
    const buffer = Buffer.from('docx bytes');

    const result = await createService().parse({
      name: 'chapter.docx',
      type: 'DOCX',
      mimeType:
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      buffer,
    });

    expect(mammoth.extractRawText).toHaveBeenCalledWith({ buffer });
    expect(result).toEqual({
      text: 'Docx text\n\n第二段',
      metadata: {
        sourceName: 'chapter.docx',
        mimeType:
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        parser: 'docx-mammoth',
      },
    });
  });

  it('wraps docx parser failures with diagnostic cause', async () => {
    const parseError = new Error('mammoth failed');
    (mammoth.extractRawText as jest.Mock).mockRejectedValueOnce(parseError);

    await expect(
      createService().parse({
        name: 'broken.docx',
        type: 'DOCX',
        mimeType:
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        buffer: Buffer.from('docx bytes'),
      }),
    ).rejects.toMatchObject({
      code: 'KNOWLEDGE_DOCUMENT_PARSE_FAILED',
      message: '资料解析失败，请稍后重试',
      statusCode: HttpStatus.UNPROCESSABLE_ENTITY,
      cause: parseError,
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

  it('returns successful pdf parse result when cleanup fails', async () => {
    const destroyError = new Error('pdf destroy failed');
    (PDFParse as jest.Mock).mockImplementationOnce(() => ({
      destroy: jest.fn().mockRejectedValue(destroyError),
      getText: jest.fn().mockResolvedValue({ text: 'Pdf text', total: 1 }),
    }));

    const result = await createService().parse({
      name: 'cleanup-fails.pdf',
      type: 'PDF',
      mimeType: 'application/pdf',
      buffer: Buffer.from('pdf bytes'),
    });

    expect(result).toEqual({
      text: 'Pdf text',
      metadata: {
        sourceName: 'cleanup-fails.pdf',
        mimeType: 'application/pdf',
        parser: 'pdf-basic',
        pageCount: 1,
      },
    });
  });

  it('wraps pdf constructor failures with diagnostic cause', async () => {
    const constructorError = new Error('pdf constructor failed');
    (PDFParse as jest.Mock).mockImplementationOnce(() => {
      throw constructorError;
    });

    await expect(
      createService().parse({
        name: 'broken.pdf',
        type: 'PDF',
        mimeType: 'application/pdf',
        buffer: Buffer.from('pdf bytes'),
      }),
    ).rejects.toMatchObject({
      code: 'KNOWLEDGE_DOCUMENT_PARSE_FAILED',
      message: '资料解析失败，请稍后重试',
      statusCode: HttpStatus.UNPROCESSABLE_ENTITY,
      cause: constructorError,
    });
  });

  it('wraps pdf parser failures and preserves parse cause when cleanup also fails', async () => {
    const parseError = new Error('pdf parse failed');
    const destroyError = new Error('pdf destroy failed');
    (PDFParse as jest.Mock).mockImplementationOnce(() => ({
      destroy: jest.fn().mockRejectedValue(destroyError),
      getText: jest.fn().mockRejectedValue(parseError),
    }));

    await expect(
      createService().parse({
        name: 'broken.pdf',
        type: 'PDF',
        mimeType: 'application/pdf',
        buffer: Buffer.from('pdf bytes'),
      }),
    ).rejects.toMatchObject({
      code: 'KNOWLEDGE_DOCUMENT_PARSE_FAILED',
      message: '资料解析失败，请稍后重试',
      statusCode: HttpStatus.UNPROCESSABLE_ENTITY,
      cause: parseError,
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
