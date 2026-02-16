/**
 * Calendar Module - Handles Google Calendar integration
 */
export class CalendarManager {
    constructor() {
        this.CALENDAR_CACHE_KEY = 'calendar_cache';
        this.CALENDAR_CONNECTED_KEY = 'calendar_connected';
        this.CACHE_DURATION = 15 * 60 * 1000; // 15 minutes
    }

    async init() {
        this.bindEvents();
        await this.initializeCalendar();
    }

    bindEvents() {
        // Connection button is dynamically created, so we don't bind here
    }

    async initializeCalendar() {
        const isConnected = await this.isCalendarConnected();
        if (isConnected) {
            await this.loadCalendarEventsAutomatically();
        }
    }

    async isCalendarConnected() {
        try {
            const result = await chrome.storage.local.get([this.CALENDAR_CONNECTED_KEY]);
            return result[this.CALENDAR_CONNECTED_KEY] || false;
        } catch (error) {
            console.log('Failed to check calendar connection status:', error);
            return false;
        }
    }

    async saveCalendarConnectionStatus(connected) {
        try {
            await chrome.storage.local.set({ [this.CALENDAR_CONNECTED_KEY]: connected });
        } catch (error) {
            console.log('Failed to save calendar connection status:', error);
        }
    }

    async loadCalendarEventsAutomatically() {
        try {
            const cachedEvents = await this.loadCachedCalendarEvent();
            if (cachedEvents) {
                this.displayNextEvents(cachedEvents);

                const cacheAge = Date.now() - (await this.getCacheTimestamp());
                if (cacheAge < 5 * 60 * 1000) {
                    return;
                }
            }

            const token = await this.getTokenSilently();
            if (token) {
                const nextEvents = await this.fetchNextCalendarEvent(token);
                if (nextEvents && nextEvents.length > 0) {
                    await this.cacheCalendarEvent(nextEvents);
                    this.displayNextEvents(nextEvents);
                } else if (!cachedEvents) {
                    this.displayNoEvents();
                }
            } else if (!cachedEvents) {
                this.displayCalendarConnectionNeeded();
            }
        } catch (error) {
            console.error('Auto calendar load failed:', error);
            const cachedEvents = await this.loadCachedCalendarEvent();
            if (cachedEvents) {
                this.displayNextEvents(cachedEvents);
            } else {
                this.displayCalendarConnectionNeeded();
            }
        }
    }

    async getTokenSilently() {
        return new Promise((resolve) => {
            chrome.identity.getAuthToken({
                interactive: false,
                scopes: [
                    'https://www.googleapis.com/auth/calendar.readonly',
                    'https://www.googleapis.com/auth/tasks'
                ]
            }, (token) => {
                if (chrome.runtime.lastError || !token) {
                    resolve(null);
                } else {
                    resolve(token);
                }
            });
        });
    }

    async getCacheTimestamp() {
        try {
            const result = await chrome.storage.local.get([this.CALENDAR_CACHE_KEY]);
            const cached = result[this.CALENDAR_CACHE_KEY];
            return cached?.timestamp || 0;
        } catch (error) {
            return 0;
        }
    }

    async connectGoogleCalendar() {
        try {
            const token = await new Promise((resolve, reject) => {
                chrome.identity.getAuthToken({
                    interactive: true,
                    scopes: [
                        'https://www.googleapis.com/auth/calendar.readonly',
                        'https://www.googleapis.com/auth/tasks'
                    ]
                }, (token) => {
                    if (chrome.runtime.lastError) {
                        reject(chrome.runtime.lastError);
                    } else {
                        resolve(token);
                    }
                });
            });

            if (token) {
                await this.saveCalendarConnectionStatus(true);

                const nextEvents = await this.fetchNextCalendarEvent(token);
                if (nextEvents && nextEvents.length > 0) {
                    await this.cacheCalendarEvent(nextEvents);
                    this.displayNextEvents(nextEvents);
                } else {
                    this.displayNoEvents();
                }
            }
        } catch (error) {
            console.error('Calendar connection failed:', error);
            this.displayCalendarError();
        }
    }

    async fetchNextCalendarEvent(token) {
        try {
            const now = new Date().toISOString();
            const response = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${now}&maxResults=2&singleEvents=true&orderBy=startTime`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!response.ok) {
                throw new Error(`Calendar API error: ${response.status}`);
            }

            const data = await response.json();
            return data.items && data.items.length > 0 ? data.items : null;
        } catch (error) {
            console.error('Failed to fetch calendar events:', error);
            return null;
        }
    }

    async loadCachedCalendarEvent() {
        try {
            const result = await chrome.storage.local.get([this.CALENDAR_CACHE_KEY]);
            const cached = result[this.CALENDAR_CACHE_KEY];

            if (cached && cached.timestamp && cached.event) {
                const now = Date.now();
                if (now - cached.timestamp < this.CACHE_DURATION) {
                    return cached.event;
                }
            }
        } catch (error) {
            console.log('Calendar cache loading failed:', error);
        }
        return null;
    }

    async cacheCalendarEvent(events) {
        try {
            const cacheData = {
                event: events,
                timestamp: Date.now()
            };
            await chrome.storage.local.set({ [this.CALENDAR_CACHE_KEY]: cacheData });
        } catch (error) {
            console.log('Calendar cache saving failed:', error);
        }
    }

    async reconnectCalendar() {
        try {
            await chrome.storage.local.remove([this.CALENDAR_CONNECTED_KEY, this.CALENDAR_CACHE_KEY]);

            chrome.identity.clearAllCachedAuthTokens(() => {
                this.connectGoogleCalendar();
            });
        } catch (error) {
            console.error('Reconnection failed:', error);
            this.connectGoogleCalendar();
        }
    }

    displayCalendarConnectionNeeded() {
        const nextEventDiv = document.getElementById('nextEvent');
        nextEventDiv.innerHTML = `
            <div class="event-placeholder">
                <button id="connectCalendarBtn" class="connect-btn">Connect Google Calendar</button>
            </div>
        `;

        document.getElementById('connectCalendarBtn').addEventListener('click', () => {
            this.connectGoogleCalendar();
        });
    }

    displayNextEvents(events) {
        const nextEventDiv = document.getElementById('nextEvent');

        if (!events || events.length === 0) {
            this.displayNoEvents();
            return;
        }

        const eventsArray = Array.isArray(events) ? events : [events];

        let eventsHTML = '';

        eventsArray.forEach((event, index) => {
            const startTime = event.start?.dateTime || event.start?.date;
            const eventDate = new Date(startTime);
            const now = new Date();

            let timeString = '';
            const timeDiff = eventDate.getTime() - now.getTime();
            const daysDiff = Math.floor(timeDiff / (1000 * 60 * 60 * 24));

            if (eventDate.toDateString() === now.toDateString()) {
                timeString = `Today at ${eventDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
            } else if (daysDiff === 1) {
                timeString = `Tomorrow at ${eventDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
            } else if (daysDiff < 7 && daysDiff > 0) {
                const dayName = eventDate.toLocaleDateString('en-US', { weekday: 'long' });
                timeString = `${dayName} at ${eventDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
            } else {
                timeString = eventDate.toLocaleDateString() + ' at ' + eventDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            }

            const eventTitle = event.summary || 'Untitled Event';
            const isFirst = index === 0;

            eventsHTML += `
                <div class="event-info ${isFirst ? 'primary-event' : 'secondary-event'}">
                    <div class="event-title">${eventTitle}</div>
                    <div class="event-time">${timeString}</div>
                    ${event.location ? `<div class="event-location">${event.location}</div>` : ''}
                </div>
            `;
        });

        nextEventDiv.innerHTML = eventsHTML;
    }

    displayNoEvents() {
        const nextEventDiv = document.getElementById('nextEvent');
        nextEventDiv.innerHTML = `
            <div class="event-placeholder">
                <span>No upcoming events</span>
            </div>
        `;
    }

    displayCalendarError() {
        const nextEventDiv = document.getElementById('nextEvent');
        nextEventDiv.innerHTML = `
            <div class="event-placeholder">
                <span>Failed to load calendar</span>
                <button id="retryCalendarBtn" class="connect-btn" style="margin-top: 10px;">Retry</button>
                <button id="reconnectCalendarBtn" class="connect-btn" style="margin-top: 5px; font-size: 0.8rem; padding: 4px 8px;">Reconnect</button>
            </div>
        `;

        document.getElementById('retryCalendarBtn').addEventListener('click', () => {
            this.loadCalendarEventsAutomatically();
        });

        document.getElementById('reconnectCalendarBtn').addEventListener('click', () => {
            this.reconnectCalendar();
        });
    }
}
