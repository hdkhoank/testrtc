<template>
  <div class="hello">
    <div>
      <input v-model="myId" placeholder="my ID" />
      <input v-model="partnerId" placeholder="partner ID" />
      <input v-if='enableUploadMonitor' v-model="deviceId" placeholder="device ID" />
      <input type="checkbox" v-model="initiator" />
    </div>
    <p />
    <div>
      <button @click="start" :disabled="!canStart || webRTCPair">Start</button>
      <button @click="stop" :disabled="!webRTCPair">Stop</button>
      <button @click="restart" :disabled="!webRTCPair">Restart</button>
    </div>
    <p />
    <pre
      style="
        width: 400px;
        height: 150px;
        overflow: auto;
        margin: 1em auto;
        border: 1px solid #aaa;
        text-align: left;
        font-size: 0.9em;
      "
    ><template v-for="log in logs">{{log}}{{"\n"}}</template></pre>
    <p />
    <video v-for="i in countVideo" :key="i" ref="video" width="400" height="150" muted autoplay controls />
  </div>
</template>
<style scoped>
.hello {
  display: flex;
  align-items: center;
  justify-content: flex-start;
}
</style>
<script lang="ts">
import { Component, Prop, Vue, Ref, Emit } from "vue-property-decorator";
import { WebRTCPair } from "../modules/webrtc/WebRTCPair";
import { Signal } from "../modules/webrtc/Signal";
import { mounted, SyncWithRouterQuerySimple } from "../utils";
import { monitor } from "../modules/webrtc/bitrateMonitor";

@Component
export default class MRelay extends Vue {
  @Prop() private role!: string;

  @Prop() private streamId!: string;
  @Prop() private deviceIds!: any;
  @Prop() private videoEnable!: boolean;
  @Prop() private audioEnable!: boolean;
  @Prop() private autoStart!: boolean;
  @Prop() private autoRestartEnable!: boolean;

  get canStart() {
    return this.audioEnable || this.videoEnable;
  }

  @Ref("video")
  video!: HTMLVideoElement;

  webRTCPair!: WebRTCPair | null;

  sessionId = "sid_" + String((Math.random() * 10000000) | 0);

  myId = String((Math.random() * 1000000000) | 0);

  @SyncWithRouterQuerySimple("signalURL", {
    defaultValue: `wss://signal-conference-staging.quickom.com`,
  })
  signalURL!: string;

  @SyncWithRouterQuerySimple("partnerId", {
    defaultValue: String((Math.random() * 1000000000) | 0),
  })
  partnerId!: string;

  deviceId = '4aa1008f-f157-48ef-8cfb-a6e5bd28f564';

  @SyncWithRouterQuerySimple("initiator", {
    defaultValue: true,
    map: (e) => e == "true",
    revMap: (e) => String(e),
  })
  initiator!: boolean;

  logs: string[] = [];

  mounted() {}

  get signal() {
    return new Signal(this.myId + "_" + this.role, this.signalURL);
  }

  get enableDownloadMonitor() {
    return this.role != "source";
  }

  get enableUploadMonitor() {
    return this.role != "dest";
  }
  
  get countVideo() {
    return this.enableUploadMonitor ? 1 : this.deviceIds;
  }

  @mounted
  shouldAutoStart() {
    this.autoStart && this.start();
  }

  async start() {
    let sessionId = this.sessionId;
    let streamId = '';
    let role = this.role;

    if (this.enableUploadMonitor) {
      streamId = `${this.deviceId}-${this.myId}` || this.streamId;
      this.reportDevice(streamId);
    } else if(this.enableDownloadMonitor){
      streamId = this.deviceIds;
    }

    if (this.webRTCPair) {
      this.webRTCPair.close();
      this.webRTCPair = null;
    }

    if (!this.webRTCPair) {
      this.webRTCPair = new (class extends WebRTCPair {
        signalPairFactory(signal: Signal) {
          return signal
            .getSignalPair(this.targetId)
            .getSignalPair([streamId])
            .getSignalPair(role)
            .getSignalPair(sessionId);
        }
      })(this.partnerId, this.signal, this.initiator, async () => {


        let pc = new RTCPeerConnection({
          iceServers: [
            {
              urls: ["stun:34.92.44.253:3478"],
            },
            {
              urls: ["stun:35.247.153.249:3478"],
            },
            {
              urls: ["turn:34.92.44.253:3478"],
              username: "username",
              credential: "password",
            },
            {
              urls: ["turn:35.247.153.249:3478"],
              username: "username",
              credential: "password",
            },
          ],
        });
        if(this.enableUploadMonitor){
          let stream = await navigator.mediaDevices.getUserMedia({
            audio: this.audioEnable,
            video: this.videoEnable,
          });

          for (let track of stream.getTracks()) {
            let sender = pc.addTrack(track);
            monitor.addMonitor(this.myId + "_up_" + track.kind, sender);
          }
        }else if(this.enableDownloadMonitor){
          
          this.videoEnable && pc.addTransceiver("video",{direction:"recvonly"});
          this.audioEnable && pc.addTransceiver("audio",{direction:"recvonly"});
        }

        let trackHandlerTimeout: number,
          tracks: MediaStreamTrack[] = [];

        pc.addEventListener("track", (event) => {
          tracks.push(event.track);
          clearTimeout(trackHandlerTimeout);
          monitor.addMonitor(
            this.myId + "_down_" + event.track.kind,
            event.receiver
          );

          trackHandlerTimeout = setTimeout(() => {
            let stream = new MediaStream(tracks);
            this.video.srcObject = stream;
            console.log(tracks);
            this.logs.push("PC Tracks ");
          }, 100);
        });

        return pc;
      });

      this.initMonitor(this.webRTCPair);

      this.$once("unmount", () => {
        this.stop()
      });

      await this.webRTCPair.start();
    }
  }

  stop() {
    if (this.webRTCPair) {
      this.webRTCPair.close();
      this.webRTCPair = null;
    }
  }

  @Ref("video")
  videoElement!: HTMLVideoElement;

  initMonitor(peer: WebRTCPair) {
    peer.logHook.on("log", (...msg: string[]) => {
      this.logs.push(msg.join(" "));
      this.logs = this.logs.slice(-100);
    });

    peer.logHook.on("error", (...msg: string[]) => {
      this.logs.push("ERROR " + msg.join(" "));
      this.logs = this.logs.slice(-100);
    });

    let videoCheckInterval,
      audioCheckInterval,
      reportInterval,
      lastTimeFrame = 0,
      videoLostCounter = 0,
      audioLostCounter = 0,
      isVideoPlaying = false;

    this.enableDownloadMonitor &&
      peer.on("init", () => {
        peer.log("Init loop check framerate");
        clearInterval(videoCheckInterval);
        videoCheckInterval = setInterval(() => {
          if(!(this.autoRestartEnable && this.videoEnable))
            return;
          let video = this.videoElement;
          if (video && video?.currentTime != lastTimeFrame) {
            lastTimeFrame = video.currentTime;
            videoLostCounter = 0;
            isVideoPlaying = true;
          } else {
            videoLostCounter++;
            if (videoLostCounter >= 3) {
              isVideoPlaying = false;
              videoLostCounter = 0;
              peer.log("Video framerate is not updated, restarting ...");
              peer.emit("failed");
            }
          }
        }, 4000);
      });

    this.enableDownloadMonitor &&
      peer.on("init", () => {
        peer.log("Init loop check audio bitrate");
        clearInterval(audioCheckInterval);
        audioCheckInterval = setInterval(() => {
          if(!(this.autoRestartEnable && this.audioEnable))
            return;
          if (monitor.getBitrate(this.myId + "_down_audio") > 0) {
            audioLostCounter = 0;
          } else {
            audioLostCounter++;
            if (audioLostCounter >= 6) {
              audioLostCounter = 0;
              peer.log("Audio data fail to received, restarting ...");
              peer.emit("failed");
            }
          }
        }, 4000);
      });

    reportInterval = this.enableDownloadMonitor && setInterval(() => {
      this.report({
        id: this.myId,
        ws: this.signal.getStatus(),
        peerGatSt: this.webRTCPair.peerConnection?.iceGatheringState,
        peerIceSt: this.webRTCPair.peerConnection?.iceConnectionState,
        peerStat: this.webRTCPair.peerStat,
        down_video: monitor.getBitrate(this.myId + "_down_video"),
        down_audio: monitor.getBitrate(this.myId + "_down_audio"),
        up_video: monitor.getBitrate(this.myId + "_up_video"),
        up_audio: monitor.getBitrate(this.myId + "_up_audio"),
        video_playing: isVideoPlaying,
        audio_playing: monitor.getBitrate(this.myId + "_down_audio") > 0,
      });
    }, 1000);

    peer.on("closed", () => {
      clearInterval(videoCheckInterval);
      clearInterval(audioCheckInterval);
      clearInterval(reportInterval);
      monitor.removeMonitor(this.myId + "_down_video");
      monitor.removeMonitor(this.myId + "_down_audio");
      monitor.removeMonitor(this.myId + "_up_video");
      monitor.removeMonitor(this.myId + "_up_audio");
    });

    this.$once("unmount", () => {
      clearInterval(videoCheckInterval);
      clearInterval(audioCheckInterval);
      clearInterval(reportInterval);
      monitor.removeMonitor(this.myId + "_down_video");
      monitor.removeMonitor(this.myId + "_down_audio");
      monitor.removeMonitor(this.myId + "_up_video");
      monitor.removeMonitor(this.myId + "_up_audio");
    });
  }

  reconnect() {}

  restart() {
    this.webRTCPair?.emit("failed");
  }

  @Emit("report")
  report($event) {}

  @Emit("device")
  reportDevice($event) {}
}
</script>

<!-- Add "scoped" attribute to limit CSS to this component only -->
<style scoped lang="stylus">
h3
  margin 40px 0 0

ul
  list-style-type none
  padding 0

li
  display inline-block
  margin 0 10px

a
  color #42b983

video
  background-color black
</style>
