import { AdvanceEventEmitter } from './AdvanceEventEmitter';
import { WSWrapper } from './WSWrapper';



export class Signal extends AdvanceEventEmitter {

  wsWrapper = new WSWrapper(`${this.path}?id=${this.signalId}`);

  sId = this.signalId.slice(-10)

  constructor(public signalId: string, public path = `wss://signal-conference-staging.quickom.com`) {
    super();
    this.wsWrapper.on("message", (...datas) => {
      this.emit("message", ...datas);
      if (!this.emit(...<[string]>datas) && typeof datas[0] == "string") {
        this.send(datas[0], "error", { error: "You don't have permission to sent this msg", datas: datas })
      }
    });
  }
  getSignalPair(targetId: string) {
    return new SignalPair(this, targetId);
  }
  send(target: string, msg: any, ...datas: any[]) {
    this.wsWrapper.send(target, msg, ...datas);
  }

  getStatus(){
    return this.wsWrapper.getStatus()
  }

}

export interface SignalPairInterface extends AdvanceEventEmitter {
  send(msg: any, ...data: any[]): void
  destroy(): void
  getStatus(): string,
  sId: string
}

export class SignalPair extends AdvanceEventEmitter implements SignalPairInterface {
  private handler = (...msgs: any[]) => {
    this.emit("message", ...msgs);
    if (!this.emit(...<[string]>msgs) && typeof msgs[0] == "string") {
      this.send("error", { error: "You don't have permission to sent this msg", msgs: msgs })
    }
  };

  get sId(): string {
    return `${this.signal.sId}/${this.target.slice(-10)}`
  }

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

  getStatus(){
    return this.signal.getStatus()
  }
}
