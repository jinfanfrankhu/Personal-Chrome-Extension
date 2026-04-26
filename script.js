/**
 * Main initialization file for MIT Chrome Extension
 * Coordinates all modules: News, Countdown, Calendar, and Tasks
 */
import { NewsManager } from './news.js';
import { CountdownManager, ProgressBarManager } from './countdown.js';
import { CalendarManager } from './calendar.js';
import { TasksManager } from './tasks.js';

class MITContentExtension {
    constructor() {
        this.newsManager = new NewsManager();
        this.countdownManager = new CountdownManager();
        this.progressBarManager = new ProgressBarManager();
        this.calendarManager = new CalendarManager();
        this.tasksManager = new TasksManager(this.calendarManager);
        this.init();
    }

    async init() {
        await Promise.all([
            this.newsManager.init(),
            this.countdownManager.init(),
            this.progressBarManager.init(),
            this.calendarManager.init(),
            this.tasksManager.init()
        ]);
    }
}

// Initialize the extension when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new MITContentExtension();
});

// Handle extension updates
chrome.runtime.onInstalled?.addListener(() => {
    console.log('MIT Content Extension installed/updated');
});
