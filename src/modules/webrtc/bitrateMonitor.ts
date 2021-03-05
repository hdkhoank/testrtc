import { EventEmitter } from 'events';
import greenlet from 'greenlet';
import { sum } from 'lodash';

export default class BitrateMonitor extends EventEmitter {
  private _intv: number;
  private _bitrate: number;
  private _timeoutIntv: number = 1000;
  private _statsList: any[] = [];

  constructor(timeoutIntv = 1000) {
    super();
    this._timeoutIntv = timeoutIntv;
  }

  get bitrate() {
    return this._bitrate;
  }

  get statsList() {
    return this._statsList;
  }

  async monitorReciver(receiver: RTCRtpReceiver) {
    let lastStats: RTCStatsReport = null;
    window.clearInterval(this._intv);

    this._intv = window.setInterval(async () => {
      let stats = await receiver.getStats();
      let bitrate = await this._calculateBitRate(stats, lastStats);
      this._bitrate = bitrate;
      this.emit('bitrate', bitrate);
      lastStats = stats;
      this._statsList = rtcStatsReportToList(stats);
    }, this._timeoutIntv);
  }

  async monitorSender(sender: RTCRtpSender) {
    let lastStats: RTCStatsReport = null;
    window.clearInterval(this._intv);

    this._intv = window.setInterval(async () => {
      let stats = await sender.getStats();
      let bitrate = await this._calculateSenderBitRate(stats, lastStats);
      this._bitrate = bitrate;
      this.emit('bitrate', bitrate);
      lastStats = stats;
      this._statsList = rtcStatsReportToList(stats);
    }, this._timeoutIntv);
  }

  async monitorLists(receivers: RTCRtpReceiver[]) {
    let listLastStats: RTCStatsReport[] = Array.from(
      { length: receivers.length },
      (v, i) => null,
    );
    window.clearInterval(this._intv);

    this._intv = window.setInterval(async () => {
      let listStats = await Promise.all([
        ...receivers.map(receiver => {
          return receiver.getStats();
        }),
      ]);

      let totalBitRate = 0;
      for (let idx = 0; idx < listStats.length; idx++) {
        let stats = listStats[idx];
        let lastStats = listLastStats[idx];

        totalBitRate += await this._calculateBitRate(stats, lastStats);
        listLastStats[idx] = stats;
      }

      this._bitrate = totalBitRate;
      this.emit('bitrate', totalBitRate);
      this._statsList = listLastStats.reduce((allStats, stats) => {
        return [...allStats, ...rtcStatsReportToList(stats)];
      }, []);
    }, this._timeoutIntv);
  }

  stop() {
    window.clearInterval(this._intv);
  }

  destroy() {
    this.stop();
    this.removeAllListeners();
  }

  private async _calculateBitRate(stats: RTCStatsReport, lastStats?: RTCStatsReport) {
    if (!lastStats) {
      return 0;
    }

    let totalBitRate = 0;
    let listStat = rtcStatsReportToList(stats).filter(stat => stat.type === 'inbound-rtp' && !stat.isRemote);
    let p: Promise<number>[] = listStat.map(stat => {
      let lastStat = lastStats.get(stat.id);
      if (lastStat) {
        return calculateReceiverBitRate(stat, lastStat);
      } else {
        return Promise.resolve(0);
      }
    });

    let bitrates = await Promise.all(p);
    totalBitRate = sum(bitrates);

    return totalBitRate;
  }

  private async _calculateSenderBitRate(
    stats: RTCStatsReport,
    lastStats?: RTCStatsReport,
  ) {
    if (!lastStats) {
      return 0;
    }

    let totalBitRate = 0;
    let listStat = rtcStatsReportToList(stats).filter(stat => stat.type === 'outbound-rtp' && !stat.isRemote);
    let p: Promise<number>[] = listStat.map(stat => {
      let lastStat = lastStats.get(stat.id);
      if (lastStat) {
        return calculateSenderBitRate(stat, lastStat);
      } else {
        return Promise.resolve(0);
      }
    });

    let bitrates = await Promise.all(p);
    totalBitRate = sum(bitrates);

    return totalBitRate;
  }
}

let calculateSenderBitRate = greenlet<any, number>((stat, lastStat) => {
  let now = stat.timestamp;
  let bytes = stat.bytesSent;
  let bitrate = (8 * (bytes - lastStat.bytesSent)) / (now - lastStat.timestamp);
  return bitrate;
});

let calculateReceiverBitRate = greenlet<any, number>((stat, lastStat) => {
  let now = stat.timestamp;
  let bytes = stat.bytesReceived;
  let bitrate =
    (8 * (bytes - lastStat.bytesReceived)) / (now - lastStat.timestamp);
  return bitrate;
});

function rtcStatsReportToList(stats: RTCStatsReport) {
  let listStats = [];
  stats.forEach(stat => {
    listStats.push(stat);
  });

  return listStats;
}

export class Monitor {
  monitors: Record<string, BitrateMonitor> = {}

  addMonitor(id: string, obj: RTCRtpReceiver | RTCRtpSender) {
    if (obj instanceof RTCRtpReceiver) {
      this.monitors[id] = new BitrateMonitor(1000)
      this.monitors[id].monitorReciver(obj)
    } else {
      this.monitors[id] = new BitrateMonitor(1000)
      this.monitors[id].monitorSender(obj)
    }
  }

  removeMonitor(id: string) {
    this.monitors[id]?.stop();
    delete this.monitors[id];
  }

  reportMonitor() {
    let monitors = Object.entries(this.monitors)
    if (monitors.length > 0) {
      // console.log("[BANDWIDTH]")
      // console.table(monitors.map(e => ({ id: e[0], bandwidth: e[1].bitrate })))
    }
  }

  getBitrate(id: string) : number{
    return this.monitors[id]?.bitrate || 0
  }

}


export const monitor = new Monitor()

setInterval(() => monitor.reportMonitor(), 5000)
