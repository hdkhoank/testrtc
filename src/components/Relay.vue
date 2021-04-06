<template>
  <div class="hello">
    <div>
      <input v-model="myId" placeholder="my ID" />
      &nbsp;
      <input v-model="partnerId" placeholder="partner ID" />
      <br/>
      <span>
        <input type="checkbox" id="initiator" name="initiator" v-model="initiator">
        <label for="initiator">initiator</label>
      </span>
      <br/>
      <span>
        <input type="checkbox" id="videoEnable" name="videoEnable" v-model="videoEnable">
        <label for="videoEnable">videoEnable</label>
      </span>
      &nbsp;
      <span>
        <input type="checkbox" id="audioEnable" name="audioEnable" v-model="audioEnable">
        <label for="audioEnable">audioEnable</label>
      </span>
      <br/>
      <span>
        <input type="checkbox" id="autoStart" name="autoStart" v-model="autoStart">
        <label for="autoStart">autoStart</label>
      </span>
      &nbsp;
      <span>
        <input type="checkbox" id="autoRestartEnable" name="autoRestartEnable" v-model="autoRestartEnable">
        <label for="autoRestartEnable">autoRestartEnable</label>
      </span>

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
    <video ref="video" width="400" height="150" muted autoplay controls />
  </div>
</template>
<style scoped>
.hello {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  text-align: left;
}
</style>
<script lang="ts">
import { Component, Prop, Vue, Ref, Emit } from "vue-property-decorator";
import { WebRTCPair } from "../modules/webrtc/WebRTCPair";
import { Signal } from "../modules/webrtc/Signal";
import {
  mounted,
  SyncBoolWithRouter,
  SyncWithRouterQuerySimple,
} from "../utils";
import { monitor } from "../modules/webrtc/bitrateMonitor";

@Component
export default class Viewer extends Vue {
  @Prop() private msg!: string;

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

  @SyncBoolWithRouter("videoEnable", true)
  videoEnable!: boolean;

  @SyncBoolWithRouter("audioEnable", true)
  audioEnable!: boolean;

  @SyncBoolWithRouter("autoStart", true)
  autoStart!: boolean;

  @SyncBoolWithRouter("autoRestartEnable", true)
  autoRestartEnable!: boolean;

  @SyncBoolWithRouter("initiator", true)
  initiator!: boolean;

  logs: string[] = [];

  mounted() {}

  get canStart() {
    return this.audioEnable || this.videoEnable;
  }

  get signal() {
    return new Signal(this.myId, this.signalURL);
  }

  @mounted
  shouldAutoStart() {
    this.autoStart && this.start();
  }

  async start() {
    let sessionId = this.sessionId;
    if (this.webRTCPair) {
      this.webRTCPair.close();
      this.webRTCPair = null;
    }

    if (!this.webRTCPair) {
      this.webRTCPair = new (class extends WebRTCPair {
        signalPairFactory(signal: Signal) {
          return signal
            .getSignalPair(this.targetId)
            .getSignalPair(Math.random().toString().slice(2))
            .getSignalPair(sessionId);
        }
      })(this.partnerId, this.signal, this.initiator, async () => {
        let stream = await navigator.mediaDevices.getUserMedia({
          audio: this.audioEnable,
          video: this.videoEnable,
        });

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

        for (let track of stream.getTracks()) {
          let sender = pc.addTrack(track);
          monitor.addMonitor(this.myId + "_up_" + track.kind, sender);
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

    peer.on("init", () => {
      peer.log("Init loop check framerate");
      clearInterval(videoCheckInterval);
      videoCheckInterval = setInterval(() => {
        let video = this.videoElement;
        if(!(this.autoRestartEnable && this.videoEnable))
          return;
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

    reportInterval = setInterval(() => {
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
      monitor.removeMonitor(this.myId + "_down_video");
      monitor.removeMonitor(this.myId + "_down_audio");
      monitor.removeMonitor(this.myId + "_up_video");
      monitor.removeMonitor(this.myId + "_up_audio");
    });
  }

  restart() {
    if (this.webRTCPair) {
      this.webRTCPair.emit("failed");
    }
  }

  @Emit("report")
  report($event) {}
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
