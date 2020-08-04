import { EventEmitter } from "events";

const DEFAULT_FILTER = (...args: any[]) => true

export class AdvanceEventEmitter extends EventEmitter {

  wait(
    msg: string,
    {
      filter = DEFAULT_FILTER,
      timeout = 30000,
      timeoutMsg = "Time out",
      rejectEvent = '',
      rejectMsg = '',
      rejectFilter = DEFAULT_FILTER
    } = {},
  ) {
    let rs: any, rj: any, to: any;
    return new Promise((resolve, reject) => {

      this.on(msg, rs = (...params: any[]) => {
        if (filter(...params))
          resolve(params);
      });

      rejectEvent && this.on(rejectEvent, rj = (...params: any) => {
        if (filter(...params))
          reject(new Error(params[0] || rejectMsg || `Wait event ${msg} but get ${rejectEvent}`));
      })
      if (isFinite(timeout)) {
        to = setTimeout(() => reject(new Error(timeoutMsg)), timeout);
      }
    }).finally(() => {
      this.off(msg, rs);
      rejectEvent && this.off(rejectEvent, rj);
      clearTimeout(to);
    });
  }
}
