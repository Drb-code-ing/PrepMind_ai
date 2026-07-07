import { KnowledgeDocumentsController } from './knowledge-documents.controller';

describe('KnowledgeDocumentsController', () => {
  it('routes process requests through DocumentProcessingJobService', async () => {
    const service = {
      enqueueOrRun: jest.fn().mockResolvedValue({ id: 'doc_1' }),
    };
    const controller = new KnowledgeDocumentsController(
      {} as never,
      service as never,
    );

    await controller.process(
      { id: 'user_1', email: 'u@example.com', role: 'STUDENT' },
      'doc_1',
      { force: false },
    );

    expect(service.enqueueOrRun).toHaveBeenCalledWith('user_1', 'doc_1', {
      force: false,
    });
  });
});
