import { AdvanceEventEmitter } from './AdvanceEventEmitter';
import { WebSocketWrapper } from './WSNative';

export class WSWrapper extends AdvanceEventEmitter {
  private ws!: WebSocketWrapper;
  private connected!: Promise<void>;
  constructor(public url: string) {
    super();
    this.init();
  }
  init() {
    this.ws = new WebSocketWrapper(this.url);
    this.ws.onmessage = msg => {
      let d = msg.data;
      try {
        let datas = JSON.parse(d);
        this.emit("message", ...datas);
        this.emit(...<[string]>datas);
      }
      catch { }
    };
    this.connected = new Promise((rs, rj) => {
      this.ws.onopen = () => rs();
      this.ws.onerror = () => rj();
    });
  }
  async send(...datas: any[]) {
    await this.connected;
    this.ws.send(JSON.stringify(datas));
  }
}
