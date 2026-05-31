import { Injectable } from '@nestjs/common';
import { Observable, Subject } from 'rxjs';
import { NotificationEvent } from './notification-event';

@Injectable()
export class NotificationEventBus {
  private readonly eventsSubject = new Subject<NotificationEvent>();

  events$(): Observable<NotificationEvent> {
    return this.eventsSubject.asObservable();
  }

  publish(event: NotificationEvent): void {
    this.eventsSubject.next(event);
  }
}
