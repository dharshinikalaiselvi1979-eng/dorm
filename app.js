const STORAGE_KEY = 'dorm-marketplace-state';
const CLAIM_TIMEOUT_MS = 30000;
const sessionId = sessionStorage.getItem('dormMarketplaceSession') || crypto.randomUUID();
sessionStorage.setItem('dormMarketplaceSession', sessionId);
const sessionStatusEl = document.getElementById('sessionId');
const itemsContainer = document.getElementById('itemsContainer');
const itemForm = document.getElementById('itemForm');
const itemTemplate = document.getElementById('itemTemplate');
let state = loadState();
let refreshTimer = null;

sessionStatusEl.textContent = sessionId.slice(0, 8);

itemForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const item = createListing();
  if (!item) return;
  state = readState();
  const updated = saveState((draft) => {
    draft.items.unshift(item);
  });
  if (updated) {
    render();
    itemForm.reset();
  } else {
    alert('Unable to publish listing. Please retry.');
  }
});

window.addEventListener('storage', (event) => {
  if (event.key === STORAGE_KEY) {
    state = readState();
    render();
  }
});

function createListing() {
  const title = document.getElementById('itemTitle').value.trim();
  const category = document.getElementById('itemCategory').value;
  const description = document.getElementById('itemDescription').value.trim();
  const location = document.getElementById('itemLocation').value.trim();
  if (!title || !description || !location) return null;
  return {
    id: crypto.randomUUID(),
    title,
    category,
    description,
    location,
    state: 'available',
    sellerNote: 'Seller override available',
    createdAt: Date.now(),
    version: 1,
  };
}

function loadState() {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) {
    try {
      const parsed = JSON.parse(stored);
      if (parsed && Array.isArray(parsed.items)) return parsed;
    } catch (err) {
      console.error('Invalid stored state', err);
    }
  }
  const initial = {
    version: 1,
    items: [
      {
        id: crypto.randomUUID(),
        title: 'Calculus Textbook',
        category: 'Textbook',
        description: 'Briefly used, includes notes. Pick up at Maple Hall lounge.',
        location: 'Maple Hall lounge',
        state: 'available',
        sellerNote: 'Ready for in-person handoff.',
        createdAt: Date.now() - 100000,
        version: 1,
      },
      {
        id: crypto.randomUUID(),
        title: 'Mini Fridge',
        category: 'Furniture',
        description: 'Clean and cold, perfect for dorm rooms.',
        location: 'Oak Dorm front desk',
        state: 'available',
        sellerNote: 'Message seller after claim.',
        createdAt: Date.now() - 500000,
        version: 1,
      },
      {
        id: crypto.randomUUID(),
        title: 'Bike',
        category: 'Other',
        description: 'Good condition, one gear. Pickup near campus bike rack.',
        location: 'Campus bike rack',
        state: 'available',
        sellerNote: 'Claim and pick up quickly.',
        createdAt: Date.now() - 250000,
        version: 1,
      },
    ],
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(initial));
  return initial;
}

function readState() {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) return state;
  try {
    return JSON.parse(stored);
  } catch {
    return state;
  }
}

function saveState(updateFn) {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const current = readState();
    const next = { version: current.version + 1, items: JSON.parse(JSON.stringify(current.items)) };
    updateFn(next);
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const fresh = raw ? JSON.parse(raw) : null;
      if (fresh && fresh.version !== current.version) {
        if (attempt === 0) continue;
        return false;
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      state = next;
      return true;
    } catch (err) {
      console.error('Failed to save state', err);
      return false;
    }
  }
  return false;
}

function updateClaimExpiry() {
  const now = Date.now();
  const hasExpired = state.items.some((item) => item.state === 'claimed' && item.expiresAt && item.expiresAt <= now && !item.pickupConfirmed);
  if (!hasExpired) return;
  saveState((draft) => {
    draft.items.forEach((item) => {
      if (item.state === 'claimed' && item.expiresAt && item.expiresAt <= now && !item.pickupConfirmed) {
        item.state = 'available';
        delete item.claimedBy;
        delete item.claimedAt;
        delete item.expiresAt;
        item.sellerNote = 'Claim expired; item is available again.';
      }
    });
  });
}

function render() {
  updateClaimExpiry();
  clearInterval(refreshTimer);
  refreshTimer = setInterval(() => {
    state = readState();
    updateClaimExpiry();
    render();
  }, 1000);

  itemsContainer.innerHTML = '';
  const sorted = [...state.items].sort((a, b) => b.createdAt - a.createdAt);
  sorted.forEach((item) => {
    const clone = itemTemplate.content.cloneNode(true);
    const card = clone.querySelector('.item-card');
    clone.querySelector('.item-title').textContent = item.title;
    clone.querySelector('.item-meta').textContent = `${item.category} · Listed at ${new Date(item.createdAt).toLocaleDateString()}`;
    clone.querySelector('.item-description').textContent = item.description;
    clone.querySelector('.item-location').textContent = `Pickup: ${item.location}`;

    const statusBadge = clone.querySelector('.status-badge');
    const actions = clone.querySelector('.item-actions');
    const footer = clone.querySelector('.item-footer');

    const now = Date.now();
    let statusLabel = '';
    let badgeClass = '';

    if (item.state === 'available') {
      statusLabel = 'Available';
      badgeClass = 'status-available';
      addButton(actions, 'Claim Item', () => handleClaim(item.id), 'primary');
    } else if (item.state === 'claimed') {
      statusLabel = 'Claimed';
      badgeClass = 'status-claimed';
      const remaining = item.expiresAt ? Math.max(0, Math.ceil((item.expiresAt - now) / 1000)) : null;
      footer.textContent = item.pickupConfirmed
        ? 'Pickup confirmed. Await completion.'
        : `Claimed by ${item.claimedBy === sessionId ? 'you' : 'another student'}. ${remaining !== null ? `Confirm pickup in ${remaining}s.` : ''}`;
      if (item.claimedBy === sessionId && !item.pickupConfirmed) {
        addButton(actions, 'Confirm Pickup', () => handleConfirmPickup(item.id), 'primary');
        addButton(actions, 'Cancel Claim', () => handleCancelClaim(item.id), 'secondary');
      }
    } else if (item.state === 'sold') {
      statusLabel = 'Sold';
      badgeClass = 'status-sold';
      footer.textContent = 'This item has been marked sold by the seller.';
    }

    if (item.sellerNote) {
      const note = document.createElement('p');
      note.className = 'action-note';
      note.textContent = item.sellerNote;
      card.appendChild(note);
    }

    addButton(actions, 'Mark as Sold', () => handleMarkSold(item.id), 'secondary', 'small');
    addButton(actions, 'Remove Listing', () => handleRemoveListing(item.id), 'danger', 'small');

    statusBadge.textContent = statusLabel;
    statusBadge.className = `status-badge ${badgeClass}`;
    itemsContainer.appendChild(clone);
  });
}

function addButton(container, label, onClick, variant = 'primary', size = '') {
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = label;
  button.className = `${variant === 'secondary' ? 'secondary' : ''} ${variant === 'danger' ? 'danger' : ''} ${size}`.trim();
  button.addEventListener('click', onClick);
  container.appendChild(button);
}

function handleClaim(itemId) {
  const success = saveState((draft) => {
    const item = draft.items.find((entry) => entry.id === itemId);
    if (!item || item.state !== 'available') return;
    item.state = 'claimed';
    item.claimedBy = sessionId;
    item.claimedAt = Date.now();
    item.expiresAt = Date.now() + CLAIM_TIMEOUT_MS;
    item.pickupConfirmed = false;
    item.sellerNote = 'Claim pending. Confirm pickup before timer expires.';
  });
  if (!success) {
    alert('Another student claimed this item first. The listing has been updated.');
  }
  render();
}

function handleConfirmPickup(itemId) {
  const success = saveState((draft) => {
    const item = draft.items.find((entry) => entry.id === itemId);
    if (!item || item.state !== 'claimed' || item.claimedBy !== sessionId) return;
    item.pickupConfirmed = true;
    item.sellerNote = 'Pickup confirmed. Seller should clear the listing once handoff is complete.';
  });
  if (!success) {
    alert('Unable to confirm pickup. Please refresh and try again.');
  }
  render();
}

function handleCancelClaim(itemId) {
  const success = saveState((draft) => {
    const item = draft.items.find((entry) => entry.id === itemId);
    if (!item || item.state !== 'claimed' || item.claimedBy !== sessionId) return;
    item.state = 'available';
    delete item.claimedBy;
    delete item.claimedAt;
    delete item.expiresAt;
    item.pickupConfirmed = false;
    item.sellerNote = 'Claim cancelled by buyer. Item is available again.';
  });
  if (!success) {
    alert('Unable to cancel the claim. Please refresh and try again.');
  }
  render();
}

function handleMarkSold(itemId) {
  const success = saveState((draft) => {
    const item = draft.items.find((entry) => entry.id === itemId);
    if (!item || item.state === 'sold') return;
    item.state = 'sold';
    delete item.claimedBy;
    delete item.claimedAt;
    delete item.expiresAt;
    item.pickupConfirmed = false;
    item.sellerNote = 'Seller marked this listing as sold outside the app.';
  });
  if (!success) {
    alert('Failed to mark sold. Please try again.');
  }
  render();
}

function handleRemoveListing(itemId) {
  const success = saveState((draft) => {
    draft.items = draft.items.filter((entry) => entry.id !== itemId);
  });
  if (!success) {
    alert('Failed to remove listing. Please refresh and try again.');
  }
  state = readState();
  render();
}

render();
