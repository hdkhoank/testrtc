import { AdvanceEventEmitter } from './AdvanceEventEmitter';
import { Signal, SignalPairInterface } from './Signal';
import { sleep } from './utils';
import { EventEmitter } from "events";


export class WebRTCPair extends AdvanceEventEmitter {
  private pc!: RTCPeerConnection;
  private sg!: SignalPairInterface
  private pcEvent = new AdvanceEventEmitter();
  private RESTART_SIGNAL = "restart";
  private OFFER_SIGNAL = "sdp";
  private ANSWER_SIGNAL = "sdp";
  private pcReady!: Promise<any>
  private randomId!: string

  public logHook = new EventEmitter()

  protected log(...params: any[]) {
    let tmp = [`[WebRTCPair] [peer:${this.targetId}]`, ...params.map(e => typeof e == 'string' ? e : JSON.stringify(e))]
    console.log(...tmp)
    this.logHook.emit("log", ...tmp)
  }

  protected error(...params: any[]) {
    let tmp = [`[WebRTCPair] [peer:${this.targetId}]`, ...params.map(e => typeof e == 'string' ? e : JSON.stringify(e))]
    console.trace(...tmp)
    this.logHook.emit("error", ...tmp)
  }

  constructor(
    public targetId: string,
    public signal: Signal,
    public initiator: boolean,
    public initPC: () => Promise<RTCPeerConnection>,
    public processSDP: (e: string) => string = e => e,
  ) {
    super();
    this.init();
    this.log({ targetId, signal, initiator });
  }

  protected signalPairFactory(signal: Signal) {
    return signal.getSignalPair(this.targetId);
  }

  private async _initPeerConnection() {
    let pc = await this.initPC();

    pc.addEventListener("connectionstatechange", e => {
      if (pc == this.pc) {
        this.log("[PC] connectionstatechange", pc.connectionState)
        this.pcEvent.emit(pc.connectionState);
      }
    });

    pc.addEventListener("icecandidate", async iceCandidate => {
      this.log("[PC] icecandidate", iceCandidate?.candidate)
      if (pc == this.pc) {
        await this.pcReady
        iceCandidate.candidate && this.sg.send("candidate", iceCandidate.candidate);
      }
    });
    return pc;
  }

  private _processSDP(sdp: any) {
    return { sdp: this.processSDP(sdp.sdp + ""), type: sdp.type };
  }

  async init() {

    this.sg = this.signalPairFactory(this.signal)

    if (this.initiator) {
      this.sg.on(this.ANSWER_SIGNAL, async (answer) => {
        await this.pc.setRemoteDescription(answer);
      });
    } else {

      this.sg.on(this.OFFER_SIGNAL, async (offer) => {
        await this.pc.setRemoteDescription(offer);
        let anwser = await this.pc.createAnswer();
        anwser = this._processSDP(anwser);
        await this.pc.setLocalDescription(anwser);
        this.sg.send(this.ANSWER_SIGNAL, anwser);
      });
    }

    this.sg.on("candidate", async (candidate) => {
      if (candidate) {
        await this.pc.addIceCandidate(candidate);
      }
    });

    let failedTimeout: any

    this.pcEvent.on("connected", () => {
      clearTimeout(failedTimeout)
    })

    this.pcEvent.on("disconnected", () => {
      clearTimeout(failedTimeout)
      failedTimeout = setTimeout(() => this.emit("failed"), 10000)
    })

    this.pcEvent.on("failed", () => {
      clearTimeout(failedTimeout)
      failedTimeout = setTimeout(() => this.emit("failed"), 10000)
    })

    if (this.initiator) {
      this.sg.on(this.RESTART_SIGNAL, randomId => {
        this.restart()
      })
    } else {

    }
  }

  async processReconnectSignal() {
    // if (!this.initiator) {
    //   let randomId = Math.random().toString().slice(2)

    //   this.log(`Process Reconnect Event`)

    //   this.pc.close()
    //   this.pc = await this._initPeerConnection()
    //   // this.sg.send("ok")
    //   await this.sg.send("reconnect-ok")
    //   await this.sg.send("ok", randomId)
    //   await this.sg.wait(this.OFFER_SIGNAL, { timeoutMsg: "Wait 'Offer' Timeout", timeout: 5000 });
    //   this.log(`Reconnect get offer`);
    //   await this.pcEvent.wait("connected", {
    //     timeoutMsg: "Peer Conection Timeout",
    //     rejectEvent: "failed",
    //     rejectMsg: "Peer Connection Failed",
    //     timeout: 10000
    //   });
    //   this.log(`Reconnect success`);
    // }
  }

  async doReconnect() {
    // setTimeout((pc: RTCPeerConnection) => pc.close(), 10000, this.pc);
    // this.pc = await this._initPeerConnection()
    // this.sg.send("reconnect")

    // await this.sg.wait("reconnect-ok", { timeoutMsg: "Wait 'Ok' Timeout", timeout: 5000 })

    // let offer = await this.pc.createOffer();
    // offer = this._processSDP(offer);
    // await this.pc.setLocalDescription(offer);
    // this.sg.send(this.OFFER_SIGNAL, offer);
    // await this.sg.wait(this.ANSWER_SIGNAL, {
    //   timeoutMsg: "Wait 'Answer' Timeout",
    //   timeout: 5000,
    //   rejectEvent: "reconnectErr"
    // });
    // this.log(`Reconnect get answer`);

    // await this.pcEvent.wait("connected", {
    //   timeoutMsg: "Peer Conection Timeout",
    //   rejectEvent: "failed",
    //   rejectMsg: "Peer Connection Failed",
    //   timeout: 10000
    // });

    // this.log(`Reconnect success`);

  }

  async restart() {
    if (this.initiator) {
      this.log(`restart ice`);

      let offer = await this.pc.createOffer({ iceRestart: true });
      await this.pc.setLocalDescription(offer);
      this.sg.send(this.OFFER_SIGNAL, offer);
      await this.sg.wait(this.ANSWER_SIGNAL, { timeoutMsg: "Wait 'Restart Answer' Timeout", timeout: 5000 });
      this.log(`get restart answer`);
      this.log(`restart complete`);

    } else {
      this.log(`restart ice`);
      this.sg.send(this.RESTART_SIGNAL, this.randomId)
      await this.sg.wait(this.OFFER_SIGNAL, { timeoutMsg: "Wait 'Restart Offer' Timeout", timeout: 5000 });
      this.log(`restart complete`);
    }
  }

  async start() {

    this.randomId = Math.random().toString().slice(2)

    this.log(`start`);

    if (this.pc instanceof RTCPeerConnection)
      setTimeout((pc: RTCPeerConnection) => pc.close(), 5000, this.pc)

    this.pc = await this._initPeerConnection();

    this.sg.send("ok", this.randomId);
    await this.sg.wait("ok", { timeoutMsg: "Wait 'ok' Timeout", timeout: 5000 });
    this.sg.send("ok", this.randomId);
    this.log(`get ok`);

    if (this.initiator) {
      let offer = await this.pc.createOffer();
      offer = this._processSDP(offer);
      await this.pc.setLocalDescription(offer);
      this.sg.send(this.OFFER_SIGNAL, offer);
      await this.sg.wait(this.ANSWER_SIGNAL, { timeoutMsg: "Wait 'Answer' Timeout", timeout: 5000 });
      this.log(`get answer`);
    } else {
      await this.sg.wait(this.OFFER_SIGNAL, { timeoutMsg: "Wait 'Offer' Timeout", timeout: 5000 });
      this.log(`get offer`);
    }

    await this.pcEvent
      .wait("connected", {
        timeoutMsg: "Peer Conection Timeout",
        rejectEvent: "failed",
        rejectMsg: "Peer Connection Failed"
      });

    this.log(`connected`);

  }

  close() {
    this.log(`Close`, this.targetId)
    this.sg.destroy();
    this.pc && this.pc.close();
    this.emit("closed")
  }
}
