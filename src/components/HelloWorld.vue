<template>
  <div class="hello">
    <div>
      <input v-model="myId" placeholder="my ID" />
      <input v-model="partnerId" placeholder="partner ID" />
      <input type="checkbox" v-model="initiator" />
    </div>
    <p />
    <div>
      <button @click="start" :disabled="webRTCPair">Start</button>
      <button @click="stop" :disabled="!webRTCPair">Stop</button>
      <button @click="restart" :disabled="!webRTCPair">Restart</button>
    </div>
    <p />
    <pre
      style="width: 400px;height: 200px;overflow: auto ; margin: 1em auto; border: 1px solid #aaa;text-align: left;font-size:0.9em;"
    ><template v-for="log in logs">{{log}}{{"\n"}}</template></pre>
    <p />
    <video ref="video" width="400" height="300" muted autoplay controls />
  </div>
</template>

<script lang="ts">
import { Component, Prop, Vue, Ref } from "vue-property-decorator";
import { WebRTCPair } from "../modules/webrtc/WebRTCPair";
import { Signal } from "../modules/webrtc/Signal";

@Component
export default class HelloWorld extends Vue {
  @Prop() private msg!: string;

  @Ref("video")
  video!: HTMLVideoElement;

  webRTCPair!: WebRTCPair | null;

  myId = String((Math.random() * 1000) | 0);
  partnerId = "";
  initiator: boolean = false;
  logs: string[] = [];

  mounted() {}

  get signal() {
    return new Signal(this.myId);
  }

  async start() {
    if (this.webRTCPair) {
      this.webRTCPair.close();
      this.webRTCPair = null;
    }

    if (!this.webRTCPair) {
      this.webRTCPair = new WebRTCPair(this.partnerId, this.signal, this.initiator, async () => {
        let stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
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
          // pc.addTransceiver(track, {
          //   direction: "sendrecv",
          //   streams: [stream],
          //   sendEncodings: [{ rid: "f" }],
          //   // sendEncodings: [
          //   //   {
          //   //     rid: "q",
          //   //     scaleResolutionDownBy: 4.0,
          //   //   },
          //   // ],
          // });
          // pc.addTransceiver(track.kind)
          pc.addTrack(track)
        }
        let trackHandlerTimeout: number,
          tracks: MediaStreamTrack[] = [];

        pc.addEventListener("track", (event) => {
          tracks.push(event.track);
          clearTimeout(trackHandlerTimeout);
          trackHandlerTimeout = setTimeout(() => {
            let stream = new MediaStream(tracks);
            this.video.srcObject = stream;
            console.log(tracks);
            this.logs.push("PC Tracks ");
          }, 100);
        });

        return pc;
      });

      this.webRTCPair.logHook.on("log", (...msg: string[]) => {
        this.logs.push(msg.join(" "));
        this.logs = this.logs.slice(-100);
      });

      this.webRTCPair.logHook.on("error", (...msg: string[]) => {
        this.logs.push("ERROR " + msg.join(" "));
        this.logs = this.logs.slice(-100);
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

  restart() {
    if (this.webRTCPair) {
      this.webRTCPair.restart();
    }
  }

  reconnect() {}
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
