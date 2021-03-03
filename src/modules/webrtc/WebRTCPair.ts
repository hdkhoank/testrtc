import { AdvanceEventEmitter } from './AdvanceEventEmitter';
import { Signal, SignalPairInterface } from './Signal';
import { sleep } from './utils';


export class WebRTCPair extends AdvanceEventEmitter {
  private pc!: RTCPeerConnection;
  private sg!: SignalPairInterface
  private pcEvent = new AdvanceEventEmitter();
  private OFFER_SIGNAL = "sdp";
  private ANSWER_SIGNAL = "sdp";
  private TIMEOUT = 10000;
  private running = false;
  private _sessionId!: string

  public logHook = new AdvanceEventEmitter()


  public get peerConnection(){
    return this.pc
  }

  public log(...params: any[]) {
    console.log(`[WebRTCPair] [peer:${this.sg.sId}]`, ...params.map(e => typeof e == 'string' ? e : JSON.stringify(e)))
    this.logHook.emit("log", ...params)

  }

  public error(...params: any[]) {
    console.error(`[WebRTCPair] [peer:${this.sg.sId}]`, ...params)
    this.logHook.emit("error", ...params)
  }

  public get peerStatus() {
    return this.pc.connectionState
  }

  public get sessionId() {
    return this._sessionId
  }
  public set sessionId(value) {
    this.log("[session Update]", value)
    console.trace("update sessionId")
    this._sessionId = value
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
        this.log("[PC]", pc.connectionState)
        this.pcEvent.emit(pc.connectionState);
        this.emit("peerStatus", pc.connectionState)
      }
    });
    pc.addEventListener("icecandidate", iceCandidate => {
      this.log("[PC] icecandidate", iceCandidate?.candidate)
      if (pc == this.pc)
        iceCandidate.candidate && this.sg.send("candidate", iceCandidate.candidate);
    });
    return pc;
  }

  private _processSDP(sdp: any) {
    return { sdp: this.processSDP(sdp.sdp + ""), type: sdp.type };
  }

  async init() {

    this.sg = this.signalPairFactory(this.signal)

    this.running = true

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
        this.sg.send(this.ANSWER_SIGNAL, anwser, this.sessionId);
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
      this.emit("connected")
      this.getPCConnectionType()
        .then(e => this.log("[Conn Type]", e))
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
      setTimeout(() => this.initiatorKeepConnection())
      this.sg.on("status", status => {
        this.log(`parnert status ${status}`)
        // console.log("status", status)
        // if (status.disconnect)
        //   this.close()
      })

      this.sg.on("reconnectErr", error => this.error(`reconnectErr`, error))
    } else {
      setTimeout(() => this.anwserKeepConnection())
      this.sg.on("reconnect", () => this.processReconnectSignal())
    }
    this.sg.on("handshakeError", error => this.error(`reconnectErr`, error))


    setTimeout(() => this.emit("init"), 1)
  }

  async getPCConnectionType() {
    await sleep(1000)
    let pairs = await this.pc
      .getStats(null)
      .then((stats) => {
        let pairs : string[] = []
        try {
          stats.forEach((value, key) => {
            if (
              (value.type == "candidate-pair" || value.type == "candidate-pair") &&
              value.nominated
              && value.state == "succeeded"
            ) {
              var remote = stats.get(value.remoteCandidateId);
              if(remote){
                pairs.push((remote.ipAddress || remote.ip || "localhost") + ":" +
                  (remote.portNumber || remote.port) + " " + remote.protocol +
                  " " + remote.candidateType)
              }
            }
          });
        } catch (error) {
          this.log("[STAT] FAILED:", String(error))
        }


        return pairs.join(" / ")
      })
      .catch(e => this.log("[STAT] FAILED:", String(e)))

    return pairs
  }

  async initiatorKeepConnection() {
    while (this.running && this.initiator) {

      await this.wait("failed", { timeout: Infinity, rejectEvent: "closed" })
        .catch((err) => this.error(err))

      let retryCount = 0

      while (this.running && this.initiator) {
        try {
          this.log(`Reconnecting attemp ${retryCount++}...`)
          await this.doReconnect()
          this.log(`Reconnect Successs`)
          break;
        } catch (err) {
          this.log(`Reconnect Fail`, err)
        }

        if (retryCount > 2) {
          this.emit("error")
          break;
        }

        await sleep(5000)
      }

      if (!this.running)
        break
      await sleep(5000)
    }
  }

  async anwserKeepConnection() {
    while (this.running && !this.initiator) {

      await this.wait("failed", { timeout: Infinity, rejectEvent: "closed" })
        .catch((err) => this.error(err))

      let retryCount = 0

      while (this.running && !this.initiator && ["failed", "connected"].includes(this.pc.connectionState)) {
        try {
          this.log(`Anwser Reconnecting attemp ${retryCount++}...`)
          await this.sg.send("ok")
          await this.sg.wait(this.OFFER_SIGNAL)
          this.log(`Anwser Reconnect Successs`)
          break;
        } catch (err) {
          this.log(`Anwser Reconnect Timeout`)
        }
        await sleep(retryCount * 1000)
      }

      if (!this.running)
        break
      await sleep(5000)
    }
  }


  async processReconnectSignal() {
    if (!this.initiator) {

      this.log(`Process Reconnect Event`)

      this.pc.close()
      // this.sessionId = Math.random().toString().slice(2)
      this.pc = await this._initPeerConnection()
      // this.sg.send("ok")
      await this.sg.send("reconnect-ok", this.sessionId)
      await this.sg.send("ok", this.sessionId)
      await this.sg.wait(this.OFFER_SIGNAL, { timeoutMsg: "Wait 'Offer' Timeout", timeout: this.TIMEOUT });
      this.log(`Reconnect get offer`);
      await this.pcEvent.wait("connected", {
        timeoutMsg: "Peer Conection Timeout",
        rejectEvent: "failed",
        rejectMsg: "Peer Connection Failed",
        timeout: 10000
      });
      this.log(`Reconnect success`);
    }
  }

  async doReconnect() {
    setTimeout((pc: RTCPeerConnection) => pc.close(), 10000, this.pc);
    // this.sessionId = Math.random().toString().slice(2)
    this.pc = await this._initPeerConnection()
    this.sg.send("reconnect", this.sessionId)
    await this.sg.wait("reconnect-ok", { timeoutMsg: "Wait 'Ok' Timeout", timeout: this.TIMEOUT })
    let offer = await this.pc.createOffer();
    offer = this._processSDP(offer);
    await this.pc.setLocalDescription(offer);
    this.sg.send(this.OFFER_SIGNAL, offer, this.sessionId);
    await this.sg.wait(this.ANSWER_SIGNAL, {
      timeoutMsg: "Wait 'Answer' Timeout",
      timeout: this.TIMEOUT,
      rejectEvent: "reconnectErr"
    });
    this.log(`Reconnect get answer`);

    await this.pcEvent.wait("connected", {
      timeoutMsg: "Peer Conection Timeout",
      rejectEvent: "failed",
      rejectMsg: "Peer Connection Failed",
      timeout: 10000
    });

    this.log(`Reconnect success`);

  }

  async start() {
    try {
      while (this.running) {
        try {
          await this._start()
          break;
        } catch (error) {
          this.pc && setTimeout((pc: RTCPeerConnection) => pc.close(), 10000, this.pc);
          this.error(error)
          await sleep(5000)
        }
      }
    } catch (error) {
      this.error(error)
      this.pcEvent.emit("failed")
      throw error
    }
  }

  async _start() {


    this.log(`start`);

    this.sessionId = Math.random().toString().slice(2)
    this.pc = await this._initPeerConnection();

    if (this.initiator) {

      this.sg.send("ok", this.sessionId);
      await this.sg.wait("ok", { timeoutMsg: "Wait 'ok' Timeout", timeout: this.TIMEOUT });
      this.sg.send("ok", this.sessionId);
      this.log(`get ok`);


      let offer = await this.pc.createOffer();
      offer = this._processSDP(offer);
      await this.pc.setLocalDescription(offer);
      this.sg.send(this.OFFER_SIGNAL, offer, this.sessionId);
      await this.sg.wait(this.ANSWER_SIGNAL, { timeoutMsg: "Wait 'Answer' Timeout", timeout: this.TIMEOUT });
      this.log(`get answer`);
    } else {

      this.sg.send("ok", this.sessionId);

      await Promise.race([
        (async () => {
          this.sg.send("ok", this.sessionId);
          await this.sg.wait("ok", { timeoutMsg: "Wait 'ok' Timeout", timeout: this.TIMEOUT });
          this.sg.send("ok", this.sessionId);
          this.log(`get ok`);

          await this.sg.wait(this.OFFER_SIGNAL, { timeoutMsg: "Wait 'Offer' Timeout", timeout: this.TIMEOUT });
          this.log(`get offer`);

        })(),
        (async () => {
          await this.sg.wait(this.OFFER_SIGNAL, { timeoutMsg: "Wait 'Offer' Timeout", timeout: this.TIMEOUT });
          this.log(`get offer only`);
        })(),
      ])

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
    this.running = false
    this.sg.destroy();
    this.pc && this.pc.close();
    this.pc = <any>null;
    this.emit("closed")
  }

  restart(){
    
  }
}
