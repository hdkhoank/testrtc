import { EventEmitter } from 'events';

export class WebSocketWrapper extends EventEmitter {
  private ws!: WebSocket;

  onclose!: ((this: WebSocketWrapper, ev: CloseEvent) => any) | null;
  onerror!: ((this: WebSocketWrapper, ev: Event) => any) | null;
  onmessage!: ((this: WebSocketWrapper, ev: MessageEvent) => any) | null;
  onopen!: ((this: WebSocketWrapper, ev: Event) => any) | null;

  _ping_pong = 0;
  _ping_pong_interval: any;
  _online_event: any = null;
  _offline_event: any = null;

  constructor(public url: string, private protocols?: string | string[]) {
    super();

    this.keepWSAlive();

    window.addEventListener(
      'offline',
      (this._offline_event = () => {
        // console.log("offline")
        this.emit('offline');
      }),
    );

    window.addEventListener(
      'online',
      (this._online_event = () => {
        // console.log("online")
        this.emit('online');
      }),
    );

    this._ping_pong_interval = setInterval(() => {
      try {
        if (this._ping_pong >= 3) {
          this.emit('error');
          this._ping_pong = 0;
        }
        this.ws.send('ping');
        this._ping_pong++;
      } catch { }
    }, 3000);

    this.on('pong', () => (this._ping_pong = 0));
  }

  private wait(done: string, error = '') {
    let resolve: any, reject: any;
    return new Promise((rs, rj) => {
      resolve = rs;
      reject = rj;
      this.once(done, resolve);
      error && this.once(error, reject);
    }).finally(() => {
      this.removeListener(done, resolve);
      error && this.removeListener(error, reject);
    });
  }

  private async keepWSAlive() {
    let first = true;

    while (!this._closed) {
      try {
        console.log('[ws] initting');

        await this.initWS();

        this.emit("status", "online")

        console.log('[ws] connected');

        if (!first) this.emit('ws-restart');

        first = false;

        await Promise.race([
          this.wait('error'),
          // this.wait("close"),
          this.wait('offline').then(e => this.wait('online')),
        ]);

        !this._closed && this.emit("status", "offline")

        console.log('[ws] dropped');

        await new Promise(r => setTimeout(r, 1000));

        !this._closed && console.log('[ws] re try');
      } catch (error) {
        console.error(error);
        console.log('[ws] failed re try');

        await new Promise(r => setTimeout(r, 5000));
      }
    }
  }

  private async initWS() {
    if (this._binaryType !== undefined) this.ws.binaryType = this.binaryType;

    if (this.ws) {
      this.ws.onopen = null;
      this.ws.onclose = null;
      this.ws.onerror = null;
      this.ws.onmessage = null;
    }

    this.ws = new WebSocket(this.url, this.protocols);

    this.ws.onopen = data => {
      this.emit('open', data);
      this.onopen && this.onopen(data);
    };

    this.ws.onclose = data => {
      if (this._closed) {
        console.log('[ws] Closed');
        this.emit('close', data);
        this.onclose && this.onclose(data);
      }
    };

    this.ws.onerror = data => {
      console.log('[ws] Error');

      this.emit('error', data);
      this.onerror && this.onerror(data);
    };

    this.ws.onmessage = data => {
      if (data.data + '' == 'pong') return this.emit('pong');

      this.emit('message', data);
      this.onmessage && this.onmessage(data);
    };

    this.ws.addEventListener('pong', e => console.log('pong'));

    await this.wait('open', 'error');
  }

  _closed = false;

  close(code?: number, reason?: string) {
    this._closed = true;
    clearInterval(this._ping_pong_interval);
    window.removeEventListener('online', this._online_event);
    window.removeEventListener('offline', this._offline_event);
    console.trace("ws close " + this.url)
    return this.ws.close(code, reason);
  }

  send(data: string | ArrayBufferLike | Blob | ArrayBufferView) {
    return this.ws.send(data);
  }

  private _binaryType!: BinaryType;

  get binaryType(): BinaryType {
    return this.ws.binaryType;
  }

  set binaryType(binaryType: BinaryType) {
    this.ws.binaryType = binaryType;
    this._binaryType = binaryType;
  }

  get bufferedAmount(): number {
    return this.ws.bufferedAmount;
  }

  get extensions(): string {
    return this.ws.extensions;
  }

  get protocol(): string {
    return this.ws.protocol;
  }
  get readyState(): number {
    return this.ws.readyState;
  }

  get CLOSED(): number {
    return this.ws.CLOSED;
  }
  get CLOSING(): number {
    return this.ws.CLOSING;
  }
  get CONNECTING(): number {
    return this.ws.CONNECTING;
  }
  get OPEN(): number {
    return this.ws.OPEN;
  }
}
