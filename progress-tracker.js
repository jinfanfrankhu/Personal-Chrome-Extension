/**
 * Progress Tracker Module - Toggleable panel with 8 customizable widget boxes
 */
export class ProgressTrackerManager {
    constructor() {
        this.STORAGE_KEY = 'tracker_panel_open';
    }

    init() {
        const btn = document.getElementById('trackerToggleBtn');
        btn.addEventListener('click', () => this.toggle());
    }

    toggle() {
        const panel = document.getElementById('progressTrackerPanel');
        const isOpen = panel.style.display !== 'none';
        isOpen ? this.showCalendar() : this.showTracker(true);
    }

    showTracker(save = true) {
        document.querySelector('.countdown-section').style.display = 'none';
        document.querySelector('.next-event-section').style.display = 'none';
        document.getElementById('progressTrackerPanel').style.display = 'grid';
        document.getElementById('trackerToggleBtn').classList.add('active');
        if (save) chrome.storage.local.set({ [this.STORAGE_KEY]: true });
        document.dispatchEvent(new CustomEvent('trackerShown'));
    }

    showCalendar() {
        document.querySelector('.countdown-section').style.display = '';
        document.querySelector('.next-event-section').style.display = '';
        document.getElementById('progressTrackerPanel').style.display = 'none';
        document.getElementById('trackerToggleBtn').classList.remove('active');
        chrome.storage.local.set({ [this.STORAGE_KEY]: false });
    }
}
