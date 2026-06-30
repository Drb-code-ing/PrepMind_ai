import { Global, Module } from '@nestjs/common';

import { InProcessEventBus } from './event-bus';

export const EVENT_BUS = Symbol('EVENT_BUS');

@Global()
@Module({
  providers: [{ provide: EVENT_BUS, useClass: InProcessEventBus }],
  exports: [EVENT_BUS],
})
export class EventsModule {}
