/**
 * News Module - Handles RSS feed fetching, parsing, and display
 */
export class NewsManager {
    constructor() {
        this.FEED_SOURCES = {
            'VentureBeat AI': [
                'https://venturebeat.com/category/ai/feed/'
            ],
            'Hugging Face': [
                'https://huggingface.co/blog/feed.xml'
            ],
            'AI Alignment Forum': [
                'https://www.alignmentforum.org/feed.xml'
            ],
            'OpenAI': [
                'https://openai.com/news/rss.xml',
                'https://openai.com/feed.xml'
            ],
            'Google DeepMind': [
                'https://deepmind.google/blog/rss.xml',
                'https://www.deepmind.com/blog/rss.xml'
            ],
            'Ars Technica AI': [
                'https://arstechnica.com/ai/feed',
                'https://feeds.arstechnica.com/arstechnica/index'
            ],
            'The Gradient': [
                'https://thegradient.pub/rss/'
            ],
            'Quantocracy': [
                'https://quantocracy.com/author/quantadmin/feed/'
            ]
        };
        this.CACHE_KEY = 'tech_content_cache';
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
            console.error('Error loading Tech Content:', error);
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
                title: "AI Funding Hits New Records as Startups Race to Build Foundation Models",
                description: "Venture capital investment in AI surges as startups compete to build the next generation of foundation models.",
                link: "https://venturebeat.com/category/ai/",
                pubDate: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
                source: "VentureBeat AI",
                category: "Industry"
            },
            {
                title: "Introducing Smol Models: Efficient Open-Source LLMs for Edge Devices",
                description: "Hugging Face researchers release a new family of compact language models optimized for on-device inference.",
                link: "https://huggingface.co/blog",
                pubDate: new Date(Date.now() - 1000 * 60 * 60 * 4).toISOString(),
                source: "Hugging Face",
                category: "Open Source"
            },
            {
                title: "Mechanistic Interpretability: Understanding Circuits in Transformers",
                description: "Researchers identify sparse, interpretable circuits responsible for in-context learning in large language models.",
                link: "https://www.alignmentforum.org",
                pubDate: new Date(Date.now() - 1000 * 60 * 60 * 8).toISOString(),
                source: "AI Alignment Forum",
                category: "AI Safety"
            },
            {
                title: "Advances in Large Language Model Reasoning",
                description: "OpenAI researchers explore new techniques for improving step-by-step reasoning capabilities in frontier models.",
                link: "https://openai.com/news",
                pubDate: new Date(Date.now() - 1000 * 60 * 60 * 6).toISOString(),
                source: "OpenAI",
                category: "Artificial Intelligence"
            },
            {
                title: "Gemini and the Future of Multimodal AI",
                description: "Google DeepMind's latest research into multimodal understanding and reasoning across text, image, and audio.",
                link: "https://deepmind.google/blog",
                pubDate: new Date(Date.now() - 1000 * 60 * 60 * 12).toISOString(),
                source: "Google DeepMind",
                category: "Research"
            },
            {
                title: "How AI Chips Are Reshaping the Hardware Landscape",
                description: "A deep dive into the specialized silicon powering the AI revolution, from Nvidia GPUs to custom TPUs.",
                link: "https://arstechnica.com/ai",
                pubDate: new Date(Date.now() - 1000 * 60 * 60 * 18).toISOString(),
                source: "Ars Technica AI",
                category: "Hardware"
            },
            {
                title: "Interpretability Research: Understanding What Models Learn",
                description: "New mechanistic interpretability techniques help researchers understand the internal representations of neural networks.",
                link: "https://thegradient.pub",
                pubDate: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
                source: "The Gradient",
                category: "Research"
            },
            {
                title: "Reinforcement Learning from Human Feedback: A Retrospective",
                description: "Examining the evolution of RLHF and its role in shaping modern AI assistants and chat models.",
                link: "https://thegradient.pub",
                pubDate: new Date(Date.now() - 1000 * 60 * 60 * 30).toISOString(),
                source: "The Gradient",
                category: "Machine Learning"
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
        const source = article.source || 'Tech News';

        const sourceColors = {
            'VentureBeat AI': '#e63946',
            'Hugging Face': '#ff9d00',
            'AI Alignment Forum': '#5c6bc0',
            'OpenAI': '#10a37f',
            'Google DeepMind': '#4285F4',
            'Ars Technica AI': '#ff6600',
            'The Gradient': '#6b4fbb'
        };
        const sourceColor = sourceColors[source] || '#1a1a1a';

        articleDiv.innerHTML = `
            <div class="source-tag" style="background-color: ${sourceColor}">${source}</div>
            <h2 class="news-title">${title}</h2>
            <p class="news-description">${description}</p>
            <div class="news-meta">
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
