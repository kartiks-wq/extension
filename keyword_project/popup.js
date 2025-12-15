document.addEventListener('DOMContentLoaded', function() {
    let currentSuggestions = [];
    // When the popup opens, send a message to the background script to get the data.
    chrome.runtime.sendMessage({ action: "getSuggestions" }, function(response) {
        if (chrome.runtime.lastError) {
            document.getElementById('result').innerText = 'An error occurred. Try reloading the extension.';
            console.error(chrome.runtime.lastError.message);
            return;
        }

        const resultDiv = document.getElementById('result');
        const keywordTitle = document.getElementById('keyword-title');
        const downloadBtn = document.getElementById('download-csv');
        const { keyword, suggestions = [], isLoading } = response;

        if (keyword) {
            keywordTitle.textContent = `Suggestions for "${keyword}"`;
        } else {
            keywordTitle.textContent = 'Keyword Suggestions';
            resultDiv.innerText = 'Perform a Google search to get started.';
            return;
        }

        currentSuggestions = suggestions; // Store for the download handler

        if (isLoading) {
            resultDiv.innerText = 'Loading...';
            downloadBtn.style.display = 'none';
        } else if (suggestions.length > 0) {
            const suggestionItems = suggestions.map(item => {
                const formattedVolume = item.volume.toLocaleString();
                return `<li><span class="keyword-text">${item.keyword}</span><span class="keyword-volume">${formattedVolume}</span></li>`;
            }).join('');
            resultDiv.innerHTML = `<ul>${suggestionItems}</ul>`;
            downloadBtn.style.display = 'block'; // Show the button
        } else {
            resultDiv.innerText = 'No suggestions found.';
            downloadBtn.style.display = 'none';
        }
    });

    document.getElementById('download-csv').addEventListener('click', () => {
        if (currentSuggestions.length === 0) {
            return;
        }

        // Prepare CSV content
        let csvContent = "data:text/csv;charset=utf-8,";
        csvContent += "Keyword,Volume\r\n"; // Add header row

        currentSuggestions.forEach(item => {
            // Handle keywords that might contain commas by enclosing them in quotes
            const keyword = `"${item.keyword.replace(/"/g, '""')}"`;
            const row = `${keyword},${item.volume}`;
            csvContent += row + "\r\n";
        });

        // Create and trigger download
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        
        // Get the original search term for the filename
        const keywordTitleText = document.getElementById('keyword-title').textContent;
        const originalKeyword = keywordTitleText.match(/"(.*?)"/);
        const filename = originalKeyword ? `suggestions_${originalKeyword[1]}.csv` : "keyword_suggestions.csv";

        link.setAttribute("download", filename);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    });
});
