import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DayGridRow, type DayGridRowProps } from '../src/daygrid/components/DayGridRow'
import { flushSyncWithSizeBatching } from '../src/component-util/resize-observer'

// Model the documented single-listener boundary and synchronous print acquisition.
// The row controls registration, cleanup and delivery to its real external refs.
const sizing = vi.hoisted(() => ({
  height: 28,
  registrations: [] as HTMLElement[],
  active: new Map<HTMLElement, (height: number) => void>(),
}))

vi.mock('../src/component-util/resize-observer', async (importOriginal) => ({
  ...await importOriginal<typeof import('../src/component-util/resize-observer')>(),
  watchHeight(el: HTMLElement, callback: (height: number) => void) {
    if (sizing.active.has(el)) throw new Error('duplicate height listener')
    sizing.registrations.push(el)
    sizing.active.set(el, callback)
    callback(sizing.height)
    return () => { sizing.active.delete(el) }
  },
}))

function createRow(
  rootElRef: DayGridRowProps['rootElRef'],
  heightRef: DayGridRowProps['heightRef'],
  forPrint = false,
) {
  return new DayGridRow({
    dateProfile: {} as DayGridRowProps['dateProfile'],
    todayRange: { start: null, end: null },
    cells: [],
    cellIsNarrow: false,
    cellIsMicro: false,
    showDayNumbers: false,
    forPrint,
    fgEventSegs: [],
    bgEventSegs: [],
    businessHourSegs: [],
    dateSelectionSegs: [],
    eventDrag: null,
    eventResize: null,
    eventSelection: '',
    dayMaxEvents: false,
    dayMaxEventRows: false,
    rootElRef,
    heightRef,
  })
}

beforeEach(() => {
  sizing.height = 28
  sizing.registrations.length = 0
  sizing.active.clear()
})

describe('DayGridRow height lifecycle', () => {
  it('keeps one height listener and one root publication across ref attachment and mount', () => {
    const rootRef = vi.fn()
    const heightRef = vi.fn()
    const el = {} as HTMLElement
    const row = createRow(rootRef, heightRef)

    row.handleRootEl(el)
    row.componentDidMount()

    expect(sizing.registrations).toEqual([el])
    expect(sizing.active.size).toBe(1)
    expect(rootRef.mock.calls).toEqual([[el]])
    expect(heightRef.mock.calls).toEqual([[28]])
  })

  it('reconnects after lifecycle replay and delivers measurements to the current height ref', () => {
    const rootRef = vi.fn()
    const originalHeightRef = vi.fn()
    const currentHeightRef = vi.fn()
    const nextHeightRef = vi.fn()
    const el = {} as HTMLElement
    const row = createRow(rootRef, originalHeightRef)

    row.handleRootEl(el)
    row.componentDidMount()
    row.componentWillUnmount()
    expect(sizing.active.size).toBe(0)
    expect(originalHeightRef.mock.calls).toEqual([[28], [null]])

    Object.assign(row, { props: { ...row.props, heightRef: currentHeightRef } })
    sizing.height = 61
    row.componentDidMount()

    // This assertion fails on the original row: no listener is reattached.
    expect(currentHeightRef.mock.calls).toEqual([[61]])
    expect(sizing.registrations).toEqual([el, el])
    expect(sizing.active.size).toBe(1)
    expect(rootRef.mock.calls).toEqual([[el]])

    Object.assign(row, { props: { ...row.props, heightRef: nextHeightRef } })
    sizing.active.get(el)!(83)
    expect(nextHeightRef.mock.calls).toEqual([[83]])
    expect(currentHeightRef.mock.calls).toEqual([[61]])
    expect(originalHeightRef.mock.calls).toEqual([[28], [null]])
  })

  it('stops measurement and clears external refs when the root is truly detached', () => {
    const rootRef = vi.fn()
    const heightRef = vi.fn()
    const el = {} as HTMLElement
    const row = createRow(rootRef, heightRef)

    row.handleRootEl(el)
    row.componentDidMount()
    row.handleRootEl(null)
    row.componentWillUnmount()

    expect(sizing.active.size).toBe(0)
    expect(sizing.registrations).toEqual([el])
    expect(rootRef.mock.calls).toEqual([[el], [null]])
    expect(heightRef.mock.calls).toEqual([[28], [null]])
  })

  it('reports synchronous print height during ref attachment before mount without republishing the root', () => {
    const el = {} as HTMLElement
    const order: string[] = []
    const heights: (number | null)[] = []
    const rootRef = vi.fn((value: HTMLElement | null) => {
      expect(value).toBe(el)
      order.push('root')
    })
    const row = createRow(rootRef, (height) => {
      order.push('height')
      heights.push(height)
    }, true)

    flushSyncWithSizeBatching(() => { row.handleRootEl(el) })

    expect(order).toEqual(['root', 'height'])
    expect(heights).toEqual([28])
    expect(sizing.registrations).toEqual([el])
    row.componentDidMount()
    expect(rootRef.mock.calls).toEqual([[el]])
    expect(heights).toEqual([28])
    expect(sizing.registrations).toEqual([el])
  })
})
