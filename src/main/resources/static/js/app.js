/**
 * ZK Web Browser - Frontend Application
 */
(function () {
    'use strict';

    // ========== State ==========
    const state = {
        servers: [],        // [{ name, address }]
        activeServer: null, // { name, address }
        selectedPath: null, // current selected node path
        treeCache: {},      // path -> { loaded: bool, expanded: bool }
    };

    const STORAGE_KEY = 'zk-web-servers';

    // ========== API ==========
    const api = {
        async post(url, body) {
            const res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
            return res.json();
        },
        async put(url, body) {
            const res = await fetch(url, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
            return res.json();
        },
        async del(url) {
            const res = await fetch(url, { method: 'DELETE' });
            return res.json();
        },
        async get(url) {
            const res = await fetch(url);
            return res.json();
        },
    };

    // ========== Utils ==========
    function $(sel) { return document.querySelector(sel); }
    function $$(sel) { return document.querySelectorAll(sel); }

    function escapeHtml(str) {
        if (str == null) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    function formatTime(ts) {
        if (!ts) return '-';
        const d = new Date(ts);
        return d.getFullYear() + '-' +
            String(d.getMonth() + 1).padStart(2, '0') + '-' +
            String(d.getDate()).padStart(2, '0') + ' ' +
            String(d.getHours()).padStart(2, '0') + ':' +
            String(d.getMinutes()).padStart(2, '0') + ':' +
            String(d.getSeconds()).padStart(2, '0');
    }

    function showToast(message, type) {
        type = type || 'info';
        const container = $('#toast-container');
        const toast = document.createElement('div');
        toast.className = 'toast ' + type;
        toast.textContent = message;
        container.appendChild(toast);
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transition = 'opacity 0.3s';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

    function joinPath(parent, name) {
        if (parent === '/') return '/' + name;
        return parent + '/' + name;
    }

    function parentPath(path) {
        if (path === '/') return null;
        const idx = path.lastIndexOf('/');
        return idx === 0 ? '/' : path.substring(0, idx);
    }

    function nodeName(path) {
        if (path === '/') return '/';
        const idx = path.lastIndexOf('/');
        return path.substring(idx + 1);
    }

    // ========== Server Management ==========
    function loadServers() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            state.servers = raw ? JSON.parse(raw) : [];
        } catch (e) {
            state.servers = [];
        }
    }

    function saveServers() {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state.servers));
    }

    function renderServerList() {
        const list = $('#server-list');
        list.innerHTML = '';

        if (state.servers.length === 0) {
            list.innerHTML = '<li style="padding:12px 14px;color:var(--color-text-muted);font-size:12px;text-align:center;">暂无服务器，点击 + 添加</li>';
            return;
        }

        state.servers.forEach((server, idx) => {
            const li = document.createElement('li');
            li.className = 'server-item';
            if (state.activeServer && state.activeServer.address === server.address) {
                li.classList.add('active');
            }

            li.innerHTML = `
                <div class="server-info">
                    <div class="server-name">${escapeHtml(server.name)}</div>
                    <div class="server-addr">${escapeHtml(server.address)}</div>
                </div>
                <button class="btn-delete-server" title="删除">
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6"/>
                    </svg>
                </button>
            `;

            // Click to connect
            li.querySelector('.server-info').addEventListener('click', () => {
                connectServer(server);
            });

            // Delete
            li.querySelector('.btn-delete-server').addEventListener('click', (e) => {
                e.stopPropagation();
                if (confirm('确定删除服务器 "' + server.name + '" 吗？')) {
                    state.servers.splice(idx, 1);
                    saveServers();
                    if (state.activeServer && state.activeServer.address === server.address) {
                        state.activeServer = null;
                        state.selectedPath = null;
                        state.treeCache = {};
                        renderTree();
                        renderDetail(null);
                        updateConnectionStatus('disconnected');
                        $('#btn-refresh').disabled = true;
                        $('#tree-path').textContent = '请先连接 ZK 服务器';
                    }
                    renderServerList();
                    showToast('已删除服务器', 'info');
                }
            });

            list.appendChild(li);
        });
    }

    async function connectServer(server) {
        state.activeServer = server;
        state.selectedPath = null;
        state.treeCache = {};
        renderServerList();
        updateConnectionStatus('connecting');

        try {
            const res = await api.post('/api/connect', { address: server.address });
            if (res.success) {
                updateConnectionStatus('connected');
                $('#btn-refresh').disabled = false;
                showToast('已连接: ' + server.name, 'success');
                await loadChildren('/');
                await selectNode('/');
            } else {
                updateConnectionStatus('disconnected');
                showToast('连接失败: ' + (res.message || '未知错误'), 'error');
            }
        } catch (e) {
            updateConnectionStatus('disconnected');
            showToast('连接失败: ' + e.message, 'error');
        }
    }

    function updateConnectionStatus(status) {
        const badge = $('#connection-status');
        if (status === 'connected') {
            badge.className = 'status-badge connected';
            badge.textContent = state.activeServer ? '已连接: ' + state.activeServer.name : '已连接';
        } else if (status === 'connecting') {
            badge.className = 'status-badge connecting';
            badge.textContent = '连接中...';
        } else {
            badge.className = 'status-badge disconnected';
            badge.textContent = '未连接';
        }
    }

    // ========== Tree ==========
    function renderTree() {
        const container = $('#tree-container');
        if (!state.activeServer) {
            container.innerHTML = `
                <div class="empty-state">
                    <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.3">
                        <circle cx="12" cy="12" r="10"/><path d="M8 12h8M12 8v8"/>
                    </svg>
                    <p>从左侧选择或添加 ZK 服务器</p>
                </div>`;
            return;
        }
        container.innerHTML = '';
        // Root node
        const rootEl = createTreeNode('/', '/');
        container.appendChild(rootEl);
    }

    function createTreeNode(path, name) {
        const node = document.createElement('div');
        node.className = 'tree-node';
        node.dataset.path = path;

        const row = document.createElement('div');
        row.className = 'tree-node-row';
        if (state.selectedPath === path) {
            row.classList.add('selected');
        }

        // Toggle
        const toggle = document.createElement('span');
        toggle.className = 'tree-toggle';
        toggle.innerHTML = '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M9 18l6-6-6-6"/></svg>';

        // Icon
        const icon = document.createElement('span');
        icon.className = 'tree-icon';
        icon.innerHTML = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#3b82f6" stroke-width="2"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg>';

        // Name
        const nameEl = document.createElement('span');
        nameEl.className = 'tree-node-name';
        nameEl.textContent = name;

        row.appendChild(toggle);
        row.appendChild(icon);
        row.appendChild(nameEl);
        node.appendChild(row);

        // Click to select
        row.addEventListener('click', (e) => {
            e.stopPropagation();
            selectNode(path);
        });

        // Double-click to toggle expand
        row.addEventListener('dblclick', (e) => {
            e.stopPropagation();
            toggleExpand(path, toggle, node);
        });

        // Toggle click
        toggle.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleExpand(path, toggle, node);
        });

        return node;
    }

    async function toggleExpand(path, toggleEl, nodeEl) {
        const cached = state.treeCache[path];
        if (cached && cached.expanded) {
            // Collapse
            cached.expanded = false;
            toggleEl.classList.remove('expanded');
            const childContainer = nodeEl.querySelector('.tree-children');
            if (childContainer) childContainer.style.display = 'none';
        } else {
            // Expand
            if (!cached || !cached.loaded) {
                await loadChildren(path, nodeEl, toggleEl);
            } else {
                // Already loaded, just show
                cached.expanded = true;
                toggleEl.classList.add('expanded');
                const childContainer = nodeEl.querySelector('.tree-children');
                if (childContainer) childContainer.style.display = '';
            }
        }
    }

    async function loadChildren(path, parentNodeEl, toggleEl) {
        if (!state.activeServer) return;

        const address = state.activeServer.address;

        // If called from renderTree (no parentNodeEl), build root
        const isRootLoad = !parentNodeEl;

        if (isRootLoad) {
            parentNodeEl = $('#tree-container').firstChild;
            toggleEl = parentNodeEl.querySelector('.tree-toggle');
        }

        // Show loading
        if (toggleEl) {
            toggleEl.classList.add('expanded');
        }

        // Remove existing children container
        const existingChildren = parentNodeEl.querySelector('.tree-children');
        if (existingChildren) existingChildren.remove();

        const childContainer = document.createElement('div');
        childContainer.className = 'tree-children';

        const loadingEl = document.createElement('div');
        loadingEl.className = 'tree-loading';
        loadingEl.textContent = '加载中...';
        childContainer.appendChild(loadingEl);
        parentNodeEl.appendChild(childContainer);

        try {
            const res = await api.get('/api/children?address=' + encodeURIComponent(address) + '&path=' + encodeURIComponent(path));
            if (!res.success) {
                loadingEl.textContent = '加载失败: ' + (res.message || '错误');
                loadingEl.style.color = 'var(--color-danger)';
                return;
            }

            const children = res.data || [];
            loadingEl.remove();

            state.treeCache[path] = { loaded: true, expanded: true };

            if (children.length === 0) {
                if (toggleEl) toggleEl.classList.add('no-children');
                childContainer.style.display = 'none';
                // Update: no toggle for empty
                if (toggleEl) toggleEl.classList.remove('expanded');
                state.treeCache[path].expanded = false;
                return;
            }

            children.forEach(childName => {
                const childPath = joinPath(path, childName);
                const childEl = createTreeNode(childPath, childName);
                childContainer.appendChild(childEl);
            });
        } catch (e) {
            loadingEl.textContent = '加载失败: ' + e.message;
            loadingEl.style.color = 'var(--color-danger)';
        }
    }

    async function selectNode(path) {
        if (!state.activeServer) return;

        // Update selected state in tree
        $$('.tree-node-row').forEach(r => r.classList.remove('selected'));
        const nodeEl = $(`.tree-node[data-path="${CSS.escape(path)}"]`);
        if (nodeEl) {
            nodeEl.querySelector('.tree-node-row').classList.add('selected');
        }

        state.selectedPath = path;
        $('#tree-path').textContent = path;

        // Load node details
        const address = state.activeServer.address;
        try {
            const res = await api.get('/api/node?address=' + encodeURIComponent(address) + '&path=' + encodeURIComponent(path));
            if (res.success) {
                renderDetail(res.data);
            } else {
                showToast('加载节点失败: ' + (res.message || ''), 'error');
                renderDetail(null);
            }
        } catch (e) {
            showToast('加载节点失败: ' + e.message, 'error');
            renderDetail(null);
        }
    }

    // ========== Detail Panel ==========
    function renderDetail(node) {
        const container = $('#detail-content');

        if (!node) {
            container.innerHTML = `
                <div class="empty-state">
                    <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.3">
                        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><path d="M14 2v6h6"/>
                    </svg>
                    <p>选择一个节点查看详情</p>
                </div>`;
            return;
        }

        const stat = node.stat || {};
        const dataFormat = node.dataFormat || 'text';
        let dataDisplay = node.data || '';
        let dataClass = 'detail-data';

        // Pretty print JSON
        if (dataFormat === 'json' && dataDisplay) {
            try {
                dataDisplay = JSON.stringify(JSON.parse(dataDisplay), null, 2);
                dataClass += ' json';
            } catch (e) {
                // ignore parse error
            }
        }

        // Node type badges
        let badges = '<span class="type-badge persistent">PERSISTENT</span>';
        if (node.ephemeral) badges = '<span class="type-badge ephemeral">EPHEMERAL</span>';
        if (node.sequential) badges += ' <span class="type-badge sequential">SEQUENTIAL</span>';

        const childrenList = (node.children || []).join(', ') || '无';

        container.innerHTML = `
            <div class="detail-section">
                <div class="detail-section-title">路径</div>
                <div class="detail-path">${escapeHtml(node.path)}</div>
            </div>

            <div class="detail-section">
                <div class="detail-section-title">节点类型</div>
                <div class="node-type-badges">${badges}</div>
            </div>

            <div class="detail-section">
                <div class="detail-section-title">
                    数据
                    <span class="data-format-badge ${dataFormat}">${dataFormat}</span>
                    <span style="font-weight:normal;color:var(--color-text-muted);font-size:11px;margin-left:4px;">${stat.dataLength || 0} bytes</span>
                </div>
                <textarea class="${dataClass}" id="node-data" spellcheck="false">${escapeHtml(dataDisplay)}</textarea>
                <div class="detail-actions">
                    <button class="btn btn-primary btn-sm" id="btn-save-data">保存数据</button>
                </div>
            </div>

            <div class="detail-section">
                <div class="detail-section-title">子节点 (${node.children ? node.children.length : 0})</div>
                <div style="font-family:var(--font-mono);font-size:12px;color:var(--color-text-secondary);word-break:break-all;line-height:1.8;">
                    ${escapeHtml(childrenList)}
                </div>
            </div>

            <div class="detail-section">
                <div class="detail-section-title">Stat 信息</div>
                <table class="stat-table">
                    <tr><td>cZxid</td><td>${stat.czxid || 0}</td></tr>
                    <tr><td>mZxid</td><td>${stat.mzxid || 0}</td></tr>
                    <tr><td>ctime</td><td>${formatTime(stat.ctime)}</td></tr>
                    <tr><td>mtime</td><td>${formatTime(stat.mtime)}</td></tr>
                    <tr><td>version</td><td>${stat.version || 0}</td></tr>
                    <tr><td>cversion</td><td>${stat.cversion || 0}</td></tr>
                    <tr><td>aversion</td><td>${stat.aversion || 0}</td></tr>
                    <tr><td>ephemeralOwner</td><td>${stat.ephemeralOwner || 0}</td></tr>
                    <tr><td>dataLength</td><td>${stat.dataLength || 0}</td></tr>
                    <tr><td>numChildren</td><td>${stat.numChildren || 0}</td></tr>
                    <tr><td>pZxid</td><td>${stat.pzxid || 0}</td></tr>
                </table>
            </div>

            <div class="detail-section">
                <div class="detail-section-title">操作</div>
                <div class="detail-actions">
                    <button class="btn btn-primary btn-sm" id="btn-create-child">创建子节点</button>
                    <button class="btn btn-danger btn-sm" id="btn-delete-node">删除节点</button>
                </div>
            </div>
        `;

        // Bind actions
        $('#btn-save-data').addEventListener('click', saveNodeData);
        $('#btn-create-child').addEventListener('click', () => openCreateModal(node.path));
        $('#btn-delete-node').addEventListener('click', () => deleteNode(node.path));
    }

    async function saveNodeData() {
        if (!state.activeServer || !state.selectedPath) return;
        const data = $('#node-data').value;
        const address = state.activeServer.address;

        try {
            const res = await api.put('/api/node', {
                address: address,
                path: state.selectedPath,
                data: data,
            });
            if (res.success) {
                showToast('数据已保存', 'success');
                // Refresh node detail
                await selectNode(state.selectedPath);
            } else {
                showToast('保存失败: ' + (res.message || ''), 'error');
            }
        } catch (e) {
            showToast('保存失败: ' + e.message, 'error');
        }
    }

    async function deleteNode(path) {
        if (path === '/') {
            showToast('不能删除根节点', 'error');
            return;
        }
        if (!confirm('确定删除节点 "' + path + '" 吗？\n注意：如果节点有子节点，删除将失败。')) {
            return;
        }
        const address = state.activeServer.address;
        try {
            const res = await api.del('/api/node?address=' + encodeURIComponent(address) + '&path=' + encodeURIComponent(path));
            if (res.success) {
                showToast('节点已删除', 'success');
                // Refresh parent
                const parent = parentPath(path);
                if (parent) {
                    // Clear cache for parent
                    delete state.treeCache[parent];
                    await refreshTree();
                    await selectNode(parent);
                }
            } else {
                showToast('删除失败: ' + (res.message || ''), 'error');
            }
        } catch (e) {
            showToast('删除失败: ' + e.message, 'error');
        }
    }

    // ========== Create Node Modal ==========
    function openCreateModal(parentPath_) {
        $('#create-parent').value = parentPath_;
        $('#create-name').value = '';
        $('#create-data').value = '';
        $('#create-mode').value = 'PERSISTENT';
        $('#create-modal').style.display = 'flex';
        $('#create-name').focus();
    }

    function closeCreateModal() {
        $('#create-modal').style.display = 'none';
    }

    async function confirmCreate() {
        const parent = $('#create-parent').value;
        const name = $('#create-name').value.trim();
        const data = $('#create-data').value;
        const mode = $('#create-mode').value;

        if (!name) {
            showToast('请输入节点名称', 'error');
            return;
        }

        const path = joinPath(parent, name);
        const address = state.activeServer.address;

        try {
            const res = await api.post('/api/node', {
                address: address,
                path: path,
                data: data,
                mode: mode,
            });
            if (res.success) {
                showToast('节点已创建: ' + res.data, 'success');
                closeCreateModal();
                // Clear parent cache and reload
                delete state.treeCache[parent];
                await refreshTree();
                await selectNode(path);
                // Expand parent
                const parentEl = $(`.tree-node[data-path="${CSS.escape(parent)}"]`);
                if (parentEl) {
                    const toggle = parentEl.querySelector('.tree-toggle');
                    const childContainer = parentEl.querySelector('.tree-children');
                    if (childContainer && childContainer.style.display === 'none') {
                        await toggleExpand(parent, toggle, parentEl);
                    }
                }
            } else {
                showToast('创建失败: ' + (res.message || ''), 'error');
            }
        } catch (e) {
            showToast('创建失败: ' + e.message, 'error');
        }
    }

    // ========== Refresh ==========
    async function refreshTree() {
        if (!state.activeServer) return;
        const prevSelected = state.selectedPath;
        state.treeCache = {};
        renderTree();
        await loadChildren('/');
        if (prevSelected) {
            // Try to reselect
            await selectNode(prevSelected);
        } else {
            await selectNode('/');
        }
    }

    // ========== Resize Handle ==========
    function initResize() {
        const handle = $('#resize-handle');
        const sidebar = $('#sidebar');
        let isResizing = false;
        let startX = 0;
        let startWidth = 0;

        handle.addEventListener('mousedown', (e) => {
            isResizing = true;
            startX = e.clientX;
            startWidth = sidebar.offsetWidth;
            handle.classList.add('dragging');
            document.body.style.cursor = 'col-resize';
            e.preventDefault();
        });

        document.addEventListener('mousemove', (e) => {
            if (!isResizing) return;
            const newWidth = Math.max(160, Math.min(500, startWidth + e.clientX - startX));
            sidebar.style.width = newWidth + 'px';
        });

        document.addEventListener('mouseup', () => {
            if (isResizing) {
                isResizing = false;
                handle.classList.remove('dragging');
                document.body.style.cursor = '';
            }
        });
    }

    // ========== Init ==========
    function init() {
        loadServers();
        renderServerList();
        renderTree();
        renderDetail(null);
        initResize();

        // Add server button
        $('#btn-add-server').addEventListener('click', () => {
            const form = $('#add-server-form');
            form.style.display = form.style.display === 'none' ? 'flex' : 'none';
            if (form.style.display === 'flex') {
                $('#server-name').focus();
            }
        });

        // Save server
        $('#btn-save-server').addEventListener('click', async () => {
            const name = $('#server-name').value.trim();
            const address = $('#server-address').value.trim();

            if (!name) {
                showToast('请输入服务器名称', 'error');
                return;
            }
            if (!address) {
                showToast('请输入服务器地址', 'error');
                return;
            }

            // Check duplicate
            const existing = state.servers.find(s => s.address === address);
            if (existing) {
                showToast('该地址已存在: ' + existing.name, 'error');
                return;
            }

            // Test connection first
            updateConnectionStatus('connecting');
            try {
                const res = await api.post('/api/connect', { address: address });
                if (!res.success) {
                    updateConnectionStatus('disconnected');
                    showToast('连接测试失败: ' + (res.message || ''), 'error');
                    return;
                }
            } catch (e) {
                updateConnectionStatus('disconnected');
                showToast('连接测试失败: ' + e.message, 'error');
                return;
            }

            // Save server
            const server = { name, address };
            state.servers.push(server);
            saveServers();
            renderServerList();

            // Clear form
            $('#server-name').value = '';
            $('#server-address').value = '';
            $('#add-server-form').style.display = 'none';

            // Auto-connect
            await connectServer(server);
        });

        // Cancel add server
        $('#btn-cancel-server').addEventListener('click', () => {
            $('#add-server-form').style.display = 'none';
            $('#server-name').value = '';
            $('#server-address').value = '';
        });

        // Enter key to save server
        $('#server-address').addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                $('#btn-save-server').click();
            }
        });

        // Refresh button
        $('#btn-refresh').addEventListener('click', () => {
            refreshTree();
        });

        // Create modal
        $('#btn-close-modal').addEventListener('click', closeCreateModal);
        $('#btn-cancel-create').addEventListener('click', closeCreateModal);
        $('#btn-confirm-create').addEventListener('click', confirmCreate);
        $('#create-modal').addEventListener('click', (e) => {
            if (e.target === $('#create-modal')) closeCreateModal();
        });

        // Enter key in create modal
        $('#create-name').addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                confirmCreate();
            }
        });
    }

    // Start
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
