<template>
  <div>
    <Relay v-for="i in count" :key="i" @report="onReport(i, $event)"> </Relay>
  </div>
</template>

<script lang="ts">
import { Component, Prop, Vue, Ref } from "vue-property-decorator";
import { WebRTCPair } from "../modules/webrtc/WebRTCPair";
import { Signal } from "../modules/webrtc/Signal";
import Relay from "./Relay.vue";
import { mounted, SyncWithRouterQuerySimple } from "../utils";
import IO from "socket.io-client";

@Component({
  components: {
    Relay,
  },
})
export default class Relays extends Vue {

  @SyncWithRouterQuerySimple("reportURL", {
    defaultValue: "http://localhost:8000",
  })
  reportURL!: string;

  @SyncWithRouterQuerySimple("count", {
    defaultValue: "1",
  })
  n!: string;

  get count() {
    return parseInt(this.n);
  }

  reportData!: any[];

  onReport(i, event) {
    this.reportData = this.reportData || [];
    this.reportData[i] = event;
  }

  @mounted
  logReportData() {
    let io = (<any>IO)(this.reportURL);
    setTimeout(() => {
      console.log("REPORT ---------------");
      console.table(this.reportData);
      io.emit("report", this.reportData);
    }, 1000);
    setInterval(() => {
      console.log("REPORT ---------------");
      console.table(this.reportData);
      io.emit("report", this.reportData);
    }, 5000);
  }
}
</script>

