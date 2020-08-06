import { assign, Configuration, FetchContext, XhrContext } from '@datadog/browser-core'

interface BrowserWindow extends Window {
  ddtrace?: any
}

export interface Tracer {
  traceFetch: (context: Partial<FetchContext>) => TraceIdentifier | undefined
  traceXhr: (context: Partial<XhrContext>, xhr: XMLHttpRequest) => TraceIdentifier | undefined
}

interface TracingHeaders {
  [key: string]: string
}

export function startTracer(configuration: Configuration): Tracer {
  return {
    traceFetch: (context) =>
      onTracingAllowed(context.url!, (tracingHeaders: TracingHeaders) => {
        context.init = context.init || {}
        context.init.headers = context.init.headers || {}

        if (typeof (context.init.headers as Headers).set === 'function') {
          Object.keys(tracingHeaders).forEach((name) => {
            ;(context.init!.headers as Headers).set(name, tracingHeaders[name])
          })
        } else {
          assign(context.init.headers, tracingHeaders)
        }
      }),
    traceXhr: (context, xhr) =>
      onTracingAllowed(context.url!, (tracingHeaders: TracingHeaders) => {
        Object.keys(tracingHeaders).forEach((name) => {
          xhr.setRequestHeader(name, tracingHeaders[name])
        })
      }),
  }
}

function onTracingAllowed(url: string, inject: (tracingHeaders: TracingHeaders) => void): TraceIdentifier | undefined {
  if (!isTracingSupported() || !isAllowedUrl(url)) {
    return undefined
  }

  if (isDdTraceJsActive()) {
    return getTraceIdFromDdTraceJs()
  }

  const traceId = new TraceIdentifier()
  inject(makeTracingHeaders(traceId))
  return traceId
}

function isAllowedUrl(url: string) {
  return url.indexOf(window.location.origin) === 0
}

export function isTracingSupported() {
  return getCrypto() !== undefined
}

function getCrypto() {
  return window.crypto || (window as any).msCrypto
}

function makeTracingHeaders(traceId: TraceIdentifier): TracingHeaders {
  return {
    'x-datadog-origin': 'rum',
    'x-datadog-parent-id': toDecimalString(traceId),
    'x-datadog-sampled': '1',
    'x-datadog-sampling-priority': '1',
    'x-datadog-trace-id': toDecimalString(traceId),
  }
}

export function isDdTraceJsActive() {
  // tslint:disable-next-line: no-unsafe-any
  return 'ddtrace' in window && (window as BrowserWindow).ddtrace.tracer.scope().active()
}

function getTraceIdFromDdTraceJs(): TraceIdentifier | undefined {
  // tslint:disable-next-line: no-unsafe-any
  return (window as BrowserWindow).ddtrace.tracer
    .scope()
    .active()
    .context()._traceId // internal trace identifier
}

/* tslint:disable:no-bitwise */
export class TraceIdentifier {
  private buffer: Uint8Array = new Uint8Array(8)

  constructor() {
    getCrypto().getRandomValues(this.buffer)
    this.buffer[0] = this.buffer[0] & 0x7f // force 63-bit
  }

  toString(radix: number) {
    let high = this.readInt32(0)
    let low = this.readInt32(4)
    let str = ''

    while (1) {
      const mod = (high % radix) * 4294967296 + low

      high = Math.floor(high / radix)
      low = Math.floor(mod / radix)
      str = (mod % radix).toString(radix) + str

      if (!high && !low) {
        break
      }
    }

    return str
  }

  private readInt32(offset: number) {
    return (
      this.buffer[offset] * 16777216 +
      (this.buffer[offset + 1] << 16) +
      (this.buffer[offset + 2] << 8) +
      this.buffer[offset + 3]
    )
  }
}
/* tslint:enable:no-bitwise */

/**
 * Format used by trace intake
 */
export function toHexString(traceId: TraceIdentifier) {
  return traceId.toString(16)
}

/**
 * Format used elsewhere
 */
export function toDecimalString(traceId: TraceIdentifier) {
  return traceId.toString(10)
}
