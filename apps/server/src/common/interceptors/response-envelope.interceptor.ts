import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  StreamableFile,
} from '@nestjs/common';
import { map, Observable } from 'rxjs';

type RequestWithId = {
  requestId?: string;
};

@Injectable()
export class ResponseEnvelopeInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<RequestWithId>();

    return next.handle().pipe(
      map((data: unknown) => {
        if (data instanceof StreamableFile) return data;

        return {
          success: true,
          data,
          requestId: request.requestId ?? 'unknown',
        };
      }),
    );
  }
}
