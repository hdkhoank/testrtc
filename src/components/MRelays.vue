<template>
  <div>
    <input v-model="n" placeholder="Peer count" />
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
    <p/>
    <MRelay
      v-for="i in count"
      :key="i"
      :streamId="streamId"
      :deviceIds='deviceIds'
      :role="i != count ? 'source' : 'dest'"
      :videoEnable="videoEnable"
      :audioEnable="audioEnable"
      :autoStart="autoStart"
      :autoRestartEnable="autoRestartEnable"
      @report="onReport(i, $event)"
      @device="onDevice(i, $event)"
    >
    </MRelay>
  </div>
</template>

<script lang="ts">
import { Component, Prop, Vue, Ref } from "vue-property-decorator";
import MRelay from "./MRelay.vue";
import { mounted, SyncBoolWithRouter, SyncWithRouterQuerySimple } from "../utils";
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

  @SyncBoolWithRouter("videoEnable", true)
  videoEnable!: boolean;

  @SyncBoolWithRouter("audioEnable", true)
  audioEnable!: boolean;

  @SyncBoolWithRouter("autoStart", true)
  autoStart!: boolean;

  @SyncBoolWithRouter("autoRestartEnable", true)
  autoRestartEnable!: boolean;

  get count() {
    return parseInt(this.n);
  }

  reportData!: any[];

  onReport(i, event) {
    this.reportData = this.reportData || [];
    this.reportData[i] = event;
  }

  deviceIds: any[] = [];

  onDevice(i, event) {
    this.deviceIds = this.deviceIds || [];
    this.deviceIds[i] = event;
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

