/**
 * Financial Disclosure Viewer
 * A modern, dark-themed static website for exploring financial disclosure data
 */

class DataManager {
    constructor() {
        this.members = [];
        this.filteredMembers = [];
        this.currentSort = { column: null, direction: 'asc' };
    }

    /**
     * Parse XML string and extract member data
     * @param {string} xmlString - The XML content as string
     * @returns {Array} Array of member objects
     */
    parseXML(xmlString) {
        try {
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(xmlString, 'text/xml');

            // Check for parsing errors
            const parserError = xmlDoc.querySelector('parsererror');
            if (parserError) {
                throw new Error('XML parsing failed: ' + parserError.textContent);
            }

            const memberElements = xmlDoc.querySelectorAll('Member');
            const members = [];

            memberElements.forEach(memberEl => {
                try {
                    const member = this.extractMemberData(memberEl);
                    if (member) {
                        members.push(member);
                    }
                } catch (error) {
                    console.warn('Failed to parse member:', error);
                    // Continue processing other members
                }
            });

            this.members = members;
            this.filteredMembers = [...members];

            console.log(`Successfully parsed ${members.length} member records`);
            return members;
        } catch (error) {
            console.error('XML parsing error:', error);
            throw new Error(`Failed to parse XML data: ${error.message}`);
        }
    }

    /**
     * Extract member data from XML element
     * @param {Element} memberEl - Member XML element
     * @returns {Object} Member object
     */
    extractMemberData(memberEl) {
        const getTextContent = (selector) => {
            const element = memberEl.querySelector(selector);
            return element ? element.textContent.trim() : '';
        };

        const prefix = getTextContent('Prefix');
        const lastName = getTextContent('Last');
        const firstName = getTextContent('First');
        const suffix = getTextContent('Suffix');
        const filingType = getTextContent('FilingType');
        const stateDst = getTextContent('StateDst');
        const year = getTextContent('Year');
        const filingDate = getTextContent('FilingDate');
        const docID = getTextContent('DocID');

        // Validate required fields
        if (!lastName && !firstName) {
            throw new Error('Member missing both first and last name');
        }

        // Parse and validate date
        let parsedDate = null;
        if (filingDate) {
            parsedDate = this.parseDate(filingDate);
        }

        // Parse year
        const parsedYear = year ? parseInt(year, 10) : null;
        if (year && (isNaN(parsedYear) || parsedYear < 1900 || parsedYear > 2100)) {
            console.warn(`Invalid year for member ${firstName} ${lastName}: ${year}`);
        }

        return {
            prefix: prefix || '',
            lastName: lastName || '',
            firstName: firstName || '',
            suffix: suffix || '',
            filingType: filingType || '',
            stateDst: stateDst || '',
            year: parsedYear,
            filingDate: parsedDate,
            filingDateString: filingDate || '',
            docID: docID || '',
            // Add search index for performance
            searchIndex: this.createSearchIndex({
                prefix, lastName, firstName, suffix, filingType, stateDst, year, filingDate, docID
            })
        };
    }

    /**
     * Parse date string into Date object
     * @param {string} dateString - Date string in various formats
     * @returns {Date|null} Parsed date or null if invalid
     */
    parseDate(dateString) {
        if (!dateString) return null;

        // Try different date formats
        const formats = [
            // MM/DD/YYYY
            /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/,
            // MM-DD-YYYY
            /^(\d{1,2})-(\d{1,2})-(\d{4})$/,
            // YYYY-MM-DD
            /^(\d{4})-(\d{1,2})-(\d{1,2})$/
        ];

        for (const format of formats) {
            const match = dateString.match(format);
            if (match) {
                let year, month, day;

                if (format === formats[2]) { // YYYY-MM-DD
                    [, year, month, day] = match;
                } else { // MM/DD/YYYY or MM-DD-YYYY
                    [, month, day, year] = match;
                }

                const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));

                // Validate the date
                if (date.getFullYear() == year &&
                    date.getMonth() == month - 1 &&
                    date.getDate() == day) {
                    return date;
                }
            }
        }

        // Try native Date parsing as fallback
        const fallbackDate = new Date(dateString);
        if (!isNaN(fallbackDate.getTime())) {
            return fallbackDate;
        }

        console.warn(`Could not parse date: ${dateString}`);
        return null;
    }

    /**
     * Create search index for a member
     * @param {Object} memberData - Member data object
     * @returns {string} Lowercase search index string
     */
    createSearchIndex(memberData) {
        return Object.values(memberData)
            .filter(value => value != null)
            .join(' ')
            .toLowerCase();
    }

    /**
     * Get all members
     * @returns {Array} Array of all member objects
     */
    getMembers() {
        return this.members;
    }

    /**
     * Get filtered members
     * @returns {Array} Array of filtered member objects
     */
    getFilteredMembers() {
        return this.filteredMembers;
    }

    /**
     * Filter members by search term
     * @param {string} searchTerm - Search term to filter by
     * @returns {Array} Array of filtered member objects
     */
    filterMembers(searchTerm) {
        if (!searchTerm || searchTerm.trim() === '') {
            this.filteredMembers = [...this.members];
        } else {
            const term = searchTerm.toLowerCase().trim();
            this.filteredMembers = this.members.filter(member =>
                member.searchIndex.includes(term)
            );
        }

        // Re-apply current sort to filtered results
        if (this.currentSort.column) {
            this.sortMembers(this.currentSort.column, this.currentSort.direction);
        }

        return this.filteredMembers;
    }

    /**
     * Sort members by column and direction
     * @param {string} column - Column to sort by
     * @param {string} direction - Sort direction ('asc' or 'desc')
     * @returns {Array} Array of sorted member objects
     */
    sortMembers(column, direction = 'asc') {
        this.currentSort = { column, direction };

        this.filteredMembers.sort((a, b) => {
            let aVal = a[column];
            let bVal = b[column];

            // Handle null/undefined values
            if (aVal == null && bVal == null) return 0;
            if (aVal == null) return direction === 'asc' ? 1 : -1;
            if (bVal == null) return direction === 'asc' ? -1 : 1;

            // Special handling for dates
            if (column === 'filingDate') {
                if (aVal instanceof Date && bVal instanceof Date) {
                    const result = aVal.getTime() - bVal.getTime();
                    return direction === 'asc' ? result : -result;
                }
                // Fallback to string comparison for invalid dates
                aVal = a.filingDateString || '';
                bVal = b.filingDateString || '';
            }

            // Special handling for numeric values
            if (column === 'year' || column === 'docID') {
                const aNum = parseInt(aVal, 10);
                const bNum = parseInt(bVal, 10);
                if (!isNaN(aNum) && !isNaN(bNum)) {
                    const result = aNum - bNum;
                    return direction === 'asc' ? result : -result;
                }
            }

            // String comparison (case-insensitive)
            const aStr = String(aVal).toLowerCase();
            const bStr = String(bVal).toLowerCase();

            if (aStr < bStr) return direction === 'asc' ? -1 : 1;
            if (aStr > bStr) return direction === 'asc' ? 1 : -1;
            return 0;
        });

        return this.filteredMembers;
    }

    /**
     * Get summary statistics
     * @returns {Object} Statistics object
     */
    getStatistics() {
        const members = this.members;

        if (members.length === 0) {
            return {
                totalRecords: 0,
                filteredRecords: 0,
                dateRange: 'No data',
                uniqueStates: 0,
                filingTypes: {}
            };
        }

        // Get date range
        const validDates = members
            .map(m => m.filingDate)
            .filter(date => date instanceof Date)
            .sort((a, b) => a.getTime() - b.getTime());

        let dateRange = 'No dates available';
        if (validDates.length > 0) {
            const earliest = validDates[0];
            const latest = validDates[validDates.length - 1];
            dateRange = `${this.formatDate(earliest)} - ${this.formatDate(latest)}`;
        }

        // Get unique states
        const uniqueStates = new Set(
            members
                .map(m => m.stateDst)
                .filter(state => state && state.trim() !== '')
        ).size;

        // Get filing type counts
        const filingTypes = {};
        members.forEach(member => {
            const type = member.filingType || 'Unknown';
            filingTypes[type] = (filingTypes[type] || 0) + 1;
        });

        return {
            totalRecords: members.length,
            filteredRecords: this.filteredMembers.length,
            dateRange,
            uniqueStates,
            filingTypes
        };
    }

    /**
     * Format date for display
     * @param {Date} date - Date object
     * @returns {string} Formatted date string
     */
    formatDate(date) {
        if (!(date instanceof Date) || isNaN(date.getTime())) {
            return '';
        }

        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    }

    /**
     * Load XML data from file
     * @param {string} filename - XML filename to load
     * @returns {Promise} Promise that resolves when data is loaded
     */
    async loadXMLFile(filename) {
        try {
            const response = await fetch(filename);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const xmlText = await response.text();
            return this.parseXML(xmlText);
        } catch (error) {
            console.error('Failed to load XML file:', error);
            throw new Error(`Failed to load data file: ${error.message}`);
        }
    }
}/**
 * Uti
lity class for data validation and sanitization
 */
class DataValidator {
    /**
     * Sanitize HTML content to prevent XSS
     * @param {string} input - Input string to sanitize
     * @returns {string} Sanitized string
     */
    static sanitizeHTML(input) {
        if (typeof input !== 'string') {
            return String(input || '');
        }

        // Create a temporary div element to leverage browser's HTML parsing
        const temp = document.createElement('div');
        temp.textContent = input;
        return temp.innerHTML;
    }

    /**
     * Sanitize search input
     * @param {string} input - Search input to sanitize
     * @returns {string} Sanitized search input
     */
    static sanitizeSearchInput(input) {
        if (typeof input !== 'string') {
            return '';
        }

        // Remove potentially dangerous characters but keep search-friendly ones
        return input
            .replace(/[<>\"'&]/g, '') // Remove HTML/script injection chars
            .replace(/\s+/g, ' ') // Normalize whitespace
            .trim()
            .substring(0, 200); // Limit length
    }

    /**
     * Validate and sanitize member data
     * @param {Object} member - Member object to validate
     * @returns {Object} Validated and sanitized member object
     */
    static validateMember(member) {
        if (!member || typeof member !== 'object') {
            throw new Error('Invalid member data');
        }

        const sanitized = {};

        // Sanitize string fields
        const stringFields = ['prefix', 'lastName', 'firstName', 'suffix', 'filingType', 'stateDst', 'docID', 'filingDateString'];
        stringFields.forEach(field => {
            sanitized[field] = this.sanitizeHTML(member[field] || '');
        });

        // Validate and sanitize numeric fields
        sanitized.year = this.validateYear(member.year);

        // Validate date field
        sanitized.filingDate = this.validateDate(member.filingDate);

        // Preserve search index
        sanitized.searchIndex = member.searchIndex || '';

        return sanitized;
    }

    /**
     * Validate year value
     * @param {*} year - Year value to validate
     * @returns {number|null} Valid year or null
     */
    static validateYear(year) {
        if (year == null) return null;

        const numYear = parseInt(year, 10);
        if (isNaN(numYear) || numYear < 1900 || numYear > 2100) {
            return null;
        }

        return numYear;
    }

    /**
     * Validate date value
     * @param {*} date - Date value to validate
     * @returns {Date|null} Valid date or null
     */
    static validateDate(date) {
        if (!date) return null;

        if (date instanceof Date) {
            return isNaN(date.getTime()) ? null : date;
        }

        return null;
    }

    /**
     * Validate filing type
     * @param {string} filingType - Filing type to validate
     * @returns {string} Validated filing type
     */
    static validateFilingType(filingType) {
        const validTypes = ['P', 'A', 'C', 'T', 'D', 'X', 'W', 'E'];
        const type = String(filingType || '').toUpperCase().trim();

        return validTypes.includes(type) ? type : filingType || '';
    }

    /**
     * Validate state/district code
     * @param {string} stateDst - State/district code to validate
     * @returns {string} Validated state/district code
     */
    static validateStateDst(stateDst) {
        if (!stateDst) return '';

        const code = String(stateDst).trim().toUpperCase();

        // Basic validation for US state codes (2 letters) + district numbers
        if (/^[A-Z]{2}\d{0,2}$/.test(code)) {
            return code;
        }

        return stateDst; // Return original if doesn't match expected format
    }
}

/**
 * Error handling utility class
 */
class ErrorHandler {
    /**
     * Handle and display errors to user
     * @param {Error} error - Error object
     * @param {string} context - Context where error occurred
     */
    static handleError(error, context = 'Application') {
        console.error(`${context} Error:`, error);

        // Show user-friendly error message
        this.showErrorMessage(this.getUserFriendlyMessage(error, context));
    }

    /**
     * Get user-friendly error message
     * @param {Error} error - Error object
     * @param {string} context - Error context
     * @returns {string} User-friendly error message
     */
    static getUserFriendlyMessage(error, context) {
        const message = error.message || 'An unknown error occurred';

        if (message.includes('XML parsing')) {
            return 'The data file appears to be corrupted or invalid. Please check the file format.';
        }

        if (message.includes('Failed to load')) {
            return 'Could not load the data file. Please check your internet connection and try again.';
        }

        if (message.includes('HTTP error')) {
            return 'Network error occurred while loading data. Please try again later.';
        }

        return `${context}: ${message}`;
    }

    /**
     * Show error message to user
     * @param {string} message - Error message to display
     */
    static showErrorMessage(message) {
        // Remove existing error messages
        const existingErrors = document.querySelectorAll('.error-message');
        existingErrors.forEach(el => el.remove());

        // Create error message element
        const errorEl = document.createElement('div');
        errorEl.className = 'error-message';
        errorEl.innerHTML = `
      <div class="error-content">
        <strong>Error:</strong> ${DataValidator.sanitizeHTML(message)}
        <button type="button" class="error-close" aria-label="Close error message">×</button>
      </div>
    `;

        // Add error styles if not already present
        if (!document.querySelector('#error-styles')) {
            const styles = document.createElement('style');
            styles.id = 'error-styles';
            styles.textContent = `
        .error-message {
          position: fixed;
          top: 20px;
          right: 20px;
          background-color: var(--error);
          color: white;
          padding: var(--space-4);
          border-radius: var(--radius-md);
          box-shadow: var(--shadow-lg);
          z-index: var(--z-modal);
          max-width: 400px;
          animation: slideInRight 0.3s ease-out;
        }
        
        .error-content {
          display: flex;
          align-items: flex-start;
          gap: var(--space-3);
        }
        
        .error-close {
          background: none;
          border: none;
          color: white;
          font-size: var(--font-size-lg);
          cursor: pointer;
          padding: 0;
          line-height: 1;
          margin-left: auto;
          flex-shrink: 0;
        }
        
        @keyframes slideInRight {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
      `;
            document.head.appendChild(styles);
        }

        // Add to page
        document.body.appendChild(errorEl);

        // Add close functionality
        const closeBtn = errorEl.querySelector('.error-close');
        closeBtn.addEventListener('click', () => {
            errorEl.remove();
        });

        // Auto-remove after 10 seconds
        setTimeout(() => {
            if (errorEl.parentNode) {
                errorEl.remove();
            }
        }, 10000);
    }

    /**
     * Handle promise rejections
     * @param {PromiseRejectionEvent} event - Unhandled promise rejection event
     */
    static handleUnhandledRejection(event) {
        console.error('Unhandled promise rejection:', event.reason);
        this.handleError(new Error(event.reason), 'System');
        event.preventDefault();
    }
}

// Set up global error handling
window.addEventListener('error', (event) => {
    ErrorHandler.handleError(event.error, 'JavaScript');
});

window.addEventListener('unhandledrejection', ErrorHandler.handleUnhandledRejection);

/**
 * Performance monitoring utility
 */
class PerformanceMonitor {
    constructor() {
        this.timers = new Map();
    }

    /**
     * Start timing an operation
     * @param {string} name - Operation name
     */
    startTimer(name) {
        this.timers.set(name, performance.now());
    }

    /**
     * End timing an operation and log result
     * @param {string} name - Operation name
     * @returns {number} Duration in milliseconds
     */
    endTimer(name) {
        const startTime = this.timers.get(name);
        if (!startTime) {
            console.warn(`Timer '${name}' was not started`);
            return 0;
        }

        const duration = performance.now() - startTime;
        console.log(`${name} took ${duration.toFixed(2)}ms`);
        this.timers.delete(name);
        return duration;
    }

    /**
     * Monitor memory usage (if available)
     */
    logMemoryUsage() {
        if (performance.memory) {
            const memory = performance.memory;
            console.log('Memory usage:', {
                used: `${(memory.usedJSHeapSize / 1024 / 1024).toFixed(2)} MB`,
                total: `${(memory.totalJSHeapSize / 1024 / 1024).toFixed(2)} MB`,
                limit: `${(memory.jsHeapSizeLimit / 1024 / 1024).toFixed(2)} MB`
            });
        }
    }
}

// Create global performance monitor instance
const performanceMonitor = new PerformanceMonitor();/**

 * Table rendering class for efficient DOM manipulation
 */
class TableRenderer {
    constructor(tableElement, dataManager) {
        this.table = tableElement;
        this.tbody = tableElement.querySelector('tbody');
        this.dataManager = dataManager;
        this.isVirtualScrolling = false;
        this.virtualScrollThreshold = 1000;
        this.visibleRowCount = 50;
        this.scrollTop = 0;
        this.rowHeight = 41; // Approximate row height in pixels

        this.setupVirtualScrolling();
    }

    /**
     * Setup virtual scrolling container
     */
    setupVirtualScrolling() {
        const tableContainer = this.table.closest('.table-container');
        if (tableContainer) {
            tableContainer.addEventListener('scroll', this.handleScroll.bind(this));
        }
    }

    /**
     * Handle scroll events for virtual scrolling
     * @param {Event} event - Scroll event
     */
    handleScroll(event) {
        if (!this.isVirtualScrolling) return;

        this.scrollTop = event.target.scrollTop;
        this.renderVisibleRows();
    }

    /**
     * Render all members in the table
     * @param {Array} members - Array of member objects to render
     */
    render(members) {
        performanceMonitor.startTimer('table-render');

        try {
            if (!members || members.length === 0) {
                this.renderEmptyState();
                return;
            }

            // Decide whether to use virtual scrolling
            this.isVirtualScrolling = members.length > this.virtualScrollThreshold;

            if (this.isVirtualScrolling) {
                this.renderVirtualTable(members);
            } else {
                this.renderStandardTable(members);
            }

            this.showTable();
        } catch (error) {
            ErrorHandler.handleError(error, 'Table Rendering');
        } finally {
            performanceMonitor.endTimer('table-render');
        }
    }

    /**
     * Render table using standard DOM manipulation
     * @param {Array} members - Array of member objects
     */
    renderStandardTable(members) {
        // Clear existing content
        this.tbody.innerHTML = '';

        // Create document fragment for efficient DOM manipulation
        const fragment = document.createDocumentFragment();

        members.forEach((member, index) => {
            const row = this.createTableRow(member, index);
            fragment.appendChild(row);
        });

        this.tbody.appendChild(fragment);
    }

    /**
     * Render table using virtual scrolling
     * @param {Array} members - Array of member objects
     */
    renderVirtualTable(members) {
        this.currentMembers = members;

        // Set up virtual scrolling container height
        const totalHeight = members.length * this.rowHeight;
        const tableContainer = this.table.closest('.table-container');

        if (tableContainer) {
            tableContainer.style.height = '600px'; // Fixed height for virtual scrolling
            this.tbody.style.height = `${totalHeight}px`;
            this.tbody.style.position = 'relative';
        }

        this.renderVisibleRows();
    }

    /**
     * Render only visible rows for virtual scrolling
     */
    renderVisibleRows() {
        if (!this.currentMembers) return;

        const containerHeight = 600; // Fixed container height
        const startIndex = Math.floor(this.scrollTop / this.rowHeight);
        const endIndex = Math.min(
            startIndex + Math.ceil(containerHeight / this.rowHeight) + 5, // Buffer rows
            this.currentMembers.length
        );

        // Clear existing rows
        this.tbody.innerHTML = '';

        // Create spacer for rows above viewport
        if (startIndex > 0) {
            const topSpacer = document.createElement('tr');
            topSpacer.style.height = `${startIndex * this.rowHeight}px`;
            topSpacer.innerHTML = '<td colspan="9"></td>';
            this.tbody.appendChild(topSpacer);
        }

        // Create document fragment for visible rows
        const fragment = document.createDocumentFragment();

        for (let i = startIndex; i < endIndex; i++) {
            const member = this.currentMembers[i];
            if (member) {
                const row = this.createTableRow(member, i);
                fragment.appendChild(row);
            }
        }

        this.tbody.appendChild(fragment);

        // Create spacer for rows below viewport
        const remainingRows = this.currentMembers.length - endIndex;
        if (remainingRows > 0) {
            const bottomSpacer = document.createElement('tr');
            bottomSpacer.style.height = `${remainingRows * this.rowHeight}px`;
            bottomSpacer.innerHTML = '<td colspan="9"></td>';
            this.tbody.appendChild(bottomSpacer);
        }
    }

    /**
     * Create a table row element for a member
     * @param {Object} member - Member object
     * @param {number} index - Row index
     * @returns {HTMLElement} Table row element
     */
    createTableRow(member, index) {
        const row = document.createElement('tr');
        row.setAttribute('data-index', index);

        // Add alternating row classes for styling
        if (index % 2 === 0) {
            row.classList.add('even-row');
        }

        // Create cells
        const cells = [
            this.createCell(member.prefix, 'prefix'),
            this.createCell(member.lastName, 'last-name'),
            this.createCell(member.firstName, 'first-name'),
            this.createCell(member.suffix, 'suffix'),
            this.createCell(member.filingType, 'filing-type'),
            this.createCell(member.stateDst, 'state-dst'),
            this.createCell(member.year || '', 'year'),
            this.createCell(this.formatDateForDisplay(member.filingDate, member.filingDateString), 'filing-date'),
            this.createCell(member.docID, 'doc-id')
        ];

        cells.forEach(cell => row.appendChild(cell));

        return row;
    }

    /**
     * Create a table cell element
     * @param {string} content - Cell content
     * @param {string} className - CSS class name
     * @returns {HTMLElement} Table cell element
     */
    createCell(content, className) {
        const cell = document.createElement('td');
        cell.className = className;

        // Sanitize content
        const sanitizedContent = DataValidator.sanitizeHTML(content || '');

        // Handle empty content
        if (!sanitizedContent.trim()) {
            cell.innerHTML = '<span class="empty-cell">—</span>';
            cell.classList.add('empty');
        } else {
            cell.textContent = sanitizedContent;

            // Add tooltip for long content
            if (sanitizedContent.length > 20) {
                cell.title = sanitizedContent;
                cell.classList.add('truncated');
            }
        }

        return cell;
    }

    /**
     * Format date for display
     * @param {Date} date - Date object
     * @param {string} fallback - Fallback string if date is invalid
     * @returns {string} Formatted date string
     */
    formatDateForDisplay(date, fallback) {
        if (date instanceof Date && !isNaN(date.getTime())) {
            return date.toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric'
            });
        }
        return fallback || '';
    }

    /**
     * Update table display with new data
     * @param {Array} members - Array of member objects
     */
    updateDisplay(members) {
        // Add updating class for smooth transition
        this.table.classList.add('table-updating');

        setTimeout(() => {
            this.render(members);
            this.table.classList.remove('table-updating');
            this.table.classList.add('table-updated');

            setTimeout(() => {
                this.table.classList.remove('table-updated');
            }, 300);
        }, 50);
    }

    /**
     * Show loading state
     */
    showLoading() {
        const loadingState = document.getElementById('loadingState');
        const tableSection = document.getElementById('tableSection');

        if (loadingState) loadingState.style.display = 'flex';
        if (tableSection) tableSection.style.display = 'none';

        // Show skeleton loading in table
        this.renderSkeletonRows();
    }

    /**
     * Hide loading state and show table
     */
    hideLoading() {
        const loadingState = document.getElementById('loadingState');
        if (loadingState) loadingState.style.display = 'none';
        this.showTable();
    }

    /**
     * Show the table section
     */
    showTable() {
        const tableSection = document.getElementById('tableSection');
        const emptyState = document.getElementById('emptyState');

        if (tableSection) tableSection.style.display = 'block';
        if (emptyState) emptyState.style.display = 'none';
    }

    /**
     * Render empty state when no data is available
     */
    renderEmptyState() {
        const tableSection = document.getElementById('tableSection');
        const emptyState = document.getElementById('emptyState');

        if (tableSection) tableSection.style.display = 'block';
        if (emptyState) emptyState.style.display = 'block';

        // Clear table body
        this.tbody.innerHTML = '';
    }

    /**
     * Render skeleton loading rows
     */
    renderSkeletonRows() {
        this.tbody.innerHTML = '';

        const fragment = document.createDocumentFragment();

        // Create 10 skeleton rows
        for (let i = 0; i < 10; i++) {
            const row = document.createElement('tr');
            row.className = 'skeleton-loading';

            // Create 9 skeleton cells (matching column count)
            for (let j = 0; j < 9; j++) {
                const cell = document.createElement('td');
                const skeleton = document.createElement('div');
                skeleton.className = 'skeleton-row';
                skeleton.style.width = `${60 + Math.random() * 40}%`; // Random width for variety
                cell.appendChild(skeleton);
                row.appendChild(cell);
            }

            fragment.appendChild(row);
        }

        this.tbody.appendChild(fragment);
    }

    /**
     * Get current scroll position for virtual scrolling
     * @returns {number} Current scroll position
     */
    getScrollPosition() {
        const tableContainer = this.table.closest('.table-container');
        return tableContainer ? tableContainer.scrollTop : 0;
    }

    /**
     * Scroll to top of table
     */
    scrollToTop() {
        const tableContainer = this.table.closest('.table-container');
        if (tableContainer) {
            tableContainer.scrollTop = 0;
        }
    }

    /**
     * Get table statistics
     * @returns {Object} Table statistics
     */
    getTableStats() {
        const rows = this.tbody.querySelectorAll('tr:not(.skeleton-loading)');
        return {
            visibleRows: rows.length,
            isVirtualScrolling: this.isVirtualScrolling,
            scrollPosition: this.getScrollPosition()
        };
    }
}/**
 * 
Search controller for handling search functionality
 */
class SearchController {
    constructor(searchInput, dataManager, tableRenderer) {
        this.searchInput = searchInput;
        this.dataManager = dataManager;
        this.tableRenderer = tableRenderer;
        this.currentSearchTerm = '';
        this.debounceDelay = 300;
        this.debounceTimer = null;

        this.setupEventListeners();
    }

    /**
     * Setup event listeners for search functionality
     */
    setupEventListeners() {
        // Search input event
        this.searchInput.addEventListener('input', this.handleSearchInput.bind(this));

        // Clear search button
        const clearButton = document.getElementById('clearSearch');
        if (clearButton) {
            clearButton.addEventListener('click', this.clearSearch.bind(this));
        }

        // Keyboard shortcuts
        this.searchInput.addEventListener('keydown', this.handleKeydown.bind(this));

        // Focus management
        this.searchInput.addEventListener('focus', this.handleFocus.bind(this));
        this.searchInput.addEventListener('blur', this.handleBlur.bind(this));
    }

    /**
     * Handle search input events
     * @param {Event} event - Input event
     */
    handleSearchInput(event) {
        const searchTerm = DataValidator.sanitizeSearchInput(event.target.value);

        // Clear existing debounce timer
        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
        }

        // Set new debounce timer
        this.debounceTimer = setTimeout(() => {
            this.performSearch(searchTerm);
        }, this.debounceDelay);

        // Update clear button visibility
        this.updateClearButtonVisibility(searchTerm);
    }

    /**
     * Handle keydown events for keyboard shortcuts
     * @param {KeyboardEvent} event - Keydown event
     */
    handleKeydown(event) {
        switch (event.key) {
            case 'Escape':
                this.clearSearch();
                event.preventDefault();
                break;
            case 'Enter':
                // Immediate search on Enter
                if (this.debounceTimer) {
                    clearTimeout(this.debounceTimer);
                }
                const searchTerm = DataValidator.sanitizeSearchInput(event.target.value);
                this.performSearch(searchTerm);
                event.preventDefault();
                break;
        }
    }

    /**
     * Handle focus events
     * @param {Event} event - Focus event
     */
    handleFocus(event) {
        event.target.classList.add('focused');
    }

    /**
     * Handle blur events
     * @param {Event} event - Blur event
     */
    handleBlur(event) {
        event.target.classList.remove('focused');
    }

    /**
     * Perform search operation
     * @param {string} searchTerm - Search term to filter by
     */
    performSearch(searchTerm) {
        performanceMonitor.startTimer('search-operation');

        try {
            this.currentSearchTerm = searchTerm;

            // Show loading state for long searches
            if (searchTerm.length > 0) {
                this.showSearchLoading();
            }

            // Filter members
            const filteredMembers = this.dataManager.filterMembers(searchTerm);

            // Update table display
            this.tableRenderer.updateDisplay(filteredMembers);

            // Update statistics
            this.updateSearchStats(filteredMembers.length);

            // Hide loading state
            this.hideSearchLoading();

            // Scroll to top of results
            this.tableRenderer.scrollToTop();

            // Log search analytics
            this.logSearchAnalytics(searchTerm, filteredMembers.length);

        } catch (error) {
            ErrorHandler.handleError(error, 'Search');
            this.hideSearchLoading();
        } finally {
            performanceMonitor.endTimer('search-operation');
        }
    }

    /**
     * Clear search and reset to all results
     */
    clearSearch() {
        this.searchInput.value = '';
        this.currentSearchTerm = '';

        // Clear debounce timer
        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
        }

        // Reset to all members
        const allMembers = this.dataManager.getMembers();
        this.dataManager.filteredMembers = [...allMembers];

        // Update display
        this.tableRenderer.updateDisplay(allMembers);

        // Update statistics
        this.updateSearchStats(allMembers.length);

        // Update clear button visibility
        this.updateClearButtonVisibility('');

        // Focus search input
        this.searchInput.focus();
    }

    /**
     * Update search statistics display
     * @param {number} resultCount - Number of filtered results
     */
    updateSearchStats(resultCount) {
        const filteredRecordsEl = document.getElementById('filteredRecords');
        if (filteredRecordsEl) {
            filteredRecordsEl.textContent = resultCount.toLocaleString();

            // Add visual indicator for filtered results
            if (this.currentSearchTerm && resultCount < this.dataManager.getMembers().length) {
                filteredRecordsEl.classList.add('filtered');
                filteredRecordsEl.title = `Showing ${resultCount} of ${this.dataManager.getMembers().length} total records`;
            } else {
                filteredRecordsEl.classList.remove('filtered');
                filteredRecordsEl.title = '';
            }
        }
    }

    /**
     * Update clear button visibility
     * @param {string} searchTerm - Current search term
     */
    updateClearButtonVisibility(searchTerm) {
        const clearButton = document.getElementById('clearSearch');
        if (clearButton) {
            if (searchTerm.trim().length > 0) {
                clearButton.style.display = 'inline-flex';
                clearButton.disabled = false;
            } else {
                clearButton.style.display = 'none';
                clearButton.disabled = true;
            }
        }
    }

    /**
     * Show search loading indicator
     */
    showSearchLoading() {
        this.searchInput.classList.add('searching');

        // Add loading indicator to search input
        if (!this.searchInput.parentNode.querySelector('.search-loading')) {
            const loadingIndicator = document.createElement('div');
            loadingIndicator.className = 'search-loading';
            loadingIndicator.innerHTML = '<div class="search-spinner"></div>';
            this.searchInput.parentNode.appendChild(loadingIndicator);
        }
    }

    /**
     * Hide search loading indicator
     */
    hideSearchLoading() {
        this.searchInput.classList.remove('searching');

        const loadingIndicator = this.searchInput.parentNode.querySelector('.search-loading');
        if (loadingIndicator) {
            loadingIndicator.remove();
        }
    }

    /**
     * Log search analytics for performance monitoring
     * @param {string} searchTerm - Search term used
     * @param {number} resultCount - Number of results found
     */
    logSearchAnalytics(searchTerm, resultCount) {
        if (searchTerm.trim().length > 0) {
            console.log(`Search: "${searchTerm}" returned ${resultCount} results`);

            // Track search performance
            const totalRecords = this.dataManager.getMembers().length;
            const filterRatio = resultCount / totalRecords;

            if (filterRatio < 0.1 && resultCount > 0) {
                console.log('Highly specific search - good filtering');
            } else if (resultCount === 0) {
                console.log('No results found - consider search suggestions');
            }
        }
    }

    /**
     * Get current search term
     * @returns {string} Current search term
     */
    getCurrentSearchTerm() {
        return this.currentSearchTerm;
    }

    /**
     * Set search term programmatically
     * @param {string} searchTerm - Search term to set
     */
    setSearchTerm(searchTerm) {
        const sanitizedTerm = DataValidator.sanitizeSearchInput(searchTerm);
        this.searchInput.value = sanitizedTerm;
        this.performSearch(sanitizedTerm);
    }

    /**
     * Get search suggestions based on current data
     * @param {string} partialTerm - Partial search term
     * @returns {Array} Array of search suggestions
     */
    getSearchSuggestions(partialTerm) {
        if (!partialTerm || partialTerm.length < 2) {
            return [];
        }

        const term = partialTerm.toLowerCase();
        const suggestions = new Set();
        const members = this.dataManager.getMembers();

        // Collect suggestions from various fields
        members.forEach(member => {
            // Last names
            if (member.lastName && member.lastName.toLowerCase().startsWith(term)) {
                suggestions.add(member.lastName);
            }

            // First names
            if (member.firstName && member.firstName.toLowerCase().startsWith(term)) {
                suggestions.add(member.firstName);
            }

            // States
            if (member.stateDst && member.stateDst.toLowerCase().startsWith(term)) {
                suggestions.add(member.stateDst);
            }

            // Filing types
            if (member.filingType && member.filingType.toLowerCase().startsWith(term)) {
                suggestions.add(member.filingType);
            }
        });

        return Array.from(suggestions).slice(0, 10); // Limit to 10 suggestions
    }

    /**
     * Highlight search terms in results
     * @param {string} text - Text to highlight
     * @param {string} searchTerm - Term to highlight
     * @returns {string} HTML with highlighted terms
     */
    highlightSearchTerm(text, searchTerm) {
        if (!searchTerm || !text) {
            return DataValidator.sanitizeHTML(text);
        }

        const sanitizedText = DataValidator.sanitizeHTML(text);
        const sanitizedTerm = DataValidator.sanitizeHTML(searchTerm);

        // Case-insensitive highlighting
        const regex = new RegExp(`(${sanitizedTerm})`, 'gi');
        return sanitizedText.replace(regex, '<mark class="search-highlight">$1</mark>');
    }
}/**
 * So
rt controller for handling table column sorting
 */
class SortController {
    constructor(tableElement, dataManager, tableRenderer) {
        this.table = tableElement;
        this.dataManager = dataManager;
        this.tableRenderer = tableRenderer;
        this.currentSort = { column: null, direction: 'asc' };

        this.setupEventListeners();
    }

    /**
     * Setup event listeners for sorting functionality
     */
    setupEventListeners() {
        // Add click listeners to sortable headers
        const sortableHeaders = this.table.querySelectorAll('th.sortable');

        sortableHeaders.forEach(header => {
            header.addEventListener('click', this.handleHeaderClick.bind(this));
            header.addEventListener('keydown', this.handleHeaderKeydown.bind(this));
        });
    }

    /**
     * Handle header click events
     * @param {Event} event - Click event
     */
    handleHeaderClick(event) {
        const header = event.currentTarget;
        const column = header.getAttribute('data-column');

        if (column) {
            this.handleSort(column);
        }
    }

    /**
     * Handle header keydown events for accessibility
     * @param {KeyboardEvent} event - Keydown event
     */
    handleHeaderKeydown(event) {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            const header = event.currentTarget;
            const column = header.getAttribute('data-column');

            if (column) {
                this.handleSort(column);
            }
        }
    }

    /**
     * Handle sort operation
     * @param {string} column - Column to sort by
     */
    handleSort(column) {
        performanceMonitor.startTimer('sort-operation');

        try {
            // Determine sort direction
            let direction = 'asc';

            if (this.currentSort.column === column) {
                // Toggle direction if same column
                direction = this.currentSort.direction === 'asc' ? 'desc' : 'asc';
            }

            // Update current sort state
            this.currentSort = { column, direction };

            // Show loading state for large datasets
            this.showSortLoading();

            // Perform sort
            const sortedMembers = this.dataManager.sortMembers(column, direction);

            // Update visual indicators
            this.updateSortIndicators(column, direction);

            // Update table display
            this.tableRenderer.updateDisplay(sortedMembers);

            // Hide loading state
            this.hideSortLoading();

            // Log sort analytics
            this.logSortAnalytics(column, direction, sortedMembers.length);

        } catch (error) {
            ErrorHandler.handleError(error, 'Sorting');
            this.hideSortLoading();
        } finally {
            performanceMonitor.endTimer('sort-operation');
        }
    }

    /**
     * Update sort indicators in table headers
     * @param {string} activeColumn - Currently sorted column
     * @param {string} direction - Sort direction
     */
    updateSortIndicators(activeColumn, direction) {
        const headers = this.table.querySelectorAll('th.sortable');

        headers.forEach(header => {
            const column = header.getAttribute('data-column');

            // Remove existing sort classes
            header.classList.remove('sort-asc', 'sort-desc');

            // Add appropriate class to active column
            if (column === activeColumn) {
                header.classList.add(`sort-${direction}`);
                header.setAttribute('aria-sort', direction === 'asc' ? 'ascending' : 'descending');
            } else {
                header.setAttribute('aria-sort', 'none');
            }
        });
    }

    /**
     * Show sort loading indicator
     */
    showSortLoading() {
        // Add loading class to table
        this.table.classList.add('sorting');

        // Disable sort headers temporarily
        const headers = this.table.querySelectorAll('th.sortable');
        headers.forEach(header => {
            header.style.pointerEvents = 'none';
            header.style.opacity = '0.7';
        });
    }

    /**
     * Hide sort loading indicator
     */
    hideSortLoading() {
        // Remove loading class
        this.table.classList.remove('sorting');

        // Re-enable sort headers
        const headers = this.table.querySelectorAll('th.sortable');
        headers.forEach(header => {
            header.style.pointerEvents = '';
            header.style.opacity = '';
        });
    }

    /**
     * Log sort analytics for performance monitoring
     * @param {string} column - Column sorted
     * @param {string} direction - Sort direction
     * @param {number} recordCount - Number of records sorted
     */
    logSortAnalytics(column, direction, recordCount) {
        console.log(`Sorted by ${column} (${direction}) - ${recordCount} records`);

        // Track sort performance for large datasets
        if (recordCount > 1000) {
            console.log('Large dataset sort completed successfully');
        }
    }

    /**
     * Get current sort state
     * @returns {Object} Current sort state
     */
    getCurrentSort() {
        return { ...this.currentSort };
    }

    /**
     * Set sort programmatically
     * @param {string} column - Column to sort by
     * @param {string} direction - Sort direction
     */
    setSort(column, direction = 'asc') {
        if (!['asc', 'desc'].includes(direction)) {
            throw new Error('Invalid sort direction. Must be "asc" or "desc"');
        }

        this.handleSort(column);

        // If direction doesn't match, sort again to toggle
        if (this.currentSort.direction !== direction) {
            this.handleSort(column);
        }
    }

    /**
     * Clear current sort and return to original order
     */
    clearSort() {
        this.currentSort = { column: null, direction: 'asc' };

        // Remove all sort indicators
        const headers = this.table.querySelectorAll('th.sortable');
        headers.forEach(header => {
            header.classList.remove('sort-asc', 'sort-desc');
            header.setAttribute('aria-sort', 'none');
        });

        // Reset to original order (or current filtered results)
        const members = this.dataManager.getFilteredMembers();
        this.tableRenderer.updateDisplay(members);
    }

    /**
     * Get sortable columns information
     * @returns {Array} Array of sortable column information
     */
    getSortableColumns() {
        const headers = this.table.querySelectorAll('th.sortable');
        const columns = [];

        headers.forEach(header => {
            const column = header.getAttribute('data-column');
            const label = header.textContent.trim().replace(/\s+/g, ' ');

            if (column) {
                columns.push({
                    column,
                    label,
                    sortable: true,
                    currentSort: this.currentSort.column === column ? this.currentSort.direction : null
                });
            }
        });

        return columns;
    }

    /**
     * Handle multi-column sorting (future enhancement)
     * @param {Array} sortCriteria - Array of sort criteria objects
     */
    handleMultiSort(sortCriteria) {
        // This is a placeholder for future multi-column sorting functionality
        console.log('Multi-column sorting not yet implemented', sortCriteria);
    }
}/**
 *
 CSV Export utility class
 */
class CSVExporter {
    constructor(dataManager) {
        this.dataManager = dataManager;
    }

    /**
     * Export filtered data to CSV
     * @param {string} filename - Optional filename for the export
     * @returns {Promise} Promise that resolves when export is complete
     */
    async exportToCSV(filename = null) {
        performanceMonitor.startTimer('csv-export');

        try {
            const members = this.dataManager.getFilteredMembers();

            if (members.length === 0) {
                throw new Error('No data to export');
            }

            // Generate CSV content
            const csvContent = this.generateCSVContent(members);

            // Create filename if not provided
            const exportFilename = filename || this.generateFilename();

            // Trigger download
            this.downloadCSV(csvContent, exportFilename);

            console.log(`Exported ${members.length} records to ${exportFilename}`);

        } catch (error) {
            ErrorHandler.handleError(error, 'CSV Export');
            throw error;
        } finally {
            performanceMonitor.endTimer('csv-export');
        }
    }

    /**
     * Generate CSV content from member data
     * @param {Array} members - Array of member objects
     * @returns {string} CSV content string
     */
    generateCSVContent(members) {
        // Define CSV headers
        const headers = [
            'Prefix',
            'Last Name',
            'First Name',
            'Suffix',
            'Filing Type',
            'State/District',
            'Year',
            'Filing Date',
            'Document ID'
        ];

        // Create CSV rows
        const rows = [headers];

        members.forEach(member => {
            const row = [
                this.escapeCsvValue(member.prefix),
                this.escapeCsvValue(member.lastName),
                this.escapeCsvValue(member.firstName),
                this.escapeCsvValue(member.suffix),
                this.escapeCsvValue(member.filingType),
                this.escapeCsvValue(member.stateDst),
                this.escapeCsvValue(member.year || ''),
                this.escapeCsvValue(this.formatDateForCSV(member.filingDate, member.filingDateString)),
                this.escapeCsvValue(member.docID)
            ];

            rows.push(row);
        });

        // Convert to CSV string
        return rows.map(row => row.join(',')).join('\n');
    }

    /**
     * Escape CSV value to handle commas, quotes, and newlines
     * @param {*} value - Value to escape
     * @returns {string} Escaped CSV value
     */
    escapeCsvValue(value) {
        if (value == null) {
            return '';
        }

        const stringValue = String(value);

        // If value contains comma, quote, or newline, wrap in quotes and escape internal quotes
        if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
            return `"${stringValue.replace(/"/g, '""')}"`;
        }

        return stringValue;
    }

    /**
     * Format date for CSV export
     * @param {Date} date - Date object
     * @param {string} fallback - Fallback string
     * @returns {string} Formatted date string
     */
    formatDateForCSV(date, fallback) {
        if (date instanceof Date && !isNaN(date.getTime())) {
            // Use ISO format for CSV (YYYY-MM-DD)
            return date.toISOString().split('T')[0];
        }
        return fallback || '';
    }

    /**
     * Generate filename for export
     * @returns {string} Generated filename
     */
    generateFilename() {
        const now = new Date();
        const dateStr = now.toISOString().split('T')[0]; // YYYY-MM-DD
        const timeStr = now.toTimeString().split(' ')[0].replace(/:/g, '-'); // HH-MM-SS

        const recordCount = this.dataManager.getFilteredMembers().length;
        const totalCount = this.dataManager.getMembers().length;

        let filename = `financial-disclosure-${dateStr}-${timeStr}`;

        // Add filter indicator if data is filtered
        if (recordCount < totalCount) {
            filename += `-filtered-${recordCount}-of-${totalCount}`;
        } else {
            filename += `-all-${recordCount}`;
        }

        return `${filename}.csv`;
    }

    /**
     * Trigger CSV download in browser
     * @param {string} csvContent - CSV content string
     * @param {string} filename - Filename for download
     */
    downloadCSV(csvContent, filename) {
        // Create blob with CSV content
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });

        // Create download link
        const link = document.createElement('a');

        if (link.download !== undefined) {
            // Modern browsers
            const url = URL.createObjectURL(blob);
            link.setAttribute('href', url);
            link.setAttribute('download', filename);
            link.style.visibility = 'hidden';

            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            // Clean up object URL
            setTimeout(() => URL.revokeObjectURL(url), 100);
        } else {
            // Fallback for older browsers
            const reader = new FileReader();
            reader.onload = function () {
                const dataUrl = reader.result;
                const link = document.createElement('a');
                link.href = dataUrl;
                link.download = filename;
                link.click();
            };
            reader.readAsDataURL(blob);
        }
    }

    /**
     * Get export statistics
     * @returns {Object} Export statistics
     */
    getExportStats() {
        const filteredCount = this.dataManager.getFilteredMembers().length;
        const totalCount = this.dataManager.getMembers().length;

        return {
            recordsToExport: filteredCount,
            totalRecords: totalCount,
            isFiltered: filteredCount < totalCount,
            estimatedFileSize: this.estimateFileSize(filteredCount)
        };
    }

    /**
     * Estimate CSV file size
     * @param {number} recordCount - Number of records
     * @returns {string} Estimated file size
     */
    estimateFileSize(recordCount) {
        // Rough estimate: ~150 bytes per record (including headers)
        const estimatedBytes = recordCount * 150 + 200; // +200 for headers

        if (estimatedBytes < 1024) {
            return `${estimatedBytes} bytes`;
        } else if (estimatedBytes < 1024 * 1024) {
            return `${(estimatedBytes / 1024).toFixed(1)} KB`;
        } else {
            return `${(estimatedBytes / (1024 * 1024)).toFixed(1)} MB`;
        }
    }
}

/**
 * Export controller for handling export functionality
 */
class ExportController {
    constructor(dataManager) {
        this.dataManager = dataManager;
        this.csvExporter = new CSVExporter(dataManager);

        this.setupEventListeners();
    }

    /**
     * Setup event listeners for export functionality
     */
    setupEventListeners() {
        const exportBtn = document.getElementById('exportBtn');
        if (exportBtn) {
            exportBtn.addEventListener('click', this.handleExportClick.bind(this));
        }
    }

    /**
     * Handle export button click
     * @param {Event} event - Click event
     */
    async handleExportClick(event) {
        const button = event.currentTarget;

        try {
            // Show loading state
            this.showExportLoading(button);

            // Get export stats
            const stats = this.csvExporter.getExportStats();

            // Confirm export for large datasets
            if (stats.recordsToExport > 10000) {
                const confirmed = confirm(
                    `You are about to export ${stats.recordsToExport.toLocaleString()} records (${stats.estimatedFileSize}). This may take a moment. Continue?`
                );

                if (!confirmed) {
                    this.hideExportLoading(button);
                    return;
                }
            }

            // Perform export
            await this.csvExporter.exportToCSV();

            // Show success message
            this.showExportSuccess(stats.recordsToExport);

        } catch (error) {
            ErrorHandler.handleError(error, 'Export');
        } finally {
            this.hideExportLoading(button);
        }
    }

    /**
     * Show export loading state
     * @param {HTMLElement} button - Export button element
     */
    showExportLoading(button) {
        button.classList.add('btn--loading');
        button.disabled = true;
        button.setAttribute('aria-label', 'Exporting data...');
    }

    /**
     * Hide export loading state
     * @param {HTMLElement} button - Export button element
     */
    hideExportLoading(button) {
        button.classList.remove('btn--loading');
        button.disabled = false;
        button.setAttribute('aria-label', 'Export filtered results to CSV');
    }

    /**
     * Show export success message
     * @param {number} recordCount - Number of exported records
     */
    showExportSuccess(recordCount) {
        // Create success message
        const message = `Successfully exported ${recordCount.toLocaleString()} records to CSV file.`;

        // Show temporary success indicator
        const exportBtn = document.getElementById('exportBtn');
        if (exportBtn) {
            const originalText = exportBtn.textContent;
            exportBtn.textContent = '✓ Exported';
            exportBtn.classList.add('btn--success');

            setTimeout(() => {
                exportBtn.textContent = originalText;
                exportBtn.classList.remove('btn--success');
            }, 2000);
        }

        console.log(message);
    }
}/**
 * M
odal controller for handling modal dialogs
 */
class ModalController {
    constructor() {
        this.currentModal = null;
        this.setupEventListeners();
    }

    /**
     * Setup global modal event listeners
     */
    setupEventListeners() {
        // Close modal on backdrop click
        document.addEventListener('click', (event) => {
            if (event.target.classList.contains('modal__backdrop')) {
                this.closeModal();
            }
        });

        // Close modal on escape key
        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape' && this.currentModal) {
                this.closeModal();
            }
        });

        // Legend button
        const legendBtn = document.getElementById('legendBtn');
        if (legendBtn) {
            legendBtn.addEventListener('click', () => this.openLegendModal());
        }

        // Modal close buttons
        document.addEventListener('click', (event) => {
            if (event.target.classList.contains('modal__close')) {
                this.closeModal();
            }
        });
    }

    /**
     * Open filing type legend modal
     */
    openLegendModal() {
        const modal = document.getElementById('legendModal');
        if (modal) {
            this.openModal(modal);
        }
    }

    /**
     * Open a modal
     * @param {HTMLElement} modal - Modal element to open
     */
    openModal(modal) {
        this.currentModal = modal;
        modal.style.display = 'flex';
        modal.setAttribute('aria-hidden', 'false');

        // Focus management
        const firstFocusable = modal.querySelector('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
        if (firstFocusable) {
            firstFocusable.focus();
        }

        // Prevent body scroll
        document.body.style.overflow = 'hidden';
    }

    /**
     * Close current modal
     */
    closeModal() {
        if (this.currentModal) {
            this.currentModal.style.display = 'none';
            this.currentModal.setAttribute('aria-hidden', 'true');
            this.currentModal = null;

            // Restore body scroll
            document.body.style.overflow = '';

            // Return focus to trigger element (legend button)
            const legendBtn = document.getElementById('legendBtn');
            if (legendBtn) {
                legendBtn.focus();
            }
        }
    }
}

/**
 * Tooltip controller for handling hover tooltips
 */
class TooltipController {
    constructor() {
        this.currentTooltip = null;
        this.showDelay = 500;
        this.hideDelay = 100;
        this.showTimer = null;
        this.hideTimer = null;

        this.setupEventListeners();
    }

    /**
     * Setup tooltip event listeners
     */
    setupEventListeners() {
        // Use event delegation for dynamic content
        document.addEventListener('mouseenter', this.handleMouseEnter.bind(this), true);
        document.addEventListener('mouseleave', this.handleMouseLeave.bind(this), true);
        document.addEventListener('focus', this.handleFocus.bind(this), true);
        document.addEventListener('blur', this.handleBlur.bind(this), true);
    }

    /**
     * Handle mouse enter events
     * @param {Event} event - Mouse enter event
     */
    handleMouseEnter(event) {
        const element = event.target;

        // Check if element has tooltip content
        if (this.shouldShowTooltip(element)) {
            this.clearHideTimer();
            this.showTimer = setTimeout(() => {
                this.showTooltip(element);
            }, this.showDelay);
        }
    }

    /**
     * Handle mouse leave events
     * @param {Event} event - Mouse leave event
     */
    handleMouseLeave(event) {
        const element = event.target;

        if (this.shouldShowTooltip(element)) {
            this.clearShowTimer();
            this.hideTimer = setTimeout(() => {
                this.hideTooltip();
            }, this.hideDelay);
        }
    }

    /**
     * Handle focus events for keyboard accessibility
     * @param {Event} event - Focus event
     */
    handleFocus(event) {
        const element = event.target;

        if (this.shouldShowTooltip(element)) {
            this.clearHideTimer();
            this.showTooltip(element);
        }
    }

    /**
     * Handle blur events
     * @param {Event} event - Blur event
     */
    handleBlur(event) {
        const element = event.target;

        if (this.shouldShowTooltip(element)) {
            this.hideTooltip();
        }
    }

    /**
     * Check if element should show tooltip
     * @param {HTMLElement} element - Element to check
     * @returns {boolean} Whether tooltip should be shown
     */
    shouldShowTooltip(element) {
        return element &&
            element.classList &&
            element.classList.contains('truncated') &&
            element.title &&
            element.title.trim().length > 0;
    }

    /**
     * Show tooltip for element
     * @param {HTMLElement} element - Element to show tooltip for
     */
    showTooltip(element) {
        this.hideTooltip(); // Hide any existing tooltip

        const tooltipText = element.title;
        if (!tooltipText) return;

        // Create tooltip element
        const tooltip = document.createElement('div');
        tooltip.className = 'tooltip';
        tooltip.textContent = tooltipText;
        tooltip.setAttribute('role', 'tooltip');

        // Add to DOM
        document.body.appendChild(tooltip);

        // Position tooltip
        this.positionTooltip(tooltip, element);

        // Show tooltip
        requestAnimationFrame(() => {
            tooltip.classList.add('show');
        });

        this.currentTooltip = tooltip;

        // Temporarily remove title to prevent browser tooltip
        element.setAttribute('data-original-title', tooltipText);
        element.removeAttribute('title');
    }

    /**
     * Position tooltip relative to element
     * @param {HTMLElement} tooltip - Tooltip element
     * @param {HTMLElement} element - Target element
     */
    positionTooltip(tooltip, element) {
        const elementRect = element.getBoundingClientRect();
        const tooltipRect = tooltip.getBoundingClientRect();

        // Calculate position
        let left = elementRect.left + (elementRect.width / 2) - (tooltipRect.width / 2);
        let top = elementRect.top - tooltipRect.height - 8;

        // Adjust for viewport boundaries
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;

        // Horizontal adjustment
        if (left < 8) {
            left = 8;
        } else if (left + tooltipRect.width > viewportWidth - 8) {
            left = viewportWidth - tooltipRect.width - 8;
        }

        // Vertical adjustment (show below if not enough space above)
        if (top < 8) {
            top = elementRect.bottom + 8;
            tooltip.classList.add('tooltip-below');
        }

        tooltip.style.left = `${left}px`;
        tooltip.style.top = `${top}px`;
    }

    /**
     * Hide current tooltip
     */
    hideTooltip() {
        if (this.currentTooltip) {
            this.currentTooltip.classList.remove('show');

            setTimeout(() => {
                if (this.currentTooltip && this.currentTooltip.parentNode) {
                    this.currentTooltip.parentNode.removeChild(this.currentTooltip);
                }
                this.currentTooltip = null;
            }, 150);
        }

        // Restore original titles
        const elementsWithOriginalTitle = document.querySelectorAll('[data-original-title]');
        elementsWithOriginalTitle.forEach(element => {
            const originalTitle = element.getAttribute('data-original-title');
            element.setAttribute('title', originalTitle);
            element.removeAttribute('data-original-title');
        });
    }

    /**
     * Clear show timer
     */
    clearShowTimer() {
        if (this.showTimer) {
            clearTimeout(this.showTimer);
            this.showTimer = null;
        }
    }

    /**
     * Clear hide timer
     */
    clearHideTimer() {
        if (this.hideTimer) {
            clearTimeout(this.hideTimer);
            this.hideTimer = null;
        }
    }
}

/**
 * Statistics controller for managing summary statistics
 */
class StatisticsController {
    constructor(dataManager) {
        this.dataManager = dataManager;
    }

    /**
     * Update all statistics displays
     */
    updateStatistics() {
        const stats = this.dataManager.getStatistics();

        this.updateTotalRecords(stats.totalRecords);
        this.updateFilteredRecords(stats.filteredRecords);
        this.updateDateRange(stats.dateRange);
    }

    /**
     * Update total records display
     * @param {number} count - Total record count
     */
    updateTotalRecords(count) {
        const element = document.getElementById('totalRecords');
        if (element) {
            element.textContent = count.toLocaleString();
        }
    }

    /**
     * Update filtered records display
     * @param {number} count - Filtered record count
     */
    updateFilteredRecords(count) {
        const element = document.getElementById('filteredRecords');
        if (element) {
            element.textContent = count.toLocaleString();

            // Add filtered indicator if different from total
            const totalCount = this.dataManager.getMembers().length;
            if (count < totalCount) {
                element.classList.add('filtered');
                element.title = `Showing ${count.toLocaleString()} of ${totalCount.toLocaleString()} total records`;
            } else {
                element.classList.remove('filtered');
                element.title = '';
            }
        }
    }

    /**
     * Update date range display
     * @param {string} dateRange - Date range string
     */
    updateDateRange(dateRange) {
        const element = document.getElementById('dateRange');
        if (element) {
            element.textContent = dateRange;
        }
    }

    /**
     * Get detailed statistics for display
     * @returns {Object} Detailed statistics
     */
    getDetailedStatistics() {
        const stats = this.dataManager.getStatistics();
        const members = this.dataManager.getMembers();

        // Calculate additional statistics
        const stateDistribution = {};
        const filingTypeDistribution = {};
        const yearDistribution = {};

        members.forEach(member => {
            // State distribution
            const state = member.stateDst ? member.stateDst.substring(0, 2) : 'Unknown';
            stateDistribution[state] = (stateDistribution[state] || 0) + 1;

            // Filing type distribution
            const filingType = member.filingType || 'Unknown';
            filingTypeDistribution[filingType] = (filingTypeDistribution[filingType] || 0) + 1;

            // Year distribution
            const year = member.year || 'Unknown';
            yearDistribution[year] = (yearDistribution[year] || 0) + 1;
        });

        return {
            ...stats,
            stateDistribution,
            filingTypeDistribution,
            yearDistribution
        };
    }
}

/**
 * Main Application Controller
 * Coordinates all components and manages application lifecycle
 */
class FinancialDisclosureApp {
    constructor() {
        this.dataManager = null;
        this.tableRenderer = null;
        this.searchController = null;
        this.sortController = null;
        this.exportController = null;
        this.modalController = null;
        this.tooltipController = null;
        this.statisticsController = null;

        this.isInitialized = false;
        this.xmlFilename = '2025FD.xml';
    }

    /**
     * Initialize the application
     */
    async init() {
        try {
            console.log('Initializing Financial Disclosure Viewer...');
            performanceMonitor.startTimer('app-initialization');

            // Initialize core components
            this.initializeComponents();

            // Load and parse data
            await this.loadData();

            // Setup keyboard shortcuts
            this.setupKeyboardShortcuts();

            // Setup accessibility features
            this.setupAccessibility();

            // Mark as initialized
            this.isInitialized = true;

            console.log('Application initialized successfully');
            performanceMonitor.logMemoryUsage();

        } catch (error) {
            ErrorHandler.handleError(error, 'Application Initialization');
        } finally {
            performanceMonitor.endTimer('app-initialization');
        }
    }

    /**
     * Initialize all component instances
     */
    initializeComponents() {
        // Initialize data manager
        this.dataManager = new DataManager();

        // Initialize UI controllers
        this.modalController = new ModalController();
        this.tooltipController = new TooltipController();
        this.statisticsController = new StatisticsController(this.dataManager);

        // Initialize table renderer
        const tableElement = document.getElementById('dataTable');
        if (tableElement) {
            this.tableRenderer = new TableRenderer(tableElement, this.dataManager);
        }

        // Initialize search controller
        const searchInput = document.getElementById('searchInput');
        if (searchInput && this.tableRenderer) {
            this.searchController = new SearchController(searchInput, this.dataManager, this.tableRenderer);
        }

        // Initialize sort controller
        if (tableElement && this.tableRenderer) {
            this.sortController = new SortController(tableElement, this.dataManager, this.tableRenderer);
        }

        // Initialize export controller
        this.exportController = new ExportController(this.dataManager);

        console.log('Components initialized');
    }

    /**
     * Load and parse XML data
     */
    async loadData() {
        try {
            console.log(`Loading data from ${this.xmlFilename}...`);

            // Show loading state
            this.showLoadingState();

            // Load XML data
            const members = await this.dataManager.loadXMLFile(this.xmlFilename);

            // Render initial table
            this.tableRenderer.render(members);

            // Update statistics
            this.statisticsController.updateStatistics();

            // Hide loading state
            this.hideLoadingState();

            console.log(`Loaded ${members.length} member records`);

        } catch (error) {
            this.hideLoadingState();
            this.showErrorState(error);
            throw error;
        }
    }

    /**
     * Show loading state
     */
    showLoadingState() {
        this.tableRenderer?.showLoading();

        // Update stats with loading indicators
        const statsElements = ['totalRecords', 'filteredRecords', 'dateRange'];
        statsElements.forEach(id => {
            const element = document.getElementById(id);
            if (element) {
                element.textContent = 'Loading...';
                element.classList.add('updating');
            }
        });
    }

    /**
     * Hide loading state
     */
    hideLoadingState() {
        this.tableRenderer?.hideLoading();

        // Remove loading indicators from stats
        const statsElements = ['totalRecords', 'filteredRecords', 'dateRange'];
        statsElements.forEach(id => {
            const element = document.getElementById(id);
            if (element) {
                element.classList.remove('updating');
            }
        });
    }

    /**
     * Show error state
     * @param {Error} error - Error that occurred
     */
    showErrorState(error) {
        const tableSection = document.getElementById('tableSection');
        const emptyState = document.getElementById('emptyState');

        if (tableSection && emptyState) {
            tableSection.style.display = 'block';
            emptyState.style.display = 'block';

            // Update empty state with error message
            const heading = emptyState.querySelector('h3');
            const paragraph = emptyState.querySelector('p');

            if (heading) heading.textContent = 'Failed to Load Data';
            if (paragraph) {
                paragraph.innerHTML = `
          ${ErrorHandler.getUserFriendlyMessage(error, 'Data Loading')}<br><br>
          <button type="button" class="btn btn--primary" onclick="location.reload()">
            Reload Page
          </button>
        `;
            }
        }
    }

    /**
     * Setup keyboard shortcuts
     */
    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (event) => {
            // Only handle shortcuts when not typing in inputs
            if (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA') {
                return;
            }

            // Handle keyboard shortcuts
            if (event.ctrlKey || event.metaKey) {
                switch (event.key) {
                    case 'f':
                    case 'F':
                        // Focus search input (Ctrl/Cmd + F)
                        event.preventDefault();
                        const searchInput = document.getElementById('searchInput');
                        if (searchInput) {
                            searchInput.focus();
                            searchInput.select();
                        }
                        break;

                    case 'e':
                    case 'E':
                        // Export data (Ctrl/Cmd + E)
                        event.preventDefault();
                        const exportBtn = document.getElementById('exportBtn');
                        if (exportBtn && !exportBtn.disabled) {
                            exportBtn.click();
                        }
                        break;
                }
            } else {
                switch (event.key) {
                    case '?':
                        // Show help/legend
                        event.preventDefault();
                        this.modalController?.openLegendModal();
                        break;

                    case 'Escape':
                        // Clear search
                        if (this.searchController?.getCurrentSearchTerm()) {
                            event.preventDefault();
                            this.searchController.clearSearch();
                        }
                        break;
                }
            }
        });
    }

    /**
     * Setup accessibility features
     */
    setupAccessibility() {
        // Add skip link functionality
        const skipLink = document.createElement('a');
        skipLink.href = '#tableSection';
        skipLink.className = 'skip-link sr-only';
        skipLink.textContent = 'Skip to main content';
        skipLink.addEventListener('focus', () => {
            skipLink.classList.remove('sr-only');
        });
        skipLink.addEventListener('blur', () => {
            skipLink.classList.add('sr-only');
        });

        document.body.insertBefore(skipLink, document.body.firstChild);

        // Add ARIA live region for announcements
        const liveRegion = document.createElement('div');
        liveRegion.id = 'live-region';
        liveRegion.setAttribute('aria-live', 'polite');
        liveRegion.setAttribute('aria-atomic', 'true');
        liveRegion.className = 'sr-only';
        document.body.appendChild(liveRegion);

        // Announce search results
        if (this.searchController) {
            const originalPerformSearch = this.searchController.performSearch.bind(this.searchController);
            this.searchController.performSearch = (searchTerm) => {
                originalPerformSearch(searchTerm);

                // Announce results
                setTimeout(() => {
                    const resultCount = this.dataManager.getFilteredMembers().length;
                    const totalCount = this.dataManager.getMembers().length;

                    let announcement;
                    if (searchTerm.trim()) {
                        announcement = `Search for "${searchTerm}" returned ${resultCount} of ${totalCount} results`;
                    } else {
                        announcement = `Showing all ${totalCount} records`;
                    }

                    this.announceToScreenReader(announcement);
                }, 100);
            };
        }
    }

    /**
     * Announce message to screen readers
     * @param {string} message - Message to announce
     */
    announceToScreenReader(message) {
        const liveRegion = document.getElementById('live-region');
        if (liveRegion) {
            liveRegion.textContent = message;

            // Clear after announcement
            setTimeout(() => {
                liveRegion.textContent = '';
            }, 1000);
        }
    }

    /**
     * Handle window resize events
     */
    handleResize() {
        // Recalculate virtual scrolling if needed
        if (this.tableRenderer?.isVirtualScrolling) {
            this.tableRenderer.renderVisibleRows();
        }

        // Hide tooltips on resize
        this.tooltipController?.hideTooltip();
    }

    /**
     * Handle visibility change (tab switching)
     */
    handleVisibilityChange() {
        if (document.hidden) {
            // Hide tooltips when tab becomes hidden
            this.tooltipController?.hideTooltip();
        }
    }

    /**
     * Get application status
     * @returns {Object} Application status information
     */
    getStatus() {
        return {
            initialized: this.isInitialized,
            dataLoaded: this.dataManager?.getMembers().length > 0,
            recordCount: this.dataManager?.getMembers().length || 0,
            filteredCount: this.dataManager?.getFilteredMembers().length || 0,
            currentSearch: this.searchController?.getCurrentSearchTerm() || '',
            currentSort: this.sortController?.getCurrentSort() || { column: null, direction: 'asc' },
            components: {
                dataManager: !!this.dataManager,
                tableRenderer: !!this.tableRenderer,
                searchController: !!this.searchController,
                sortController: !!this.sortController,
                exportController: !!this.exportController,
                modalController: !!this.modalController,
                tooltipController: !!this.tooltipController,
                statisticsController: !!this.statisticsController
            }
        };
    }

    /**
     * Cleanup resources
     */
    destroy() {
        // Clear any running timers
        if (this.searchController?.debounceTimer) {
            clearTimeout(this.searchController.debounceTimer);
        }

        if (this.tooltipController) {
            this.tooltipController.clearShowTimer();
            this.tooltipController.clearHideTimer();
            this.tooltipController.hideTooltip();
        }

        // Remove event listeners
        // (In a real application, you'd want to track and remove all listeners)

        console.log('Application destroyed');
    }
}

// Global application instance
let app = null;

/**
 * Initialize application when DOM is ready
 */
document.addEventListener('DOMContentLoaded', async () => {
    try {
        app = new FinancialDisclosureApp();
        await app.init();

        // Setup global event handlers
        window.addEventListener('resize', () => app.handleResize());
        document.addEventListener('visibilitychange', () => app.handleVisibilityChange());

        // Setup beforeunload handler for cleanup
        window.addEventListener('beforeunload', () => {
            if (app) {
                app.destroy();
            }
        });

    } catch (error) {
        console.error('Failed to initialize application:', error);
        ErrorHandler.handleError(error, 'Application Startup');
    }
});

// Export for debugging/testing
if (typeof window !== 'undefined') {
    window.FinancialDisclosureApp = {
        app: () => app,
        getStatus: () => app?.getStatus(),
        performanceMonitor,
        DataValidator,
        ErrorHandler
    };
}