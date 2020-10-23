import { AdvanceEventEmitter } from './AdvanceEventEmitter';
import { WSWrapper } from './WSWrapper';



export class Signal extends AdvanceEventEmitter {

  wsWrapper = new WSWrapper(`wss://signal-conference-staging.quickom.com?id=${this.signalId}`);

  constructor(public signalId: string) {
    super();
    this.wsWrapper.on("message", (...datas) => {
      this.emit("message", ...datas);
      this.emit(...<[string]>datas);
    });
  }
  getSignalPair(targetId: string) {
    return new SignalPair(this, targetId);
  }
  send(target: string, msg: any, ...datas: any[]) {
    this.wsWrapper.send(target, msg, ...datas);
  }
}

export interface SignalPairInterface extends AdvanceEventEmitter {
  send(msg: any, ...data: any[]): void
  destroy(): void
}

export class SignalPair extends AdvanceEventEmitter implements SignalPairInterface {
  private handler = (...msgs: any[]) => {
    this.emit("message", ...msgs);
    this.emit(...<[string]>msgs);
  };

  constructor(public signal: Signal | SignalPair, public target: string) {
    super();
    this.signal.on(target, this.handler);
    // this.on("message", (...e) => console.log("[SignalPair]", e))
  }
  destroy() {
    this.signal.off(this.target, this.handler);
  }
  send(msg: any, ...params: any) {
    this.signal.send(this.target, msg, ...params);
  }

  getSignalPair(targetId: string) {
    return new SignalPair(this, targetId);
  }
}
