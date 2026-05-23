/**
 * Widget Manager - Handles customizable widget boxes with Graph and Heatmap types
 */

const COLORS = {
    blue:  { hex: '#286DC0', dark: '#1a5ca0' },
    green: { hex: '#2d7a4f', dark: '#1e5c3a' },
    red:   { hex: '#c0392b', dark: '#96281b' },
};

export class WidgetManager {
    constructor() {
        this.WIDGET_KEY_PREFIX = 'widget_';
        this.boxes = [];
    }

    async init() {
        this.boxes = Array.from(document.querySelectorAll('.tracker-box'));
        await this.renderAll();
        document.addEventListener('trackerShown', () => this.scrollHeatmapsToToday());
        this.scrollHeatmapsToToday();
    }

    // ── Storage ───────────────────────────────────────────────────────────────

    async loadWidget(index) {
        const key = this.WIDGET_KEY_PREFIX + index;
        const result = await chrome.storage.local.get([key]);
        return result[key] || null;
    }

    async saveWidget(index, data) {
        await chrome.storage.local.set({ [this.WIDGET_KEY_PREFIX + index]: data });
    }

    async deleteWidget(index) {
        await chrome.storage.local.remove([this.WIDGET_KEY_PREFIX + index]);
    }

    // ── Rendering ─────────────────────────────────────────────────────────────

    async renderAll() {
        for (let i = 0; i < this.boxes.length; i++) {
            const data = await this.loadWidget(i);
            this.renderBox(this.boxes[i], i, data);
        }
    }

    renderBox(box, index, data) {
        box.innerHTML = '';
        box.className = 'tracker-box';
        if (!data || !data.type) {
            this.renderEmpty(box, index);
        } else {
            const c = COLORS[data.color] || COLORS.blue;
            box.style.setProperty('--widget-accent', c.hex);
            box.style.setProperty('--widget-accent-dark', c.dark);
            if (data.type === 'graph') {
                this.renderGraph(box, index, data);
            } else if (data.type === 'heatmap') {
                this.renderHeatmap(box, index, data);
            }
        }
    }

    // ── Empty State ───────────────────────────────────────────────────────────

    renderEmpty(box, index) {
        box.classList.add('tracker-box--empty');
        const label = document.createElement('span');
        label.className = 'tracker-box-label';
        label.textContent = `Widget ${index + 1}`;
        box.appendChild(label);
        box.addEventListener('click', () => this.showTypeSelector(box, index), { once: true });
    }

    // ── Type Selector Modal ───────────────────────────────────────────────────

    showTypeSelector(box, index) {
        let selectedColor = 'blue';

        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal-content widget-type-modal">
                <h3>Choose Widget Type</h3>
                <div class="widget-type-options">
                    <button class="widget-type-btn" data-type="graph">
                        <span class="widget-type-icon">📈</span>
                        <span class="widget-type-name">Graph</span>
                        <span class="widget-type-desc">Track a number over time</span>
                    </button>
                    <button class="widget-type-btn" data-type="heatmap">
                        <span class="widget-type-icon">🟦</span>
                        <span class="widget-type-name">Heatmap</span>
                        <span class="widget-type-desc">Daily activity grid</span>
                    </button>
                </div>
                <div class="widget-type-color-row">
                    <span class="widget-type-color-label">Color:</span>
                    <button class="widget-color-swatch widget-color-swatch--selected" data-color="blue" style="background:#286DC0" title="Blue"></button>
                    <button class="widget-color-swatch" data-color="green" style="background:#2d7a4f" title="Green"></button>
                    <button class="widget-color-swatch" data-color="red" style="background:#c0392b" title="Red"></button>
                </div>
                <button class="modal-btn secondary" id="widgetCancelBtn">Cancel</button>
            </div>
        `;
        document.body.appendChild(modal);

        modal.querySelectorAll('.widget-color-swatch').forEach(swatch => {
            swatch.addEventListener('click', (e) => {
                e.stopPropagation();
                selectedColor = swatch.dataset.color;
                modal.querySelectorAll('.widget-color-swatch').forEach(s => s.classList.remove('widget-color-swatch--selected'));
                swatch.classList.add('widget-color-swatch--selected');
            });
        });

        modal.querySelectorAll('.widget-type-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                const type = btn.dataset.type;
                const data = type === 'graph'
                    ? { type: 'graph', title: 'Metric', range: 30, entries: [], color: selectedColor }
                    : { type: 'heatmap', title: 'Activity', activeDays: [], color: selectedColor };
                await this.saveWidget(index, data);
                document.body.removeChild(modal);
                this.renderBox(box, index, data);
                if (type === 'heatmap') this.scrollHeatmapsToToday();
            });
        });

        modal.querySelector('#widgetCancelBtn').addEventListener('click', () => {
            document.body.removeChild(modal);
            this.renderEmpty(box, index);
        });

        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                document.body.removeChild(modal);
                this.renderEmpty(box, index);
            }
        });
    }

    // ── Color Picker (inline, post-creation) ─────────────────────────────────

    showColorPicker(inner, index, data, box) {
        const existing = inner.querySelector('.widget-color-picker');
        if (existing) { existing.remove(); return; }

        const picker = document.createElement('div');
        picker.className = 'widget-color-picker';

        Object.entries(COLORS).forEach(([key, { hex }]) => {
            const swatch = document.createElement('button');
            swatch.className = 'widget-color-picker-swatch' +
                ((data.color || 'blue') === key ? ' widget-color-picker-swatch--active' : '');
            swatch.style.background = hex;
            swatch.title = key.charAt(0).toUpperCase() + key.slice(1);
            swatch.addEventListener('click', async (e) => {
                e.stopPropagation();
                const fresh = await this.loadWidget(index);
                fresh.color = key;
                await this.saveWidget(index, fresh);
                this.renderBox(box, index, fresh);
                if (fresh.type === 'heatmap') this.scrollHeatmapsToToday();
            });
            picker.appendChild(swatch);
        });

        // Insert after header (first child of inner)
        inner.insertBefore(picker, inner.children[1] || null);
    }

    // ── Graph Widget ──────────────────────────────────────────────────────────

    renderGraph(box, index, data) {
        box.classList.add('tracker-box--graph');
        box.innerHTML = '';

        const inner = document.createElement('div');
        inner.className = 'widget-inner';

        // Header
        const header = document.createElement('div');
        header.className = 'widget-header';

        const title = document.createElement('span');
        title.className = 'widget-title';
        title.textContent = data.title;
        title.title = 'Click to rename';
        title.addEventListener('click', () => this.makeEditableTitle(title, index, data));

        const actions = document.createElement('div');
        actions.className = 'widget-header-actions';

        const colorBtn = document.createElement('button');
        colorBtn.className = 'widget-color-btn';
        colorBtn.style.background = (COLORS[data.color] || COLORS.blue).hex;
        colorBtn.title = 'Change color';
        colorBtn.addEventListener('click', (e) => { e.stopPropagation(); this.showColorPicker(inner, index, data, box); });

        const resetBtn = document.createElement('button');
        resetBtn.className = 'widget-reset-btn';
        resetBtn.textContent = '×';
        resetBtn.title = 'Remove widget';
        resetBtn.addEventListener('click', (e) => { e.stopPropagation(); this.confirmReset(box, index); });

        actions.appendChild(colorBtn);
        actions.appendChild(resetBtn);
        header.appendChild(title);
        header.appendChild(actions);

        // Range input row
        const rangeRow = document.createElement('div');
        rangeRow.className = 'graph-range-row';

        const rangeLabel = document.createElement('label');
        rangeLabel.className = 'graph-range-label';
        rangeLabel.textContent = 'Last';

        const rangeInput = document.createElement('input');
        rangeInput.type = 'number';
        rangeInput.className = 'graph-range-input';
        rangeInput.value = data.range || 30;
        rangeInput.min = 1;
        rangeInput.max = 3650;

        const rangeSuffix = document.createElement('span');
        rangeSuffix.className = 'graph-range-suffix';
        rangeSuffix.textContent = 'days';

        const commitRange = async () => {
            const val = parseInt(rangeInput.value, 10);
            if (isNaN(val) || val < 1) { rangeInput.value = data.range || 30; return; }
            const fresh = await this.loadWidget(index);
            fresh.range = val;
            await this.saveWidget(index, fresh);
            this.renderGraph(box, index, fresh);
        };
        rangeInput.addEventListener('blur', commitRange);
        rangeInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') rangeInput.blur(); });

        const maBtn = document.createElement('button');
        maBtn.className = 'graph-ma-btn' + (data.showMovingAvg ? ' graph-ma-btn--active' : '');
        maBtn.textContent = '7D avg';
        maBtn.title = 'Toggle 7-day moving average';
        maBtn.addEventListener('click', async () => {
            const fresh = await this.loadWidget(index);
            fresh.showMovingAvg = !fresh.showMovingAvg;
            await this.saveWidget(index, fresh);
            this.renderGraph(box, index, fresh);
        });

        rangeRow.appendChild(rangeLabel);
        rangeRow.appendChild(rangeInput);
        rangeRow.appendChild(rangeSuffix);
        rangeRow.appendChild(maBtn);

        // Chart
        const chartArea = document.createElement('div');
        chartArea.className = 'graph-chart-area';
        chartArea.appendChild(this.buildSVGChart(data.entries || [], data.range, index, box, data.color, data.showMovingAvg));

        // Add entry button
        const addBtn = document.createElement('button');
        addBtn.className = 'graph-add-btn';
        addBtn.textContent = '+ Add Entry';
        addBtn.addEventListener('click', () => this.showAddEntryModal(index, box));

        inner.appendChild(header);
        inner.appendChild(rangeRow);
        inner.appendChild(chartArea);
        inner.appendChild(addBtn);
        box.appendChild(inner);
    }

    buildSVGChart(entries, range, index, box, colorKey, showMovingAvg) {
        const accent = (COLORS[colorKey] || COLORS.blue).hex;
        const accentDark = (COLORS[colorKey] || COLORS.blue).dark;

        const cutoff = Date.now() - range * 86400000;
        const allSorted = (entries || []).sort((a, b) => new Date(a.ts) - new Date(b.ts));
        const filtered = allSorted.filter(e => new Date(e.ts).getTime() >= cutoff);

        if (filtered.length === 0) {
            const p = document.createElement('p');
            p.className = 'graph-no-data';
            p.textContent = 'No data — click "+ Add Entry"';
            return p;
        }

        const PAD_L = 32, PAD_R = 10, PAD_T = 8, PAD_B = 18;
        const W = 280, H = 80;
        const chartW = W - PAD_L - PAD_R;
        const chartH = H - PAD_T - PAD_B;

        const ns = 'http://www.w3.org/2000/svg';
        const svg = document.createElementNS(ns, 'svg');
        svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
        svg.setAttribute('class', 'graph-svg');
        svg.setAttribute('width', '100%');
        svg.setAttribute('height', '100%');

        const timestamps = filtered.map(e => new Date(e.ts).getTime());
        const values = filtered.map(e => e.value);
        const minTs = Math.min(...timestamps);
        const maxTs = Math.max(...timestamps);
        const minVal = Math.min(...values);
        const maxVal = Math.max(...values);
        const rawRange = maxVal - minVal;
        const effectiveMin = rawRange === 0 ? minVal - 1 : minVal;
        const effectiveRange = rawRange === 0 ? 2 : rawRange;

        const toX = ts => filtered.length === 1
            ? PAD_L + chartW / 2
            : PAD_L + ((ts - minTs) / (maxTs - minTs)) * chartW;
        const toY = val => PAD_T + chartH - ((val - effectiveMin) / effectiveRange) * chartH;

        const mk = (tag, attrs) => {
            const el = document.createElementNS(ns, tag);
            Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
            return el;
        };

        svg.appendChild(mk('line', { x1: PAD_L, y1: PAD_T, x2: PAD_L, y2: PAD_T + chartH, stroke: '#ddd', 'stroke-width': '1' }));
        svg.appendChild(mk('line', { x1: PAD_L, y1: PAD_T + chartH, x2: PAD_L + chartW, y2: PAD_T + chartH, stroke: '#ddd', 'stroke-width': '1' }));

        for (let i = 0; i <= 2; i++) {
            const frac = i / 2;
            const val = effectiveMin + frac * effectiveRange;
            const y = PAD_T + chartH - frac * chartH;
            if (i > 0) {
                svg.appendChild(mk('line', { x1: PAD_L, y1: y, x2: PAD_L + chartW, y2: y, stroke: '#f0f0f0', 'stroke-width': '1' }));
            }
            const lbl = mk('text', { x: PAD_L - 3, y: y + 3, 'text-anchor': 'end', 'font-size': '7', fill: '#999' });
            lbl.textContent = Number.isInteger(val) ? String(val) : val.toFixed(1);
            svg.appendChild(lbl);
        }

        const showDates = filtered.length > 1 ? [filtered[0], filtered[filtered.length - 1]] : [filtered[0]];
        showDates.forEach((entry, i) => {
            const x = toX(new Date(entry.ts).getTime());
            const d = new Date(entry.ts);
            const lbl = mk('text', {
                x, y: H - 3,
                'text-anchor': i === 0 && filtered.length > 1 ? 'start' : 'end',
                'font-size': '7', fill: '#999'
            });
            lbl.textContent = `${d.getMonth() + 1}/${d.getDate()}`;
            svg.appendChild(lbl);
        });

        if (filtered.length > 1) {
            const pts = filtered.map(e => `${toX(new Date(e.ts).getTime())},${toY(e.value)}`).join(' ');
            svg.appendChild(mk('polyline', { points: pts, stroke: accent, 'stroke-width': '1.5', fill: 'none', 'stroke-linejoin': 'round' }));
        }

        if (showMovingAvg && filtered.length > 1) {
            const MA_WINDOW = 7 * 86400000;
            const maPoints = filtered.map(e => {
                const ets = new Date(e.ts).getTime();
                const window = allSorted.filter(x => {
                    const xts = new Date(x.ts).getTime();
                    return xts >= ets - MA_WINDOW && xts <= ets;
                });
                const avg = window.reduce((s, x) => s + x.value, 0) / window.length;
                return `${toX(ets)},${toY(avg)}`;
            }).join(' ');
            const maLine = mk('polyline', {
                points: maPoints,
                stroke: accent,
                'stroke-width': '2',
                'stroke-opacity': '0.35',
                fill: 'none',
                'stroke-linejoin': 'round',
                'stroke-dasharray': '4 2',
            });
            svg.appendChild(maLine);
        }

        filtered.forEach(entry => {
            const circle = mk('circle', {
                cx: toX(new Date(entry.ts).getTime()),
                cy: toY(entry.value),
                r: '3', fill: accent, stroke: 'white', 'stroke-width': '1.5'
            });
            circle.style.cursor = 'pointer';
            const titleEl = document.createElementNS(ns, 'title');
            titleEl.textContent = `${entry.value} — ${new Date(entry.ts).toLocaleDateString()} (right-click to delete)`;
            circle.appendChild(titleEl);
            circle.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                this.deleteEntry(index, entry.ts, box);
            });
            svg.appendChild(circle);
        });

        return svg;
    }

    showAddEntryModal(index, box) {
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal-content">
                <h3>Add Data Point</h3>
                <input type="number" class="widget-entry-input" id="widgetEntryVal" placeholder="Enter a number" step="any">
                <div class="modal-buttons">
                    <button class="modal-btn secondary" id="entryCancel">Cancel</button>
                    <button class="modal-btn primary" id="entryAdd">Add</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);

        const input = modal.querySelector('#widgetEntryVal');
        input.focus();

        const doAdd = async () => {
            const val = parseFloat(input.value);
            if (isNaN(val)) { input.style.borderColor = '#d32f2f'; return; }
            const data = await this.loadWidget(index);
            data.entries = [...(data.entries || []), { ts: new Date().toISOString(), value: val }]
                .sort((a, b) => new Date(a.ts) - new Date(b.ts));
            await this.saveWidget(index, data);
            document.body.removeChild(modal);
            this.renderGraph(box, index, data);
        };

        modal.querySelector('#entryAdd').addEventListener('click', doAdd);
        modal.querySelector('#entryCancel').addEventListener('click', () => document.body.removeChild(modal));
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') doAdd();
            if (e.key === 'Escape') document.body.removeChild(modal);
        });
        modal.addEventListener('click', (e) => { if (e.target === modal) document.body.removeChild(modal); });
    }

    async deleteEntry(index, ts, box) {
        const data = await this.loadWidget(index);
        data.entries = (data.entries || []).filter(e => e.ts !== ts);
        await this.saveWidget(index, data);
        this.renderGraph(box, index, data);
    }

    // ── Heatmap Widget ────────────────────────────────────────────────────────

    renderHeatmap(box, index, data) {
        box.classList.add('tracker-box--heatmap');
        box.innerHTML = '';

        const inner = document.createElement('div');
        inner.className = 'widget-inner';

        const header = document.createElement('div');
        header.className = 'widget-header';

        const title = document.createElement('span');
        title.className = 'widget-title';
        title.textContent = data.title;
        title.title = 'Click to rename';
        title.addEventListener('click', () => this.makeEditableTitle(title, index, data));

        const actions = document.createElement('div');
        actions.className = 'widget-header-actions';

        const colorBtn = document.createElement('button');
        colorBtn.className = 'widget-color-btn';
        colorBtn.style.background = (COLORS[data.color] || COLORS.blue).hex;
        colorBtn.title = 'Change color';
        colorBtn.addEventListener('click', (e) => { e.stopPropagation(); this.showColorPicker(inner, index, data, box); });

        const resetBtn = document.createElement('button');
        resetBtn.className = 'widget-reset-btn';
        resetBtn.textContent = '×';
        resetBtn.title = 'Remove widget';
        resetBtn.addEventListener('click', (e) => { e.stopPropagation(); this.confirmReset(box, index); });

        actions.appendChild(colorBtn);
        actions.appendChild(resetBtn);
        header.appendChild(title);
        header.appendChild(actions);

        inner.appendChild(header);
        inner.appendChild(this.buildHeatmapGrid(data.activeDays || [], index));
        box.appendChild(inner);
    }

    buildHeatmapGrid(activeDays, index) {
        const activeSet = new Set(activeDays);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayStr = this.dateToStr(today);

        const dayOfWeek = today.getDay();
        const currentSunday = new Date(today);
        currentSunday.setDate(today.getDate() - dayOfWeek);

        const startSunday = new Date(currentSunday);
        startSunday.setDate(currentSunday.getDate() - 26 * 7);

        const weeks = [];
        const cursor = new Date(startSunday);
        while (cursor <= currentSunday) {
            const week = [];
            for (let i = 0; i < 7; i++) {
                week.push(this.dateToStr(new Date(cursor)));
                cursor.setDate(cursor.getDate() + 1);
            }
            weeks.push(week);
        }

        const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
        const CELL = 11, GAP = 2, COL = CELL + GAP;

        const outer = document.createElement('div');
        outer.className = 'heatmap-outer';

        // Fixed day labels
        const dayLabels = document.createElement('div');
        dayLabels.className = 'heatmap-day-labels';
        ['S','M','T','W','T','F','S'].forEach(l => {
            const s = document.createElement('span');
            s.textContent = l;
            dayLabels.appendChild(s);
        });

        // Scrollable area
        const scrollWrapper = document.createElement('div');
        scrollWrapper.className = 'heatmap-scroll-wrapper';

        const scrollInner = document.createElement('div');
        scrollInner.className = 'heatmap-scroll-inner';

        // Month labels
        const monthRow = document.createElement('div');
        monthRow.className = 'heatmap-month-labels-row';

        let prevMonth = -1, colCount = 0;
        const monthSpans = [];
        weeks.forEach(week => {
            const m = new Date(week[0] + 'T00:00:00').getMonth();
            if (m !== prevMonth) {
                if (prevMonth !== -1) monthSpans.push({ label: MONTHS[prevMonth], cols: colCount });
                prevMonth = m; colCount = 1;
            } else {
                colCount++;
            }
        });
        if (prevMonth !== -1) monthSpans.push({ label: MONTHS[prevMonth], cols: colCount });

        monthSpans.forEach(({ label, cols }) => {
            const span = document.createElement('span');
            span.className = 'heatmap-month-label';
            span.textContent = label;
            span.style.width = (cols * COL - GAP) + 'px';
            monthRow.appendChild(span);
        });

        // Weeks + event delegation
        const weeksRow = document.createElement('div');
        weeksRow.className = 'heatmap-weeks-row';

        weeksRow.addEventListener('click', async (e) => {
            const cell = e.target.closest('.heatmap-cell');
            if (!cell || !cell.dataset.date) return;
            const dateStr = cell.dataset.date;
            const data = await this.loadWidget(index);
            const set = new Set(data.activeDays || []);
            if (set.has(dateStr)) set.delete(dateStr); else set.add(dateStr);
            data.activeDays = Array.from(set);
            await this.saveWidget(index, data);
            cell.classList.toggle('heatmap-cell--active');
        });

        weeks.forEach(week => {
            const weekCol = document.createElement('div');
            weekCol.className = 'heatmap-week';
            week.forEach(dateStr => {
                const cell = document.createElement('div');
                cell.className = 'heatmap-cell';
                cell.dataset.date = dateStr;
                if (activeSet.has(dateStr)) cell.classList.add('heatmap-cell--active');
                if (dateStr === todayStr) cell.classList.add('heatmap-cell--today');
                weekCol.appendChild(cell);
            });
            weeksRow.appendChild(weekCol);
        });

        scrollInner.appendChild(monthRow);
        scrollInner.appendChild(weeksRow);
        scrollWrapper.appendChild(scrollInner);
        outer.appendChild(dayLabels);
        outer.appendChild(scrollWrapper);

        return outer;
    }

    scrollHeatmapsToToday() {
        document.querySelectorAll('.heatmap-scroll-wrapper').forEach(w => {
            w.scrollLeft = w.scrollWidth;
        });
    }

    // ── Shared ────────────────────────────────────────────────────────────────

    makeEditableTitle(titleEl, index, data) {
        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'widget-title-input';
        input.value = data.title;
        input.maxLength = 30;
        titleEl.replaceWith(input);
        input.focus();
        input.select();

        const commit = async () => {
            const newTitle = input.value.trim() || data.title;
            const fresh = await this.loadWidget(index);
            fresh.title = newTitle;
            data.title = newTitle;
            await this.saveWidget(index, fresh);
            const span = document.createElement('span');
            span.className = 'widget-title';
            span.textContent = newTitle;
            span.title = 'Click to rename';
            span.addEventListener('click', () => this.makeEditableTitle(span, index, data));
            input.replaceWith(span);
        };

        input.addEventListener('blur', commit);
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') { e.preventDefault(); input.blur(); }
            if (e.key === 'Escape') { input.value = data.title; input.blur(); }
        });
    }

    confirmReset(box, index) {
        const actions = box.querySelector('.widget-header-actions');
        if (!actions) return;
        actions.innerHTML = '';

        const wrap = document.createElement('span');
        wrap.className = 'widget-reset-confirm';
        wrap.textContent = 'Remove? ';

        const yesBtn = document.createElement('button');
        yesBtn.className = 'widget-reset-confirm-btn';
        yesBtn.textContent = '✓';
        yesBtn.addEventListener('click', async () => {
            await this.deleteWidget(index);
            this.renderBox(box, index, null);
        });

        const noBtn = document.createElement('button');
        noBtn.className = 'widget-reset-confirm-btn';
        noBtn.textContent = '✗';
        noBtn.addEventListener('click', () => {
            this.loadWidget(index).then(fresh => {
                if (fresh) this.renderBox(box, index, fresh);
            });
        });

        wrap.appendChild(yesBtn);
        wrap.appendChild(noBtn);
        actions.appendChild(wrap);
    }

    dateToStr(date) {
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    }
}
