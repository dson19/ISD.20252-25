import { Injectable, Logger } from '@nestjs/common';
import { Observable, Subject } from 'rxjs';
import { NotificationEvent } from './notification-event';

@Injectable()
export class NotificationEventBus {
  private readonly logger = new Logger(NotificationEventBus.name);
  private readonly eventsSubject = new Subject<NotificationEvent>();

  events$(): Observable<NotificationEvent> {
    return this.eventsSubject.asObservable();
  }

  publish(event: NotificationEvent): void {
    this.logger.log(`Publishing ${event.type} notification for order #${event.orderId}`);
    this.eventsSubject.next(event);
  }
}
