/**
 * Countdown Module - Handles countdown timer functionality
 */
export class CountdownManager {
    constructor() {
        this.TARGET_DATE_KEY = 'target_date';
        this.TARGET_TITLE_KEY = 'target_title';
        this.countdownInterval = null;
    }

    async init() {
        this.bindEvents();
        await this.initializeCountdown();
    }

    bindEvents() {
        document.getElementById('setDateBtn').addEventListener('click', () => {
            this.showDatePicker();
        });
    }

    async initializeCountdown() {
        const savedDate = await this.loadTargetDate();
        const savedTitle = await this.loadTargetTitle();

        if (savedDate) {
            this.startCountdown(savedDate);
            if (savedTitle) {
                document.getElementById('countdownTitle').textContent = savedTitle;
            }
        } else {
            const now = new Date();
            const year = now.getMonth() === 11 && now.getDate() > 15 ? now.getFullYear() + 1 : now.getFullYear();
            const defaultDate = new Date(`${year}-12-15T00:00:00`);
            this.startCountdown(defaultDate);
            document.getElementById('countdownTitle').textContent = 'Days until End of Semester';
        }
    }

    async loadTargetTitle() {
        try {
            const result = await chrome.storage.local.get([this.TARGET_TITLE_KEY]);
            return result[this.TARGET_TITLE_KEY] || null;
        } catch (error) {
            console.log('Failed to load target title:', error);
            return null;
        }
    }

    async saveTargetTitle(title) {
        try {
            await chrome.storage.local.set({ [this.TARGET_TITLE_KEY]: title });
        } catch (error) {
            console.log('Failed to save target title:', error);
        }
    }

    async loadTargetDate() {
        try {
            const result = await chrome.storage.local.get([this.TARGET_DATE_KEY]);
            console.log('Loaded date from storage (ISO):', result[this.TARGET_DATE_KEY]);
            const date = result[this.TARGET_DATE_KEY] ? new Date(result[this.TARGET_DATE_KEY]) : null;
            if (date) {
                console.log('Loaded date as Date object:', date.toString());
                console.log('Loaded date ISO:', date.toISOString());
            }
            return date;
        } catch (error) {
            console.log('Failed to load target date:', error);
            return null;
        }
    }

    async saveTargetDate(date) {
        try {
            await chrome.storage.local.set({ [this.TARGET_DATE_KEY]: date.toISOString() });
        } catch (error) {
            console.log('Failed to save target date:', error);
        }
    }

    startCountdown(targetDate) {
        if (this.countdownInterval) {
            clearInterval(this.countdownInterval);
        }

        const updateCountdown = () => {
            const now = new Date();
            const difference = targetDate - now;

            if (difference > 0) {
                const days = Math.floor(difference / (1000 * 60 * 60 * 24));
                const hours = Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
                const seconds = Math.floor((difference % (1000 * 60)) / 1000);

                document.getElementById('daysCount').textContent = days;
                document.getElementById('hoursCount').textContent = hours;
                document.getElementById('minutesCount').textContent = minutes;
                document.getElementById('secondsCount').textContent = seconds;
            } else {
                document.getElementById('daysCount').textContent = '0';
                document.getElementById('hoursCount').textContent = '0';
                document.getElementById('minutesCount').textContent = '0';
                document.getElementById('secondsCount').textContent = '0';
            }
        };

        updateCountdown();
        this.countdownInterval = setInterval(updateCountdown, 1000);
    }

    showDatePicker() {
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal-content">
                <h3>Set Target Date</h3>
                <input type="date" id="dateInput" class="date-input" min="${new Date().toISOString().split('T')[0]}">
                <input type="text" id="titleInput" class="date-input" placeholder="Event title (optional)" maxlength="30">
                <div class="modal-buttons">
                    <button class="modal-btn secondary" id="cancelBtn">Cancel</button>
                    <button class="modal-btn primary" id="saveBtn">Save</button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        Promise.all([this.loadTargetDate(), this.loadTargetTitle()]).then(([date, title]) => {
            if (date) {
                document.getElementById('dateInput').value = date.toISOString().split('T')[0];
            }
            if (title) {
                document.getElementById('titleInput').value = title;
            }
        });

        document.getElementById('cancelBtn').addEventListener('click', () => {
            document.body.removeChild(modal);
        });

        document.getElementById('saveBtn').addEventListener('click', async () => {
            const dateValue = document.getElementById('dateInput').value;
            const titleValue = document.getElementById('titleInput').value.trim();

            if (dateValue) {
                const targetDate = new Date(dateValue + 'T00:00:00');
                await this.saveTargetDate(targetDate);

                const title = titleValue || 'Days until Target Date';
                await this.saveTargetTitle(title);
                document.getElementById('countdownTitle').textContent = title;

                this.startCountdown(targetDate);
            }

            document.body.removeChild(modal);
        });

        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                document.body.removeChild(modal);
            }
        });
    }
}
