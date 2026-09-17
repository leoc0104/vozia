import { vi } from 'vitest'

export interface RecordedRequest {
  url: string
  method: string
  headers: Record<string, string>
  body: unknown
  json: unknown
}

export type Responder = (req: RecordedRequest) => Response | Promise<Response>

/** A `fetch` double that records each request and answers from a responder. */
export function createFetchStub(responder: Responder) {
  const requests: RecordedRequest[] = []
  const fetchImpl = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url
    const headers = Object.fromEntries(new Headers(init?.headers).entries())
    let json: unknown = null
    if (typeof init?.body === 'string') {
      try {
        json = JSON.parse(init.body)
      } catch {
        json = null
      }
    }
    const request = { url, method: init?.method ?? 'GET', headers, body: init?.body, json }
    requests.push(request)
    return responder(request)
  })
  return { fetchImpl: fetchImpl as unknown as typeof fetch, requests }
}

export const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
