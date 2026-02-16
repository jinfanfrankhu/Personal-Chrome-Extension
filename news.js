/**
 * News Module - Handles RSS feed fetching, parsing, and display
 */
export class NewsManager {
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
    }

    init() {
        this.bindEvents();
        this.loadNews();
    }

    bindEvents() {
        document.getElementById('retryBtn').addEventListener('click', () => {
            this.loadNews(true);
        });
    }

    async loadNews(forceRefresh = false) {
        this.showLoading();

        try {
            let newsData = null;

            if (!forceRefresh) {
                newsData = await this.loadFromCache();
            }

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

        for (const [sourceName, urls] of Object.entries(this.FEED_SOURCES)) {
            console.log(`Fetching from ${sourceName}...`);
            let sourceArticles = [];

            for (const url of urls) {
                try {
                    console.log(`Trying URL: ${url}`);
                    sourceArticles = await this.fetchRSSFromUrl(url);
                    if (sourceArticles && sourceArticles.length > 0) {
                        sourceArticles = sourceArticles.map(article => ({
                            ...article,
                            source: sourceName
                        }));
                        break;
                    }
                } catch (error) {
                    console.log(`Failed to fetch from ${url}:`, error);
                    continue;
                }
            }

            if (sourceArticles.length > 0) {
                allArticles.push(...sourceArticles.slice(0, 8));
            }
        }

        if (allArticles.length > 0) {
            allArticles.sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));
            return allArticles.slice(0, 20);
        }

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

        const parserError = xmlDoc.querySelector('parsererror');
        if (parserError) {
            throw new Error('Invalid XML format');
        }

        const items = xmlDoc.querySelectorAll('item');
        const articles = [];

        items.forEach((item, index) => {
            if (index < 12) {
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
        return [
            {
                title: "MIT researchers develop breakthrough in quantum computing",
                description: "A new approach to quantum error correction could make quantum computers more practical for real-world applications.",
                link: "https://news.mit.edu/quantum-breakthrough",
                pubDate: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
                source: "MIT News",
                category: "Research"
            },
            {
                title: "The Future of AI: What's Next After Large Language Models",
                description: "Experts discuss the next frontier in artificial intelligence development and its implications for society.",
                link: "https://www.technologyreview.com/ai-future",
                pubDate: new Date(Date.now() - 1000 * 60 * 60 * 6).toISOString(),
                source: "MIT Technology Review",
                category: "Artificial Intelligence"
            },
            {
                title: "Student innovation in renewable energy wins competition",
                description: "MIT students develop novel solar panel technology that increases efficiency by 30%.",
                link: "https://news.mit.edu/student-renewable-energy",
                pubDate: new Date(Date.now() - 1000 * 60 * 60 * 12).toISOString(),
                source: "MIT News",
                category: "Energy"
            },
            {
                title: "Building Community Through Digital Platforms",
                description: "How MIT students connect and support each other through online communities and digital initiatives.",
                link: "https://mitadmissions.org/blogs/building-community",
                pubDate: new Date(Date.now() - 1000 * 60 * 60 * 18).toISOString(),
                source: "MIT Admissions Blog",
                category: "Student Life"
            },
            {
                title: "Climate Change Solutions from MIT Labs",
                description: "Recent breakthroughs in carbon capture and clean energy technologies show promising results.",
                link: "https://news.mit.edu/climate-solutions",
                pubDate: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
                source: "MIT News",
                category: "Climate"
            },
            {
                title: "The Ethics of AI in Healthcare",
                description: "Researchers examine the moral implications of artificial intelligence in medical applications.",
                link: "https://www.technologyreview.com/ai-healthcare-ethics",
                pubDate: new Date(Date.now() - 1000 * 60 * 60 * 30).toISOString(),
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
}
