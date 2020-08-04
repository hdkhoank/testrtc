<template>
  <div class="hello">
    <div>
      <input v-model="myId" placeholder="my ID" />
      <input v-model="partnerId" placeholder="partner ID" />
      <input type="checkbox" v-model="initiator" />
    </div>
    <p />
    <div>
      <button @click="start">Start</button>
      <button @click="stop">Stop</button>
    </div>
    <p />
    <pre style="width: 400px;height: 200px;overflow: auto ; margin: 1em auto; border: 1px solid #aaa;text-align: left;font-size:0.9em;"><template v-for="log in logs">{{log}}{{"\n"}}</template></pre>
    <p />
    <video ref="video" width="400" height="300" muted autoplay/>
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

  async start() {
    if (this.webRTCPair) {
      this.webRTCPair.close();
      this.webRTCPair = null;
    }

    if (!this.webRTCPair) {
      this.webRTCPair = new WebRTCPair(
        this.partnerId,
        new Signal(this.myId),
        this.initiator,
        async () => {
          let stream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: true,
          });

          let pc = new RTCPeerConnection();
          for (let track of stream.getTracks()) {
            pc.addTrack(track, stream);
          }
          pc.addEventListener("track", (event) => {
            let stream = event.streams[0];
            this.video.srcObject = stream;
            this.logs.push("PC Tracks ");
          });
          return pc;
        }
      );
      this.webRTCPair.logHook.on("log", (...msg: string[]) => {
        this.logs.push(msg.join(" "));
        this.logs = this.logs.slice(-10)
      });
      this.webRTCPair.logHook.on("error", (...msg: string[]) => {
        this.logs.push("ERROR " + msg.join(" "));
        this.logs = this.logs.slice(-10)
      });

      await this.webRTCPair.start()
    }
  }

  stop() {
    if (this.webRTCPair) {
      this.webRTCPair.close();
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
