/**
 * Main Application Scripts
 * Handles mobile-first navigation, themes, and transaction management.
 */

const App = {
    init() {
        console.log('App Initializing...');
        this.setupTheme();
        this.setupNavigation();
        this.setupModal();
        this.setupFiltersAndExport();
        this.setupKeyboardShortcuts();
        this.loadDashboard();
        
        // Update version display
        const versionEl = document.getElementById('app-version');
        if (versionEl) versionEl.textContent = 'v1.1.0';
    },

    state: {
        view: 'dashboard'
    },

    setupTheme() {
        const themeToggle = document.getElementById('theme-toggle');
        const savedTheme = localStorage.getItem('theme') || 'light';
        
        document.documentElement.setAttribute('data-theme', savedTheme);
        if (themeToggle) {
            themeToggle.checked = savedTheme === 'dark';
            themeToggle.addEventListener('change', (e) => {
                const newTheme = e.target.checked ? 'dark' : 'light';
                document.documentElement.setAttribute('data-theme', newTheme);
                localStorage.setItem('theme', newTheme);
                this.announce(`Theme set to ${newTheme} mode.`);
            });
        }
    },

    setupNavigation() {
        const navItems = document.querySelectorAll('.nav-item');
        const pageTitle = document.getElementById('page-title');

        navItems.forEach(item => {
            item.addEventListener('click', (e) => {
                const button = e.target.closest('button');
                const targetId = button.id.replace('nav-', '');
                
                // Update active state in nav
                navItems.forEach(nav => {
                    nav.classList.remove('active');
                    nav.setAttribute('aria-current', 'false');
                });
                button.classList.add('active');
                button.setAttribute('aria-current', 'page');

                // Switch View
                this.switchView(targetId);

                // Update Title
                let title = targetId.charAt(0).toUpperCase() + targetId.slice(1);
                if (targetId === 'dashboard') title = 'Summary';
                if (targetId === 'transactions') title = 'History';
                pageTitle.textContent = title;
            });
        });
    },

    switchView(viewName) {
        document.querySelectorAll('.view').forEach(el => el.classList.add('hidden'));
        const targetView = document.getElementById(`view-${viewName}`);
        if (targetView) targetView.classList.remove('hidden');

        if (viewName === 'dashboard') {
            this.loadDashboard();
        } else if (viewName === 'transactions') {
            this.loadTransactions();
        }
    },

    setupFiltersAndExport() {
        const searchInput = document.getElementById('filter-search');
        const typeSelect = document.getElementById('filter-type');
        const exportBtn = document.getElementById('btn-export-csv');

        const updateFilter = () => {
            this.loadTransactions();
        };
        if (searchInput) searchInput.addEventListener('input', updateFilter);
        if (typeSelect) typeSelect.addEventListener('change', updateFilter);

        if (exportBtn) {
            exportBtn.addEventListener('click', () => this.exportToCSV());
        }
    },

    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                const modal = document.getElementById('transaction-modal');
                if (modal.classList.contains('active')) {
                    this.closeModal();
                }
            }
        });
    },

    exportToCSV() {
        const transactions = this.getTransactions();
        if (transactions.length === 0) return;

        const headers = ['Date', 'Type', 'Category', 'Amount', 'Description'];
        const csvRows = [headers.join(',')];

        transactions.forEach(t => {
            const desc = `"${(t.description || '').replace(/"/g, '""')}"`;
            csvRows.push([t.date, t.type, t.category, t.amount, desc].join(','));
        });

        const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `finance_tracker_${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        this.announce("File exported.");
    },

    setupModal() {
        const modal = document.getElementById('transaction-modal');
        const btnAdd = document.getElementById('btn-add-transaction');
        const btnClose = document.getElementById('btn-close-modal');
        const btnCancel = document.getElementById('btn-cancel-modal');
        const form = document.getElementById('transaction-form');

        const openModal = () => {
            modal.classList.add('active');
            document.getElementById('t-amount').focus();
        };

        this.closeModal = () => {
            modal.classList.remove('active');
            form.reset();
        };

        btnAdd.addEventListener('click', openModal);
        btnClose.addEventListener('click', this.closeModal);
        btnCancel.addEventListener('click', this.closeModal);

        form.addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleTransactionSubmit(new FormData(form));
            this.closeModal();
        });
    },

    handleTransactionSubmit(formData) {
        const transaction = {
            id: Date.now().toString(),
            type: formData.get('type'),
            amount: parseFloat(formData.get('amount')),
            date: formData.get('date'),
            category: formData.get('category'),
            description: formData.get('description')
        };

        const current = this.getTransactions();
        current.unshift(transaction);
        localStorage.setItem('transactions', JSON.stringify(current));

        this.loadDashboard();
        this.loadTransactions();
        this.announce(`Added ₹${transaction.amount}.`);
    },

    getTransactions() {
        return JSON.parse(localStorage.getItem('transactions') || '[]');
    },

    loadDashboard() {
        const transactions = this.getTransactions();
        let inc = 0, exp = 0;

        transactions.forEach(t => {
            if (t.type === 'income') inc += t.amount;
            else exp += t.amount;
        });

        document.getElementById('total-balance').textContent = this.formatMoney(inc - exp);
        document.getElementById('total-income').textContent = '+' + this.formatMoney(inc);
        document.getElementById('total-expense').textContent = '-' + this.formatMoney(exp);

        const tbody = document.getElementById('recent-transactions-body');
        tbody.innerHTML = '';
        const recent = transactions.slice(0, 5);

        if (recent.length === 0) {
            document.getElementById('no-transactions-msg').classList.remove('hidden');
        } else {
            document.getElementById('no-transactions-msg').classList.add('hidden');
            recent.forEach(t => {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${this.formatDate(t.date)}</td>
                    <td>${t.category}</td>
                    <td class="text-right ${t.type === 'income' ? 'positive' : 'negative'}">
                        ${t.type === 'income' ? '+' : '-'}${this.formatMoney(t.amount)}
                    </td>
                `;
                tbody.appendChild(row);
            });
        }
    },

    loadTransactions() {
        let transactions = this.getTransactions();
        const search = document.getElementById('filter-search').value.toLowerCase();
        const type = document.getElementById('filter-type').value;

        transactions = transactions.filter(t => {
            const matchesSearch = (t.description || '').toLowerCase().includes(search) || 
                                (t.category || '').toLowerCase().includes(search);
            const matchesType = type === 'all' || t.type === type;
            return matchesSearch && matchesType;
        });

        const tbody = document.getElementById('all-transactions-body');
        tbody.innerHTML = '';

        if (transactions.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" class="text-center" style="padding: 2rem; color: var(--text-muted);">Empty</td></tr>';
            return;
        }

        transactions.forEach(t => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${this.formatDate(t.date)}</td>
                <td>${t.category}</td>
                <td class="text-right ${t.type === 'income' ? 'positive' : 'negative'}">
                    ${t.type === 'income' ? '+' : '-'}${this.formatMoney(t.amount)}
                </td>
                <td class="text-center">
                    <button class="delete-btn" style="background:none; border:none; color:var(--danger); cursor:pointer;" data-id="${t.id}">✕</button>
                </td>
            `;
            tbody.appendChild(row);
        });

        document.querySelectorAll('.delete-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = e.target.dataset.id;
                if (confirm('Delete?')) {
                    const filtered = this.getTransactions().filter(t => t.id !== id);
                    localStorage.setItem('transactions', JSON.stringify(filtered));
                    this.loadTransactions();
                    this.loadDashboard();
                }
            });
        });
    },

    formatMoney(val) {
        return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(val);
    },

    formatDate(d) {
        if (!d) return '-';
        return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    },

    announce(msg) {
        const el = document.getElementById('a11y-announcer');
        if (el) {
            el.textContent = msg;
            setTimeout(() => el.textContent = '', 3000);
        }
    }
};

document.addEventListener('DOMContentLoaded', () => App.init());
