<template>
  <div>
    <Relay v-for="i in count" :key="i" @report="onReport"> </Relay>
  </div>
</template>

<script lang="ts">
import { Component, Prop, Vue, Ref } from "vue-property-decorator";
import { WebRTCPair } from "../modules/webrtc/WebRTCPair";
import { Signal } from "../modules/webrtc/Signal";
import Relay from "./Relay.vue";
import { SyncWithRouterQuerySimple } from "../utils";

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

  onReport(event) {
    console.table(Object.entries(event));
  }
}
</script>

