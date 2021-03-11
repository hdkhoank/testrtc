<template>
  <div>
    <input v-model="n" placeholder="Peer count" />
    <p/>
    <MRelay
      v-for="i in count"
      :key="i"
      :streamId="streamId"
      :role="i == 0 ? 'dest' : 'source'"
      @report="onReport(i, $event)"
    >
    </MRelay>
  </div>
</template>

<script lang="ts">
import { Component, Prop, Vue, Ref } from "vue-property-decorator";
import MRelay from "./MRelay.vue";
import { mounted, SyncWithRouterQuerySimple } from "../utils";
import IO from "socket.io-client";

@Component({
  components: {
    MRelay,
  },
})
export default class MRelays extends Vue {
  @SyncWithRouterQuerySimple("reportURL", {
    defaultValue: "http://localhost:8000",
  })
  reportURL!: string;

  @SyncWithRouterQuerySimple("count", {
    defaultValue: "1",
  })
  n!: string;

  streamId = Math.random().toString().slice(2);

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

