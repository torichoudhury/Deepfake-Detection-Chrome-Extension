// Function to format date
function formatDate(timestamp) {
    const date = new Date(timestamp);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      hour12: true
    });
  }
  
  // Function to create a history card element
  function createHistoryCard(prediction, index) {
    const historyCard = document.createElement('div');
    historyCard.className = 'history-card';
    historyCard.setAttribute('data-index', index);
  
    // Determine badge class based on prediction result
    const badgeClass = prediction.class.toLowerCase() === 'real' ? 'badge-real' : 'badge-fake';
  
    historyCard.innerHTML = `
      <div class="card-image">
        <img src="data:image/png;base64,${prediction.image}" alt="Analyzed image">
      </div>
      <div class="card-details">
        <div class="prediction-date">${formatDate(prediction.timestamp)}</div>
        <div class="prediction-result">
          <span class="result-badge ${badgeClass}">${prediction.class}</span>
          <span class="confidence-text">${(prediction.confidence * 100).toFixed(1)}% confidence</span>
        </div>
      </div>
      <div class="card-actions">
        <button class="action-btn btn-view" data-index="${index}">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
            <circle cx="12" cy="12" r="3"></circle>
          </svg>
          View Details
        </button>
        <button class="action-btn btn-delete" data-index="${index}">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M3 6h18"></path>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
          </svg>
          Delete
        </button>
      </div>
    `;
  
    return historyCard;
  }
  
  // Function to refresh the history display
  function refreshHistoryDisplay() {
    chrome.storage.local.get('predictionsHistory', (data) => {
      const historyContainer = document.getElementById('historyContainer');
      const emptyState = document.getElementById('emptyState');
      const clearHistoryBtn = document.getElementById('clearHistory');
      
      // Remove all history cards first (except empty state)
      const existingCards = document.querySelectorAll('.history-card');
      existingCards.forEach(card => card.remove());
      
      const predictions = data.predictionsHistory || [];
      
      if (predictions.length === 0) {
        // Show empty state and hide clear button
        emptyState.style.display = 'flex';
        clearHistoryBtn.style.display = 'none';
      } else {
        // Hide empty state and show clear button
        emptyState.style.display = 'none';
        clearHistoryBtn.style.display = 'flex';
        
        // Add history cards in reverse chronological order (newest first)
        predictions.slice().reverse().forEach((prediction, index) => {
          const historyCard = createHistoryCard(prediction, index);
          historyContainer.appendChild(historyCard);
        });
      }
    });
  }
  
  // Event delegation for view and delete buttons
  document.addEventListener('click', (event) => {
    // Handle view button click
    if (event.target.closest('.btn-view')) {
      const button = event.target.closest('.btn-view');
      const index = button.getAttribute('data-index');
      
      chrome.storage.local.get('predictionsHistory', (data) => {
        const predictions = data.predictionsHistory || [];
        const reversedIndex = predictions.length - 1 - parseInt(index);
        
        if (predictions[reversedIndex]) {
          // Store as last prediction and redirect to dashboard
          chrome.storage.local.set({ 
            lastPrediction: predictions[reversedIndex] 
          }, () => {
            window.location.href = 'dashboard.html';
          });
        }
      });
    }
    
    // Handle delete button click
    if (event.target.closest('.btn-delete')) {
      const button = event.target.closest('.btn-delete');
      const index = button.getAttribute('data-index');
      
      chrome.storage.local.get('predictionsHistory', (data) => {
        const predictions = data.predictionsHistory || [];
        const reversedIndex = predictions.length - 1 - parseInt(index);
        
        if (predictions[reversedIndex]) {
          // Remove the prediction at this index
          predictions.splice(reversedIndex, 1);
          
          // Save updated history
          chrome.storage.local.set({ 
            predictionsHistory: predictions 
          }, () => {
            refreshHistoryDisplay();
          });
        }
      });
    }
  });
  
  // Handle clear all history
  document.getElementById('clearHistory').addEventListener('click', () => {
    if (confirm('Are you sure you want to clear all prediction history?')) {
      chrome.storage.local.set({ predictionsHistory: [] }, () => {
        refreshHistoryDisplay();
      });
    }
  });
  
  // Navigation handler
  document.addEventListener("DOMContentLoaded", function () {
    document.querySelector(".nav-buttons button:nth-child(1)")
      .addEventListener("click", () => {
        window.location.href = "dashboard.html";
      });
  
    document.querySelector(".nav-buttons button:nth-child(2)")
      .addEventListener("click", () => {
        window.location.href = "history.html";
      });
  
    document.querySelector(".nav-buttons button:nth-child(3)")
      .addEventListener("click", () => {
        window.location.href = "about.html";
      });
  
    // Initial load of history
    refreshHistoryDisplay();
  });