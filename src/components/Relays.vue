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

@Component({
  components: {
    Relay,
  },
})
export default class Relays extends Vue {
  @SyncWithRouterQuerySimple("count", {
    defaultValue: "1",
  })
  n!: string;

  get count() {
    return parseInt(this.n);
  }

  reportData! : any[]

  onReport(i, event) {
    this.reportData = this.reportData || []
    this.reportData[i] = event;
  }

  @mounted
  logReportData() {
    setInterval(() => {
      console.log("REPORT ---------------");
      console.table(this.reportData);
    }, 5000);
  }
}
</script>

