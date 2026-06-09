import { Controller, Get } from '@nestjs/common';

@Controller('health')
export class HealthController {
  @Get()
  getHealth(): { status: 'ok'; service: 'prepmind-server' } {
    return {
      status: 'ok',
      service: 'prepmind-server',
    };
  }
}
