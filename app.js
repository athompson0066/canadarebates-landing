// CanadaRebates Landing — app.js
// n8n webhook: https://n8n.srv1524386.hstgr.cloud/webhook/canada-rebates

const WEBHOOK_URL = 'https://n8n.srv1524386.hstgr.cloud/webhook/canada-rebates';

// DOM elements
const form = document.getElementById('search-form');
const searchBtn = document.getElementById('search-btn');
const cityInput = document.getElementById('city-input');
const provinceSelect = document.getElementById('province-select');
const loadingOverlay = document.getElementById('loading-overlay');
const loadingCity = document.getElementById('loading-city');
const resultsSection = document.getElementById('results-section');
const resultsHeading = document.getElementById('results-heading');
const resultsSubheading = document.getElementById('results-subheading');
const rebatesSummary = document.getElementById('rebates-summary');
const contractorsGrid = document.getElementById('contractors-grid');
const errorToast = document.getElementById('error-toast');
const liveCount = document.getElementById('live-count');

// ─── Form Submit ───────────────────────────────────────────────
form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const city = cityInput.value.trim();
  const province = provinceSelect.value;

  if (!city || !province) {
    showError('Please enter a city and select a province.');
    return;
  }

  setLoading(true, city);
  window.scrollTo({ top: 0, behavior: 'smooth' });

  try {
    const response = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ city, province })
    });

    if (!response.ok) throw new Error(`Webhook returned ${response.status}`);

    const data = await response.json();
    renderResults(data, city, province);
  } catch (err) {
    console.error('Webhook error:', err);
    // Fallback: load from Supabase directly
    await loadFromSupabase(city, province);
  } finally {
    setLoading(false);
  }
});

// ─── Load from Supabase directly (fallback) ─────────────────────
async function loadFromSupabase(city, province) {
  try {
    const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlybHh4ZW9vY3FrdGl1dWxmdXFiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg5MDU2MTgsImV4cCI6MjA3NDQ4MTYxOH0.1rjQgX34Kj8R_ibQ6LsmXl6J3WI8d5kEXrk3SbB6iyg';
    const SUPABASE_URL = 'https://irlxxeoocqktiuulfuqb.supabase.co';

    // Try city match first, fall back to province
    let url = `${SUPABASE_URL}/rest/v1/contractors?province=eq.${province}&tier=eq.gold&is_verified=eq.true&select=*&order=rating.desc&limit=12`;
    
    const res = await fetch(url, {
      headers: {
        'apikey': ANON_KEY,
        'Authorization': `Bearer ${ANON_KEY}`
      }
    });

    if (!res.ok) throw new Error('Supabase error');
    const contractors = await res.json();

    // Also try city filter if available
    const cityRes = await fetch(`${SUPABASE_URL}/rest/v1/contractors?province=eq.${province}&city=ilike.*${city}*&select=*&order=rating.desc&limit=12`, {
      headers: {
        'apikey': ANON_KEY,
        'Authorization': `Bearer ${ANON_KEY}`
      }
    });
    
    let cityMatch = [];
    if (cityRes.ok) {
      cityMatch = await cityRes.json();
    }

    const combined = cityMatch.length > 0 ? cityMatch : contractors;
    
    renderResults({
      rebates: getRebatesForProvince(province),
      contractors: combined,
      city,
      province
    }, city, province);

  } catch (err) {
    console.error('Supabase fallback error:', err);
    showError('Something went wrong. Please try again.');
    setLoading(false);
  }
}

// ─── Render Results ─────────────────────────────────────────────
function renderResults(data, city, province) {
  resultsHeading.textContent = `Results for ${city}, ${province}`;
  
  const prov = province;
  const rebates = data.rebates || getRebatesForProvince(prov);
  const contractors = data.contractors || [];

  // Render rebate summary cards
  rebatesSummary.innerHTML = rebates.slice(0, 3).map(rebate => `
    <div class="rebate-card rounded-2xl p-5 fade-in">
      <div class="flex items-start justify-between mb-2">
        <span class="text-lg">${rebate.emoji}</span>
        <span class="contractor-badge px-2 py-0.5 rounded-full bg-[#6ee7a0]/10 text-[#6ee7a0]">${rebate.category}</span>
      </div>
      <h3 class="font-bold text-white text-sm mb-1">${rebate.name}</h3>
      <p class="text-xs text-mint/50 mb-3">${rebate.description}</p>
      <div class="text-lg font-extrabold text-[#6ee7a0]">${rebate.amount}</div>
    </div>
  `).join('');

  // Render contractor cards
  if (contractors.length === 0) {
    contractorsGrid.innerHTML = `
      <div class="col-span-full text-center py-12">
        <p class="text-mint/50 text-sm mb-4">No verified contractors found for this city yet.</p>
        <p class="text-mint/30 text-xs">We're expanding daily. Try another nearby city or check back soon.</p>
      </div>
    `;
  } else {
    contractorsGrid.innerHTML = contractors.map(c => `
      <div class="rebate-card rounded-2xl p-5 fade-in">
        <div class="flex items-start justify-between mb-3">
          <div>
            <h3 class="font-bold text-white text-sm">${c.name || 'Unnamed Contractor'}</h3>
            ${c.company ? `<p class="text-xs text-mint/50">${c.company}</p>` : ''}
          </div>
          ${c.badge && c.badge !== 'none' ? `
            <span class="contractor-badge px-2 py-0.5 rounded-full ${badgeColor(c.badge)}">${c.badge} shield</span>
          ` : ''}
        </div>
        
        ${c.rating ? `
          <div class="flex items-center gap-1 mb-3">
            <span class="text-[#f59e0b] text-sm">★</span>
            <span class="text-xs text-mint font-semibold">${c.rating}</span>
            ${c.reviews ? `<span class="text-xs text-mint/30">(${c.reviews} reviews)</span>` : ''}
          </div>
        ` : ''}

        ${c.services && c.services.length > 0 ? `
          <div class="flex flex-wrap gap-1 mb-3">
            ${c.services.slice(0, 3).map(s => `<span class="text-xs px-2 py-0.5 rounded-full bg-[#243526] text-mint/60">${s}</span>`).join('')}
          </div>
        ` : ''}

        <div class="space-y-1 mb-4 text-xs text-mint/40">
          ${c.city ? `<div>📍 ${c.city}, ${c.province}</div>` : `<div>📍 ${c.province}</div>`}
          ${c.phone ? `<div>📞 ${c.phone}</div>` : ''}
        </div>

        ${c.email || c.website ? `
          <div class="flex gap-2">
            ${c.email ? `<a href="mailto:${c.email}" class="flex-1 text-center py-2 rounded-xl text-xs font-semibold bg-[#243526] text-mint hover:bg-[#2e4532] transition-colors">Email</a>` : ''}
            ${c.website ? `<a href="${c.website}" target="_blank" rel="noopener" class="flex-1 text-center py-2 rounded-xl text-xs font-semibold bg-[#243526] text-mint hover:bg-[#2e4532] transition-colors">Website</a>` : ''}
          </div>
        ` : ''}
      </div>
    `).join('');
  }

  resultsSection.classList.remove('hidden');
  resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ─── Rebate data by province ────────────────────────────────────
function getRebatesForProvince(province) {
  const rebates = {
    ON: [
      { name: 'Green Home Rebate', category: 'Energy', emoji: '🌿', amount: 'Up to $5,000', description: 'Home energy retrofits, insulation, windows, heat pumps' },
      { name: 'Canada Greener Homes', category: 'Energy', emoji: '🏠', amount: 'Up to $5,000', description: 'Heat pumps, insulation, renewable energy installation' },
      { name: 'Ontario Renovates', category: 'Housing', emoji: '🔧', amount: 'Up to $15,000', description: 'Home repairs for low-income homeowners' },
    ],
    MB: [
      { name: 'Efficiency Manitoba', category: 'Energy', emoji: '⚡', amount: 'Up to $5,000', description: 'Home energy upgrades, insulation, heat pumps' },
      { name: 'Green Manitoba', category: 'Energy', emoji: '🌱', amount: 'Up to $2,500', description: 'Energy efficiency retrofits for homes and businesses' },
      { name: 'Manitoba Housing', category: 'Housing', emoji: '🏘️', amount: 'Varies', description: 'Repair and renovation programs for eligible homeowners' },
    ],
    BC: [
      { name: 'Clean BC Rebates', category: 'Energy', emoji: '🌊', amount: 'Up to $10,000', description: 'Heat pumps, insulation, windows, and energy upgrades' },
      { name: 'BC Energy Coach', category: 'Energy', emoji: '🔋', amount: 'Free audit', description: 'Free home energy assessments for BC residents' },
      { name: 'BC Property Transfer', category: 'Housing', emoji: '🏡', amount: 'Rebate available', description: 'First-time home buyer rebate on property transfer tax' },
    ],
    QC: [
      { name: 'RénoVert', category: 'Energy', emoji: '🏗️', amount: 'Up to $10,000', description: 'Environmentally-friendly home renovations' },
      { name: 'Programme Novoclimat', category: 'Energy', emoji: '❄️', amount: 'Up to $5,000', description: 'New energy-efficient home construction or major renovations' },
      { name: 'Chauffez vert', category: 'Energy', emoji: '🔥', amount: 'Up to $7,500', description: 'Conversion to certified renewable energy heating systems' },
    ],
    NL: [
      { name: 'EfficiencyNL', category: 'Energy', emoji: '⚡', amount: 'Up to $5,000', description: 'Home energy upgrades including heat pumps and insulation' },
      { name: 'Newfoundland Housing', category: 'Housing', emoji: '🏠', amount: 'Varies', description: 'Home repair and renovation assistance for eligible residents' },
    ],
  };
  return rebates[province] || rebates.ON;
}

// ─── Badge color helper ─────────────────────────────────────────
function badgeColor(badge) {
  const colors = {
    gold: 'bg-[#ffd700]/10 text-[#ffd700]',
    silver: 'bg-[#c0c0c0]/10 text-[#c0c0c0]',
    bronze: 'bg-[#cd7f32]/10 text-[#cd7f32]'
  };
  return colors[badge] || 'bg-[#6ee7a0]/10 text-[#6ee7a0]';
}

// ─── Loading state ──────────────────────────────────────────────
function setLoading(on, city = '') {
  loadingCity.textContent = city;
  loadingOverlay.classList.toggle('hidden', !on);
  searchBtn.disabled = on;
  cityInput.disabled = on;
  provinceSelect.disabled = on;
}

// ─── New search ─────────────────────────────────────────────────
function newSearch() {
  resultsSection.classList.add('hidden');
  rebatesSummary.innerHTML = '';
  contractorsGrid.innerHTML = '';
  cityInput.value = '';
  provinceSelect.value = '';
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ─── Error toast ────────────────────────────────────────────────
function showError(msg) {
  errorToast.textContent = msg;
  errorToast.classList.remove('hidden');
  setTimeout(() => errorToast.classList.add('hidden'), 4000);
}
