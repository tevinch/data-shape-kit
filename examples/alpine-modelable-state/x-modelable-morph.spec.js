import { haveText, html, test } from '../../utils'

test('x-modelable retains an inner update made immediately after morph',
    html`
        <div x-data="{ outer: 0 }">
            <div id="counter" x-data="{ inner: 0 }" x-modelable="inner" x-model="outer"></div>
            <button id="increment" @click="Alpine.$data(document.getElementById('counter')).inner++">Increment</button>
            <button id="morph" @click="let el = document.getElementById('counter'); Alpine.morph(el, el.outerHTML); Alpine.$data(el).inner++">Morph and increment</button>
            <output x-text="outer"></output>
        </div>
    `,
    ({ get }) => {
        get('#increment').click()
        get('output').should(haveText('1'))
        for (let i = 2; i <= 11; i++) {
            get('#morph').click()
            get('output').should(haveText(String(i)))
        }
        get('#increment').click()
        get('output').should(haveText('12'))
    }
)

test('x-modelable retains selections made by an attribute observer after repeated page morphs',
    [html`
        <div id="app" data-page="1" x-data="{ selected: [99], selectNewPages: true }">
            <label><input id="automatic" type="checkbox" x-model="selectNewPages">Select new pages</label>
            <button id="toggle" @click="window.toggleList()">Toggle list</button>
            <button id="clear" @click="selected = []">Clear selection</button>
            <output id="selected" x-text="JSON.stringify(selected)"></output>
            <div id="list" data-page="1" x-data="pageSelection" x-modelable="value" x-model="selected">
                <input id="notes" type="text" x-model="notes">
                <button id="select-page" @click="value = [...new Set([...value, ...rows])]">Select page</button>
                <button id="next" @click="window.nextPage()">Next page</button>
                <template x-for="row in rows" :key="row">
                    <label><input type="checkbox" :data-row="row" :value="row" x-model.number="value"><span x-text="row"></span></label>
                </template>
                <output id="observations" x-text="observations"></output>
                <output id="inner" x-text="JSON.stringify(value)"></output>
            </div>
        </div>
    `, html`
        let markup = document.getElementById('app').outerHTML
        let newPage = () => {
            let holder = document.createElement('div')
            holder.innerHTML = markup
            return holder.firstElementChild
        }
        window.nextPage = () => {
            let app = document.getElementById('app')
            let target = newPage()
            target.dataset.page = Number(app.dataset.page) + 1
            target.querySelector('#list').dataset.page = target.dataset.page
            Alpine.morph(app, target)
        }
        window.toggleList = () => {
            let list = document.getElementById('list')
            if (list) list.remove()
            else document.getElementById('app').append(newPage().querySelector('#list'))
        }
        Alpine.data('pageSelection', () => ({
            value: [], rows: [1, 2], observations: 0, observer: null, notes: 'Existing notes',
            init() {
                this.observer = new MutationObserver(() => {
                    this.observations++
                    let page = Number(this.$el.dataset.page)
                    this.rows = [page * 2 - 1, page * 2]
                    if (this.selectNewPages) this.value = [...new Set([...this.value, ...this.rows])]
                })
                this.observer.observe(this.$el, { attributes: true, attributeFilter: ['data-page'] })
            },
            destroy() { this.observer.disconnect() },
        }))
    `],
    ({ get }) => {
        let selected = [99, 1, 2]
        get('#select-page').click()
        get('#selected').should(haveText(JSON.stringify(selected)))
        get('#notes').clear().type('Keep this draft')
        for (let page = 2; page <= 11; page++) {
            selected.push(page * 2 - 1, page * 2)
            get('#next').click()
            get('#observations').should(haveText(String(page - 1)))
            get('#selected').should(haveText(JSON.stringify(selected)))
            get('#inner').should(haveText(JSON.stringify(selected)))
            get('[data-row]').should('have.length', 2).and('be.checked')
        }
        get('#notes').should('have.value', 'Keep this draft')
        get('[data-row="21"]').uncheck()
        get('#selected').should(haveText(JSON.stringify(selected.filter(row => row !== 21))))
        get('[data-row="21"]').check()
        selected = [...selected.filter(row => row !== 21), 21]
        get('#selected').should(haveText(JSON.stringify(selected)))
        get('#automatic').uncheck()
        get('#next').click()
        get('#observations').should(haveText('11'))
        get('#selected').should(haveText(JSON.stringify(selected)))
        get('[data-row="23"]').should('not.be.checked').check()
        selected.push(23)
        get('#selected').should(haveText(JSON.stringify(selected)))
        get('#clear').click()
        get('#inner').should(haveText('[]'))
        get('[data-row]').should('not.be.checked')
        get('#toggle').click()
        get('#list').should('not.exist')
        get('#toggle').click()
        get('#inner').should(haveText('[]'))
        get('[data-row="1"]').check()
        get('#selected').should(haveText('[1]'))
    }
)

test('x-modelable does not accumulate live bindings on morph comparison nodes',
    [html`
        <div x-data="{ outer: { items: [] } }">
            <div id="component" x-data="{
                stored: { items: [] },
                get inner() { window.modelReads++; return this.stored },
                set inner(value) { this.stored = value },
            }" x-modelable="inner" x-model="outer"></div>
            <output x-text="JSON.stringify(outer)"></output>
        </div>
    `, 'window.modelReads = 0'],
    ({ get, then }, reload, window, document) => {
        let baseline
        let previousMorphs = 0
        for (let morphCount of [0, 1, 5, 10, 20]) {
            then(() => {
                let el = document.getElementById('component')
                for (let i = previousMorphs; i < morphCount; i++) window.Alpine.morph(el, el.outerHTML)
                previousMorphs = morphCount
            })
            then(() => {
                window.modelReads = 0
                window.Alpine.$data(document.getElementById('component')).stored.items.push(morphCount)
            })
            get('output').should(haveText(JSON.stringify({ items: [0, 1, 5, 10, 20].filter(n => n <= morphCount) })))
            then(() => {
                if (morphCount === 0) {
                    baseline = window.modelReads
                    expect(baseline).to.be.greaterThan(0)
                } else {
                    expect(window.modelReads).to.equal(baseline)
                }
            })
        }
    }
)
