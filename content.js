// content.js

let suggestionsContainer; // Holds the UI for our suggestions

/**
 * A debounce function to limit the rate at which a function gets called.
 * This prevents sending too many requests while the user is typing.
 */
function debounce(func, delay) {
    let timeout;
    return function(...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), delay);
    };
}

const handleInput = (event) => {
    const keyword = event.target.value;
    // Only send a message if the keyword is not empty
    if (keyword && keyword.trim().length > 0) {
        chrome.runtime.sendMessage({ action: "fetchRealtimeSuggestions", keyword: keyword });
    }
};

// Debounce the input handler to wait 300ms after the user stops typing
const debouncedHandleInput = debounce(handleInput, 300);

/**
 * Finds the main search input on the page and attaches the input listener.
 * Google's search input can have different selectors.
 */
const attachListenerToSearchInput = () => {
    const searchInput = document.querySelector('textarea[name="q"], input[name="q"]');
    if (searchInput) {
        searchInput.addEventListener('input', debouncedHandleInput);
    }
};

// Listen for changes in session storage
chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'session' && changes.searchData) {
        const { newValue } = changes.searchData;
        updateSuggestionsUI(newValue);
    }
});

/**
 * Creates and injects the suggestions container into the page if it doesn't exist.
 */
function createSuggestionsContainer(searchInput) {
    if (document.getElementById('keyword-suggestions-container')) {
        return;
    }

    suggestionsContainer = document.createElement('div');
    suggestionsContainer.id = 'keyword-suggestions-container';
    suggestionsContainer.style.width = searchInput.offsetWidth + 'px';
    suggestionsContainer.style.border = '1px solid #dfe1e5';
    suggestionsContainer.style.borderRadius = '0 0 24px 24px';
    suggestionsContainer.style.marginTop = '-1px';
    suggestionsContainer.style.padding = '10px 0';
    suggestionsContainer.style.backgroundColor = 'white';
    suggestionsContainer.style.display = 'none'; // Initially hidden

    // Find the search form's parent to inject the container after it
    const formParent = searchInput.closest('form')?.parentElement;
    if (formParent) {
        formParent.insertAdjacentElement('afterend', suggestionsContainer);
    }
}

/**
 * Updates the UI with the latest suggestions.
 */
function updateSuggestionsUI({ keyword, suggestions = [], isLoading }) {
    if (!suggestionsContainer) return;

    if (isLoading) {
        suggestionsContainer.style.display = 'block';
        suggestionsContainer.innerHTML = `<div style="padding: 10px 20px; color: #5f6368;">Loading suggestions for "${keyword}"...</div>`;
    } else if (suggestions.length > 0) {
        suggestionsContainer.style.display = 'block';
        const listItems = suggestions.map(item =>
            `<li style="display: flex; justify-content: space-between; padding: 6px 20px;">
                <span>${item.keyword}</span>
                <span style="color: #5f6368;">${item.volume.toLocaleString()}</span>
            </li>`
        ).join('');
        suggestionsContainer.innerHTML = `<ul style="list-style: none; margin: 0; padding: 0;">${listItems}</ul>`;
    } else {
        suggestionsContainer.style.display = 'none';
    }
}

// Initial attempt to attach the listener
attachListenerToSearchInput();

// Also, check for initial data when the page loads
chrome.storage.session.get("searchData").then(({ searchData }) => {
    if (searchData) {
        const searchInput = document.querySelector('textarea[name="q"], input[name="q"]');
        if (searchInput && searchInput.value === searchData.keyword) {
            createSuggestionsContainer(searchInput);
            updateSuggestionsUI(searchData);
        }
    }
});