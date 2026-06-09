import { randomUUID } from 'node:crypto';

import { Injectable, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';

export type RequestWithId = Request & {
  requestId?: string;
};

@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(req: RequestWithId, res: Response, next: NextFunction): void {
    const requestId = req.header('x-request-id') ?? `req_${randomUUID()}`;
    req.requestId = requestId;
    res.setHeader('x-request-id', requestId);
    next();
  }
}
