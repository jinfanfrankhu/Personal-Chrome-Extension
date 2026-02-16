class MITContentExtension {
    constructor() {
        this.FEED_SOURCES = {
            'MIT News': [
                'https://news.mit.edu/rss/feed',
                'https://news.mit.edu/rss.xml',
                'https://news.mit.edu/feed',
                'https://news.mit.edu/rss'
            ],
            'MIT Technology Review': [
                'https://www.technologyreview.com/rss/',
                'https://www.technologyreview.com/feed/',
                'https://feeds.technologyreview.com/technology_review'
            ],
            'MIT Admissions Blog': [
                'https://mitadmissions.org/blogs/feed/',
                'https://mitadmissions.org/blogs/rss.xml',
                'https://mitadmissions.org/feed/',
                'https://mitadmissions.org/rss'
            ]
        };
        this.CACHE_KEY = 'mit_content_cache';
        this.CACHE_DURATION = 15 * 60 * 1000; // 15 minutes
        this.TARGET_DATE_KEY = 'target_date';
        this.CALENDAR_CACHE_KEY = 'calendar_cache';
        this.CALENDAR_CONNECTED_KEY = 'calendar_connected';
        this.CALENDAR_TOKEN_KEY = 'calendar_token';
        this.TASKS_CACHE_KEY = 'tasks_cache';
        this.countdownInterval = null;
        this.TARGET_TITLE_KEY = 'target_title';
        this.init();
    }

    async init() {
        this.bindEvents();
        await this.loadNews();
        await this.initializeCountdown();
        await this.initializeCalendar();
        await this.initializeTasks();
    }

    bindEvents() {    
        document.getElementById('retryBtn').addEventListener('click', () => {
            this.loadNews(true);
        });

        document.getElementById('setDateBtn').addEventListener('click', () => {
            this.showDatePicker();
        });

        document.getElementById('connectCalendarBtn').addEventListener('click', () => {
            this.connectGoogleCalendar();
        });
    }

    async loadNews(forceRefresh = false) {
        this.showLoading();

        try {
            let newsData = null;
            
            // Try to load from cache first
            if (!forceRefresh) {
                newsData = await this.loadFromCache();
            }
            
            // If no cached data or force refresh, fetch from RSS
            if (!newsData) {
                newsData = await this.fetchFromRSS();
                if (newsData) {
                    await this.saveToCache(newsData);
                }
            }

            if (newsData && newsData.length > 0) {
                this.displayNews(newsData);
            } else {
                throw new Error('No news articles found');
            }
        } catch (error) {
            console.error('Error loading MIT Content:', error);
            this.showError(error.message);
        }
    }

    async fetchFromRSS() {
        const allArticles = [];
        const sourceResults = [];

        // Try to fetch from each source
        for (const [sourceName, urls] of Object.entries(this.FEED_SOURCES)) {
            console.log(`Fetching from ${sourceName}...`);
            let sourceArticles = [];
            
            // Try each URL for this source
            for (const url of urls) {
                try {
                    console.log(`Trying URL: ${url}`);
                    sourceArticles = await this.fetchRSSFromUrl(url);
                    if (sourceArticles && sourceArticles.length > 0) {
                        // Add source information to each article
                        sourceArticles = sourceArticles.map(article => ({
                            ...article,
                            source: sourceName
                        }));
                        break; // Success, move to next source
                    }
                } catch (error) {
                    console.log(`Failed to fetch from ${url}:`, error);
                    continue;
                }
            }
            
            if (sourceArticles.length > 0) {
                sourceResults.push({
                    source: sourceName,
                    articles: sourceArticles.slice(0, 8) // Limit per source
                });
                allArticles.push(...sourceArticles.slice(0, 8));
            }
        }
        
        // If we got articles from any source, return them
        if (allArticles.length > 0) {
            // Sort by date (newest first) and limit total articles
            allArticles.sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));
            return allArticles.slice(0, 20); // Total limit
        }
        
        // If all sources failed, try alternative approach
        return await this.fetchFallbackContent();
    }

    async fetchRSSFromUrl(url) {
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Accept': 'application/rss+xml, application/xml, text/xml'
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const xmlText = await response.text();
        return this.parseRSSXML(xmlText);
    }

    parseRSSXML(xmlText) {
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xmlText, 'text/xml');
        
        // Check for parsing errors
        const parserError = xmlDoc.querySelector('parsererror');
        if (parserError) {
            throw new Error('Invalid XML format');
        }

        const items = xmlDoc.querySelectorAll('item');
        const articles = [];

        items.forEach((item, index) => {
            if (index < 12) { // Limit to 12 articles
                const article = {
                    title: this.getTextContent(item, 'title'),
                    description: this.getTextContent(item, 'description'),
                    link: this.getTextContent(item, 'link'),
                    pubDate: this.getTextContent(item, 'pubDate'),
                    category: this.getTextContent(item, 'category')
                };
                
                if (article.title && article.link) {
                    articles.push(article);
                }
            }
        });

        return articles;
    }

    getTextContent(item, tagName) {
        const element = item.querySelector(tagName);
        return element ? element.textContent.trim() : '';
    }

    async fetchFallbackContent() {
        // Fallback: create mock data from different MIT sources
        return [
            {
                title: "MIT researchers develop breakthrough in quantum computing",
                description: "A new approach to quantum error correction could make quantum computers more practical for real-world applications.",
                link: "https://news.mit.edu/quantum-breakthrough",
                pubDate: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(), // 2 hours ago
                source: "MIT News",
                category: "Research"
            },
            {
                title: "The Future of AI: What's Next After Large Language Models",
                description: "Experts discuss the next frontier in artificial intelligence development and its implications for society.",
                link: "https://www.technologyreview.com/ai-future",
                pubDate: new Date(Date.now() - 1000 * 60 * 60 * 6).toISOString(), // 6 hours ago
                source: "MIT Technology Review",
                category: "Artificial Intelligence"
            },
            {
                title: "Student innovation in renewable energy wins competition",
                description: "MIT students develop novel solar panel technology that increases efficiency by 30%.",
                link: "https://news.mit.edu/student-renewable-energy",
                pubDate: new Date(Date.now() - 1000 * 60 * 60 * 12).toISOString(), // 12 hours ago
                source: "MIT News",
                category: "Energy"
            },
            {
                title: "Building Community Through Digital Platforms",
                description: "How MIT students connect and support each other through online communities and digital initiatives.",
                link: "https://mitadmissions.org/blogs/building-community",
                pubDate: new Date(Date.now() - 1000 * 60 * 60 * 18).toISOString(), // 18 hours ago
                source: "MIT Admissions Blog",
                category: "Student Life"
            },
            {
                title: "Climate Change Solutions from MIT Labs",
                description: "Recent breakthroughs in carbon capture and clean energy technologies show promising results.",
                link: "https://news.mit.edu/climate-solutions",
                pubDate: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(), // 1 day ago
                source: "MIT News",
                category: "Climate"
            },
            {
                title: "The Ethics of AI in Healthcare",
                description: "Researchers examine the moral implications of artificial intelligence in medical applications.",
                link: "https://www.technologyreview.com/ai-healthcare-ethics",
                pubDate: new Date(Date.now() - 1000 * 60 * 60 * 30).toISOString(), // 30 hours ago
                source: "MIT Technology Review",
                category: "Healthcare"
            }
        ];
    }

    async loadFromCache() {
        try {
            const result = await chrome.storage.local.get([this.CACHE_KEY]);
            const cached = result[this.CACHE_KEY];
            
            if (cached && cached.timestamp && cached.data) {
                const now = Date.now();
                if (now - cached.timestamp < this.CACHE_DURATION) {
                    console.log('Loading from cache');
                    return cached.data;
                }
            }
        } catch (error) {
            console.log('Cache loading failed:', error);
        }
        return null;
    }

    async saveToCache(data) {
        try {
            const cacheData = {
                data: data,
                timestamp: Date.now()
            };
            await chrome.storage.local.set({ [this.CACHE_KEY]: cacheData });
            console.log('Data cached successfully');
        } catch (error) {
            console.log('Cache saving failed:', error);
        }
    }

    displayNews(articles) {
        const container = document.getElementById('newsContainer');
        container.innerHTML = '';

        articles.forEach(article => {
            const articleElement = this.createArticleElement(article);
            container.appendChild(articleElement);
        });

        this.hideLoading();
        this.hideError();
        container.classList.remove('hidden');
    }

    createArticleElement(article) {
        const articleDiv = document.createElement('div');
        articleDiv.className = 'news-article';
        
        const title = this.truncateText(article.title, 100);
        const description = this.truncateText(this.stripHtml(article.description), 150);
        const date = this.formatDate(article.pubDate);
        const source = article.source || 'MIT';
        
        // Determine source color
        const sourceColors = {
            'MIT News': '#8B1538',
            'MIT Technology Review': '#0066CC', 
            'MIT Admissions Blog': '#FF6B35'
        };
        const sourceColor = sourceColors[source] || '#8B1538';
        
        articleDiv.innerHTML = `
            <div class="source-tag" style="background-color: ${sourceColor}">${source}</div>
            <h2 class="news-title">${title}</h2>
            <p class="news-description">${description}</p>
            <div class="news-meta">
                <span class="news-date">${date}</span>
                <a href="${article.link}" target="_blank" rel="noopener noreferrer" class="read-more">Read More</a>
            </div>
        `;

        articleDiv.addEventListener('click', (e) => {
            if (e.target.tagName !== 'A') {
                window.open(article.link, '_blank', 'noopener,noreferrer');
            }
        });

        return articleDiv;
    }

    stripHtml(html) {
        const div = document.createElement('div');
        div.innerHTML = html;
        return div.textContent || div.innerText || '';
    }

    truncateText(text, maxLength) {
        if (text.length <= maxLength) return text;
        return text.substr(0, maxLength).trim() + '...';
    }

    formatDate(dateString) {
        try {
            const date = new Date(dateString);
            const now = new Date();
            const diffTime = Math.abs(now - date);
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            
            if (diffDays === 1) {
                return 'Yesterday';
            } else if (diffDays < 7) {
                return `${diffDays} days ago`;
            } else {
                return date.toLocaleDateString();
            }
        } catch (error) {
            return 'Recently';
        }
    }

    showLoading() {
        document.getElementById('loading').classList.remove('hidden');
        document.getElementById('error').classList.add('hidden');
        document.getElementById('newsContainer').classList.add('hidden');
    }

    hideLoading() {
        document.getElementById('loading').classList.add('hidden');
    }

    showError(message) {
        document.getElementById('errorMessage').textContent = message;
        document.getElementById('error').classList.remove('hidden');
        document.getElementById('loading').classList.add('hidden');
        document.getElementById('newsContainer').classList.add('hidden');
    }

    hideError() {
        document.getElementById('error').classList.add('hidden');
    }

    // Countdown functionality
    async initializeCountdown() {
        const savedDate = await this.loadTargetDate();
        const savedTitle = await this.loadTargetTitle();
        
        if (savedDate) {
            this.startCountdown(savedDate);
            if (savedTitle) {
                document.getElementById('countdownTitle').textContent = savedTitle;
            }
        } else {
            // Set default to a common academic date (e.g., end of semester)
            const now = new Date();
            const year = now.getMonth() === 11 && now.getDate() > 15 ? now.getFullYear() + 1 : now.getFullYear();
            // Create date at midnight in local timezone for December 15th
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
        this.countdownInterval = setInterval(updateCountdown, 1000); // Update every second
    }

    showDatePicker() {
        // Create modal
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

        // Set current date and title if they exist
        Promise.all([this.loadTargetDate(), this.loadTargetTitle()]).then(([date, title]) => {
            if (date) {
                document.getElementById('dateInput').value = date.toISOString().split('T')[0];
            }
            if (title) {
                document.getElementById('titleInput').value = title;
            }
        });

        // Handle events
        document.getElementById('cancelBtn').addEventListener('click', () => {
            document.body.removeChild(modal);
        });

        document.getElementById('saveBtn').addEventListener('click', async () => {
            const dateValue = document.getElementById('dateInput').value;
            const titleValue = document.getElementById('titleInput').value.trim();

            if (dateValue) {
                // Create date at midnight in local timezone
                const targetDate = new Date(dateValue + 'T00:00:00');
                await this.saveTargetDate(targetDate);

                // Save and update countdown title
                const title = titleValue || 'Days until Target Date';
                await this.saveTargetTitle(title);
                document.getElementById('countdownTitle').textContent = title;

                this.startCountdown(targetDate);
            }

            document.body.removeChild(modal);
        });

        // Close on overlay click
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                document.body.removeChild(modal);
            }
        });
    }

    // Google Calendar functionality
    async initializeCalendar() {
        const isConnected = await this.isCalendarConnected();
        if (isConnected) {
            // Try to load events automatically
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

    // Add new method to save connection status
    async saveCalendarConnectionStatus(connected) {
        try {
            await chrome.storage.local.set({ [this.CALENDAR_CONNECTED_KEY]: connected });
        } catch (error) {
            console.log('Failed to save calendar connection status:', error);
        }
    }

    // Add new method to load events automatically
    async loadCalendarEventsAutomatically() {
        try {
            // First try cached events
            const cachedEvents = await this.loadCachedCalendarEvent();
            if (cachedEvents) {
                this.displayNextEvents(cachedEvents);
                
                // Check if cache is getting old (refresh if older than 5 minutes for better UX)
                const cacheAge = Date.now() - (await this.getCacheTimestamp());
                if (cacheAge < 5 * 60 * 1000) { // 5 minutes
                    return; // Use cache if it's fresh
                }
            }

            // Try to get a token silently (non-interactive)
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
                // If no token and no cache, show connect button
                this.displayCalendarConnectionNeeded();
            }
        } catch (error) {
            console.error('Auto calendar load failed:', error);
            // If auto-load fails, try to use cached events
            const cachedEvents = await this.loadCachedCalendarEvent();
            if (cachedEvents) {
                this.displayNextEvents(cachedEvents);
            } else {
                this.displayCalendarConnectionNeeded();
            }
        }
    }

    // Add method to get token silently
    async getTokenSilently() {
        return new Promise((resolve) => {
            chrome.identity.getAuthToken({
                interactive: false, // Don't prompt user
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

    // Add method to get cache timestamp
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
            // Request OAuth token (interactive)
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
                // Mark as connected
                await this.saveCalendarConnectionStatus(true);

                const nextEvents = await this.fetchNextCalendarEvent(token);
                if (nextEvents && nextEvents.length > 0) {
                    await this.cacheCalendarEvent(nextEvents);
                    this.displayNextEvents(nextEvents);
                } else {
                    this.displayNoEvents();
                }

                // Also load tasks
                await this.loadTasksAutomatically();
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
            // Clear stored connection status and cache
            await chrome.storage.local.remove([this.CALENDAR_CONNECTED_KEY, this.CALENDAR_CACHE_KEY]);
            
            // Remove any existing tokens
            chrome.identity.clearAllCachedAuthTokens(() => {
                // Reconnect
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

        // Handle both single event (legacy) and multiple events
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

    // Google Tasks functionality
    async initializeTasks() {
        const isConnected = await this.isCalendarConnected();
        if (isConnected) {
            await this.loadTasksAutomatically();
        }
    }

    async loadTasksAutomatically() {
        try {
            // First try cached tasks
            const cachedTasks = await this.loadCachedTasks();
            if (cachedTasks) {
                this.displayTasks(cachedTasks);

                // Check if cache is getting old
                const cacheAge = Date.now() - (await this.getTasksCacheTimestamp());
                if (cacheAge < 5 * 60 * 1000) { // 5 minutes
                    return; // Use cache if it's fresh
                }
            }

            // Try to get a token silently
            const token = await this.getTokenSilently();
            if (token) {
                const tasks = await this.fetchTasksFromAPI(token);
                if (tasks && tasks.length > 0) {
                    await this.cacheTasks(tasks);
                    this.displayTasks(tasks);
                } else if (!cachedTasks) {
                    this.displayNoTasks();
                }
            } else if (!cachedTasks) {
                this.displayTasksConnectionNeeded();
            }
        } catch (error) {
            console.error('Auto tasks load failed:', error);
            const cachedTasks = await this.loadCachedTasks();
            if (cachedTasks) {
                this.displayTasks(cachedTasks);
            } else {
                this.displayTasksConnectionNeeded();
            }
        }
    }

    async fetchTasksFromAPI(token) {
        try {
            console.log('=== FETCHING TASKS ===');
            // First, get all task lists
            const listsResponse = await fetch('https://www.googleapis.com/tasks/v1/users/@me/lists', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            console.log('Lists Response Status:', listsResponse.status);

            if (!listsResponse.ok) {
                throw new Error(`Tasks API error: ${listsResponse.status}`);
            }

            const listsData = await listsResponse.json();
            console.log('Task Lists Found:', listsData.items?.length || 0);
            console.log('Task Lists Data:', listsData);

            const allTasks = [];

            // Fetch tasks only from "My Tasks" list
            if (listsData.items && listsData.items.length > 0) {
                // Find "My Tasks" list (it's usually titled "My Tasks" but could vary)
                const myTasksList = listsData.items.find(list =>
                    list.title === 'My Tasks' || list.title === 'Tasks'
                ) || listsData.items[0]; // Fallback to first list if "My Tasks" not found

                console.log(`Fetching tasks from list: "${myTasksList.title}" (ID: ${myTasksList.id})`);

                const tasksResponse = await fetch(
                    `https://www.googleapis.com/tasks/v1/lists/${myTasksList.id}/tasks?showCompleted=false&maxResults=10`,
                    {
                        headers: {
                            'Authorization': `Bearer ${token}`
                        }
                    }
                );

                console.log(`Tasks Response Status for "${myTasksList.title}":`, tasksResponse.status);

                if (tasksResponse.ok) {
                    const tasksData = await tasksResponse.json();
                    console.log(`Tasks in "${myTasksList.title}":`, tasksData.items?.length || 0);
                    console.log(`Tasks Data for "${myTasksList.title}":`, tasksData);

                    if (tasksData.items && tasksData.items.length > 0) {
                        // Add list ID to each task for completion functionality
                        tasksData.items.forEach(task => {
                            task.listId = myTasksList.id;
                            allTasks.push(task);
                        });
                    }
                }
            }

            console.log('Total tasks collected:', allTasks.length);
            console.log('All tasks:', allTasks);

            // Sort by due date (tasks with due dates first, then by date)
            allTasks.sort((a, b) => {
                if (a.due && !b.due) return -1;
                if (!a.due && b.due) return 1;
                if (a.due && b.due) return new Date(a.due) - new Date(b.due);
                return 0;
            });

            return allTasks.slice(0, 10); // Limit to 10 tasks
        } catch (error) {
            console.error('Failed to fetch tasks:', error);
            return null;
        }
    }

    async loadCachedTasks() {
        try {
            const result = await chrome.storage.local.get([this.TASKS_CACHE_KEY]);
            const cached = result[this.TASKS_CACHE_KEY];

            if (cached && cached.timestamp && cached.tasks) {
                const now = Date.now();
                if (now - cached.timestamp < this.CACHE_DURATION) {
                    return cached.tasks;
                }
            }
        } catch (error) {
            console.log('Tasks cache loading failed:', error);
        }
        return null;
    }

    async cacheTasks(tasks) {
        try {
            const cacheData = {
                tasks: tasks,
                timestamp: Date.now()
            };
            await chrome.storage.local.set({ [this.TASKS_CACHE_KEY]: cacheData });
        } catch (error) {
            console.log('Tasks cache saving failed:', error);
        }
    }

    async getTasksCacheTimestamp() {
        try {
            const result = await chrome.storage.local.get([this.TASKS_CACHE_KEY]);
            const cached = result[this.TASKS_CACHE_KEY];
            return cached?.timestamp || 0;
        } catch (error) {
            return 0;
        }
    }

    displayTasks(tasks) {
        const tasksContainer = document.getElementById('tasksContainer');

        if (!tasks || tasks.length === 0) {
            this.displayNoTasks();
            return;
        }

        let tasksHTML = '';

        tasks.forEach(task => {
            const taskTitle = task.title || 'Untitled Task';
            let dueDate = '';

            if (task.due) {
                const due = new Date(task.due);
                const now = new Date();
                const timeDiff = due.getTime() - now.getTime();
                const daysDiff = Math.floor(timeDiff / (1000 * 60 * 60 * 24));

                if (daysDiff < 0) {
                    dueDate = '<span class="task-overdue">Overdue</span>';
                } else if (daysDiff === 0) {
                    dueDate = '<span class="task-due-today">Due today</span>';
                } else if (daysDiff === 1) {
                    dueDate = '<span class="task-due-soon">Due tomorrow</span>';
                } else if (daysDiff < 7) {
                    dueDate = `<span class="task-due-soon">Due in ${daysDiff} days</span>`;
                } else {
                    dueDate = `Due ${due.toLocaleDateString()}`;
                }
            }

            tasksHTML += `
                <div class="task-item" data-task-id="${task.id}" data-list-id="${task.listId}">
                    <div class="task-checkbox"></div>
                    <div class="task-content">
                        <div class="task-title">${taskTitle}</div>
                        <div class="task-meta">
                            ${dueDate ? `<span class="task-due">${dueDate}</span>` : ''}
                        </div>
                    </div>
                </div>
            `;
        });

        tasksContainer.innerHTML = tasksHTML;

        // Add click handlers to checkboxes
        const checkboxes = tasksContainer.querySelectorAll('.task-checkbox');
        checkboxes.forEach(checkbox => {
            checkbox.addEventListener('click', async (e) => {
                const taskItem = e.target.closest('.task-item');
                const taskId = taskItem.dataset.taskId;
                const listId = taskItem.dataset.listId;

                if (taskId && listId) {
                    await this.completeTask(listId, taskId, taskItem);
                }
            });
        });
    }

    displayNoTasks() {
        const tasksContainer = document.getElementById('tasksContainer');
        tasksContainer.innerHTML = `
            <div class="tasks-placeholder">
                <span>No tasks found</span>
            </div>
        `;
    }

    displayTasksConnectionNeeded() {
        const tasksContainer = document.getElementById('tasksContainer');
        tasksContainer.innerHTML = `
            <div class="tasks-placeholder">
                <button id="connectTasksBtn" class="connect-btn">Connect Google Tasks</button>
            </div>
        `;

        document.getElementById('connectTasksBtn').addEventListener('click', () => {
            this.connectGoogleTasks();
        });
    }

    async connectGoogleTasks() {
        try {
            // Clear existing tokens to force re-authentication with new scopes
            await new Promise((resolve) => {
                chrome.identity.clearAllCachedAuthTokens(() => {
                    resolve();
                });
            });

            // Request OAuth token with both calendar and tasks scopes
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
                // Load both calendar events and tasks
                const [nextEvents, tasks] = await Promise.all([
                    this.fetchNextCalendarEvent(token),
                    this.fetchTasksFromAPI(token)
                ]);

                // Update calendar
                if (nextEvents && nextEvents.length > 0) {
                    await this.cacheCalendarEvent(nextEvents);
                    this.displayNextEvents(nextEvents);
                }

                // Update tasks
                if (tasks && tasks.length > 0) {
                    await this.cacheTasks(tasks);
                    this.displayTasks(tasks);
                } else {
                    this.displayNoTasks();
                }

                await this.saveCalendarConnectionStatus(true);
            }
        } catch (error) {
            console.error('Tasks connection failed:', error);
            const tasksContainer = document.getElementById('tasksContainer');
            tasksContainer.innerHTML = `
                <div class="tasks-placeholder">
                    <span style="color: #d32f2f;">Failed to connect tasks</span>
                    <button id="retryTasksBtn" class="connect-btn" style="margin-top: 10px;">Retry</button>
                </div>
            `;

            document.getElementById('retryTasksBtn').addEventListener('click', () => {
                this.connectGoogleTasks();
            });
        }
    }

    async completeTask(listId, taskId, taskElement) {
        try {
            // Add completing animation
            taskElement.classList.add('task-completing');

            // Try to get token (first silently, then interactively if needed)
            let token = await this.getTokenSilently();

            if (!token) {
                // If silent auth fails, try interactive auth
                token = await new Promise((resolve, reject) => {
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
            }

            if (!token) {
                throw new Error('Authentication required');
            }

            // Mark task as completed via API
            const response = await fetch(
                `https://www.googleapis.com/tasks/v1/lists/${listId}/tasks/${taskId}`,
                {
                    method: 'PATCH',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        status: 'completed'
                    })
                }
            );

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                console.error('API Error:', errorData);
                throw new Error(`Failed to complete task: ${response.status}`);
            }

            console.log('Task marked as completed successfully');

            // Add completed animation
            taskElement.classList.add('task-completed');

            // Wait for animation to complete
            setTimeout(async () => {
                // Remove task from display
                taskElement.remove();

                // Refresh tasks from API
                const tasks = await this.fetchTasksFromAPI(token);
                if (tasks && tasks.length > 0) {
                    await this.cacheTasks(tasks);
                    // Only update if there are still tasks visible
                    const tasksContainer = document.getElementById('tasksContainer');
                    if (tasksContainer.children.length === 0) {
                        this.displayTasks(tasks);
                    }
                } else {
                    this.displayNoTasks();
                }
            }, 500); // Match animation duration

        } catch (error) {
            console.error('Failed to complete task:', error);
            // Remove completing animation on error
            taskElement.classList.remove('task-completing');

            // Show error feedback
            const taskContent = taskElement.querySelector('.task-content');
            const originalHTML = taskContent.innerHTML;
            taskContent.innerHTML = '<div class="task-error">Failed to complete task. Please try again.</div>';

            setTimeout(() => {
                taskContent.innerHTML = originalHTML;
            }, 3000);
        }
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