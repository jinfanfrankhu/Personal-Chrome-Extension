/**
 * Tasks Module - Handles Google Tasks integration
 */
export class TasksManager {
    constructor(calendarManager) {
        this.calendarManager = calendarManager;
        this.TASKS_CACHE_KEY = 'tasks_cache';
        this.CACHE_DURATION = 15 * 60 * 1000; // 15 minutes
    }

    async init() {
        document.addEventListener('calendarConnected', () => {
            this.loadTasksAutomatically();
        });
        await this.initializeTasks();
    }

    async initializeTasks() {
        const isConnected = await this.calendarManager.isCalendarConnected();
        if (isConnected) {
            await this.loadTasksAutomatically();
        }
    }

    async loadTasksAutomatically() {
        try {
            const cachedTasks = await this.loadCachedTasks();
            if (cachedTasks) {
                this.displayTasks(cachedTasks);

                const cacheAge = Date.now() - (await this.getTasksCacheTimestamp());
                if (cacheAge < 5 * 60 * 1000) {
                    return;
                }
            }

            const token = await this.calendarManager.getTokenSilently();
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

            const allTasks = [];

            if (listsData.items && listsData.items.length > 0) {
                const myTasksList = listsData.items.find(list =>
                    list.title === 'My Tasks' || list.title === 'Tasks'
                ) || listsData.items[0];

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

                    if (tasksData.items && tasksData.items.length > 0) {
                        tasksData.items.forEach(task => {
                            task.listId = myTasksList.id;
                            allTasks.push(task);
                        });
                    }
                }
            }

            console.log('Total tasks collected:', allTasks.length);

            allTasks.sort((a, b) => {
                if (a.due && !b.due) return -1;
                if (!a.due && b.due) return 1;
                if (a.due && b.due) return new Date(a.due) - new Date(b.due);
                return 0;
            });

            return allTasks.slice(0, 10);
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
            await new Promise((resolve) => {
                chrome.identity.clearAllCachedAuthTokens(() => {
                    resolve();
                });
            });

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
                const [nextEvents, tasks] = await Promise.all([
                    this.calendarManager.fetchNextCalendarEvent(token),
                    this.fetchTasksFromAPI(token)
                ]);

                if (nextEvents && nextEvents.length > 0) {
                    await this.calendarManager.cacheCalendarEvent(nextEvents);
                    this.calendarManager.displayNextEvents(nextEvents);
                }

                if (tasks && tasks.length > 0) {
                    await this.cacheTasks(tasks);
                    this.displayTasks(tasks);
                } else {
                    this.displayNoTasks();
                }

                await this.calendarManager.saveCalendarConnectionStatus(true);
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
            taskElement.classList.add('task-completing');

            let token = await this.calendarManager.getTokenSilently();

            if (!token) {
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

            taskElement.classList.add('task-completed');

            setTimeout(async () => {
                taskElement.remove();

                const tasks = await this.fetchTasksFromAPI(token);
                if (tasks && tasks.length > 0) {
                    await this.cacheTasks(tasks);
                    const tasksContainer = document.getElementById('tasksContainer');
                    if (tasksContainer.children.length === 0) {
                        this.displayTasks(tasks);
                    }
                } else {
                    this.displayNoTasks();
                }
            }, 500);

        } catch (error) {
            console.error('Failed to complete task:', error);
            taskElement.classList.remove('task-completing');

            const taskContent = taskElement.querySelector('.task-content');
            const originalHTML = taskContent.innerHTML;
            taskContent.innerHTML = '<div class="task-error">Failed to complete task. Please try again.</div>';

            setTimeout(() => {
                taskContent.innerHTML = originalHTML;
            }, 3000);
        }
    }
}
