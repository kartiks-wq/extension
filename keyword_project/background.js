// Listen for messages from the popup.
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    // Message from popup to get current data
    if (request.action === "getSuggestions") {
        chrome.storage.session.get("searchData").then(({ searchData }) => {
            sendResponse(searchData || {});
        });
        // Return true to indicate you wish to send a response asynchronously.
        return true;
    }

    // Message from content script with a new keyword
    if (request.action === "fetchRealtimeSuggestions") {
        const keyword = request.keyword;
        chrome.storage.session.get("searchData").then(async ({ searchData }) => {
            if (keyword && keyword !== searchData?.keyword) {
                await chrome.storage.session.set({ searchData: { keyword: keyword, suggestions: [], isLoading: true } });
                fetchSuggestions(keyword);
            }
        });
    }
});

function fetchSuggestions(keyword) {
    const url = `http://suggestqueries.google.com/complete/search?client=chrome&q=${encodeURIComponent(keyword)}`;

    fetch(url)
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            // Google's API returns a non-standard JSON format, so we read it as text first.
            return response.text();
        })
        .then(async (data) => {
            if (data.status === 'success') {
                // Store the final results and set loading to false.
                const { searchData } = await chrome.storage.session.get("searchData");
                await chrome.storage.session.set({ 
                    searchData: { keyword: searchData.keyword, suggestions: data.related_keywords || [], isLoading: false } 
                });
            }

            // The text needs to be parsed manually as it's not a strict JSON object.
            const parsedData = JSON.parse(data);
            const suggestionStrings = parsedData[1];
            let relevanceScores = [];

            // Safely check for relevance scores
            if (parsedData.length > 4 && typeof parsedData[4] === 'object' && parsedData[4]['google:suggestrelevance']) {
                relevanceScores = parsedData[4]['google:suggestrelevance'];
            }

            const suggestions = suggestionStrings.map((suggestion, i) => ({
                keyword: suggestion,
                volume: relevanceScores[i] || 0
            }));

            const { searchData } = await chrome.storage.session.get("searchData");
            if (searchData.keyword === keyword) { // Ensure we are not overwriting a newer search
                const { searchData } = await chrome.storage.session.get("searchData");
                await chrome.storage.session.set({ searchData: { keyword: searchData.keyword, suggestions: suggestions, isLoading: false } });
            }
        })
        .catch(async (error) => {
            console.error('Network or API call failed:', error);
            // On fetch failure, clear suggestions and set loading to false.
            const { searchData } = await chrome.storage.session.get("searchData");
            await chrome.storage.session.set({ searchData: { ...searchData, suggestions: [], isLoading: false } });
        });
}