// 小小时间管理师 - 主应用逻辑 (多用户版本)

// ============ 数据存储结构 ============
// 存储所有用户信息
// 格式: { users: { [userId]: { id, name, createdAt, settings, taskTypes, totalStars }, ... }, currentUserId, version }
// 每个用户的数据: kiddoData_[userId] -> { tasks: [], history: [] }

let allUsers = JSON.parse(localStorage.getItem('kiddoAllUsers')) || { users: {}, currentUserId: null, version: 1 };
let currentUserId = allUsers.currentUserId;
let tasks = [];
let history = []; // 已完成任务的历史记录
let taskTypes = getDefaultTaskTypes();
let totalStars = 0;
let settings = getDefaultSettings();

// 当前选中的任务
let selectedTaskId = null;

// 待开始的任务ID（用于开始确认）
let pendingStartTaskId = null;

// 超时提醒相关
let overdueReminderInterval = null;
let lastOverdueCheck = null;

// 超时任务的动画表情（搞怪有趣）
const overdueEmojis = [
    '⏰', '🚨', '💨', '🏃', '⚡', '🔥', '😱', '👀', 
    '🦁', '🐻', '🐰', '🐶', '🎯', '💪', '🚀', '🎈',
    '🕐', '⏳', '💥', '🌟', '🎪', '🎭', '🦄', '🐼'
];

// 搞怪有趣的提醒语（轮换显示）
const funnyReminders = [
    "⏰ 时间飞逝~ 任务在疯狂呼喊你！",
    "🚀 主人主人！再不动身就要起飞啦！",
    "😱 任务说：主人主人，快来宠幸我吧！",
    "💪 相信自己，你可以的！冲鸭！",
    "🦁 小狮子说：今天的任务，今天完成！",
    "🎯 瞄准目标，一击必中！开始吧！",
    "🌟 星星都在看着你呢，快发光吧！",
    "🐰 小兔子都在等你的任务呢，快跑起来！",
    "⚡ 闪电侠警告：再不动就要超时啦！",
    "🔥 任务在燃烧！你也要燃烧起来！",
    "🎈 气球越飘越高，任务越拖越难！",
    "🦄 独角兽说：开始就是成功的一半！",
    "👀 你的任务正在被全世界注视！",
    "💨 时间像风一样溜走，快抓住它！",
    "🐼 熊猫都学会时间管理了，你也可以！",
    "🎭 表演时间到！展示你的实力吧！",
    "🏃 冲刺时刻！不要在起跑线上停留！",
    "🎪 马戏团表演开始了，你是主角！",
    "😤 任务等得不耐烦啦！快快快！",
    "🌈 彩虹在等你，完成任务就有彩虹！"
];

// 临时选择状态
let selectedEmoji = '📚';
let selectedColor = '#5B8DEF';
let selectedMascot = '🐻';

// 提醒检查间隔
let reminderInterval;

// 音效
const audioContext = new (window.AudioContext || window.webkitAudioContext)();

function playSound(type) {
    try {
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        switch(type) {
            case 'complete':
                oscillator.frequency.setValueAtTime(523.25, audioContext.currentTime);
                oscillator.frequency.setValueAtTime(659.25, audioContext.currentTime + 0.1);
                oscillator.frequency.setValueAtTime(783.99, audioContext.currentTime + 0.2);
                gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
                gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
                oscillator.start(audioContext.currentTime);
                oscillator.stop(audioContext.currentTime + 0.5);
                break;
            case 'add':
                oscillator.frequency.setValueAtTime(440, audioContext.currentTime);
                oscillator.frequency.setValueAtTime(554.37, audioContext.currentTime + 0.1);
                gainNode.gain.setValueAtTime(0.2, audioContext.currentTime);
                gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
                oscillator.start(audioContext.currentTime);
                oscillator.stop(audioContext.currentTime + 0.3);
                break;
            case 'reminder':
                oscillator.frequency.setValueAtTime(880, audioContext.currentTime);
                gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
                gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);
                oscillator.start(audioContext.currentTime);
                oscillator.stop(audioContext.currentTime + 0.2);
                break;
            case 'overdue':
                oscillator.frequency.setValueAtTime(600, audioContext.currentTime);
                oscillator.frequency.setValueAtTime(800, audioContext.currentTime + 0.1);
                oscillator.frequency.setValueAtTime(600, audioContext.currentTime + 0.2);
                oscillator.frequency.setValueAtTime(800, audioContext.currentTime + 0.3);
                gainNode.gain.setValueAtTime(0.4, audioContext.currentTime);
                gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
                oscillator.start(audioContext.currentTime);
                oscillator.stop(audioContext.currentTime + 0.5);
                break;
            case 'delete':
                oscillator.frequency.setValueAtTime(300, audioContext.currentTime);
                oscillator.frequency.exponentialRampToValueAtTime(100, audioContext.currentTime + 0.2);
                gainNode.gain.setValueAtTime(0.2, audioContext.currentTime);
                gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);
                oscillator.start(audioContext.currentTime);
                oscillator.stop(audioContext.currentTime + 0.2);
                break;
        }
    } catch (e) {
        console.log('Sound not available');
    }
}

// 获取默认设置
function getDefaultSettings() {
    return {
        childName: '',
        encouragementMessage: '你是最棒的时间管理小能手！每完成一个任务，你就离成功更近一步。记住，坚持就是胜利，爸爸妈妈为你骄傲！⭐',
        mascot: '🐻'
    };
}

// 获取默认任务类型
function getDefaultTaskTypes() {
    return [
        { id: 'study', name: '学习', emoji: '📚', color: '#6C9EFF' },
        { id: 'homework', name: '作业', emoji: '✏️', color: '#00D9FF' },
        { id: 'art', name: '艺术', emoji: '🎨', color: '#B388FF' },
        { id: 'sport', name: '运动', emoji: '⚽', color: '#69F0AE' },
        { id: 'reading', name: '阅读', emoji: '📖', color: '#FFD54F' },
        { id: 'chore', name: '家务', emoji: '🧹', color: '#4DD0E1' }
    ];
}

// 获取随机超时表情
function getRandomOverdueEmoji() {
    return overdueEmojis[Math.floor(Math.random() * overdueEmojis.length)];
}

// 获取随机提醒语
function getRandomReminderText() {
    return funnyReminders[Math.floor(Math.random() * funnyReminders.length)];
}

// ============ 用户管理函数 ============

// 创建新用户
function createUser(name) {
    const userId = 'user_' + Date.now();
    const user = {
        id: userId,
        name: name,
        createdAt: new Date().toISOString()
    };
    allUsers.users[userId] = user;
    
    // 初始化该用户的数据
    saveUserData(userId, {
        tasks: [],
        history: [],
        taskTypes: getDefaultTaskTypes(),
        totalStars: 0,
        settings: { ...getDefaultSettings(), childName: name }
    });
    
    saveAllUsers();
    return user;
}

// 获取所有用户列表
function getAllUsers() {
    return Object.values(allUsers.users);
}

// 删除用户
function deleteUser(userId) {
    if (allUsers.users[userId]) {
        delete allUsers.users[userId];
        // 删除用户数据
        localStorage.removeItem('kiddoData_' + userId);
        saveAllUsers();
        return true;
    }
    return false;
}

// 保存所有用户信息
function saveAllUsers() {
    localStorage.setItem('kiddoAllUsers', JSON.stringify(allUsers));
}

// 获取当前用户数据
function getCurrentUser() {
    if (currentUserId && allUsers.users[currentUserId]) {
        return allUsers.users[currentUserId];
    }
    return null;
}

// 加载用户数据
function loadUserData(userId) {
    const savedData = localStorage.getItem('kiddoData_' + userId);
    const data = savedData ? JSON.parse(savedData) : {
        tasks: [],
        history: [],
        taskTypes: getDefaultTaskTypes(),
        totalStars: 0,
        settings: getDefaultSettings()
    };
    
    tasks = data.tasks || [];
    history = data.history || [];
    taskTypes = data.taskTypes || getDefaultTaskTypes();
    totalStars = data.totalStars || 0;
    
    // 确保 settings.childName 与用户名同步
    const user = allUsers.users[userId];
    const defaultSettings = getDefaultSettings();
    const userSettings = data.settings || {};
    
    // 优先使用用户设置中的 childName，否则使用用户名
    let childName = userSettings.childName;
    if (!childName || childName.trim() === '') {
        childName = user?.name || defaultSettings.childName;
    }
    
    settings = { 
        ...defaultSettings, 
        ...userSettings,
        childName: childName
    };
}

// 保存用户数据
function saveUserData(userId, data) {
    localStorage.setItem('kiddoData_' + userId, JSON.stringify(data));
}

// 保存当前用户的所有数据
function saveCurrentUserData() {
    if (!currentUserId) return;
    
    saveUserData(currentUserId, {
        tasks: tasks,
        history: history,
        taskTypes: taskTypes,
        totalStars: totalStars,
        settings: settings
    });
}

// 切换用户
function switchUser(userId) {
    // 先保存当前用户数据
    if (currentUserId) {
        saveCurrentUserData();
    }
    
    // 切换到新用户
    currentUserId = userId;
    allUsers.currentUserId = userId;
    saveAllUsers();
    
    // 加载新用户数据
    if (userId) {
        loadUserData(userId);
    } else {
        tasks = [];
        history = [];
        taskTypes = getDefaultTaskTypes();
        totalStars = 0;
        settings = getDefaultSettings();
    }
    
    // 重置选择状态
    selectedTaskId = null;
    pendingStartTaskId = null;
}

// ============ 初始化 ============
function init() {
    if (getAllUsers().length === 0) {
        // 没有任何用户，显示创建用户页面
        showUserManagementPage();
    } else if (currentUserId && allUsers.users[currentUserId]) {
        // 有当前用户，加载并显示主应用
        loadUserData(currentUserId);
        showMainApp();
    } else {
        // 没有登录，显示用户选择页面
        showUserSelectionPage();
    }
}

// 显示用户管理页面（首次使用）
function showUserManagementPage() {
    document.getElementById('userManagementPage').style.display = 'flex';
    document.getElementById('appContainer').style.display = 'none';
    renderUserList();
}

// 显示用户选择页面
function showUserSelectionPage() {
    document.getElementById('userSelectionPage').style.display = 'flex';
    document.getElementById('appContainer').style.display = 'none';
    renderUserSelectionList();
}

// 显示主应用
function showMainApp() {
    document.getElementById('userManagementPage').style.display = 'none';
    document.getElementById('userSelectionPage').style.display = 'none';
    document.getElementById('appContainer').style.display = 'block';
    
    updateCurrentTime();
    // 防止重复设置定时器
    if (!window._timeInterval) {
        window._timeInterval = setInterval(updateCurrentTime, 1000);
    }
    renderEncouragement();
    renderTaskTypes();
    renderTasks();
    updateStats();
    updateProgress();
    setupEventListeners();
    startReminderCheck();
    startOverdueReminderCheck();
    checkInstallPrompt();
    updateMascot();
    
    // 如果有未完成任务，检查是否超时
    checkOverdueTasks();
}

// 更新当前时间显示
function updateCurrentTime() {
    const now = new Date();
    const timeString = now.toLocaleTimeString('zh-CN', { 
        hour: '2-digit', 
        minute: '2-digit',
        second: '2-digit'
    });
    const dateString = now.toLocaleDateString('zh-CN', { 
        month: 'long', 
        day: 'numeric',
        weekday: 'long'
    });
    document.getElementById('currentTime').innerHTML = `${dateString}<br>${timeString}`;
}

// 渲染用户列表（管理页面）
function renderUserList() {
    const container = document.getElementById('userManagementList');
    const users = getAllUsers();
    
    if (users.length === 0) {
        container.innerHTML = '<p class="no-users">还没有用户，点击上方按钮添加第一个用户吧！</p>';
        return;
    }
    
    container.innerHTML = users.map(user => `
        <div class="user-card">
            <div class="user-info">
                <div class="user-avatar">${getUserAvatar(user.name)}</div>
                <div class="user-details">
                    <div class="user-name">${user.name}</div>
                    <div class="user-date">创建于 ${formatDate(user.createdAt)}</div>
                </div>
            </div>
            <div class="user-actions">
                <button class="btn-user-select" onclick="selectUser('${user.id}')">进入</button>
                <button class="btn-user-delete" onclick="removeUser('${user.id}')">删除</button>
            </div>
        </div>
    `).join('');
}

// 渲染用户选择列表
function renderUserSelectionList() {
    const container = document.getElementById('userSelectionList');
    const users = getAllUsers();
    
    container.innerHTML = users.map(user => `
        <div class="user-card clickable" onclick="selectUser('${user.id}')">
            <div class="user-avatar large">${getUserAvatar(user.name)}</div>
            <div class="user-name">${user.name}</div>
        </div>
    `).join('');
    
    // 添加"添加新用户"按钮
    container.innerHTML += `
        <div class="user-card add-new" onclick="showAddUserForm()">
            <div class="user-avatar large">➕</div>
            <div class="user-name">添加新用户</div>
        </div>
    `;
}

// 获取用户头像（基于名字生成）
function getUserAvatar(name) {
    const emojis = ['👦', '👧', '🧒', '👶', '🦄', '🐱', '🐶', '🐰', '🐼', '🦊', '🦁', '🐯'];
    const index = name.length % emojis.length;
    return emojis[index];
}

// 格式化日期
function formatDate(dateStr) {
    const date = new Date(dateStr);
    return date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
}

// 格式化任务日期显示
function formatTaskDate(dateStr) {
    if (!dateStr) return '';
    const today = getLocalDateString(new Date());
    const tomorrow = getLocalDateString(new Date(Date.now() + 86400000));
    const yesterday = getLocalDateString(new Date(Date.now() - 86400000));
    
    if (dateStr === today) return '今天';
    if (dateStr === tomorrow) return '明天';
    if (dateStr === yesterday) return '昨天';
    
    const date = new Date(dateStr);
    return date.toLocaleDateString('zh-CN', { month: 'long', day: 'numeric' });
}

// 选择用户
function selectUser(userId) {
    // 保存当前用户数据
    if (currentUserId) {
        saveCurrentUserData();
    }
    
    // 设置新用户为当前用户
    currentUserId = userId;
    allUsers.currentUserId = userId;
    saveAllUsers();
    
    // 强制重载页面，确保所有数据刷新
    window.location.reload();
}

// 显示添加用户表单
function showAddUserForm() {
    const name = prompt('请输入新用户的名字：');
    if (name && name.trim()) {
        const user = createUser(name.trim());
        selectUser(user.id);
    }
}

// 删除用户
function removeUser(userId) {
    const user = allUsers.users[userId];
    if (!user) return;
    
    if (confirm(`确定要删除用户"${user.name}"吗？\n这将删除该用户的所有任务和历史记录！`)) {
        // 如果删除的是当前用户，切换到其他用户或显示管理页面
        if (currentUserId === userId) {
            const remainingUsers = getAllUsers().filter(u => u.id !== userId);
            if (remainingUsers.length > 0) {
                selectUser(remainingUsers[0].id);
            } else {
                deleteUser(userId);
                currentUserId = null;
                showUserManagementPage();
            }
        } else {
            deleteUser(userId);
            renderUserList();
        }
        playSound('delete');
    }
}

// 返回用户管理页面
function goToUserManagement() {
    // 关闭所有弹窗
    closeSettingsModal();
    closeAddTaskModal();
    closeAddTypeModal();
    closeHistoryModal();
    closeStartTaskModal();
    
    showUserManagementPage();
}

// ============ 渲染函数 ============

// 渲染激励寄语
function renderEncouragement() {
    document.getElementById('encouragementTitle').textContent = `致亲爱的${settings.childName}`;
    document.getElementById('encouragementText').textContent = settings.encouragementMessage;
}

// 更新吉祥物
function updateMascot() {
    document.querySelector('.mascot').textContent = settings.mascot;
}

// 渲染任务类型
function renderTaskTypes() {
    const container = document.getElementById('taskTypesList');
    container.innerHTML = taskTypes.map(type => `
        <div class="task-type-tag" style="background: ${type.color}20; color: ${type.color}; border: 2px solid ${type.color}40;">
            <span>${type.emoji}</span>
            <span>${type.name}</span>
            <div class="type-actions">
                <button class="type-action-btn edit" onclick="editTaskType('${type.id}', event)" title="编辑">✏️</button>
                <button class="type-action-btn delete" onclick="deleteTaskType('${type.id}', event)" title="删除">×</button>
            </div>
        </div>
    `).join('');
    
    updateTaskTypeSelect();
}

// 更新任务类型下拉框
function updateTaskTypeSelect() {
    const select = document.getElementById('taskType');
    select.innerHTML = taskTypes.map(type => 
        `<option value="${type.id}">${type.emoji} ${type.name}</option>`
    ).join('');
}

// 检查任务是否超时
function isTaskOverdue(task) {
    if (task.completed || task.started) return false;
    const now = new Date();
    const today = getLocalDateString(now);
    
    // 只有今天的任务才判断超时
    if (task.date && task.date !== today) return false;
    
    const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    return currentTime > task.startTime;
}

// 检查任务是否进行中
function isTaskInProgress(task) {
    if (task.completed) return false;
    // 只要标记为已开始，就显示为进行中（支持提前开始）
    return !!task.started;
}

// 获取本地日期字符串 YYYY-MM-DD
function getLocalDateString(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

// 渲染任务列表
function renderTasks() {
    const container = document.getElementById('tasksList');
    
    if (tasks.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">📝</div>
                <p class="empty-state-text">还没有任务哦，快来添加第一个任务吧！</p>
            </div>
        `;
        return;
    }
    
    // 排序：未完成的按日期+时间排序，已完成的放最后
    const sortedTasks = [...tasks].sort((a, b) => {
        if (a.completed && !b.completed) return 1;
        if (!a.completed && b.completed) return -1;
        // 先按日期排序，再按时间排序
        const dateCompare = (a.date || '').localeCompare(b.date || '');
        if (dateCompare !== 0) return dateCompare;
        return a.startTime.localeCompare(b.startTime);
    });
    
    container.innerHTML = sortedTasks.map(task => {
        const type = taskTypes.find(t => t.id === task.typeId) || taskTypes[0];
        const isOverdue = isTaskOverdue(task);
        const inProgress = isTaskInProgress(task);
        const statusClass = task.completed ? 'completed' : (isOverdue ? 'overdue' : (inProgress ? 'in-progress' : 'pending'));
        
        let statusText, statusIcon;
        if (task.completed) {
            statusText = '已完成';
            statusIcon = '✅';
        } else if (inProgress) {
            statusText = '进行中';
            statusIcon = '⏳';
        } else if (isOverdue) {
            statusText = '超时未开始';
            statusIcon = '🚨';
        } else {
            statusText = '待开始';
            statusIcon = '⏸️';
        }
        
        // 格式化日期显示
        const dateDisplay = formatTaskDate(task.date);
        
        const selectedClass = selectedTaskId === task.id ? 'selected' : '';
        
        return `
            <div class="task-item ${statusClass} ${selectedClass}" 
                 style="--task-color: ${type.color};"
                 onclick="selectTask('${task.id}')">
                <div class="task-header">
                    <div>
                        <div class="task-title">${task.name}</div>
                        <span class="task-type-badge" style="--type-bg: ${type.color}20; --type-color: ${type.color};">
                            ${type.emoji} ${type.name}
                        </span>
                    </div>
                    <span class="task-status ${statusClass}">${statusIcon} ${statusText}</span>
                </div>
                <div class="task-time">
                    <span class="task-time-icon">📅</span>
                    <span>${dateDisplay}</span>
                    <span class="task-time-icon">⏰</span>
                    <span>${task.startTime} - ${task.endTime}</span>
                    ${task.reminder > 0 ? `<span style="color: #FF6B6B;">🔔 提前${task.reminder}分钟</span>` : ''}
                </div>
                ${task.note ? `<div class="task-note">💭 ${task.note}</div>` : ''}
                <div class="task-actions" onclick="event.stopPropagation()">
                    ${!task.completed && !inProgress ? 
                        `<button class="btn-start" onclick="startTask('${task.id}')">🚀 开始</button>` : ''
                    }
                    ${!task.completed ? 
                        `<button class="btn-complete" onclick="completeTask('${task.id}')">✅ 完成</button>` :
                        `<button class="btn-complete" onclick="uncompleteTask('${task.id}')" style="background: linear-gradient(135deg, #95a5a6, #7f8c8d);">↩️ 取消</button>`
                    }
                    <button class="btn-edit" onclick="editTask('${task.id}')">✏️</button>
                    <button class="btn-delete" onclick="deleteTask('${task.id}')">🗑️</button>
                </div>
            </div>
        `;
    }).join('');
}

// 显示开始任务确认弹窗
function startTask(taskId) {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;
    
    pendingStartTaskId = taskId;
    const type = taskTypes.find(t => t.id === task.typeId) || taskTypes[0];
    
    document.getElementById('startAnimation').textContent = type.emoji;
    document.getElementById('startTaskTitle').textContent = `🚀 ${task.name}`;
    document.getElementById('startTaskText').textContent = `确认要开始执行"${task.name}"这个任务吗？\n准备好了就点击开始吧！`;
    document.getElementById('startTaskModal').classList.add('active');
    playSound('reminder');
}

// 确认开始任务
function confirmStartTask() {
    if (!pendingStartTaskId) return;
    
    const task = tasks.find(t => t.id === pendingStartTaskId);
    if (task) {
        task.started = true;
        task.startedAt = new Date().toISOString();
        saveCurrentUserData();
        renderTasks();
        if (selectedTaskId === pendingStartTaskId) {
            renderTaskDetail();
        }
        playSound('complete');
        
        // 检查是否提前开始，给予称赞
        checkEarlyStart(task);
    }
    
    closeStartTaskModal();
}

// 检查是否提前开始任务
function checkEarlyStart(task) {
    const now = new Date();
    const today = getLocalDateString(now);
    const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    
    // 如果是今天的任务，且当前时间早于开始时间，就是提前开始
    if (task.date === today && currentTime < task.startTime) {
        // 计算提前了多少分钟
        const [startHour, startMinute] = task.startTime.split(':').map(Number);
        const [currHour, currMinute] = currentTime.split(':').map(Number);
        const startMinutes = startHour * 60 + startMinute;
        const currMinutes = currHour * 60 + currMinute;
        const earlyMinutes = startMinutes - currMinutes;
        
        showEarlyStartCelebration(earlyMinutes);
    }
}

// 显示提前开始的称赞弹窗
function showEarlyStartCelebration(earlyMinutes) {
    const encouragements = [
        { title: '🌟 太积极了！', text: `${settings.childName}，你提前${earlyMinutes}分钟开始任务！\n这种积极主动的态度太棒了！` },
        { title: '🚀 超前小达人！', text: `哇！提前${earlyMinutes}分钟开始！\n${settings.childName}，你真是时间管理小能手！` },
        { title: '👏 主动出击！', text: `提前${earlyMinutes}分钟！\n${settings.childName}，你的行动力让人佩服！` },
        { title: '💪 积极主动！', text: `太棒了${settings.childName}！\n提前${earlyMinutes}分钟开始，这种主动性值得表扬！` },
        { title: '🎯 抢跑成功！', text: `提前${earlyMinutes}分钟开始任务！\n${settings.childName}，你比计划还要棒！` }
    ];
    
    const randomEncouragement = encouragements[Math.floor(Math.random() * encouragements.length)];
    
    // 使用全部完成的弹窗样式，但修改内容
    const modal = document.getElementById('allCompletedModal');
    if (!modal) {
        createAllCompletedModal();
    }
    
    document.getElementById('allCompletedTitle').textContent = randomEncouragement.title;
    document.getElementById('allCompletedText').innerHTML = randomEncouragement.text.replace(/\n/g, '<br>');
    
    document.getElementById('allCompletedModal').classList.add('active');
    
    playAllCompletedSound();
    createSuperConfetti();
}

// 关闭开始确认弹窗
function closeStartTaskModal() {
    document.getElementById('startTaskModal').classList.remove('active');
    pendingStartTaskId = null;
}

// 选择任务
function selectTask(taskId) {
    selectedTaskId = taskId;
    renderTasks();
    renderTaskDetail();
}

// 渲染任务详情
function renderTaskDetail() {
    const container = document.getElementById('taskDetailCard');
    
    if (!selectedTaskId) {
        container.innerHTML = `
            <div class="detail-empty">
                <span class="empty-icon">👈</span>
                <p>点击左侧任务查看详情</p>
            </div>
        `;
        return;
    }
    
    const task = tasks.find(t => t.id === selectedTaskId);
    if (!task) {
        container.innerHTML = `
            <div class="detail-empty">
                <span class="empty-icon">👈</span>
                <p>点击左侧任务查看详情</p>
            </div>
        `;
        return;
    }
    
    const type = taskTypes.find(t => t.id === task.typeId) || taskTypes[0];
    const isOverdue = isTaskOverdue(task);
    const inProgress = isTaskInProgress(task);
    
    let statusClass, statusText, statusIcon;
    if (task.completed) {
        statusClass = 'completed';
        statusText = '已完成';
        statusIcon = '✅';
    } else if (inProgress) {
        statusClass = 'in-progress';
        statusText = '进行中';
        statusIcon = '⏳';
    } else if (isOverdue) {
        statusClass = 'overdue';
        statusText = '超时未开始';
        statusIcon = '🚨';
    } else {
        statusClass = 'pending';
        statusText = '待开始';
        statusIcon = '⏸️';
    }
    
    let timeRemaining = '';
    if (!task.completed) {
        const now = new Date();
        const [endHour, endMinute] = task.endTime.split(':').map(Number);
        const endTime = new Date();
        endTime.setHours(endHour, endMinute, 0, 0);
        
        if (now < endTime) {
            const diff = endTime - now;
            const hours = Math.floor(diff / (1000 * 60 * 60));
            const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
            if (hours > 0) {
                timeRemaining = `剩余 ${hours}小时${minutes}分钟`;
            } else {
                timeRemaining = `剩余 ${minutes}分钟`;
            }
        } else {
            timeRemaining = '已超时';
        }
    }
    
    container.innerHTML = `
        <div class="detail-content">
            <div class="detail-header">
                <span class="detail-icon">${type.emoji}</span>
                <div>
                    <div class="detail-title">${task.name}</div>
                    <span class="detail-type" style="background: ${type.color}20; color: ${type.color};">
                        ${type.name}
                    </span>
                </div>
            </div>
            <div class="detail-info">
                <div class="detail-row">
                    <span class="label">📅 日期</span>
                    <span class="value">${formatTaskDate(task.date)}</span>
                </div>
                <div class="detail-row">
                    <span class="label">⏰ 时间</span>
                    <span class="value">${task.startTime} - ${task.endTime}</span>
                </div>
                <div class="detail-row">
                    <span class="label">📊 状态</span>
                    <span class="status-badge ${statusClass}">${statusIcon} ${statusText}</span>
                </div>
                ${timeRemaining ? `
                <div class="detail-row">
                    <span class="label">⏳ ${timeRemaining}</span>
                </div>
                ` : ''}
                ${task.reminder > 0 ? `
                <div class="detail-row">
                    <span class="label">🔔 提醒</span>
                    <span class="value">提前${task.reminder}分钟</span>
                </div>
                ` : ''}
                ${task.note ? `
                <div class="detail-note">
                    <strong>💭 备注：</strong><br>
                    ${task.note}
                </div>
                ` : ''}
            </div>
            <div class="detail-actions">
                ${!task.completed && !inProgress ? 
                    `<button class="btn-start" onclick="startTask('${task.id}')" style="background: linear-gradient(135deg, rgba(255, 217, 61, 0.9), rgba(255, 217, 61, 0.7)); color: #1E293B;">🚀 开始任务</button>` : ''
                }
                ${!task.completed ? 
                    `<button class="btn-complete" onclick="completeTask('${task.id}')">✅ 完成任务</button>` :
                    `<button onclick="uncompleteTask('${task.id}')" style="background: linear-gradient(135deg, #95a5a6, #7f8c8d); flex: 1;">↩️ 取消完成</button>`
                }
                <button class="btn-edit" onclick="editTask('${task.id}')">✏️</button>
                <button class="btn-delete" onclick="deleteTask('${task.id}')">🗑️</button>
            </div>
        </div>
    `;
}

// 更新统计数据
function updateStats() {
    const today = getLocalDateString(new Date());
    
    // 今日统计：只统计今天的任务
    const todayTasks = tasks.filter(t => t.date === today);
    const todayTotal = todayTasks.length;
    const todayCompleted = todayTasks.filter(t => t.completed).length;
    const todayStars = todayCompleted; // 每完成一个任务得一颗星
    
    // 累计统计：所有任务 + 历史记录
    const allTotal = tasks.length;
    const allCompleted = tasks.filter(t => t.completed).length + history.length;
    const allStars = totalStars;
    
    // 更新今日统计
    document.getElementById('todayTasks').textContent = todayTotal;
    document.getElementById('todayCompleted').textContent = todayCompleted;
    document.getElementById('todayStars').textContent = todayStars;
    
    // 更新累计统计
    document.getElementById('totalTasks').textContent = allTotal;
    document.getElementById('totalCompleted').textContent = allCompleted;
    document.getElementById('totalStars').textContent = allStars;
}

// 更新进度条
function updateProgress() {
    const total = tasks.length;
    const completed = tasks.filter(t => t.completed).length;
    const percent = total > 0 ? Math.round((completed / total) * 100) : 0;
    
    document.getElementById('progressPercent').textContent = `${percent}%`;
    document.getElementById('progressFill').style.width = `${percent}%`;
}

// ============ 弹窗相关 ============

function showAddTaskModal() {
    document.getElementById('addTaskModal').classList.add('active');
    document.getElementById('taskModalTitle').textContent = '📝 添加新任务';
    document.getElementById('taskSubmitBtn').textContent = '🚀 添加任务';
    document.getElementById('editTaskId').value = '';
    document.getElementById('addTaskForm').reset();
    
    const now = new Date();
    // 设置默认日期为今天
    const today = getLocalDateString(now);
    document.getElementById('taskDate').value = today;
    
    const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    document.getElementById('startTime').value = currentTime;
    const endTime = new Date(now.getTime() + 60 * 60 * 1000);
    document.getElementById('endTime').value = `${String(endTime.getHours()).padStart(2, '0')}:${String(endTime.getMinutes()).padStart(2, '0')}`;
}

function editTask(taskId) {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;
    
    document.getElementById('addTaskModal').classList.add('active');
    document.getElementById('taskModalTitle').textContent = '✏️ 编辑任务';
    document.getElementById('taskSubmitBtn').textContent = '💾 保存修改';
    document.getElementById('editTaskId').value = taskId;
    document.getElementById('taskName').value = task.name;
    document.getElementById('taskType').value = task.typeId;
    document.getElementById('taskDate').value = task.date || getLocalDateString(new Date());
    document.getElementById('startTime').value = task.startTime;
    document.getElementById('endTime').value = task.endTime;
    document.getElementById('reminderTime').value = task.reminder;
    document.getElementById('taskNote').value = task.note || '';
}

function closeAddTaskModal() {
    document.getElementById('addTaskModal').classList.remove('active');
    document.getElementById('addTaskForm').reset();
    document.getElementById('editTaskId').value = '';
}

function showAddTypeModal() {
    document.getElementById('addTypeModal').classList.add('active');
    document.getElementById('typeModalTitle').textContent = '📋 添加任务类型';
    document.getElementById('typeSubmitBtn').textContent = '✨ 添加类型';
    document.getElementById('editTypeId').value = '';
    document.getElementById('addTypeForm').reset();
    selectedEmoji = '📚';
    selectedColor = '#5B8DEF';
    updateEmojiSelection();
    updateColorSelection();
}

function editTaskType(typeId, event) {
    event.stopPropagation();
    const type = taskTypes.find(t => t.id === typeId);
    if (!type) return;
    
    document.getElementById('addTypeModal').classList.add('active');
    document.getElementById('typeModalTitle').textContent = '✏️ 编辑任务类型';
    document.getElementById('typeSubmitBtn').textContent = '💾 保存修改';
    document.getElementById('editTypeId').value = typeId;
    document.getElementById('typeName').value = type.name;
    selectedEmoji = type.emoji;
    selectedColor = type.color;
    updateEmojiSelection();
    updateColorSelection();
}

function closeAddTypeModal() {
    document.getElementById('addTypeModal').classList.remove('active');
    document.getElementById('addTypeForm').reset();
    document.getElementById('editTypeId').value = '';
}

function showSettingsModal() {
    document.getElementById('settingsModal').classList.add('active');
    
    // 强制刷新输入框的值，确保显示当前用户的设置
    const childNameInput = document.getElementById('childName');
    childNameInput.value = settings.childName || '';
    
    const messageInput = document.getElementById('encouragementMessage');
    messageInput.value = settings.encouragementMessage || '';
    
    selectedMascot = settings.mascot || '🐻';
    updateMascotSelection();
}

function closeSettingsModal() {
    document.getElementById('settingsModal').classList.remove('active');
}

// ============ 历史记录功能 ============

// 显示历史记录页面
function showHistoryPage() {
    document.getElementById('historyModal').classList.add('active');
    renderHistoryList();
}

// 关闭历史记录页面
function closeHistoryModal() {
    document.getElementById('historyModal').classList.remove('active');
}

// 渲染历史记录列表
function renderHistoryList(dateFilter = null) {
    const container = document.getElementById('historyList');
    const todayBtn = document.getElementById('filterToday');
    const weekBtn = document.getElementById('filterWeek');
    const allBtn = document.getElementById('filterAll');
    
    // 更新按钮状态
    todayBtn.classList.remove('active');
    weekBtn.classList.remove('active');
    allBtn.classList.remove('active');
    
    let filteredHistory = [...history];
    
    if (dateFilter === 'today') {
        const today = new Date().toDateString();
        filteredHistory = history.filter(h => new Date(h.completedAt).toDateString() === today);
        todayBtn.classList.add('active');
    } else if (dateFilter === 'week') {
        const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        filteredHistory = history.filter(h => new Date(h.completedAt) >= weekAgo);
        weekBtn.classList.add('active');
    } else {
        allBtn.classList.add('active');
    }
    
    // 按完成时间倒序排列
    filteredHistory.sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt));
    
    if (filteredHistory.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">📜</div>
                <p class="empty-state-text">还没有完成任务的历史记录哦！<br>完成一些任务后就能在这里看到啦～</p>
            </div>
        `;
        return;
    }
    
    // 按日期分组显示
    const groupedByDate = {};
    filteredHistory.forEach(item => {
        const dateKey = new Date(item.completedAt).toLocaleDateString('zh-CN', {
            month: 'long',
            day: 'numeric',
            weekday: 'long'
        });
        if (!groupedByDate[dateKey]) {
            groupedByDate[dateKey] = [];
        }
        groupedByDate[dateKey].push(item);
    });
    
    let html = '';
    for (const [date, items] of Object.entries(groupedByDate)) {
        html += `
            <div class="history-date-group">
                <div class="history-date-header">${date}</div>
                ${items.map(item => {
                    const type = taskTypes.find(t => t.id === item.typeId) || taskTypes[0];
                    const time = new Date(item.completedAt).toLocaleTimeString('zh-CN', {
                        hour: '2-digit',
                        minute: '2-digit'
                    });
                    return `
                        <div class="history-item">
                            <div class="history-item-left">
                                <span class="history-icon" style="color: ${type.color}">${type.emoji}</span>
                                <div class="history-info">
                                    <div class="history-name">${item.name}</div>
                                    <div class="history-meta">${type.name} · ${item.startTime}-${item.endTime}</div>
                                </div>
                            </div>
                            <div class="history-item-right">
                                <span class="history-time">${time}</span>
                                <span class="history-star">⭐</span>
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        `;
    }
    
    container.innerHTML = html;
}

// 删除历史记录（可选）
function clearHistory() {
    if (confirm('确定要清空所有历史记录吗？此操作不可恢复！')) {
        history = [];
        saveCurrentUserData();
        renderHistoryList();
        playSound('delete');
    }
}

// ============ 保存和操作函数 ============

function setupEventListeners() {
    // 防止重复绑定事件
    if (window._eventListenersSetup) return;
    window._eventListenersSetup = true;
    
    document.getElementById('addTaskForm').addEventListener('submit', function(e) {
        e.preventDefault();
        saveTask();
    });
    
    document.getElementById('addTypeForm').addEventListener('submit', function(e) {
        e.preventDefault();
        saveTaskType();
    });
    
    document.getElementById('settingsForm').addEventListener('submit', function(e) {
        e.preventDefault();
        saveSettings();
    });
    
    document.querySelectorAll('.emoji-picker .emoji-option').forEach(el => {
        el.addEventListener('click', function() {
            selectedEmoji = this.dataset.emoji;
            updateEmojiSelection();
        });
    });
    
    document.querySelectorAll('.color-picker .color-option').forEach(el => {
        el.addEventListener('click', function() {
            selectedColor = this.dataset.color;
            updateColorSelection();
        });
    });
    
    document.querySelectorAll('.mascot-option').forEach(el => {
        el.addEventListener('click', function() {
            selectedMascot = this.dataset.mascot;
            updateMascotSelection();
        });
    });
    
    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', function(e) {
            if (e.target === this && this.id !== 'overdueModal') {
                this.classList.remove('active');
            }
        });
    });
}

function updateEmojiSelection() {
    document.querySelectorAll('.emoji-option').forEach(el => {
        el.classList.toggle('selected', el.dataset.emoji === selectedEmoji);
    });
}

function updateColorSelection() {
    document.querySelectorAll('.color-picker .color-option').forEach(el => {
        el.classList.toggle('selected', el.dataset.color === selectedColor);
    });
}

function updateMascotSelection() {
    document.querySelectorAll('.mascot-option').forEach(el => {
        el.classList.toggle('selected', el.dataset.mascot === selectedMascot);
    });
}

function saveTask() {
    const editId = document.getElementById('editTaskId').value;
    const name = document.getElementById('taskName').value.trim();
    const typeId = document.getElementById('taskType').value;
    const date = document.getElementById('taskDate').value;
    const startTime = document.getElementById('startTime').value;
    const endTime = document.getElementById('endTime').value;
    const reminder = document.getElementById('reminderTime').value ? parseInt(document.getElementById('reminderTime').value) : 0;
    const note = document.getElementById('taskNote').value.trim();
    
    if (!name || !startTime || !endTime) {
        alert('请填写完整的任务信息！');
        return;
    }
    
    if (startTime >= endTime) {
        alert('结束时间必须晚于开始时间！');
        return;
    }
    
    // 如果没有选择日期，默认为今天
    const taskDate = date || getLocalDateString(new Date());
    
    if (editId) {
        const task = tasks.find(t => t.id === editId);
        if (task) {
            task.name = name;
            task.typeId = typeId;
            task.date = taskDate;
            task.startTime = startTime;
            task.endTime = endTime;
            task.reminder = reminder;
            task.note = note;
        }
    } else {
        const task = {
            id: Date.now().toString(),
            name,
            typeId,
            date: taskDate,
            startTime,
            endTime,
            reminder,
            note,
            completed: false,
            started: false,
            reminded: false,
            createdAt: new Date().toISOString()
        };
        tasks.push(task);
    }
    
    saveCurrentUserData();
    renderTasks();
    updateStats();
    updateProgress();
    closeAddTaskModal();
    playSound('add');
}

function saveTaskType() {
    const editId = document.getElementById('editTypeId').value;
    const name = document.getElementById('typeName').value.trim();
    
    if (!name) {
        alert('请输入类型名称！');
        return;
    }
    
    if (editId) {
        const type = taskTypes.find(t => t.id === editId);
        if (type) {
            type.name = name;
            type.emoji = selectedEmoji;
            type.color = selectedColor;
        }
    } else {
        const type = {
            id: 'type_' + Date.now(),
            name,
            emoji: selectedEmoji,
            color: selectedColor
        };
        taskTypes.push(type);
    }
    
    saveCurrentUserData();
    renderTaskTypes();
    renderTasks();
    closeAddTypeModal();
    playSound('add');
}

function saveSettings() {
    settings.childName = document.getElementById('childName').value.trim() || '小朋友';
    settings.encouragementMessage = document.getElementById('encouragementMessage').value.trim() || 
        '你是最棒的时间管理小能手！⭐';
    settings.mascot = selectedMascot;
    
    saveCurrentUserData();
    renderEncouragement();
    updateMascot();
    closeSettingsModal();
    playSound('add');
}

function deleteTaskType(typeId, event) {
    event.stopPropagation();
    
    const tasksUsingType = tasks.filter(t => t.typeId === typeId);
    if (tasksUsingType.length > 0) {
        alert(`有 ${tasksUsingType.length} 个任务使用了此类型，请先删除这些任务！`);
        return;
    }
    
    if (confirm('确定要删除这个任务类型吗？')) {
        taskTypes = taskTypes.filter(t => t.id !== typeId);
        saveCurrentUserData();
        renderTaskTypes();
        playSound('delete');
    }
}

function completeTask(taskId) {
    const task = tasks.find(t => t.id === taskId);
    if (task) {
        // 添加到历史记录
        const historyItem = {
            id: task.id,
            name: task.name,
            typeId: task.typeId,
            startTime: task.startTime,
            endTime: task.endTime,
            completedAt: new Date().toISOString(),
            note: task.note
        };
        history.push(historyItem);
        
        task.completed = true;
        totalStars++;
        
        saveCurrentUserData();
        renderTasks();
        updateStats();
        updateProgress();
        if (selectedTaskId === taskId) {
            renderTaskDetail();
        }
        playSound('complete');
        showCelebration();
        
        // 检查是否提前完成，给予称赞
        checkEarlyComplete(task);
        
        checkAllTasksCompleted();
    }
}

// 检查是否提前完成任务
function checkEarlyComplete(task) {
    const now = new Date();
    const today = getLocalDateString(now);
    const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    
    // 如果是今天的任务，且当前时间早于结束时间，就是提前完成
    if (task.date === today && currentTime < task.endTime) {
        // 计算提前了多少分钟
        const [endHour, endMinute] = task.endTime.split(':').map(Number);
        const [currHour, currMinute] = currentTime.split(':').map(Number);
        const endMinutes = endHour * 60 + endMinute;
        const currMinutes = currHour * 60 + currMinute;
        const earlyMinutes = endMinutes - currMinutes;
        
        showEarlyCompleteCelebration(earlyMinutes);
    }
}

// 显示提前完成的称赞弹窗
function showEarlyCompleteCelebration(earlyMinutes) {
    const encouragements = [
        { title: '⚡ 超速完成！', text: `${settings.childName}，你提前${earlyMinutes}分钟完成任务！\n效率太高了，太厉害了！` },
        { title: '🏆 提前达标！', text: `哇！提前${earlyMinutes}分钟完成！\n${settings.childName}，你的效率让人惊叹！` },
        { title: '🌟 闪电速度！', text: `提前${earlyMinutes}分钟完成！\n${settings.childName}，你完成任务的速度超快！` },
        { title: '👏 高效小能手！', text: `太棒了${settings.childName}！\n提前${earlyMinutes}分钟完成，效率满分！` },
        { title: '🎯 又快又好！', text: `提前${earlyMinutes}分钟完成任务！\n${settings.childName}，你真是又快又棒！` }
    ];
    
    const randomEncouragement = encouragements[Math.floor(Math.random() * encouragements.length)];
    
    // 延迟显示，让完成动画先播放
    setTimeout(() => {
        const modal = document.getElementById('allCompletedModal');
        if (!modal) {
            createAllCompletedModal();
        }
        
        document.getElementById('allCompletedTitle').textContent = randomEncouragement.title;
        document.getElementById('allCompletedText').innerHTML = randomEncouragement.text.replace(/\n/g, '<br>');
        
        document.getElementById('allCompletedModal').classList.add('active');
        
        playAllCompletedSound();
        createSuperConfetti();
    }, 1500);
}

function uncompleteTask(taskId) {
    const task = tasks.find(t => t.id === taskId);
    if (task) {
        task.completed = false;
        // 从历史记录中移除
        history = history.filter(h => h.id !== taskId);
        totalStars = Math.max(0, totalStars - 1);
        
        saveCurrentUserData();
        renderTasks();
        updateStats();
        updateProgress();
        if (selectedTaskId === taskId) {
            renderTaskDetail();
        }
    }
}

function deleteTask(taskId) {
    if (confirm('确定要删除这个任务吗？')) {
        tasks = tasks.filter(t => t.id !== taskId);
        if (selectedTaskId === taskId) {
            selectedTaskId = null;
        }
        saveCurrentUserData();
        renderTasks();
        renderTaskDetail();
        updateStats();
        updateProgress();
        playSound('delete');
    }
}

function showCelebration() {
    const celebration = document.getElementById('celebration');
    document.getElementById('celebrationTitle').textContent = `太棒了，${settings.childName}！`;
    document.getElementById('celebrationText').textContent = '你完成了一个任务！继续加油！';
    celebration.classList.add('active');
    
    createConfetti();
    
    setTimeout(() => {
        celebration.classList.remove('active');
    }, 3000);
}

function createConfetti() {
    const colors = ['#5B8DEF', '#00C9A7', '#FFD93D', '#B388FF', '#FF6B6B'];
    const celebration = document.getElementById('celebration');
    
    for (let i = 0; i < 50; i++) {
        const confetti = document.createElement('div');
        confetti.style.cssText = `
            position: fixed;
            width: 10px;
            height: 10px;
            background: ${colors[Math.floor(Math.random() * colors.length)]};
            left: ${Math.random() * 100}vw;
            top: -10px;
            border-radius: ${Math.random() > 0.5 ? '50%' : '0'};
            animation: fall ${2 + Math.random() * 3}s linear forwards;
            z-index: 2001;
        `;
        celebration.appendChild(confetti);
        
        setTimeout(() => confetti.remove(), 5000);
    }
}

// 添加彩纸动画样式
if (!document.getElementById('confetti-style')) {
    const style = document.createElement('style');
    style.id = 'confetti-style';
    style.textContent = `
        @keyframes fall {
            to {
                transform: translateY(100vh) rotate(720deg);
                opacity: 0;
            }
        }
    `;
    document.head.appendChild(style);
}

function startReminderCheck() {
    reminderInterval = setInterval(checkReminders, 30000);
    checkReminders();
}

function checkReminders() {
    const now = new Date();
    const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    
    tasks.forEach(task => {
        if (task.completed || task.reminded || task.reminder === 0) return;
        
        const [taskHour, taskMinute] = task.startTime.split(':').map(Number);
        const reminderTime = new Date();
        reminderTime.setHours(taskHour, taskMinute - task.reminder, 0, 0);
        
        const reminderTimeStr = `${String(reminderTime.getHours()).padStart(2, '0')}:${String(reminderTime.getMinutes()).padStart(2, '0')}`;
        
        if (currentTime === reminderTimeStr) {
            showReminder(task);
            task.reminded = true;
            saveCurrentUserData();
        }
    });
}

function showReminder(task) {
    const modal = document.getElementById('reminderModal');
    const text = document.getElementById('reminderText');
    text.textContent = `${settings.childName}，任务"${task.name}"将在${task.reminder}分钟后开始！`;
    modal.classList.add('active');
    playSound('reminder');
}

function closeReminderModal() {
    document.getElementById('reminderModal').classList.remove('active');
}

// 超时提醒功能
function startOverdueReminderCheck() {
    overdueReminderInterval = setInterval(checkOverdueTasks, 30000);
}

function checkOverdueTasks() {
    const now = new Date();
    const currentMinute = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    
    const overdueTasks = tasks.filter(task => {
        if (task.completed || task.started) return false;
        return currentMinute > task.startTime;
    });
    
    if (overdueTasks.length > 0) {
        const lastCheckKey = 'overdue_last_check';
        const lastCheck = localStorage.getItem(lastCheckKey);
        const currentTimestamp = now.getTime();
        
        if (lastCheck) {
            const lastCheckTime = parseInt(lastCheck);
            if (currentTimestamp - lastCheckTime < 60000) {
                renderTasks();
                return;
            }
        }
        
        localStorage.setItem(lastCheckKey, currentTimestamp.toString());
        
        const primaryOverdueTask = overdueTasks[0];
        showOverdueReminder(primaryOverdueTask, overdueTasks.length);
        renderTasks();
    }
}

function showOverdueReminder(task, overdueCount) {
    const modal = document.getElementById('overdueModal');
    
    document.getElementById('overdueAnimation').textContent = getRandomOverdueEmoji();
    document.getElementById('overdueTitle').textContent = `⏰ ${task.name} 超时啦！`;
    
    let reminderText = getRandomReminderText();
    if (overdueCount > 1) {
        reminderText += `\n\n📋 还有 ${overdueCount - 1} 个任务也在等你哦！`;
    }
    
    document.getElementById('overdueText').innerHTML = reminderText.replace(/\n/g, '<br>');
    
    modal.classList.add('active');
    playSound('overdue');
}

function handleOverdueAction() {
    document.getElementById('overdueModal').classList.remove('active');
    playSound('complete');
}

function checkAllTasksCompleted() {
    const totalTasks = tasks.length;
    const completedTasks = tasks.filter(t => t.completed).length;
    
    if (totalTasks > 0 && completedTasks === totalTasks) {
        setTimeout(() => {
            showAllCompletedCelebration();
        }, 1500);
    }
}

function showAllCompletedCelebration() {
    const modal = document.getElementById('allCompletedModal');
    if (!modal) {
        createAllCompletedModal();
    }
    
    const encouragements = [
        { title: '🎉 太棒了！', text: `${settings.childName}，你完成了所有任务！\n你真是时间管理小达人！` },
        { title: '🌟 超级厉害！', text: `哇！所有任务都完成啦！\n${settings.childName}，你是最棒的！` },
        { title: '🏆 完美收官！', text: `恭喜${settings.childName}！\n今天的任务全部搞定，给你一个大大的赞！` },
        { title: '🎊 全勤奖！', text: `${settings.childName}，你做到了！\n所有任务都完成了，太厉害了！` },
        { title: '👏 掌声鼓励！', text: `太棒了${settings.childName}！\n任务清零，你是真正的时间管理大师！` }
    ];
    
    const randomEncouragement = encouragements[Math.floor(Math.random() * encouragements.length)];
    
    document.getElementById('allCompletedTitle').textContent = randomEncouragement.title;
    document.getElementById('allCompletedText').innerHTML = randomEncouragement.text.replace(/\n/g, '<br>');
    
    document.getElementById('allCompletedModal').classList.add('active');
    
    playAllCompletedSound();
    createSuperConfetti();
}

function createAllCompletedModal() {
    const modal = document.createElement('div');
    modal.className = 'modal all-completed-modal';
    modal.id = 'allCompletedModal';
    modal.innerHTML = `
        <div class="modal-content all-completed-content">
            <div class="all-completed-animation">🏆</div>
            <h2 id="allCompletedTitle">🎉 太棒了！</h2>
            <p id="allCompletedText">你完成了所有任务！</p>
            <div class="all-completed-stars">⭐⭐⭐</div>
            <button class="btn-all-completed" onclick="closeAllCompletedModal()">🎊 继续加油！</button>
        </div>
    `;
    document.body.appendChild(modal);
    
    const style = document.createElement('style');
    style.textContent = `
        .all-completed-modal .modal-content {
            text-align: center;
            padding: 40px;
            background: linear-gradient(135deg, #1E293B, #0F172A);
            border: 1px solid rgba(255, 255, 255, 0.1);
            animation: rainbow-bg 3s ease infinite;
            background-size: 200% 200%;
        }
        
        @keyframes rainbow-bg {
            0% { background-position: 0% 50%; }
            50% { background-position: 100% 50%; }
            100% { background-position: 0% 50%; }
        }
        
        .all-completed-animation {
            font-size: 100px;
            animation: trophy-bounce 1s ease infinite;
        }
        
        @keyframes trophy-bounce {
            0%, 100% { transform: translateY(0) rotate(-5deg); }
            50% { transform: translateY(-20px) rotate(5deg); }
        }
        
        .all-completed-content h2 {
            font-size: 32px;
            color: white;
            margin: 20px 0 15px;
            text-shadow: 2px 2px 4px rgba(0,0,0,0.3);
        }
        
        .all-completed-content p {
            font-size: 18px;
            color: #E2E8F0;
            margin-bottom: 20px;
            line-height: 1.6;
        }
        
        .all-completed-stars {
            font-size: 40px;
            margin: 20px 0;
            animation: stars-twinkle 1s ease infinite;
        }
        
        @keyframes stars-twinkle {
            0%, 100% { transform: scale(1); opacity: 1; }
            50% { transform: scale(1.2); opacity: 0.8; }
        }
        
        .btn-all-completed {
            padding: 15px 40px;
            background: linear-gradient(135deg, #5B8DEF, #00C9A7);
            color: white;
            border: none;
            border-radius: 30px;
            font-family: inherit;
            font-size: 18px;
            font-weight: bold;
            cursor: pointer;
            transition: all 0.3s ease;
            box-shadow: 0 4px 15px rgba(91, 141, 239, 0.4);
        }
        
        .btn-all-completed:hover {
            transform: scale(1.1);
            box-shadow: 0 6px 20px rgba(91, 141, 239, 0.5);
        }
    `;
    document.head.appendChild(style);
}

function playAllCompletedSound() {
    try {
        const notes = [
            { freq: 523.25, time: 0 },
            { freq: 659.25, time: 0.1 },
            { freq: 783.99, time: 0.2 },
            { freq: 1046.50, time: 0.3 },
            { freq: 783.99, time: 0.4 },
            { freq: 1046.50, time: 0.5 },
            { freq: 1318.51, time: 0.6 },
        ];
        
        notes.forEach(note => {
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);
            
            oscillator.frequency.setValueAtTime(note.freq, audioContext.currentTime + note.time);
            gainNode.gain.setValueAtTime(0.3, audioContext.currentTime + note.time);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + note.time + 0.3);
            
            oscillator.start(audioContext.currentTime + note.time);
            oscillator.stop(audioContext.currentTime + note.time + 0.3);
        });
    } catch (e) {}
}

function createSuperConfetti() {
    const colors = ['#5B8DEF', '#00C9A7', '#FFD93D', '#B388FF', '#FF6B6B'];
    
    for (let i = 0; i < 100; i++) {
        setTimeout(() => {
            const confetti = document.createElement('div');
            confetti.style.cssText = `
                position: fixed;
                width: ${10 + Math.random() * 10}px;
                height: ${10 + Math.random() * 10}px;
                background: ${colors[Math.floor(Math.random() * colors.length)]};
                left: ${Math.random() * 100}vw;
                top: -20px;
                border-radius: ${Math.random() > 0.5 ? '50%' : '0'};
                animation: super-fall ${3 + Math.random() * 2}s linear forwards;
                z-index: 3000;
            `;
            document.body.appendChild(confetti);
            
            setTimeout(() => confetti.remove(), 5000);
        }, i * 30);
    }
}

function closeAllCompletedModal() {
    document.getElementById('allCompletedModal').classList.remove('active');
}

function checkInstallPrompt() {
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || 
                         window.navigator.standalone === true;
    const promptDismissed = localStorage.getItem('installPromptDismissed');
    
    if (!isStandalone && !promptDismissed) {
        setTimeout(() => {
            document.getElementById('installPrompt').classList.add('active');
        }, 3000);
    }
}

function dismissInstallPrompt() {
    document.getElementById('installPrompt').classList.remove('active');
    localStorage.setItem('installPromptDismissed', 'true');
}

// ============ 导出函数 ============
window.createUser = createUser;
window.selectUser = selectUser;
window.removeUser = removeUser;
window.goToUserManagement = goToUserManagement;
window.showHistoryPage = showHistoryPage;
window.closeHistoryModal = closeHistoryModal;
window.renderHistoryList = renderHistoryList;
window.clearHistory = clearHistory;
window.showAddTaskModal = showAddTaskModal;
window.closeAddTaskModal = closeAddTaskModal;
window.showAddTypeModal = showAddTypeModal;
window.closeAddTypeModal = closeAddTypeModal;
window.showSettingsModal = showSettingsModal;
window.closeSettingsModal = closeSettingsModal;
window.completeTask = completeTask;
window.uncompleteTask = uncompleteTask;
window.deleteTask = deleteTask;
window.editTask = editTask;
window.selectTask = selectTask;
window.editTaskType = editTaskType;
window.deleteTaskType = deleteTaskType;
window.closeReminderModal = closeReminderModal;
window.dismissInstallPrompt = dismissInstallPrompt;
window.startTask = startTask;
window.confirmStartTask = confirmStartTask;
window.closeStartTaskModal = closeStartTaskModal;
window.handleOverdueAction = handleOverdueAction;
window.closeAllCompletedModal = closeAllCompletedModal;
window.showAddUserForm = showAddUserForm;

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', init);
