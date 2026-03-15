/**
 * Main Application Scripts
 * Handles initialization, navigation, and core state management.
 */

// We will implement simpler modular logic for clarity
const App = {
    init() {
        console.log('App Initializing...');
        this.setupNavigation();
        this.setupModal();
        this.setupFiltersAndExport();
        this.setupKeyboardShortcuts();
        this.loadDashboard();
    },

    state: {
        transactions: [],
        view: 'dashboard'
    },

    setupNavigation() {
        const navItems = document.querySelectorAll('.nav-item');
        const views = document.querySelectorAll('.view');
        const pageTitle = document.getElementById('page-title');

        navItems.forEach(item => {
            item.addEventListener('click', (e) => {
                // Remove active class from all
                navItems.forEach(nav => {
                    nav.classList.remove('active');
                    nav.setAttribute('aria-current', 'false');
                });

                // Add active to clicked
                // Handle click on span vs button
                const button = e.target.closest('button');
                button.classList.add('active');
                button.setAttribute('aria-current', 'page');

                // Switch View
                const targetId = button.id.replace('nav-', '');
                this.switchView(targetId);

                // Update Title
                pageTitle.textContent = targetId.charAt(0).toUpperCase() + targetId.slice(1);

                // Focus the title for NVDA to announce page change
                pageTitle.setAttribute('tabindex', '-1');
                pageTitle.focus();
            });
        });
    },

    switchView(viewName) {
        document.querySelectorAll('.view').forEach(el => el.classList.add('hidden'));
        document.getElementById(`view-${viewName}`).classList.remove('hidden');

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
            const typeText = typeSelect.options[typeSelect.selectedIndex].text;
            this.announce(`Filtered to ${typeText} transactions. ${searchInput.value ? 'Search active.' : ''}`);
        };
        if (searchInput) searchInput.addEventListener('input', updateFilter);
        if (typeSelect) typeSelect.addEventListener('change', updateFilter);

        if (exportBtn) {
            exportBtn.addEventListener('click', () => this.exportToCSV());
        }
    },

    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            // Escape closes modal
            if (e.key === 'Escape') {
                const modal = document.getElementById('transaction-modal');
                if (!modal.classList.contains('hidden')) {
                    document.getElementById('btn-close-modal').click();
                }
            }
        });
    },

    exportToCSV() {
        const transactions = this.getTransactions();
        if (transactions.length === 0) {
            this.announce("No transactions to export.");
            return;
        }

        const headers = ['Date', 'Type', 'Category', 'Amount', 'Description'];
        const csvRows = [headers.join(',')];

        transactions.forEach(t => {
            const desc = `"${(t.description || '').replace(/"/g, '""')}"`;
            csvRows.push([t.date, t.type, t.category, t.amount, desc].join(','));
        });

        const csvString = csvRows.join('\n');
        const blob = new Blob([csvString], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = `transactions_${new Date().toISOString().split('T')[0]}.csv`;
        a.click();

        URL.revokeObjectURL(url);
        this.announce("Transactions exported to CSV.");
    },

    setupModal() {
        const modal = document.getElementById('transaction-modal');
        const btnAdd = document.getElementById('btn-add-transaction');
        const btnClose = document.getElementById('btn-close-modal');
        const btnCancel = document.getElementById('btn-cancel-modal');
        const form = document.getElementById('transaction-form');

        // Focus trap functionality
        const focusableElements = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

        const handleFocusTrap = (e) => {
            if (e.key !== 'Tab' || modal.classList.contains('hidden')) return;

            const focusableContent = modal.querySelectorAll(focusableElements);
            const firstFocusable = focusableContent[0];
            const lastFocusable = focusableContent[focusableContent.length - 1];

            if (e.shiftKey) { // Shift + Tab
                if (document.activeElement === firstFocusable) {
                    lastFocusable.focus();
                    e.preventDefault();
                }
            } else { // Tab
                if (document.activeElement === lastFocusable) {
                    firstFocusable.focus();
                    e.preventDefault();
                }
            }
        };

        const openModal = () => {
            modal.classList.remove('hidden');
            document.addEventListener('keydown', handleFocusTrap);

            // Hide background from screen readers so NVDA stays inside modal
            const mainContent = document.getElementById('main-content');
            const sidebar = document.querySelector('.sidebar');
            if (mainContent) mainContent.setAttribute('aria-hidden', 'true');
            if (sidebar) sidebar.setAttribute('aria-hidden', 'true');

            // Auto-focus amount field for faster entry
            setTimeout(() => {
                document.getElementById('t-amount').focus();
            }, 50);
        };

        const closeModal = () => {
            modal.classList.add('hidden');
            document.removeEventListener('keydown', handleFocusTrap);

            // Restore background visibility to screen readers
            const mainContent = document.getElementById('main-content');
            const sidebar = document.querySelector('.sidebar');
            if (mainContent) mainContent.removeAttribute('aria-hidden');
            if (sidebar) sidebar.removeAttribute('aria-hidden');

            btnAdd.focus(); // Return focus
            form.reset();
        };

        btnAdd.addEventListener('click', openModal);
        btnClose.addEventListener('click', closeModal);
        btnCancel.addEventListener('click', closeModal);

        form.addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleTransactionSubmit(new FormData(form));
            closeModal();
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

        this.saveTransaction(transaction);
        this.announce(`Transaction of $${transaction.amount} added.`);

        // Refresh current view
        if (!document.getElementById('view-dashboard').classList.contains('hidden')) {
            this.loadDashboard();
        } else {
            this.loadTransactions(); // If on list view
        }
    },

    saveTransaction(transaction) {
        const current = JSON.parse(localStorage.getItem('transactions') || '[]');
        current.unshift(transaction); // Add to top
        localStorage.setItem('transactions', JSON.stringify(current));
    },

    getTransactions() {
        return JSON.parse(localStorage.getItem('transactions') || '[]');
    },

    loadDashboard() {
        const transactions = this.getTransactions();

        // Calculate Totals
        let income = 0;
        let expense = 0;

        transactions.forEach(t => {
            if (t.type === 'income') income += t.amount;
            else expense += t.amount;
        });

        const total = income - expense;

        // Update DOM
        document.getElementById('total-balance').textContent = this.formatMoney(total);
        document.getElementById('total-income').textContent = '+' + this.formatMoney(income);
        document.getElementById('total-expense').textContent = '-' + this.formatMoney(expense);

        // Recent Activity (Top 5)
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
                    <td><span class="badge ${t.type}">${t.category}</span></td>
                    <td>${t.description}</td>
                    <td class="text-right ${t.type === 'income' ? 'positive' : 'negative'}">
                        ${t.type === 'income' ? '+' : '-'}${this.formatMoney(t.amount)}
                    </td>
                `;
                tbody.appendChild(row);
            });
        }
    },

    loadTransactions() {
        // Similar to dashboard but all transactions
        let transactions = this.getTransactions();

        // Apply Filters
        const searchInput = document.getElementById('filter-search');
        const typeSelect = document.getElementById('filter-type');

        if (searchInput && typeSelect) {
            const searchTerm = searchInput.value.toLowerCase();
            const filterType = typeSelect.value;

            transactions = transactions.filter(t => {
                const matchesSearch = (t.description || '').toLowerCase().includes(searchTerm) ||
                    (t.category || '').toLowerCase().includes(searchTerm);
                const matchesType = filterType === 'all' || t.type === filterType;
                return matchesSearch && matchesType;
            });
        }

        const tbody = document.getElementById('all-transactions-body');
        tbody.innerHTML = '';

        if (transactions.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="text-center empty-state" style="padding: 2rem; color: var(--text-muted);">No matching transactions found.</td></tr>';
            return;
        }

        transactions.forEach(t => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${this.formatDate(t.date)}</td>
                <td>${t.category}</td>
                <td>${t.description}</td>
                <td class="text-right ${t.type === 'income' ? 'positive' : 'negative'}">
                    ${t.type === 'income' ? '+' : '-'}${this.formatMoney(t.amount)}
                </td>
                <td class="text-center">
                    <button class="btn-icon delete-btn" aria-label="Delete transaction" data-id="${t.id}">🗑️</button>
                </td>
            `;
            tbody.appendChild(row);
        });

        // Add Delete Listeners
        document.querySelectorAll('.delete-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = e.target.closest('button').dataset.id;
                this.deleteTransaction(id);
            });
        });
    },

    deleteTransaction(id) {
        if (confirm('Are you sure you want to delete this transaction?')) {
            const current = this.getTransactions().filter(t => t.id !== id);
            localStorage.setItem('transactions', JSON.stringify(current));
            this.loadTransactions();
            this.announce("Transaction deleted.");
        }
    },

    formatMoney(amount) {
        return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(amount);
    },

    formatDate(dateStr) {
        if (!dateStr) return 'N/A';
        return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    },

    announce(message) {
        const announcer = document.getElementById('a11y-announcer');
        announcer.textContent = message;
        // clear after a moment so same message can be announced again if needed
        setTimeout(() => announcer.textContent = '', 3000);
    }
};

// Start App
document.addEventListener('DOMContentLoaded', () => {
    App.init();
});
