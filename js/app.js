/**
 * VCF Contact Manager - Main Application
 * 
 * Handles all UI interactions, API communication, and state management.
 */

(function () {
    'use strict';

    // =============================================
    // State Management
    // =============================================
    const state = {
        csrfToken: '',
        files: [],
        contacts: [],
        selectedFile: 'all',
        selectedContacts: new Set(),
        duplicateGroups: [],
        skippedGroups: new Set(),
        currentConflict: null,
        isLoading: false,
        dataTable: null  // DataTables instance reference
    };

    // =============================================
    // DOM Elements
    // =============================================
    const elements = {
        // Sidebar
        sidebar: document.getElementById('sidebar'),
        sidebarToggle: document.getElementById('sidebarToggle'),
        mobileMenuBtn: document.getElementById('mobileMenuBtn'),
        dropZone: document.getElementById('dropZone'),
        fileInput: document.getElementById('fileInput'),
        pasteBtn: document.getElementById('pasteBtn'),
        filesList: document.getElementById('filesList'),
        fileCount: document.getElementById('fileCount'),
        totalContactCount: document.getElementById('totalContactCount'),
        analyzeBtn: document.getElementById('analyzeBtn'),
        exportBtn: document.getElementById('exportBtn'),
        clearAllBtn: document.getElementById('clearAllBtn'),

        // Main content
        pageTitle: document.getElementById('pageTitle'),
        searchInput: document.getElementById('searchInput'),
        selectAll: document.getElementById('selectAll'),
        selectedCount: document.getElementById('selectedCount'),
        bulkActions: document.getElementById('bulkActions'),
        bulkDeleteBtn: document.getElementById('bulkDeleteBtn'),
        bulkMoveBtn: document.getElementById('bulkMoveBtn'),
        bulkExportBtn: document.getElementById('bulkExportBtn'),
        contactsBody: document.getElementById('contactsBody'),
        emptyState: document.getElementById('emptyState'),
        loadingState: document.getElementById('loadingState'),
        contactTable: document.getElementById('contactTable'),

        // Modals
        pasteModal: document.getElementById('pasteModal'),
        vcfTextarea: document.getElementById('vcfTextarea'),
        importPastedBtn: document.getElementById('importPastedBtn'),
        mergeModal: document.getElementById('mergeModal'),
        mergeSummary: document.getElementById('mergeSummary'),
        mergeGroups: document.getElementById('mergeGroups'),
        autoMergeBtn: document.getElementById('autoMergeBtn'),
        editModal: document.getElementById('editModal'),
        editForm: document.getElementById('editForm'),
        editContactId: document.getElementById('editContactId'),
        editName: document.getElementById('editName'),
        editPhonesContainer: document.getElementById('editPhonesContainer'),
        editEmailsContainer: document.getElementById('editEmailsContainer'),
        editOrg: document.getElementById('editOrg'),
        editTitle: document.getElementById('editTitle'),
        editNotes: document.getElementById('editNotes'),
        addPhoneBtn: document.getElementById('addPhoneBtn'),
        addEmailBtn: document.getElementById('addEmailBtn'),
        saveContactBtn: document.getElementById('saveContactBtn'),

        // Additional fields elements
        toggleAdditionalFields: document.getElementById('toggleAdditionalFields'),
        additionalFieldsSection: document.getElementById('additionalFieldsSection'),
        editPrefix: document.getElementById('editPrefix'),
        editMiddleName: document.getElementById('editMiddleName'),
        editSuffix: document.getElementById('editSuffix'),
        editNickname: document.getElementById('editNickname'),
        editDepartment: document.getElementById('editDepartment'),
        editBirthday: document.getElementById('editBirthday'),
        editAnniversary: document.getElementById('editAnniversary'),
        editGender: document.getElementById('editGender'),
        editTimezone: document.getElementById('editTimezone'),
        editGeo: document.getElementById('editGeo'),
        editUrlsContainer: document.getElementById('editUrlsContainer'),
        editAddressesContainer: document.getElementById('editAddressesContainer'),
        editSocialProfilesContainer: document.getElementById('editSocialProfilesContainer'),
        editImHandlesContainer: document.getElementById('editImHandlesContainer'),
        editRelatedContainer: document.getElementById('editRelatedContainer'),
        addUrlBtn: document.getElementById('addUrlBtn'),
        addAddressBtn: document.getElementById('addAddressBtn'),
        addSocialProfileBtn: document.getElementById('addSocialProfileBtn'),
        addImHandleBtn: document.getElementById('addImHandleBtn'),
        addRelatedBtn: document.getElementById('addRelatedBtn'),

        conflictModal: document.getElementById('conflictModal'),
        conflictContainer: document.getElementById('conflictContainer'),
        resolveConflictBtn: document.getElementById('resolveConflictBtn'),

        // Toast
        toastContainer: document.getElementById('toastContainer'),

        // Confirmation Modal
        confirmModal: document.getElementById('confirmModal'),
        confirmMessage: document.getElementById('confirmMessage'),
        confirmActionBtn: document.getElementById('confirmActionBtn'),

        // Preview Merge Modal
        previewMergeModal: document.getElementById('previewMergeModal'),
        previewMergeContent: document.getElementById('previewMergeContent'),
        confirmAutoMergeBtn: document.getElementById('confirmAutoMergeBtn'),
        previewMergeBtn: document.getElementById('previewMergeBtn'),

        // Add Contact
        addContactBtn: document.getElementById('addContactBtn'),
        sourceFileGroup: document.getElementById('sourceFileGroup'),
        editSourceFileSelect: document.getElementById('editSourceFileSelect'),
        editSourceFile: document.getElementById('editSourceFile'),
        editModalTitle: document.getElementById('editModalTitle')
    };

    // =============================================
    // API Communication
    // =============================================
    const api = {
        async init() {
            try {
                const response = await fetch('api/init.php');
                const data = await response.json();
                if (data.success) {
                    state.csrfToken = data.csrfToken;
                    state.files = data.files || [];
                    return data;
                }
                throw new Error(data.error || 'Failed to initialize');
            } catch (error) {
                console.error('Init error:', error);
                showToast('Failed to connect to server', 'error');
                return null;
            }
        },

        async request(endpoint, options = {}) {
            const defaultOptions = {
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': state.csrfToken
                }
            };

            const response = await fetch(`api/${endpoint}`, {
                ...defaultOptions,
                ...options,
                headers: { ...defaultOptions.headers, ...options.headers }
            });

            const data = await response.json();

            if (!response.ok || !data.success) {
                throw new Error(data.error || 'Request failed');
            }

            return data;
        },

        async uploadFiles(formData) {
            formData.append('csrf_token', state.csrfToken);

            const response = await fetch('api/upload.php', {
                method: 'POST',
                headers: {
                    'X-CSRF-TOKEN': state.csrfToken
                },
                body: formData
            });

            const data = await response.json();

            if (!data.success) {
                throw new Error(data.error || 'Upload failed');
            }

            return data;
        },

        async getContacts(fileId = null, search = null) {
            let url = 'api/contacts.php?';
            if (fileId && fileId !== 'all') url += `file_id=${encodeURIComponent(fileId)}&`;
            if (search) url += `search=${encodeURIComponent(search)}`;

            const response = await fetch(url);
            const data = await response.json();

            if (!data.success) {
                throw new Error(data.error || 'Failed to get contacts');
            }

            return data;
        },

        async updateContact(id, updates) {
            return this.request('contacts.php', {
                method: 'PUT',
                body: JSON.stringify({ id, ...updates })
            });
        },

        async deleteContacts(ids) {
            return this.request('contacts.php', {
                method: 'DELETE',
                body: JSON.stringify({ ids })
            });
        },

        async getFiles() {
            const response = await fetch('api/files.php');
            const data = await response.json();
            return data;
        },

        async deleteFile(id) {
            return this.request('files.php', {
                method: 'DELETE',
                body: JSON.stringify({ id })
            });
        },

        async renameFile(id, name) {
            return this.request('files.php', {
                method: 'PUT',
                body: JSON.stringify({ id, name })
            });
        },

        async analyze(threshold = 80) {
            return this.request('analyze.php', {
                method: 'POST',
                body: JSON.stringify({ threshold })
            });
        },

        async merge(ids, preferredValues = null) {
            return this.request('merge.php', {
                method: 'POST',
                body: JSON.stringify({ action: 'merge', ids, preferredValues })
            });
        },

        async autoMerge(groups) {
            return this.request('merge.php', {
                method: 'POST',
                body: JSON.stringify({ action: 'auto_merge', groups })
            });
        },

        async createContact(contactData) {
            return this.request('contacts.php', {
                method: 'POST',
                body: JSON.stringify(contactData)
            });
        }
    };

    // =============================================
    // UI Rendering
    // =============================================
    function renderFiles() {
        const allFilesItem = elements.filesList.querySelector('.file-item--all');
        elements.filesList.innerHTML = '';
        elements.filesList.appendChild(allFilesItem);

        state.files.forEach(file => {
            const li = document.createElement('li');
            li.className = `file-item${file.id === state.selectedFile ? ' active' : ''}`;
            li.dataset.fileId = file.id;
            li.setAttribute('role', 'option');
            li.setAttribute('aria-selected', file.id === state.selectedFile);
            li.innerHTML = `
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                    <polyline points="14 2 14 8 20 8"/>
                </svg>
                <span class="file-name" title="${escapeHtml(file.name)}">${escapeHtml(file.name)}</span>
                <span class="file-count">${file.contactCount}</span>
                <button class="btn btn-icon btn-ghost file-delete-btn" data-file-id="${file.id}" title="Remove source" aria-label="Remove ${escapeHtml(file.name)}">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;">
                        <line x1="18" y1="6" x2="6" y2="18"/>
                        <line x1="6" y1="6" x2="18" y2="18"/>
                    </svg>
                </button>
            `;
            elements.filesList.appendChild(li);
        });

        // Update counts
        elements.fileCount.textContent = state.files.length;
        const totalContacts = state.files.reduce((sum, f) => sum + f.contactCount, 0);
        elements.totalContactCount.textContent = totalContacts;

        // Update buttons
        elements.analyzeBtn.disabled = totalContacts === 0;
        elements.exportBtn.disabled = totalContacts === 0;
        if (elements.clearAllBtn) {
            elements.clearAllBtn.disabled = state.files.length === 0;
        }

        // Update "All Contacts" selection
        allFilesItem.classList.toggle('active', state.selectedFile === 'all');
        allFilesItem.setAttribute('aria-selected', state.selectedFile === 'all');
    }


    function renderContacts() {
        // Properly destroy existing DataTable if it exists
        if (state.dataTable) {
            state.dataTable.destroy();
            state.dataTable = null;
        }

        // Also check using DataTables API in case state wasn't synced
        if (typeof $ !== 'undefined' && $.fn.DataTable && $.fn.DataTable.isDataTable('#contactTable')) {
            $('#contactTable').DataTable().destroy();
        }

        if (state.contacts.length === 0) {
            elements.contactTable.style.display = 'none';
            elements.emptyState.style.display = 'flex';
            return;
        }

        elements.contactTable.style.display = 'table';
        elements.emptyState.style.display = 'none';

        // Build table body HTML
        elements.contactsBody.innerHTML = state.contacts.map(contact => `
            <tr data-contact-id="${contact.id}" class="${state.selectedContacts.has(contact.id) ? 'selected' : ''}">
                <td class="col-select">
                    <label class="checkbox-wrapper">
                        <input type="checkbox" class="contact-checkbox" 
                               ${state.selectedContacts.has(contact.id) ? 'checked' : ''}>
                        <span class="checkmark"></span>
                    </label>
                </td>
                <td class="col-name">
                    <span class="contact-name">${escapeHtml(contact.name || 'No Name')}</span>
                </td>
                <td class="col-phone">
                    ${renderMultiValue(contact.phones, 'value', 'type')}
                </td>
                <td class="col-email">
                    ${renderMultiValue(contact.emails, 'value', 'type')}
                </td>
                <td class="col-org">
                    <span class="contact-secondary">${escapeHtml(contact.organization || '-')}</span>
                </td>
                <td class="col-source">
                    <span class="source-badge" title="${escapeHtml(contact.sourceFileName || '')}">
                        ${escapeHtml(contact.sourceFileName || 'Unknown')}
                    </span>
                </td>
                <td class="col-actions">
                    <div class="row-actions">
                        <button class="btn btn-icon btn-ghost edit-btn" title="Edit contact">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                            </svg>
                        </button>
                        <button class="btn btn-icon btn-ghost delete-btn" title="Delete contact">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <polyline points="3 6 5 6 21 6"/>
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                            </svg>
                        </button>
                    </div>
                </td>
            </tr>
        `).join('');

        // Initialize DataTables with our custom configuration
        initDataTable();

        updateSelectionUI();
    }

    /**
     * Initialize DataTables on the contact table
     * This handles pagination, sorting, and responsive layout
     */
    function initDataTable() {
        // Only initialize if jQuery and DataTables are loaded
        if (typeof $ === 'undefined' || typeof $.fn.DataTable === 'undefined') {
            console.warn('DataTables or jQuery not loaded, skipping initialization');
            return;
        }

        // Check if DataTable is already initialized on this table and destroy it
        if ($.fn.DataTable.isDataTable('#contactTable')) {
            $('#contactTable').DataTable().destroy();
        }

        // Initialize DataTable with immediate display
        state.dataTable = $('#contactTable').DataTable({
            // Pagination settings - show 25 entries immediately
            paging: true,
            pageLength: 25,
            displayStart: 0,
            lengthMenu: [[10, 25, 50, 100, -1], [10, 25, 50, 100, "All"]],

            // Don't defer rendering - draw immediately
            deferRender: false,

            // Disable initial sorting (we handle contact order from API)
            order: [],

            // Column definitions
            columnDefs: [
                { orderable: false, targets: [0, 6] }, // Disable sort on checkbox and actions columns
                { searchable: false, targets: [0, 6] }, // Don't search checkbox/actions
                { responsivePriority: 1, targets: 1 }, // Name highest priority
                { responsivePriority: 2, targets: 2 }, // Phone second priority
                { responsivePriority: 3, targets: 3 }, // Email third priority
                { responsivePriority: 10001, targets: [4, 5] } // Org and Source hidden first
            ],

            // Responsive extension
            responsive: true,

            // Interface language
            language: {
                search: "",
                searchPlaceholder: "Filter within results...",
                lengthMenu: "Show _MENU_ contacts",
                info: "Showing _START_ to _END_ of _TOTAL_ contacts",
                infoEmpty: "No contacts",
                infoFiltered: "(filtered from _MAX_)",
                paginate: {
                    first: "«",
                    last: "»",
                    next: "›",
                    previous: "‹"
                },
                emptyTable: "No contacts found"
            },

            // Customize DOM structure for better styling
            dom: '<"datatable-header"lf>rt<"datatable-footer"ip>',

            // Disable state saving (we manage state via our app)
            stateSave: false,

            // Initialize callback - force redraw after init
            initComplete: function () {
                // Force a draw to ensure pagination is applied
                this.api().draw();
            },

            // Handle responsive events
            drawCallback: function () {
                // Ensure row actions are still visible after redraw
                updateRowActionsVisibility();
            }
        });

        // Handle DataTables search to sync with our search input
        state.dataTable.on('search.dt', function () {
            updateSelectionUIForCurrentPage();
        });

        // Preserve selection across pagination
        state.dataTable.on('draw.dt', function () {
            updateSelectionUIForCurrentPage();
        });
    }

    /**
     * Update selection UI considering DataTables pagination
     */
    function updateSelectionUIForCurrentPage() {
        // Re-apply selection states after DataTable redraw
        if (!state.dataTable) return;

        elements.contactsBody.querySelectorAll('tr[data-contact-id]').forEach(row => {
            const contactId = row.dataset.contactId;
            const checkbox = row.querySelector('.contact-checkbox');
            if (checkbox) {
                checkbox.checked = state.selectedContacts.has(contactId);
                row.classList.toggle('selected', state.selectedContacts.has(contactId));
            }
        });

        updateSelectionUI();
    }

    /**
     * Ensure row actions are properly visible after DataTables operations
     */
    function updateRowActionsVisibility() {
        // On mobile, make sure actions are always somewhat visible
        if (window.innerWidth <= 768) {
            document.querySelectorAll('.row-actions').forEach(actions => {
                actions.style.opacity = '1';
            });
        }
    }

    /**
     * Get all contact IDs from all pages (not just current page)
     * This is essential for batch operations to work correctly with DataTables
     */
    function getAllContactIds() {
        return state.contacts.map(c => c.id);
    }

    /**
     * Get selected contact IDs - this works across all pages
     */
    function getSelectedContactIds() {
        return Array.from(state.selectedContacts);
    }

    function renderMultiValue(items, valueKey, typeKey) {
        if (!items || items.length === 0) {
            return '<span class="contact-secondary">-</span>';
        }

        if (items.length === 1) {
            return `<span class="contact-secondary">${escapeHtml(items[0][valueKey])}</span>`;
        }

        return `
            <div class="multi-value">
                ${items.slice(0, 2).map(item => `
                    <div class="multi-value-item">
                        <span class="contact-secondary">${escapeHtml(item[valueKey])}</span>
                        ${item[typeKey] ? `<span class="value-type">${escapeHtml(item[typeKey])}</span>` : ''}
                    </div>
                `).join('')}
                ${items.length > 2 ? `<span class="contact-secondary">+${items.length - 2} more</span>` : ''}
            </div>
        `;
    }

    function updateSelectionUI() {
        const count = state.selectedContacts.size;
        elements.selectedCount.textContent = `${count} selected`;
        elements.bulkActions.style.display = count > 0 ? 'flex' : 'none';
        elements.selectAll.checked = count === state.contacts.length && count > 0;
        elements.selectAll.indeterminate = count > 0 && count < state.contacts.length;
    }

    function renderMergeModal(data) {
        // Handle both old format and new 5-category format
        const categories = data.categories || {
            exactMatch: data.autoMergeable || [],
            sameNumber: [],
            sameName: [],
            similarPhone: [],
            sameEmail: []
        };

        const { exactMatch, sameNumber, sameName, similarPhone, sameEmail } = categories;
        const stats = data.stats || {};

        // Store for auto-merge (only exactMatch is auto-mergeable)
        state.duplicateGroups = {
            autoMergeable: exactMatch,
            conflicts: [...sameNumber, ...sameName, ...similarPhone],
            categories
        };

        const totalGroups = exactMatch.length + sameNumber.length + sameName.length + similarPhone.length + sameEmail.length;

        elements.mergeSummary.innerHTML = `
            <h4>${totalGroups} Duplicate Groups Found</h4>
            <div class="merge-stats" style="display: flex; gap: 16px; flex-wrap: wrap; margin-top: 8px; font-size: 13px;">
                ${exactMatch.length > 0 ? `<span style="color: var(--color-success);">✅ ${exactMatch.length} Safe to Auto-Merge</span>` : ''}
                ${sameNumber.length > 0 ? `<span style="color: var(--color-warning);">📱 ${sameNumber.length} Same Number</span>` : ''}
                ${sameName.length > 0 ? `<span style="color: var(--color-warning);">👤 ${sameName.length} Same Name</span>` : ''}
                ${similarPhone.length > 0 ? `<span style="color: var(--color-info);">🔗 ${similarPhone.length} Similar Phone</span>` : ''}
                ${sameEmail.length > 0 ? `<span style="color: var(--color-text-muted);">📧 ${sameEmail.length} Same Email</span>` : ''}
            </div>
        `;

        let groupsHtml = '';

        // Category 1: Exact Match (Auto-mergeable)
        if (exactMatch.length > 0) {
            groupsHtml += `
                <div class="merge-category" data-category="exactMatch">
                    <h4 style="margin-bottom: var(--spacing-md); color: var(--color-success);">
                        ✅ Safe to Auto-Merge (${exactMatch.length})
                        <small style="font-weight: normal; color: var(--color-text-muted); display: block; font-size: 12px; margin-top: 4px;">
                            Same name AND phone number - will combine all other details
                        </small>
                    </h4>
                    ${exactMatch.map((group, i) => renderMergeGroup(group, i, 'exactMatch')).join('')}
                </div>
            `;
        }

        // Category 2: Same Phone, Different Name  
        if (sameNumber.length > 0) {
            groupsHtml += `
                <div class="merge-category" data-category="sameNumber">
                    <h4 style="margin: var(--spacing-lg) 0 var(--spacing-md); color: var(--color-warning);">
                        📱 Same Phone, Different Names (${sameNumber.length})
                        <small style="font-weight: normal; color: var(--color-text-muted); display: block; font-size: 12px; margin-top: 4px;">
                            Choose which name to keep, or enter a custom name
                        </small>
                    </h4>
                    ${sameNumber.map((group, i) => renderMergeGroup(group, i, 'sameNumber')).join('')}
                </div>
            `;
        }

        // Category 3: Same Name, Different Phones
        if (sameName.length > 0) {
            groupsHtml += `
                <div class="merge-category" data-category="sameName">
                    <h4 style="margin: var(--spacing-lg) 0 var(--spacing-md); color: var(--color-warning);">
                        👤 Same Name, Different Phones (${sameName.length})
                        <small style="font-weight: normal; color: var(--color-text-muted); display: block; font-size: 12px; margin-top: 4px;">
                            Merge to combine all phone numbers into one contact
                        </small>
                    </h4>
                    ${sameName.map((group, i) => renderMergeGroup(group, i, 'sameName')).join('')}
                </div>
            `;
        }

        // Category 4: Similar Phone (spacing/country code differences)
        if (similarPhone.length > 0) {
            groupsHtml += `
                <div class="merge-category" data-category="similarPhone">
                    <h4 style="margin: var(--spacing-lg) 0 var(--spacing-md); color: var(--color-info);">
                        🔗 Similar Phone Numbers (${similarPhone.length})
                        <small style="font-weight: normal; color: var(--color-text-muted); display: block; font-size: 12px; margin-top: 4px;">
                            Phones differ only by formatting or country code - will prefer version with country code
                        </small>
                    </h4>
                    ${similarPhone.map((group, i) => renderMergeGroup(group, i, 'similarPhone')).join('')}
                </div>
            `;
        }

        // Category 5: Same Email
        if (sameEmail.length > 0) {
            groupsHtml += `
                <div class="merge-category" data-category="sameEmail">
                    <h4 style="margin: var(--spacing-lg) 0 var(--spacing-md); color: var(--color-text-muted);">
                        📧 Same Email Address (${sameEmail.length})
                        <small style="font-weight: normal; color: var(--color-text-muted); display: block; font-size: 12px; margin-top: 4px;">
                            Consider editing or removing duplicate emails
                        </small>
                    </h4>
                    ${sameEmail.map((group, i) => renderMergeGroup(group, i, 'sameEmail')).join('')}
                </div>
            `;
        }

        elements.mergeGroups.innerHTML = groupsHtml;
        elements.autoMergeBtn.disabled = exactMatch.length === 0;

        // Update preview button state
        if (elements.previewMergeBtn) {
            elements.previewMergeBtn.disabled = exactMatch.length === 0;
        }

        openModal(elements.mergeModal);
    }

    function renderMergeGroup(group, index, type) {
        // Labels based on new matchType values from API
        const matchLabels = {
            'exact': '✅ Exact Match',
            'samePhone': '📱 Same Phone',
            'sameName': '👤 Same Name',
            'similarPhone': '🔗 Similar Phone',
            'sameEmail': '📧 Same Email',
            'phone': '📱 Phone Match',
            'email': '📧 Email Match',
            'fuzzy': '🔤 Similar Names'
        };

        const matchLabel = matchLabels[group.matchType] || matchLabels[type] || 'Match';

        // Determine what action button to show
        const showResolveBtn = type === 'sameNumber' || type === 'conflict';
        const showMergeBtn = type === 'sameName' || type === 'similarPhone';
        const showInfoOnly = type === 'sameEmail';
        const isAutoMergeable = type === 'exactMatch' || type === 'auto';

        // Generate unique group key for skip tracking
        const groupKey = `${type}_${index}`;
        const isSkipped = state.skippedGroups.has(groupKey);

        let actionBtnHtml = '';
        if (isAutoMergeable) {
            // Add skip checkbox for auto-mergeable groups
            actionBtnHtml = `
                <label class="skip-group-label" style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                    <input type="checkbox" class="skip-group-checkbox" data-group-key="${groupKey}" ${isSkipped ? 'checked' : ''}>
                    <span style="font-size: 12px; color: ${isSkipped ? 'var(--color-warning)' : 'var(--color-text-muted)'};">
                        ${isSkipped ? 'Skipped' : 'Skip this group'}
                    </span>
                </label>
            `;
        } else if (showResolveBtn) {
            actionBtnHtml = `<button class="btn btn-sm btn-warning resolve-btn">Choose Name</button>`;
        } else if (showMergeBtn) {
            actionBtnHtml = `<button class="btn btn-sm btn-primary merge-group-btn">Merge</button>`;
        } else if (showInfoOnly) {
            actionBtnHtml = `<button class="btn btn-sm btn-ghost edit-contact-btn">Edit Contacts</button>`;
        }

        const skippedStyle = isSkipped ? 'opacity: 0.5; border-color: var(--color-warning);' : '';

        return `
            <div class="merge-group ${isSkipped ? 'merge-group--skipped' : ''}" data-group-index="${index}" data-group-type="${type}" data-group-key="${groupKey}" style="${skippedStyle}">
                <div class="merge-group-header">
                    <div class="merge-group-title">
                        <span class="match-type">${matchLabel}</span>
                        <span>${group.contacts.length} contacts</span>
                        ${group.preferredPhone ? `<span style="font-size: 11px; color: var(--color-success);">→ ${escapeHtml(group.preferredPhone)}</span>` : ''}
                    </div>
                    ${actionBtnHtml}
                </div>
                <div class="merge-group-contacts">
                    ${group.contacts.map(c => `
                        <div class="merge-contact-card" data-contact-id="${c.id}">
                            <h5>${escapeHtml(c.name || 'No Name')}</h5>
                            ${c.phones && c.phones.length > 0 ? `<p>📱 ${escapeHtml(c.phones[0].value)}</p>` : ''}
                            ${c.emails && c.emails.length > 0 ? `<p>📧 ${escapeHtml(c.emails[0].value)}</p>` : ''}
                            <p style="font-size: 11px; opacity: 0.6;">${escapeHtml(c.sourceFileName || '')}</p>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }

    function renderEditModal(contact) {
        elements.editContactId.value = contact.id;
        elements.editName.value = contact.name || '';
        elements.editOrg.value = contact.organization || '';
        elements.editTitle.value = contact.title || '';
        elements.editNotes.value = contact.notes || '';

        // Hide source file selector when editing
        if (elements.sourceFileGroup) {
            elements.sourceFileGroup.style.display = 'none';
        }

        // Reset modal title
        if (elements.editModalTitle) {
            elements.editModalTitle.textContent = 'Edit Contact';
        }

        // Render phones - use 'mobile' as default type if not specified
        elements.editPhonesContainer.innerHTML = '';
        const phones = contact.phones.length > 0 ? contact.phones : [{ value: '', type: 'mobile' }];
        phones.forEach((phone, i) => addPhoneInput(phone.value, phone.type || 'mobile'));

        // Render emails - use 'home' as default type if not specified
        elements.editEmailsContainer.innerHTML = '';
        const emails = contact.emails.length > 0 ? contact.emails : [{ value: '', type: 'home' }];
        emails.forEach((email, i) => addEmailInput(email.value, email.type || 'home'));

        // Populate additional fields
        if (elements.editPrefix) elements.editPrefix.value = contact.prefix || '';
        if (elements.editMiddleName) elements.editMiddleName.value = contact.middleName || '';
        if (elements.editSuffix) elements.editSuffix.value = contact.suffix || '';
        if (elements.editNickname) elements.editNickname.value = contact.nickname || '';
        if (elements.editDepartment) elements.editDepartment.value = contact.department || '';
        if (elements.editBirthday) elements.editBirthday.value = contact.birthday || '';
        if (elements.editAnniversary) elements.editAnniversary.value = contact.anniversary || '';
        if (elements.editGender) elements.editGender.value = contact.gender || '';
        if (elements.editTimezone) elements.editTimezone.value = contact.timezone || '';
        if (elements.editGeo) elements.editGeo.value = contact.geo || '';

        // Render URLs
        if (elements.editUrlsContainer) {
            elements.editUrlsContainer.innerHTML = '';
            const urls = contact.urls || [];
            urls.forEach(url => addUrlInput(url.value, url.type));
        }

        // Render Addresses
        if (elements.editAddressesContainer) {
            elements.editAddressesContainer.innerHTML = '';
            const addresses = contact.addresses || [];
            addresses.forEach(addr => addAddressInput(addr));
        }

        // Render Social Profiles
        if (elements.editSocialProfilesContainer) {
            elements.editSocialProfilesContainer.innerHTML = '';
            const socialProfiles = contact.socialProfiles || [];
            socialProfiles.forEach(sp => addSocialProfileInput(sp.value, sp.type));
        }

        // Render IM Handles
        if (elements.editImHandlesContainer) {
            elements.editImHandlesContainer.innerHTML = '';
            const imHandles = contact.imHandles || [];
            imHandles.forEach(im => addImHandleInput(im.value, im.type));
        }

        // Render Related Contacts
        if (elements.editRelatedContainer) {
            elements.editRelatedContainer.innerHTML = '';
            const related = contact.related || [];
            related.forEach(rel => addRelatedInput(rel.value, rel.type));
        }

        // Check if any additional fields have data - if so, auto-expand
        const hasAdditionalData = !!(
            contact.prefix ||
            contact.middleName ||
            contact.suffix ||
            contact.nickname ||
            contact.department ||
            contact.birthday ||
            contact.anniversary ||
            contact.gender ||
            contact.timezone ||
            contact.geo ||
            (contact.urls && contact.urls.length > 0) ||
            (contact.addresses && contact.addresses.length > 0) ||
            (contact.socialProfiles && contact.socialProfiles.length > 0) ||
            (contact.imHandles && contact.imHandles.length > 0) ||
            (contact.related && contact.related.length > 0)
        );

        // Set additional fields visibility
        if (elements.additionalFieldsSection && elements.toggleAdditionalFields) {
            if (hasAdditionalData) {
                elements.additionalFieldsSection.style.display = 'block';
                elements.toggleAdditionalFields.parentElement.classList.add('expanded');
                elements.toggleAdditionalFields.innerHTML = '<span class="toggle-icon">▼</span> Hide Additional Fields';
            } else {
                elements.additionalFieldsSection.style.display = 'none';
                elements.toggleAdditionalFields.parentElement.classList.remove('expanded');
                elements.toggleAdditionalFields.innerHTML = '<span class="toggle-icon">▶</span> Show Additional Fields';
            }
        }

        openModal(elements.editModal);
    }

    function addPhoneInput(value = '', type = 'mobile') {
        // Normalize type - default to 'mobile' if not recognized
        const validTypes = ['mobile', 'home', 'work', 'other'];
        const normalizedType = validTypes.includes(type?.toLowerCase()) ? type.toLowerCase() : 'mobile';

        const row = document.createElement('div');
        row.className = 'multi-input-row';
        row.innerHTML = `
            <input type="tel" class="form-control phone-value" value="${escapeHtml(value)}" placeholder="Phone number">
            <select class="phone-type">
                <option value="mobile" ${normalizedType === 'mobile' ? 'selected' : ''}>Mobile</option>
                <option value="home" ${normalizedType === 'home' ? 'selected' : ''}>Home</option>
                <option value="work" ${normalizedType === 'work' ? 'selected' : ''}>Work</option>
                <option value="other" ${normalizedType === 'other' ? 'selected' : ''}>Other</option>
            </select>
            <button type="button" class="remove-input-btn" aria-label="Remove phone">×</button>
        `;
        elements.editPhonesContainer.appendChild(row);
    }

    function addEmailInput(value = '', type = 'home') {
        // Normalize type - default to 'home' if not recognized
        const validTypes = ['home', 'work', 'other'];
        const normalizedType = validTypes.includes(type?.toLowerCase()) ? type.toLowerCase() : 'home';

        const row = document.createElement('div');
        row.className = 'multi-input-row';
        row.innerHTML = `
            <input type="email" class="form-control email-value" value="${escapeHtml(value)}" placeholder="Email address">
            <select class="email-type">
                <option value="home" ${normalizedType === 'home' ? 'selected' : ''}>Home</option>
                <option value="work" ${normalizedType === 'work' ? 'selected' : ''}>Work</option>
                <option value="other" ${normalizedType === 'other' ? 'selected' : ''}>Other</option>
            </select>
            <button type="button" class="remove-input-btn" aria-label="Remove email">×</button>
        `;
        elements.editEmailsContainer.appendChild(row);
    }

    function addUrlInput(value = '', type = 'website') {
        if (!elements.editUrlsContainer) return;
        const row = document.createElement('div');
        row.className = 'multi-input-row';
        row.innerHTML = `
            <input type="url" class="form-control url-value" value="${escapeHtml(value)}" placeholder="https://example.com">
            <select class="url-type">
                <option value="website" ${type === 'website' ? 'selected' : ''}>Website</option>
                <option value="work" ${type === 'work' ? 'selected' : ''}>Work</option>
                <option value="home" ${type === 'home' ? 'selected' : ''}>Home</option>
                <option value="blog" ${type === 'blog' ? 'selected' : ''}>Blog</option>
                <option value="other" ${type === 'other' ? 'selected' : ''}>Other</option>
            </select>
            <button type="button" class="remove-input-btn" aria-label="Remove URL">×</button>
        `;
        elements.editUrlsContainer.appendChild(row);
    }

    function addAddressInput(addr = {}) {
        if (!elements.editAddressesContainer) return;
        const type = addr.type || 'home';
        const card = document.createElement('div');
        card.className = 'address-card';
        card.innerHTML = `
            <div class="address-type-row">
                <select class="addr-type">
                    <option value="home" ${type === 'home' ? 'selected' : ''}>Home</option>
                    <option value="work" ${type === 'work' ? 'selected' : ''}>Work</option>
                    <option value="other" ${type === 'other' ? 'selected' : ''}>Other</option>
                </select>
                <button type="button" class="remove-input-btn" aria-label="Remove address">×</button>
            </div>
            <div class="address-fields">
                <input type="text" class="form-control addr-street full-width" value="${escapeHtml(addr.street || '')}" placeholder="Street">
                <input type="text" class="form-control addr-city" value="${escapeHtml(addr.city || '')}" placeholder="City">
                <input type="text" class="form-control addr-region" value="${escapeHtml(addr.region || '')}" placeholder="State/Region">
                <input type="text" class="form-control addr-postal" value="${escapeHtml(addr.postalCode || '')}" placeholder="Postal Code">
                <input type="text" class="form-control addr-country" value="${escapeHtml(addr.country || '')}" placeholder="Country">
            </div>
        `;
        elements.editAddressesContainer.appendChild(card);
    }

    function addSocialProfileInput(value = '', type = 'twitter') {
        if (!elements.editSocialProfilesContainer) return;
        const normalizedType = type?.toLowerCase() || 'twitter';
        const row = document.createElement('div');
        row.className = 'multi-input-row';
        row.innerHTML = `
            <select class="social-type">
                <option value="twitter" ${normalizedType === 'twitter' ? 'selected' : ''}>Twitter/X</option>
                <option value="facebook" ${normalizedType === 'facebook' ? 'selected' : ''}>Facebook</option>
                <option value="instagram" ${normalizedType === 'instagram' ? 'selected' : ''}>Instagram</option>
                <option value="linkedin" ${normalizedType === 'linkedin' ? 'selected' : ''}>LinkedIn</option>
                <option value="tiktok" ${normalizedType === 'tiktok' ? 'selected' : ''}>TikTok</option>
                <option value="youtube" ${normalizedType === 'youtube' ? 'selected' : ''}>YouTube</option>
                <option value="other" ${normalizedType === 'other' ? 'selected' : ''}>Other</option>
            </select>
            <input type="text" class="form-control social-value" value="${escapeHtml(value)}" placeholder="@username or URL">
            <button type="button" class="remove-input-btn" aria-label="Remove social">×</button>
        `;
        elements.editSocialProfilesContainer.appendChild(row);
    }

    function addImHandleInput(value = '', type = 'skype') {
        if (!elements.editImHandlesContainer) return;
        const normalizedType = type?.toLowerCase() || 'skype';
        const row = document.createElement('div');
        row.className = 'multi-input-row';
        row.innerHTML = `
            <select class="im-type">
                <option value="skype" ${normalizedType === 'skype' ? 'selected' : ''}>Skype</option>
                <option value="whatsapp" ${normalizedType === 'whatsapp' ? 'selected' : ''}>WhatsApp</option>
                <option value="telegram" ${normalizedType === 'telegram' ? 'selected' : ''}>Telegram</option>
                <option value="discord" ${normalizedType === 'discord' ? 'selected' : ''}>Discord</option>
                <option value="jabber" ${normalizedType === 'jabber' ? 'selected' : ''}>Jabber/XMPP</option>
                <option value="impp" ${normalizedType === 'impp' ? 'selected' : ''}>IMPP</option>
                <option value="other" ${normalizedType === 'other' ? 'selected' : ''}>Other</option>
            </select>
            <input type="text" class="form-control im-value" value="${escapeHtml(value)}" placeholder="Username or ID">
            <button type="button" class="remove-input-btn" aria-label="Remove IM">×</button>
        `;
        elements.editImHandlesContainer.appendChild(row);
    }

    function addRelatedInput(value = '', type = 'spouse') {
        if (!elements.editRelatedContainer) return;
        const normalizedType = type?.toLowerCase() || 'spouse';
        const row = document.createElement('div');
        row.className = 'multi-input-row';
        row.innerHTML = `
            <select class="related-type">
                <option value="spouse" ${normalizedType === 'spouse' ? 'selected' : ''}>Spouse</option>
                <option value="child" ${normalizedType === 'child' ? 'selected' : ''}>Child</option>
                <option value="parent" ${normalizedType === 'parent' ? 'selected' : ''}>Parent</option>
                <option value="sibling" ${normalizedType === 'sibling' ? 'selected' : ''}>Sibling</option>
                <option value="friend" ${normalizedType === 'friend' ? 'selected' : ''}>Friend</option>
                <option value="assistant" ${normalizedType === 'assistant' ? 'selected' : ''}>Assistant</option>
                <option value="manager" ${normalizedType === 'manager' ? 'selected' : ''}>Manager</option>
                <option value="contact" ${normalizedType === 'contact' ? 'selected' : ''}>Contact</option>
                <option value="other" ${normalizedType === 'other' ? 'selected' : ''}>Other</option>
            </select>
            <input type="text" class="form-control related-value" value="${escapeHtml(value)}" placeholder="Name">
            <button type="button" class="remove-input-btn" aria-label="Remove related">×</button>
        `;
        elements.editRelatedContainer.appendChild(row);
    }

    function renderConflictModal(group) {
        state.currentConflict = group;
        const contacts = group.contacts;

        // Find conflicting fields
        const fields = ['name', 'organization', 'title'];
        let html = '';

        fields.forEach(field => {
            const values = [...new Set(contacts.map(c => c[field]).filter(v => v))];
            if (values.length > 1) {
                html += `
                    <div class="conflict-field">
                        <div class="conflict-field-title">${field}</div>
                        <div class="conflict-options">
                            ${values.map((value, i) => `
                                <label class="conflict-option">
                                    <input type="radio" name="conflict_${field}" value="${escapeHtml(value)}" ${i === 0 ? 'checked' : ''}>
                                    <span>${escapeHtml(value)}</span>
                                </label>
                            `).join('')}
                            <label class="conflict-option">
                                <input type="radio" name="conflict_${field}" value="__custom__">
                                <input type="text" class="form-control custom-value" placeholder="Custom value" style="flex:1; margin-left: 8px;">
                            </label>
                        </div>
                    </div>
                `;
            }
        });

        elements.conflictContainer.innerHTML = html || '<p>No conflicts to resolve. Contacts will be merged.</p>';
        openModal(elements.conflictModal);
    }

    // =============================================
    // Modal Helpers
    // =============================================
    function openModal(modal) {
        modal.classList.add('active');
        document.body.style.overflow = 'hidden';

        // Focus first focusable element
        const focusable = modal.querySelector('button, input, textarea, select');
        if (focusable) focusable.focus();
    }

    function closeModal(modal) {
        modal.classList.remove('active');
        document.body.style.overflow = '';
    }

    function closeAllModals() {
        document.querySelectorAll('.modal.active').forEach(modal => closeModal(modal));
    }

    // =============================================
    // Toast Notifications
    // =============================================
    function showToast(message, type = 'success') {
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;

        const icons = {
            success: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
            error: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
            warning: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>'
        };

        toast.innerHTML = `
            <span class="toast-icon">${icons[type] || icons.success}</span>
            <span class="toast-message">${escapeHtml(message)}</span>
            <button class="toast-close">&times;</button>
        `;

        elements.toastContainer.appendChild(toast);

        // Auto remove after 4 seconds
        const timeout = setTimeout(() => removeToast(toast), 4000);

        toast.querySelector('.toast-close').addEventListener('click', () => {
            clearTimeout(timeout);
            removeToast(toast);
        });
    }

    function removeToast(toast) {
        toast.classList.add('toast-out');
        setTimeout(() => toast.remove(), 200);
    }

    // =============================================
    // Utility Functions
    // =============================================
    function escapeHtml(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    function debounce(func, wait) {
        let timeout;
        return function (...args) {
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(this, args), wait);
        };
    }

    function setLoading(isLoading) {
        state.isLoading = isLoading;
        elements.loadingState.style.display = isLoading ? 'flex' : 'none';
        if (isLoading) {
            elements.contactTable.style.display = 'none';
            elements.emptyState.style.display = 'none';
        }
    }

    // =============================================
    // Data Operations
    // =============================================
    async function loadContacts() {
        setLoading(true);
        try {
            const fileId = state.selectedFile === 'all' ? null : state.selectedFile;
            const search = elements.searchInput.value.trim() || null;

            const data = await api.getContacts(fileId, search);
            state.contacts = data.contacts || [];
            state.files = data.files || state.files;

            renderFiles();
            renderContacts();
        } catch (error) {
            console.error('Load contacts error:', error);
            showToast(error.message, 'error');
        } finally {
            setLoading(false);
        }
    }

    /**
     * Load contacts silently without showing loading indicator
     * Used when refreshing data in the background while modal is open
     */
    async function loadContactsSilently() {
        try {
            const fileId = state.selectedFile === 'all' ? null : state.selectedFile;
            const search = elements.searchInput.value.trim() || null;

            const data = await api.getContacts(fileId, search);
            state.contacts = data.contacts || [];
            state.files = data.files || state.files;

            // Update file counts in sidebar
            renderFiles();
            // Note: We don't re-render contacts table to avoid disrupting the merge modal
        } catch (error) {
            console.error('Silent load contacts error:', error);
        }
    }

    /**
     * Update the merge summary counts after a group has been processed
     */
    function updateMergeSummary() {
        const categories = state.duplicateGroups.categories;
        if (!categories) return;

        const exactMatch = categories.exactMatch?.length || 0;
        const sameNumber = categories.sameNumber?.length || 0;
        const sameName = categories.sameName?.length || 0;
        const similarPhone = categories.similarPhone?.length || 0;
        const sameEmail = categories.sameEmail?.length || 0;

        const totalGroups = exactMatch + sameNumber + sameName + similarPhone + sameEmail;

        // Update the summary text
        if (elements.mergeSummary) {
            elements.mergeSummary.innerHTML = `
                <h4>${totalGroups} Duplicate Groups Remaining</h4>
                <div class="merge-stats" style="display: flex; gap: 16px; flex-wrap: wrap; margin-top: 8px; font-size: 13px;">
                    ${exactMatch > 0 ? `<span style="color: var(--color-success);">✅ ${exactMatch} Safe to Auto-Merge</span>` : ''}
                    ${sameNumber > 0 ? `<span style="color: var(--color-warning);">📱 ${sameNumber} Same Number</span>` : ''}
                    ${sameName > 0 ? `<span style="color: var(--color-warning);">👤 ${sameName} Same Name</span>` : ''}
                    ${similarPhone > 0 ? `<span style="color: var(--color-info);">🔗 ${similarPhone} Similar Phone</span>` : ''}
                    ${sameEmail > 0 ? `<span style="color: var(--color-text-muted);">📧 ${sameEmail} Same Email</span>` : ''}
                </div>
            `;
        }

        // Update auto-merge button state
        if (elements.autoMergeBtn) {
            elements.autoMergeBtn.disabled = exactMatch === 0;
        }
        if (elements.previewMergeBtn) {
            elements.previewMergeBtn.disabled = exactMatch === 0;
        }

        // Check if specific category sections are now empty and remove their headers
        ['exactMatch', 'sameNumber', 'sameName', 'similarPhone', 'sameEmail'].forEach(category => {
            if ((categories[category]?.length || 0) === 0) {
                const categoryEl = document.querySelector(`.merge-category[data-category="${category}"]`);
                if (categoryEl) {
                    categoryEl.remove();
                }
            }
        });
    }

    async function handleFileUpload(files) {
        if (!files || files.length === 0) return;

        const formData = new FormData();
        for (let i = 0; i < files.length; i++) {
            formData.append('vcf_files[]', files[i]);
        }

        setLoading(true);
        try {
            const data = await api.uploadFiles(formData);

            let successCount = 0;
            let totalContacts = 0;

            data.files.forEach(result => {
                if (result.success) {
                    successCount++;
                    totalContacts += result.contactCount;
                } else {
                    showToast(`${result.filename}: ${result.error}`, 'error');
                }
            });

            if (successCount > 0) {
                showToast(`Imported ${totalContacts} contacts from ${successCount} file(s)`, 'success');
                state.files = data.totalFiles || [];
                await loadContacts();
            }
        } catch (error) {
            console.error('Upload error:', error);
            showToast(error.message, 'error');
        } finally {
            setLoading(false);
            elements.fileInput.value = '';
        }
    }

    async function handlePastedVCF() {
        const text = elements.vcfTextarea.value.trim();
        if (!text) {
            showToast('Please paste VCF content', 'warning');
            return;
        }

        const formData = new FormData();
        formData.append('vcf_text', text);

        setLoading(true);
        closeModal(elements.pasteModal);

        try {
            const data = await api.uploadFiles(formData);

            if (data.files[0].success) {
                showToast(`Imported ${data.files[0].contactCount} contacts`, 'success');
                state.files = data.totalFiles || [];
                elements.vcfTextarea.value = '';
                await loadContacts();
            } else {
                showToast(data.files[0].error, 'error');
            }
        } catch (error) {
            console.error('Paste import error:', error);
            showToast(error.message, 'error');
        } finally {
            setLoading(false);
        }
    }

    async function handleDeleteContacts(ids) {
        if (!confirm(`Delete ${ids.length} contact(s)? This cannot be undone.`)) return;

        try {
            await api.deleteContacts(ids);
            showToast(`Deleted ${ids.length} contact(s)`, 'success');
            state.selectedContacts.clear();
            await loadContacts();
        } catch (error) {
            showToast(error.message, 'error');
        }
    }

    // Confirmation modal callback storage
    let confirmCallback = null;

    function showConfirmModal(message, callback) {
        if (elements.confirmModal && elements.confirmMessage) {
            elements.confirmMessage.textContent = message;
            confirmCallback = callback;
            openModal(elements.confirmModal);
        } else {
            // Fallback to native confirm
            if (confirm(message)) {
                callback();
            }
        }
    }

    async function handleDeleteFile(fileId) {
        const file = state.files.find(f => f.id === fileId);
        if (!file) return;

        showConfirmModal(
            `Remove "${file.name}" and its ${file.contactCount} contact(s)? This cannot be undone.`,
            async () => {
                try {
                    await api.deleteFile(fileId);
                    showToast(`Removed "${file.name}"`, 'success');

                    // If we were viewing this file, switch to "all"
                    if (state.selectedFile === fileId) {
                        state.selectedFile = 'all';
                        elements.pageTitle.textContent = 'All Contacts';
                    }

                    await loadContacts();
                } catch (error) {
                    showToast(error.message, 'error');
                }
            }
        );
    }

    async function handleClearAllFiles() {
        if (state.files.length === 0) return;

        const totalContacts = state.files.reduce((sum, f) => sum + f.contactCount, 0);

        showConfirmModal(
            `Clear all ${state.files.length} source file(s) and ${totalContacts} contact(s)? This cannot be undone.`,
            async () => {
                try {
                    await api.request('files.php', {
                        method: 'POST',
                        body: JSON.stringify({ action: 'clear_all' })
                    });
                    showToast('All sources cleared', 'success');
                    state.selectedFile = 'all';
                    elements.pageTitle.textContent = 'All Contacts';
                    await loadContacts();
                } catch (error) {
                    showToast(error.message, 'error');
                }
            }
        );
    }

    async function handleSaveContact() {
        const id = elements.editContactId.value;
        const isNewContact = !id;

        // Gather phones
        const phones = [];
        elements.editPhonesContainer.querySelectorAll('.multi-input-row').forEach(row => {
            const value = row.querySelector('.phone-value').value.trim();
            const type = row.querySelector('.phone-type').value;
            if (value) {
                phones.push({ value, type, normalized: value.replace(/\D/g, '') });
            }
        });

        // Gather emails
        const emails = [];
        elements.editEmailsContainer.querySelectorAll('.multi-input-row').forEach(row => {
            const value = row.querySelector('.email-value').value.trim();
            const type = row.querySelector('.email-type').value;
            if (value) {
                emails.push({ value: value.toLowerCase(), type });
            }
        });

        // Gather URLs
        const urls = [];
        if (elements.editUrlsContainer) {
            elements.editUrlsContainer.querySelectorAll('.multi-input-row').forEach(row => {
                const value = row.querySelector('.url-value').value.trim();
                const type = row.querySelector('.url-type').value;
                if (value) {
                    urls.push({ value, type });
                }
            });
        }

        // Gather Addresses
        const addresses = [];
        if (elements.editAddressesContainer) {
            elements.editAddressesContainer.querySelectorAll('.address-card').forEach(card => {
                const street = card.querySelector('.addr-street')?.value.trim() || '';
                const city = card.querySelector('.addr-city')?.value.trim() || '';
                const region = card.querySelector('.addr-region')?.value.trim() || '';
                const postalCode = card.querySelector('.addr-postal')?.value.trim() || '';
                const country = card.querySelector('.addr-country')?.value.trim() || '';
                const type = card.querySelector('.addr-type')?.value || 'home';
                // Only add if at least one field has data
                if (street || city || region || postalCode || country) {
                    addresses.push({ type, street, city, region, postalCode, country, poBox: '', extended: '' });
                }
            });
        }

        // Gather Social Profiles
        const socialProfiles = [];
        if (elements.editSocialProfilesContainer) {
            elements.editSocialProfilesContainer.querySelectorAll('.multi-input-row').forEach(row => {
                const value = row.querySelector('.social-value').value.trim();
                const type = row.querySelector('.social-type').value;
                if (value) {
                    socialProfiles.push({ value, type });
                }
            });
        }

        // Gather IM Handles
        const imHandles = [];
        if (elements.editImHandlesContainer) {
            elements.editImHandlesContainer.querySelectorAll('.multi-input-row').forEach(row => {
                const value = row.querySelector('.im-value').value.trim();
                const type = row.querySelector('.im-type').value;
                if (value) {
                    imHandles.push({ value, type });
                }
            });
        }

        // Gather Related Contacts
        const related = [];
        if (elements.editRelatedContainer) {
            elements.editRelatedContainer.querySelectorAll('.multi-input-row').forEach(row => {
                const value = row.querySelector('.related-value').value.trim();
                const type = row.querySelector('.related-type').value;
                if (value) {
                    related.push({ value, type });
                }
            });
        }

        const contactData = {
            name: elements.editName.value.trim(),
            organization: elements.editOrg.value.trim(),
            title: elements.editTitle.value.trim(),
            notes: elements.editNotes.value.trim(),
            phones,
            emails,
            // Additional fields
            prefix: elements.editPrefix?.value.trim() || '',
            middleName: elements.editMiddleName?.value.trim() || '',
            suffix: elements.editSuffix?.value.trim() || '',
            nickname: elements.editNickname?.value.trim() || '',
            department: elements.editDepartment?.value.trim() || '',
            birthday: elements.editBirthday?.value || '',
            anniversary: elements.editAnniversary?.value || '',
            gender: elements.editGender?.value || '',
            timezone: elements.editTimezone?.value.trim() || '',
            geo: elements.editGeo?.value.trim() || '',
            urls,
            addresses,
            socialProfiles,
            imHandles,
            related
        };

        if (!contactData.name && phones.length === 0) {
            showToast('Contact must have a name or phone number', 'warning');
            return;
        }

        try {
            if (isNewContact) {
                // Get source file for new contact
                const sourceFile = elements.editSourceFileSelect ?
                    elements.editSourceFileSelect.value :
                    (state.selectedFile !== 'all' ? state.selectedFile : (state.files[0]?.id || ''));

                if (!sourceFile) {
                    showToast('Please select a source file for the new contact', 'warning');
                    return;
                }

                contactData.sourceFile = sourceFile;
                await api.createContact(contactData);
                showToast('Contact created', 'success');
            } else {
                await api.updateContact(id, contactData);
                showToast('Contact updated', 'success');
            }
            closeModal(elements.editModal);
            await loadContacts();
        } catch (error) {
            showToast(error.message, 'error');
        }
    }

    function openAddContactModal() {
        // Check if we have any files to add to
        if (state.files.length === 0) {
            showToast('Please import a VCF file first to add contacts', 'warning');
            return;
        }

        // Clear the form
        elements.editContactId.value = '';
        elements.editName.value = '';
        elements.editOrg.value = '';
        elements.editTitle.value = '';
        elements.editNotes.value = '';
        elements.editPhonesContainer.innerHTML = '';
        elements.editEmailsContainer.innerHTML = '';

        // Clear additional fields
        if (elements.editPrefix) elements.editPrefix.value = '';
        if (elements.editMiddleName) elements.editMiddleName.value = '';
        if (elements.editSuffix) elements.editSuffix.value = '';
        if (elements.editNickname) elements.editNickname.value = '';
        if (elements.editDepartment) elements.editDepartment.value = '';
        if (elements.editBirthday) elements.editBirthday.value = '';
        if (elements.editAnniversary) elements.editAnniversary.value = '';
        if (elements.editGender) elements.editGender.value = '';
        if (elements.editTimezone) elements.editTimezone.value = '';
        if (elements.editGeo) elements.editGeo.value = '';
        if (elements.editUrlsContainer) elements.editUrlsContainer.innerHTML = '';
        if (elements.editAddressesContainer) elements.editAddressesContainer.innerHTML = '';
        if (elements.editSocialProfilesContainer) elements.editSocialProfilesContainer.innerHTML = '';
        if (elements.editImHandlesContainer) elements.editImHandlesContainer.innerHTML = '';
        if (elements.editRelatedContainer) elements.editRelatedContainer.innerHTML = '';

        // Hide additional fields section by default for new contacts
        if (elements.additionalFieldsSection && elements.toggleAdditionalFields) {
            elements.additionalFieldsSection.style.display = 'none';
            elements.toggleAdditionalFields.parentElement.classList.remove('expanded');
            elements.toggleAdditionalFields.innerHTML = '<span class="toggle-icon">▶</span> Show Additional Fields';
        }

        // Add one empty phone and email input
        addPhoneInput();
        addEmailInput();

        // Show source file selector and populate it
        if (elements.sourceFileGroup && elements.editSourceFileSelect) {
            elements.sourceFileGroup.style.display = 'block';
            elements.editSourceFileSelect.innerHTML = state.files.map(f =>
                `<option value="${f.id}" ${f.id === state.selectedFile ? 'selected' : ''}>${escapeHtml(f.name)}</option>`
            ).join('');

            // If current view is a specific file, default to that
            if (state.selectedFile !== 'all') {
                elements.editSourceFileSelect.value = state.selectedFile;
            }
        }

        // Update modal title
        if (elements.editModalTitle) {
            elements.editModalTitle.textContent = 'Add New Contact';
        }

        openModal(elements.editModal);
    }

    async function handleAnalyze() {
        setLoading(true);
        try {
            const data = await api.analyze(80);

            if (data.totalDuplicateGroups === 0) {
                showToast('No duplicates found! Your contacts are clean.', 'success');
                return;
            }

            renderMergeModal(data);
        } catch (error) {
            showToast(error.message, 'error');
        } finally {
            setLoading(false);
        }
    }

    function showMergePreview(groups) {
        if (!groups || groups.length === 0) {
            showToast('No groups to preview', 'warning');
            return;
        }

        // Filter out skipped groups
        const activeGroups = groups.filter((_, i) => !state.skippedGroups.has(`exactMatch_${i}`));

        if (activeGroups.length === 0) {
            showToast('All groups are skipped. Uncheck some groups to merge.', 'warning');
            return;
        }

        let previewHtml = `<p style="margin-bottom: 16px;"><strong>${activeGroups.length} group(s)</strong> will be merged (${groups.length - activeGroups.length} skipped):</p>`;

        activeGroups.forEach((group, i) => {
            const names = [...new Set(group.contacts.map(c => c.name))];
            const phones = [];
            const emails = [];

            group.contacts.forEach(c => {
                if (c.phones) c.phones.forEach(p => phones.push(p.value));
                if (c.emails) c.emails.forEach(e => emails.push(e.value));
            });

            previewHtml += `
                <div class="preview-group" style="background: var(--color-surface); padding: 12px; border-radius: 8px; margin-bottom: 12px; border: 1px solid var(--color-border);">
                    <div style="font-weight: 600; margin-bottom: 8px;">Group ${i + 1}: ${escapeHtml(names[0] || 'No Name')}</div>
                    <div style="font-size: 13px; color: var(--color-text-secondary);">
                        <div>📱 ${phones.length} phone(s): ${phones.slice(0, 3).map(p => escapeHtml(p)).join(', ')}${phones.length > 3 ? '...' : ''}</div>
                        ${emails.length > 0 ? `<div>📧 ${emails.length} email(s): ${emails.slice(0, 2).map(e => escapeHtml(e)).join(', ')}${emails.length > 2 ? '...' : ''}</div>` : ''}
                        <div style="margin-top: 4px; opacity: 0.7;">${group.contacts.length} contacts → 1 merged contact</div>
                    </div>
                </div>
            `;
        });

        if (elements.previewMergeContent) {
            elements.previewMergeContent.innerHTML = previewHtml;
        }

        closeModal(elements.mergeModal);
        openModal(elements.previewMergeModal);
    }

    async function handleAutoMerge() {
        const groups = state.duplicateGroups.autoMergeable;
        if (!groups || groups.length === 0) return;

        // Filter out skipped groups
        const activeGroups = groups.filter((_, i) => !state.skippedGroups.has(`exactMatch_${i}`));

        if (activeGroups.length === 0) {
            showToast('All groups are skipped. Uncheck some groups to merge.', 'warning');
            return;
        }

        setLoading(true);
        closeModal(elements.mergeModal);

        try {
            const data = await api.autoMerge(activeGroups);
            showToast(`Merged ${data.totalMerged} duplicate groups (${groups.length - activeGroups.length} skipped)`, 'success');
            // Clear skipped groups after successful merge
            state.skippedGroups.clear();
            await loadContacts();
        } catch (error) {
            showToast(error.message, 'error');
        } finally {
            setLoading(false);
        }
    }

    async function handleResolveConflict() {
        if (!state.currentConflict) return;

        const preferredValues = {};
        elements.conflictContainer.querySelectorAll('.conflict-field').forEach(field => {
            const fieldName = field.querySelector('.conflict-field-title').textContent.toLowerCase();
            const selected = field.querySelector('input[type="radio"]:checked');

            if (selected) {
                if (selected.value === '__custom__') {
                    const customInput = selected.parentElement.querySelector('.custom-value');
                    preferredValues[fieldName] = customInput.value.trim();
                } else {
                    preferredValues[fieldName] = selected.value;
                }
            }
        });

        const ids = state.currentConflict.contacts.map(c => c.id);
        const conflictType = state.currentConflict.matchType;
        const conflictIndex = state.currentConflict._resolveIndex;

        try {
            await api.merge(ids, preferredValues);
            showToast('Contacts merged successfully', 'success');
            closeModal(elements.conflictModal);

            // Remove the resolved group from state
            if (conflictType === 'samePhone' && state.duplicateGroups.categories?.sameNumber) {
                const idx = state.duplicateGroups.categories.sameNumber.findIndex(
                    g => g.contacts.some(c => ids.includes(c.id))
                );
                if (idx !== -1) {
                    state.duplicateGroups.categories.sameNumber.splice(idx, 1);
                }
            }

            state.currentConflict = null;

            // Refresh contacts silently
            await loadContactsSilently();

            // Check if there are remaining duplicate groups
            const categories = state.duplicateGroups.categories;
            const totalRemaining = (categories?.exactMatch?.length || 0) +
                (categories?.sameNumber?.length || 0) +
                (categories?.sameName?.length || 0) +
                (categories?.similarPhone?.length || 0) +
                (categories?.sameEmail?.length || 0);

            if (totalRemaining > 0) {
                // Reopen the merge modal with updated data
                showToast('Returning to duplicates panel...', 'success');
                setTimeout(() => {
                    // Rebuild merge modal with remaining groups
                    renderMergeModal({ categories: state.duplicateGroups.categories });
                }, 300);
            } else {
                // All done!
                showToast('All duplicates have been resolved!', 'success');
                await loadContacts();
            }
        } catch (error) {
            showToast(error.message, 'error');
        }
    }

    function handleExport() {
        const fileId = state.selectedFile === 'all' ? '' : state.selectedFile;
        const ids = state.selectedContacts.size > 0
            ? Array.from(state.selectedContacts).join(',')
            : '';

        let url = 'api/export.php?timestamp=1';
        if (fileId) url += `&file_id=${encodeURIComponent(fileId)}`;
        if (ids) url += `&ids=${encodeURIComponent(ids)}`;

        // Trigger download
        window.location.href = url;
        showToast('Downloading VCF file...', 'success');
    }

    // =============================================
    // Event Handlers
    // =============================================
    function setupEventListeners() {
        // Mobile menu
        elements.mobileMenuBtn.addEventListener('click', () => {
            elements.sidebar.classList.toggle('open');
        });

        // Close sidebar on outside click (mobile)
        document.addEventListener('click', (e) => {
            if (window.innerWidth <= 768 &&
                elements.sidebar.classList.contains('open') &&
                !elements.sidebar.contains(e.target) &&
                !elements.mobileMenuBtn.contains(e.target)) {
                elements.sidebar.classList.remove('open');
            }
        });

        // File drop zone
        elements.dropZone.addEventListener('click', () => elements.fileInput.click());
        elements.dropZone.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                elements.fileInput.click();
            }
        });

        elements.dropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            elements.dropZone.classList.add('dragover');
        });

        elements.dropZone.addEventListener('dragleave', () => {
            elements.dropZone.classList.remove('dragover');
        });

        elements.dropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            elements.dropZone.classList.remove('dragover');
            handleFileUpload(e.dataTransfer.files);
        });

        elements.fileInput.addEventListener('change', (e) => {
            handleFileUpload(e.target.files);
        });

        // Paste button
        elements.pasteBtn.addEventListener('click', () => openModal(elements.pasteModal));
        elements.importPastedBtn.addEventListener('click', handlePastedVCF);

        // File selection and file delete button
        elements.filesList.addEventListener('click', (e) => {
            // Handle file delete button
            const deleteBtn = e.target.closest('.file-delete-btn');
            if (deleteBtn) {
                e.stopPropagation();
                const fileId = deleteBtn.dataset.fileId;
                if (fileId) {
                    handleDeleteFile(fileId);
                }
                return;
            }

            // Handle file selection
            const fileItem = e.target.closest('.file-item');
            if (fileItem) {
                state.selectedFile = fileItem.dataset.fileId;
                elements.pageTitle.textContent = fileItem.querySelector('.file-name').textContent;
                state.selectedContacts.clear();
                loadContacts();
            }
        });

        // Clear All Sources button
        if (elements.clearAllBtn) {
            elements.clearAllBtn.addEventListener('click', handleClearAllFiles);
        }

        // Confirmation modal confirm button
        if (elements.confirmActionBtn) {
            elements.confirmActionBtn.addEventListener('click', () => {
                closeModal(elements.confirmModal);
                if (confirmCallback) {
                    confirmCallback();
                    confirmCallback = null;
                }
            });
        }

        // Search
        elements.searchInput.addEventListener('input', debounce(() => {
            loadContacts();
        }, 300));

        // Select all - works across ALL pages, not just current page
        elements.selectAll.addEventListener('change', (e) => {
            if (e.target.checked) {
                // Select all contacts from state (includes all pages)
                state.contacts.forEach(c => state.selectedContacts.add(c.id));
            } else {
                state.selectedContacts.clear();
            }
            // Update checkbox states on visible rows
            elements.contactsBody.querySelectorAll('tr[data-contact-id]').forEach(row => {
                const contactId = row.dataset.contactId;
                const checkbox = row.querySelector('.contact-checkbox');
                if (checkbox) {
                    checkbox.checked = state.selectedContacts.has(contactId);
                    row.classList.toggle('selected', state.selectedContacts.has(contactId));
                }
            });
            updateSelectionUI();
        });

        // Individual contact selection and actions
        elements.contactsBody.addEventListener('click', (e) => {
            const row = e.target.closest('tr');
            if (!row) return;

            const contactId = row.dataset.contactId;

            // Checkbox
            if (e.target.classList.contains('contact-checkbox')) {
                if (e.target.checked) {
                    state.selectedContacts.add(contactId);
                } else {
                    state.selectedContacts.delete(contactId);
                }
                updateSelectionUI();
                row.classList.toggle('selected', e.target.checked);
                return;
            }

            // Edit button
            if (e.target.closest('.edit-btn')) {
                const contact = state.contacts.find(c => c.id === contactId);
                if (contact) renderEditModal(contact);
                return;
            }

            // Delete button
            if (e.target.closest('.delete-btn')) {
                handleDeleteContacts([contactId]);
                return;
            }
        });

        // Bulk actions
        elements.bulkDeleteBtn.addEventListener('click', () => {
            handleDeleteContacts(Array.from(state.selectedContacts));
        });

        elements.bulkExportBtn.addEventListener('click', handleExport);

        // Analyze and merge
        elements.analyzeBtn.addEventListener('click', handleAnalyze);
        elements.autoMergeBtn.addEventListener('click', handleAutoMerge);

        // Preview merge button
        if (elements.previewMergeBtn) {
            elements.previewMergeBtn.addEventListener('click', () => {
                if (state.duplicateGroups && state.duplicateGroups.autoMergeable) {
                    showMergePreview(state.duplicateGroups.autoMergeable);
                }
            });
        }

        // Confirm auto-merge from preview modal
        if (elements.confirmAutoMergeBtn) {
            elements.confirmAutoMergeBtn.addEventListener('click', () => {
                closeModal(elements.previewMergeModal);
                handleAutoMerge();
            });
        }

        // Merge modal - handle all group action buttons
        elements.mergeGroups.addEventListener('click', async (e) => {
            const groupEl = e.target.closest('.merge-group');
            if (!groupEl) return;

            const index = parseInt(groupEl.dataset.groupIndex);
            const type = groupEl.dataset.groupType;

            // Handle resolve button (name conflicts)
            if (e.target.classList.contains('resolve-btn')) {
                let group;
                if (type === 'sameNumber') {
                    group = state.duplicateGroups.categories?.sameNumber[index];
                } else {
                    group = state.duplicateGroups.conflicts[index];
                }
                if (group) {
                    closeModal(elements.mergeModal);
                    renderConflictModal(group);
                }
                return;
            }

            // Handle merge button (same name or similar phone)
            if (e.target.classList.contains('merge-group-btn')) {
                let group;
                let categoryType;
                if (type === 'sameName') {
                    group = state.duplicateGroups.categories?.sameName[index];
                    categoryType = 'sameName';
                } else if (type === 'similarPhone') {
                    group = state.duplicateGroups.categories?.similarPhone[index];
                    categoryType = 'similarPhone';
                }
                if (group) {
                    const ids = group.contacts.map(c => c.id);
                    const preferredValues = {};

                    // For similar phones, prefer the one with country code
                    if (group.preferredPhone) {
                        preferredValues.phone = group.preferredPhone;
                    }

                    try {
                        // Show merging indicator on the button
                        e.target.textContent = 'Merging...';
                        e.target.disabled = true;

                        await api.merge(ids, preferredValues);
                        showToast('Contacts merged successfully', 'success');

                        // Remove the merged group from state
                        if (categoryType && state.duplicateGroups.categories?.[categoryType]) {
                            state.duplicateGroups.categories[categoryType].splice(index, 1);
                        }

                        // Remove the group element from DOM with animation
                        groupEl.style.transition = 'all 0.3s ease';
                        groupEl.style.opacity = '0';
                        groupEl.style.transform = 'translateX(20px)';

                        setTimeout(() => {
                            groupEl.remove();
                            // Check if there are any remaining groups
                            const remainingGroups = document.querySelectorAll('.merge-group');
                            if (remainingGroups.length === 0) {
                                // All groups are merged, close the modal
                                closeModal(elements.mergeModal);
                                showToast('All duplicates have been resolved!', 'success');
                            } else {
                                // Update the summary counts
                                updateMergeSummary();
                            }
                        }, 300);

                        // Refresh contacts in background (without closing modal)
                        loadContactsSilently();
                    } catch (error) {
                        showToast(error.message, 'error');
                        e.target.textContent = 'Merge';
                        e.target.disabled = false;
                    }
                }
                return;
            }

            // Handle edit button (for same email duplicates)
            if (e.target.classList.contains('edit-contact-btn')) {
                // Just show a toast for now pointing them to edit
                showToast('Select a contact from the list and click Edit to modify emails', 'info');
                closeModal(elements.mergeModal);
                return;
            }
        });

        // Handle skip checkbox changes for auto-merge groups
        elements.mergeGroups.addEventListener('change', (e) => {
            if (e.target.classList.contains('skip-group-checkbox')) {
                const groupKey = e.target.dataset.groupKey;
                const groupEl = e.target.closest('.merge-group');

                if (e.target.checked) {
                    state.skippedGroups.add(groupKey);
                    groupEl.style.opacity = '0.5';
                    groupEl.style.borderColor = 'var(--color-warning)';
                    groupEl.classList.add('merge-group--skipped');
                    e.target.nextElementSibling.textContent = 'Skipped';
                    e.target.nextElementSibling.style.color = 'var(--color-warning)';
                } else {
                    state.skippedGroups.delete(groupKey);
                    groupEl.style.opacity = '1';
                    groupEl.style.borderColor = '';
                    groupEl.classList.remove('merge-group--skipped');
                    e.target.nextElementSibling.textContent = 'Skip this group';
                    e.target.nextElementSibling.style.color = 'var(--color-text-muted)';
                }

                // Update the count display in the summary
                const totalGroups = state.duplicateGroups.autoMergeable?.length || 0;
                const skippedCount = state.skippedGroups.size;
                const activeCount = totalGroups - skippedCount;

                const summaryEl = elements.mergeSummary;
                if (summaryEl) {
                    const statsDiv = summaryEl.querySelector('.merge-stats');
                    const safeSpan = statsDiv?.querySelector('span');
                    if (safeSpan && safeSpan.textContent.includes('Safe to Auto-Merge')) {
                        safeSpan.innerHTML = `✅ ${activeCount} Safe to Auto-Merge${skippedCount > 0 ? ` <small style="color: var(--color-warning);">(${skippedCount} skipped)</small>` : ''}`;
                    }
                }
            }
        });

        elements.resolveConflictBtn.addEventListener('click', handleResolveConflict);

        // Export
        elements.exportBtn.addEventListener('click', handleExport);

        // Edit modal
        elements.addPhoneBtn.addEventListener('click', () => addPhoneInput());
        elements.addEmailBtn.addEventListener('click', () => addEmailInput());
        elements.saveContactBtn.addEventListener('click', handleSaveContact);

        // Additional fields toggle
        if (elements.toggleAdditionalFields) {
            elements.toggleAdditionalFields.addEventListener('click', () => {
                const section = elements.additionalFieldsSection;
                const toggle = elements.toggleAdditionalFields;
                const isHidden = section.style.display === 'none';

                section.style.display = isHidden ? 'block' : 'none';
                toggle.parentElement.classList.toggle('expanded', isHidden);
                toggle.innerHTML = isHidden
                    ? '<span class="toggle-icon">▼</span> Hide Additional Fields'
                    : '<span class="toggle-icon">▶</span> Show Additional Fields';
            });
        }

        // Additional fields add buttons
        if (elements.addUrlBtn) {
            elements.addUrlBtn.addEventListener('click', () => addUrlInput());
        }
        if (elements.addAddressBtn) {
            elements.addAddressBtn.addEventListener('click', () => addAddressInput());
        }
        if (elements.addSocialProfileBtn) {
            elements.addSocialProfileBtn.addEventListener('click', () => addSocialProfileInput());
        }
        if (elements.addImHandleBtn) {
            elements.addImHandleBtn.addEventListener('click', () => addImHandleInput());
        }
        if (elements.addRelatedBtn) {
            elements.addRelatedBtn.addEventListener('click', () => addRelatedInput());
        }

        // Add Contact button
        if (elements.addContactBtn) {
            elements.addContactBtn.addEventListener('click', openAddContactModal);
        }

        // Remove input buttons (works for all multi-input types)
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('remove-input-btn')) {
                // Check if it's inside an address card
                const addrCard = e.target.closest('.address-card');
                if (addrCard) {
                    addrCard.remove();
                    return;
                }
                // Otherwise remove the multi-input-row
                e.target.closest('.multi-input-row')?.remove();
            }
        });

        // Modal close buttons
        document.querySelectorAll('.modal-close, [data-close-modal]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const modal = e.target.closest('.modal');
                if (modal) closeModal(modal);
            });
        });

        // Close modal on backdrop click
        document.querySelectorAll('.modal-backdrop').forEach(backdrop => {
            backdrop.addEventListener('click', () => {
                const modal = backdrop.closest('.modal');
                if (modal) closeModal(modal);
            });
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            // Escape to close modals
            if (e.key === 'Escape') {
                closeAllModals();
            }

            // Ctrl/Cmd + A to select all
            if ((e.ctrlKey || e.metaKey) && e.key === 'a' &&
                !e.target.matches('input, textarea')) {
                e.preventDefault();
                elements.selectAll.checked = true;
                elements.selectAll.dispatchEvent(new Event('change'));
            }

            // Delete key to delete selected
            if (e.key === 'Delete' && state.selectedContacts.size > 0 &&
                !e.target.matches('input, textarea')) {
                handleDeleteContacts(Array.from(state.selectedContacts));
            }
        });
    }

    // =============================================
    // Initialization
    // =============================================
    async function init() {
        setupEventListeners();

        const initData = await api.init();
        if (initData) {
            state.files = initData.files || [];
            renderFiles();
            await loadContacts();
        }
    }

    // Start the app
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
