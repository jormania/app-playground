import { describe, it, expect } from 'vitest'
import { createNotionClient } from './notionClient.js'

// A fake proxy that records calls and echoes a minimal page shape back.
function fakeFetch(calls) {
  return async (token, path, method, body) => {
    calls.push({ token, path, method, body })
    if (/\/query$/.test(path)) {
      return { results: [{ id: 'p1', properties: { Name: { title: [{ plain_text: 'a' }] }, Order: { number: 5 } } }], has_more: false }
    }
    // create/update echo: reflect the props sent back as a page.
    return { id: body?.parent ? 'new1' : 'p1', properties: body?.properties || {} }
  }
}

describe('notionClient', () => {
  it('lists via the query endpoint and maps to threads', async () => {
    const calls = []
    const c = createNotionClient('tok', { databaseId: 'db1', fetchImpl: fakeFetch(calls) })
    const list = await c.listThreads()
    expect(calls[0].path).toBe('databases/db1/query')
    expect(list[0]).toMatchObject({ id: 'p1', title: 'a', order: 5 })
  })

  it('creates a page under the database', async () => {
    const calls = []
    const c = createNotionClient('tok', { databaseId: 'db1', fetchImpl: fakeFetch(calls) })
    await c.createThread({ title: 'weave', skein: 'Work', day: '2026-07-17', order: 10, done: false })
    expect(calls[0].path).toBe('pages')
    expect(calls[0].body.parent).toEqual({ database_id: 'db1' })
    expect(calls[0].body.properties.Name.title[0].text.content).toBe('weave')
  })

  it('a reorder patch writes ONLY Order — never clobbers the title', async () => {
    const calls = []
    const c = createNotionClient('tok', { databaseId: 'db1', fetchImpl: fakeFetch(calls) })
    await c.updateThread('p1', { order: 250 })
    expect(calls[0].method).toBe('PATCH')
    expect(Object.keys(calls[0].body.properties)).toEqual(['Order'])
    expect(calls[0].body.properties.Order.number).toBe(250)
  })

  it('a done patch writes only Done', async () => {
    const calls = []
    const c = createNotionClient('tok', { databaseId: 'db1', fetchImpl: fakeFetch(calls) })
    await c.updateThread('p1', { done: true })
    expect(Object.keys(calls[0].body.properties)).toEqual(['Done'])
    expect(calls[0].body.properties.Done.checkbox).toBe(true)
  })

  it('remove archives the page', async () => {
    const calls = []
    const c = createNotionClient('tok', { databaseId: 'db1', fetchImpl: fakeFetch(calls) })
    await c.removeThread('p1')
    expect(calls[0]).toMatchObject({ path: 'pages/p1', method: 'PATCH', body: { archived: true } })
  })
})
