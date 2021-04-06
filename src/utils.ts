
import { createDecorator } from 'vue-class-component'
import Vue from 'vue';



export function SyncWithRouterQuerySimple<T>(
  queryKey: string,
  { validate = e => true, defaultValue = "" as any as T, map = e => e, revMap = e => e }: {
    validate?: (e: T) => boolean,
    map?: (e: any) => T,
    revMap?: (e: T) => any,
    defaultValue?: T
  } = {}
) {
  return createDecorator((options, key) => {
    if (!options.computed)
      options.computed = {}

    options.computed[key] = {
      get() {
        try {
          var temp = map(JSON.parse((<any>this).$route.query[queryKey]))
          return validate(temp as T) ? (temp ?? defaultValue) : defaultValue
        } catch (error) {
          // console.log((<any>this).$route.query,queryKey, (<any>this).$route.query[queryKey])
          // console.error(error)
          return defaultValue
        }
      },
      set(value: T) {
        const { path, hash } = (<Vue>this).$route;
        (<Vue>this).$router.replace({
          path,
          hash,
          query: {
            ... (<Vue>this).$route.query,
            [queryKey]: JSON.stringify(revMap(value))
          },
        })
      }
    }
  })
}


export function SyncBoolWithRouter(
  queryKey: string,
  defaultValue: boolean = false
) {
  return SyncWithRouterQuerySimple(queryKey, {
    defaultValue: defaultValue,
    map: (e) => e == "true",
    revMap: (e) => String(e),
  })
}


export const mounted = createDecorator((componentOptions, key) => {
  let mounted: Function | undefined = componentOptions.mounted;
  let methods: any = componentOptions.methods;
  let handler: Function = methods[key];
  componentOptions.mounted = function (this: any): void {
    if (typeof mounted === "function")
      mounted.call(this);

    handler.call(this)
  };
})
