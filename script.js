/**
 * script.js — VMSS Global Runtime
 *
 * Loaded on every page. Responsibilities:
 *   - Defines the global VMSS state object (window.VMSS) and its event bus
 *   - Provides vmssAnimateNumber() for animated numeric transitions
 *   - Fetches and injects navbar.html / footer.html into placeholder divs
 *   - Initialises per-page features after layout components are ready:
 *     theme toggle, mobile menu, active nav, live state HUD, layer echo,
 *     layer links, join modal, scroll-reveal, back arrows
 *   - Handles Supabase integration for the join form (applicant count + submissions)
 *
 * Execution order:
 *   1. Global constants + vmssAnimateNumber exposed immediately (synchronous)
 *   2. initVmssGlobal() runs as IIFE — sets up window.VMSS
 *   3. Supabase client initialised if library is present
 *   4. DOMContentLoaded fires:
 *      a. enhancePageLayout() + initBackArrows() + initReveal() run immediately
 *      b. navbar.html + footer.html fetched in parallel
 *      c. All nav-dependent inits run inside requestAnimationFrame after injection
 */

const SUPABASE_URL      = 'https://nizitfgihubglrtovget.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_yDPdS68HfKjVQNPQ6KEhyA_333w01sV';

let supabaseClient = null;


// =========================
// VMSS GLOBAL STATE
// =========================
/**
 * Default state shape. Also used as the merge base when loading
 * a partial or corrupted state from localStorage, so every key
 * always has a valid fallback value.
 */
const VMSS_DEFAULT_STATE = {
  selectedLayer: '0',
  stiScore: 43,
  profile: 'Balanced baseline',
  tone: 'Containment threshold engaged',
  lastEvent: 'Baseline loaded',
  values: {
    civic: 11,
    contribution: 11,
    conduct: 8,
    competence: 8,
    endorsement: 6,
    recovery: 5,
    violations: 6,
  }
};

function vmssClone(value) {
  return JSON.parse(JSON.stringify(value));
}

/**
 * Maps a numeric STI score to its layer descriptor.
 * Exposed on window.VMSS.layerForScore so external modules can call it.
 * sti-sim.js has its own copy that also returns a .tone field — this
 * version is intentionally minimal (key, label, short, band only).
 */
function vmssLayerForScore(score) {
  if (score >= 85) return { key:'+1', label:'+1 Sanctuary', short:'+1 Sanctuary', band:'85–100' };
  if (score >= 70) return { key:'0', label:'Main Layer (0)', short:'Layer 0', band:'70–84' };
  if (score >= 50) return { key:'-1', label:'-1 Noncompliance', short:'-1 Noncompliance', band:'50–69' };
  if (score >= 30) return { key:'-2', label:'-2 Violent Offense', short:'-2 Violent Offense', band:'30–49' };
  return { key:'-3', label:'-3 Terminal', short:'-3 Terminal', band:'0–29' };
}

/**
 * Smoothly animates a numeric text element from its current value to target.
 * Uses cubic ease-out and requestAnimationFrame. Respects prefers-reduced-motion.
 * Stores the current value in element.dataset.currentValue so render functions
 * can read the logical value rather than parsing the animated display string.
 * Exposed as window.vmssAnimateNumber for use by sti-sim.js.
 */
function vmssAnimateNumber(element, target, options = {}) {
  if (!element) return;
  const duration = options.duration ?? 520;
  const decimals = options.decimals ?? 0;
  const prefix = options.prefix ?? '';
  const suffix = options.suffix ?? '';
  const start = Number(element.dataset.currentValue ?? element.textContent.replace(/[^0-9.-]/g, '')) || 0;
  const end = Number(target) || 0;
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    element.textContent = `${prefix}${end.toFixed(decimals)}${suffix}`;
    element.dataset.currentValue = String(end);
    return;
  }
  const startTime = performance.now();
  const ease = (t) => 1 - Math.pow(1 - t, 3);
  cancelAnimationFrame(element._vmssRaf || 0);
  const tick = (now) => {
    const progress = Math.min(1, (now - startTime) / duration);
    const value = start + (end - start) * ease(progress);
    element.textContent = `${prefix}${value.toFixed(decimals)}${suffix}`;
    if (progress < 1) {
      element._vmssRaf = requestAnimationFrame(tick);
    } else {
      element.dataset.currentValue = String(end);
      element.textContent = `${prefix}${end.toFixed(decimals)}${suffix}`;
    }
  };
  element._vmssRaf = requestAnimationFrame(tick);
}
window.vmssAnimateNumber = vmssAnimateNumber;

/**
 * initVmssGlobal — sets up window.VMSS, the global state store.
 *
 * window.VMSS provides:
 *   .getState()           — returns a deep clone of current state
 *   .setState(patch, meta)— merges patch, saves to localStorage, fires vmss:state-change
 *   .reset()              — restores default state
 *   .layerForScore(score) — maps score to layer descriptor
 *
 * The vmss:state-change CustomEvent is the cross-component communication bus.
 * Every interactive component (HUD, diagram, STI console) listens for it and
 * fires it via setState, passing a source tag in meta to prevent feedback loops.
 */
(function initVmssGlobal() {
  const STORAGE_KEY = 'vmss_state';
  const safeLoad = () => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return vmssClone(VMSS_DEFAULT_STATE);
      const parsed = JSON.parse(raw);
      return {
        ...vmssClone(VMSS_DEFAULT_STATE),
        ...parsed,
        values: { ...VMSS_DEFAULT_STATE.values, ...(parsed.values || {}) }
      };
    } catch (e) {
      console.warn('VMSS state load failed:', e);
      return vmssClone(VMSS_DEFAULT_STATE);
    }
  };
  const safeSave = (state) => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) { console.warn('VMSS state save failed:', e); }
  };
  const state = safeLoad();
  window.VMSS = {
    state,
    layerForScore: vmssLayerForScore,
    getState() { return vmssClone(this.state); },
    setState(patch = {}, meta = {}) {
      const next = {
        ...this.state,
        ...patch,
        values: { ...this.state.values, ...(patch.values || {}) }
      };
      if ((patch.stiScore ?? next.stiScore) !== undefined && (patch.selectedLayer === undefined)) {
        next.selectedLayer = vmssLayerForScore(Number(next.stiScore) || 0).key;
      }
      this.state = next;
      safeSave(this.state);
      document.dispatchEvent(new CustomEvent('vmss:state-change', { detail: { state: this.getState(), meta } }));
      return this.getState();
    },
    reset() {
      this.state = vmssClone(VMSS_DEFAULT_STATE);
      safeSave(this.state);
      document.dispatchEvent(new CustomEvent('vmss:state-change', { detail: { state: this.getState(), meta: { source: 'reset' } } }));
      return this.getState();
    }
  };
})();

// Supabase client — initialised only if the Supabase SDK is present on the page.
// The SDK is loaded selectively (only on join.html) to avoid unnecessary overhead
// on pages that don't need it.
if (typeof window !== 'undefined' && typeof window.supabase !== 'undefined') {
  try {
    supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  } catch (e) {
    console.warn('Supabase init failed:', e);
    supabaseClient = null;
  }
}

// =========================
// SUPABASE HELPERS
// =========================

/** Fetches the total application count and updates the #applicant-count element. */
function loadApplicantCount() {
  const countEl = document.getElementById('applicant-count');
  if (!countEl || !supabaseClient) return Promise.resolve();

  return supabaseClient
    .from('applications')
    .select('*', { count: 'exact', head: true })
    .then(({ count, error }) => {
      if (error) throw error;
      countEl.textContent = count ?? '0';
    })
    .catch((err) => {
      console.error('Failed to load applicant count:', err);
      countEl.textContent = '—';
    });
}

/** Fetches the 5 most recent applicants and renders their city/country into #recent-applicants. */
function loadRecentApplicants() {
  const container = document.getElementById('recent-applicants');
  if (!container || !supabaseClient) return Promise.resolve();

  return supabaseClient
    .from('applications')
    .select('city, country')
    .order('created_at', { ascending: false })
    .limit(5)
    .then(({ data, error }) => {
      if (error) throw error;

      container.innerHTML = '';

      if (!data || data.length === 0) {
        const empty = document.createElement('div');
        empty.textContent = 'No applications yet.';
        container.appendChild(empty);
        return;
      }

      data.forEach((row) => {
        const city = row.city || '';
        const country = row.country || '';
        const line = document.createElement('div');
        line.textContent = `• ${city}${city && country ? ', ' : ''}${country}`;
        container.appendChild(line);
      });
    })
    .catch((err) => {
      console.error('Failed to load recent applicants:', err);
      container.innerHTML = '<div>—</div>';
    });
}
/**
 * initVmssHud — creates and manages the floating live state panel.
 *
 * The HUD is injected into document.body as an <aside> element.
 * It displays the current STI score, layer, profile name, and last event,
 * updating whenever a vmss:state-change event fires.
 *
 * Idle behaviour: the HUD fades slightly after 2.6s of inactivity.
 *   Any interaction (hover, focus, touch) resets the idle timer.
 *
 * Minimise/expand: persisted in localStorage so the preference survives
 *   page navigation. On mobile (<768px), auto-minimises on load unless
 *   the user has already set an explicit preference.
 *
 * The border glows gold when layer = +1 Sanctuary (via CSS [data-layer="+1"]).
 * The border flashes accent briefly on each state update (vmss-hud.is-updating).
 */
function initVmssHud() {
  if (!document.body || document.getElementById('vmss-hud')) return;
  const savedHudMinimized = localStorage.getItem('vmss_hud_minimized') === 'true';
  const hud = document.createElement('aside');
  hud.id = 'vmss-hud';
  hud.className = 'vmss-hud';
  hud.setAttribute('aria-label', 'VMSS live state panel');
  hud.innerHTML = `
    <div class="vmss-hud-top">
      <div class="vmss-hud-kicker">VMSS live state</div>
      <button class="vmss-hud-toggle" type="button" aria-expanded="true" aria-label="Minimize live state panel">−</button>
    </div>
    <div class="vmss-hud-body">
      <div class="vmss-hud-row"><span class="vmss-hud-label">Layer</span><strong data-vmss-hud-layer>Main Layer (0)</strong></div>
      <div class="vmss-hud-row"><span class="vmss-hud-label">STI</span><strong data-vmss-hud-score>43</strong></div>
      <div class="vmss-hud-row"><span class="vmss-hud-label">Profile</span><span data-vmss-hud-profile>Balanced baseline</span></div>
      <div class="vmss-hud-row"><span class="vmss-hud-label">Last event</span><span class="vmss-hud-event" data-vmss-hud-event>Baseline loaded</span></div>
    </div>
    <div class="vmss-hud-actions">
      <a class="vmss-hud-btn is-primary" href="simulations.html#sti-console">Open simulation</a>
      <a class="vmss-hud-btn" href="layers.html">Open rings</a>
    </div>
    <div aria-live="polite" aria-atomic="true" class="sr-only" data-vmss-hud-live></div>
  `;
  document.body.appendChild(hud);
  const layerTarget = hud.querySelector('[data-vmss-hud-layer]');
  const scoreTarget = hud.querySelector('[data-vmss-hud-score]');
  const profileTarget = hud.querySelector('[data-vmss-hud-profile]');
  const eventTarget = hud.querySelector('[data-vmss-hud-event]');
  const liveRegion = hud.querySelector('[data-vmss-hud-live]');
  const toggleBtn = hud.querySelector('.vmss-hud-toggle');
  let idleTimer = null;
  const setIdle = (idle) => hud.classList.toggle('is-idle', idle);
  const scheduleIdle = () => {
    clearTimeout(idleTimer);
    setIdle(false);
    idleTimer = setTimeout(() => setIdle(true), 2600);
  };
  const setMinimized = (minimized) => {
    hud.classList.toggle('is-minimized', minimized);
    toggleBtn.textContent = minimized ? '+' : '−';
    toggleBtn.setAttribute('aria-expanded', minimized ? 'false' : 'true');
    toggleBtn.setAttribute('aria-label', minimized ? 'Expand live state panel' : 'Minimize live state panel');
    try {
      localStorage.setItem('vmss_hud_minimized', String(minimized));
    } catch (e) {
      console.warn('HUD minimized state save failed:', e);
    }
  };
  toggleBtn?.addEventListener('click', () => {
    setMinimized(!hud.classList.contains('is-minimized'));
    scheduleIdle();
  });
  ['mouseenter', 'mousemove', 'focusin', 'touchstart'].forEach((evt) => {
    hud.addEventListener(evt, scheduleIdle, { passive: true });
  });
  const apply = (state = window.VMSS?.getState?.() || VMSS_DEFAULT_STATE) => {
    const layer = window.VMSS?.layerForScore?.(Number(state.stiScore) || 0) || vmssLayerForScore(Number(state.stiScore) || 0);
    hud.dataset.layer = state.selectedLayer || layer.key;
    if (layerTarget) layerTarget.textContent = layer.label;
    if (scoreTarget) window.vmssAnimateNumber(scoreTarget, Number(state.stiScore) || 0, { duration: 420 });
    if (profileTarget) profileTarget.textContent = state.profile || 'Balanced baseline';
    if (eventTarget) eventTarget.textContent = state.lastEvent || 'Baseline loaded';
    if (liveRegion) liveRegion.textContent = `STI score ${Number(state.stiScore) || 0}, ${layer.label}.`;
    hud.classList.remove('is-updating');
    void hud.offsetWidth;
    hud.classList.add('is-updating');
    setTimeout(() => hud.classList.remove('is-updating'), 540);
    scheduleIdle();
  };
  document.addEventListener('vmss:state-change', (event) => apply(event.detail?.state));
  const isMobile = () => window.innerWidth < 768;

  /* Auto-minimise on mobile unless user has explicitly set a preference */
  const hasUserPref = localStorage.getItem('vmss_hud_minimized') !== null;
  if (hasUserPref) {
    setMinimized(savedHudMinimized);
  } else {
    setMinimized(isMobile());
  }

  /* Re-evaluate on resize — only when no user preference is stored */
  let resizeRaf = null;
  window.addEventListener('resize', () => {
    if (localStorage.getItem('vmss_hud_minimized') !== null) return;
    if (resizeRaf) return;
    resizeRaf = requestAnimationFrame(() => {
      setMinimized(isMobile());
      resizeRaf = null;
    });
  }, { passive: true });

  apply();
}

/**
 * initVmssLayerEcho — syncs text elements marked with data-vmss-*-echo
 * to the current global state values.
 *
 * Any element with [data-vmss-layer-echo], [data-vmss-score-echo], or
 * [data-vmss-event-echo] will have its textContent updated whenever the
 * global state changes. Used on the systems.html page to show the live
 * STI layer and score in the cohesion layer banner without coupling
 * that page directly to the simulation console.
 */
function initVmssLayerEcho() {
  const layerTargets = Array.from(document.querySelectorAll('[data-vmss-layer-echo]'));
  const scoreTargets = Array.from(document.querySelectorAll('[data-vmss-score-echo]'));
  const eventTargets = Array.from(document.querySelectorAll('[data-vmss-event-echo]'));
  if (!layerTargets.length && !scoreTargets.length && !eventTargets.length) return;
  if (!window.VMSS) return;
  const apply = () => {
    const state = window.VMSS.getState();
    const layer = window.VMSS.layerForScore(state.stiScore);
    layerTargets.forEach((el) => el.textContent = layer.label);
    scoreTargets.forEach((el) => el.textContent = String(state.stiScore));
    eventTargets.forEach((el) => el.textContent = state.lastEvent || 'Baseline loaded');
  };
  apply();
  document.addEventListener('vmss:state-change', apply);
}

/**
 * initVmssLayerLinks — highlights the layer link that matches the current
 * global selected layer.
 *
 * Any element with [data-layer] gets .is-vmss-current toggled to match the
 * active layer in global state. Clicking a layer link also updates the global
 * state, so the HUD and ring map reflect the selection immediately.
 */
function initVmssLayerLinks() {
  const links = Array.from(document.querySelectorAll('[data-layer]'));
  if (!links.length || !window.VMSS) return;
  const apply = () => {
    const state = window.VMSS.getState();
    links.forEach((link) => link.classList.toggle('is-vmss-current', link.dataset.layer === state.selectedLayer));
  };
  links.forEach((link) => {
    link.addEventListener('click', () => {
      window.VMSS.setState({ selectedLayer: link.dataset.layer, lastEvent: `Focused ${link.dataset.layer} ring` }, { source: 'layer-link' });
    });
  });
  apply();
  document.addEventListener('vmss:state-change', apply);
}

// =========================
// THEME
// =========================

/**
 * Returns the user's preferred theme: 'dark' or 'light'.
 * Checks localStorage first, then falls back to the OS preference.
 */
function getPreferredTheme() {
  const saved = localStorage.getItem('theme');
  if (saved === 'light' || saved === 'dark') return saved;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

/**
 * Applies a theme by setting data-theme on <html> and updating the
 * theme toggle button icon. Called on page load and on toggle click.
 */
function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  const toggle = document.getElementById('theme-toggle');
  if (toggle) {
    toggle.innerHTML = theme === 'light'
      ? '<i class="fas fa-sun"></i>'
      : '<i class="fas fa-moon"></i>';
  }
}

/** Wires up the theme toggle button. Runs after the navbar is injected. */
function initThemeToggle() {
  const toggle = document.getElementById('theme-toggle');
  if (!toggle) return;
  applyTheme(getPreferredTheme());
  toggle.addEventListener('click', () => {
    const current = document.documentElement.getAttribute('data-theme') || getPreferredTheme();
    const next = current === 'dark' ? 'light' : 'dark';
    localStorage.setItem('theme', next);
    applyTheme(next);
  });
}

// =========================
// MOBILE MENU
// =========================

/**
 * Wires up the hamburger/close toggle for the mobile nav drawer.
 * Clicking any nav link inside the drawer also closes it.
 * aria-expanded is kept in sync with the open/closed state.
 */
function initMobileMenu() {
  const menuToggle    = document.getElementById('menu-toggle');
  const mobileMenu    = document.getElementById('mobile-menu');
  const hamburgerIcon = document.getElementById('hamburger-icon');
  const closeIcon     = document.getElementById('close-icon');
  const navLinks      = mobileMenu ? mobileMenu.querySelectorAll('a') : [];

  if (!menuToggle || !mobileMenu) return;

  const setExpanded = (open) => {
    menuToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    mobileMenu.classList.toggle('hidden', !open);
    if (hamburgerIcon) hamburgerIcon.classList.toggle('hidden', open);
    if (closeIcon)     closeIcon.classList.toggle('hidden', !open);
  };

  menuToggle.addEventListener('click', () => setExpanded(mobileMenu.classList.contains('hidden')));
  navLinks.forEach((link) => link.addEventListener('click', () => setExpanded(false)));
}

// =========================
// ACTIVE NAV
// =========================

/**
 * Marks the nav link matching the current page with .nav-link-active
 * and aria-current="page". Runs after the navbar is injected so the
 * links exist in the DOM.
 */
function initActiveNav() {
  const navLinks = document.querySelectorAll('.nav-link');
  if (!navLinks.length) return;

  let currentPage = window.location.pathname.split('/').pop();
  if (!currentPage || currentPage === '') currentPage = 'index.html';

  navLinks.forEach((link) => {
    const href = link.getAttribute('href');
    if (!href) return;
    const isActive = href === currentPage;
    link.classList.toggle('nav-link-active', isActive);
    if (isActive) {
      link.setAttribute('aria-current', 'page');
    } else {
      link.removeAttribute('aria-current');
    }
  });
}

// =========================
// DOM READY
// =========================

document.addEventListener('DOMContentLoaded', () => {
  requestAnimationFrame(() => document.body.classList.add('vmss-ui-ready'));

  /**
   * initJoinModal — manages the entry application modal on join.html.
   *
   * Features:
   *   - Opens/closes the modal with aria-hidden toggled correctly
   *   - Focus trap: Tab/Shift+Tab cycle within the modal while open
   *   - Focus returns to the triggering element on close
   *   - Escape key closes the modal; clicking the backdrop also closes it
   *   - Honeypot field blocks bot submissions silently
   *   - 60-second cooldown between submissions (localStorage-based)
   *   - Submits to Supabase, refreshes applicant count and recent list on success
   */
  function initJoinModal() {
    const openBtn    = document.getElementById('open-entry-modal');
    const closeBtn   = document.getElementById('close-entry-modal');
    const entryModal = document.getElementById('entryModal');
    const entryForm = document.getElementById('entryForm');
    const submitBtn = document.getElementById('entry-submit-btn');
    const messageEl = document.getElementById('entry-form-message');

    if (!entryModal) return;

    const lockPage = () => {
      document.body.classList.add('overflow-hidden');
      document.documentElement.classList.add('overflow-hidden');
      document.body.style.touchAction = 'none';
    };

    const unlockPage = () => {
      document.body.classList.remove('overflow-hidden');
      document.documentElement.classList.remove('overflow-hidden');
      document.body.style.touchAction = '';
    };

    const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
    let lastFocused = null;

    const trapFocus = (e) => {
      const focusable = Array.from(entryModal.querySelectorAll(FOCUSABLE));
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.key === 'Tab') {
        if (e.shiftKey) {
          if (document.activeElement === first) { e.preventDefault(); last.focus(); }
        } else {
          if (document.activeElement === last) { e.preventDefault(); first.focus(); }
        }
      }
    };

    const showEntryForm = () => {
      lastFocused = document.activeElement;
      entryModal.classList.remove('hidden');
      entryModal.classList.add('block');
      entryModal.setAttribute('aria-hidden', 'false');
      lockPage();
      requestAnimationFrame(() => {
        const first = entryModal.querySelector(FOCUSABLE);
        if (first) first.focus();
      });
      entryModal.addEventListener('keydown', trapFocus);
    };

    const hideEntryForm = () => {
      entryModal.classList.add('hidden');
      entryModal.classList.remove('block');
      entryModal.setAttribute('aria-hidden', 'true');
      unlockPage();
      entryModal.removeEventListener('keydown', trapFocus);
      if (lastFocused) lastFocused.focus();
    };

    const setMessage = (text, isError = false) => {
      if (!messageEl) return;
      messageEl.textContent = text;
      messageEl.classList.remove('hidden');
      messageEl.style.color = isError ? '#f87171' : '';
    };

    const clearMessage = () => {
      if (!messageEl) return;
      messageEl.textContent = '';
      messageEl.classList.add('hidden');
      messageEl.style.color = '';
    };

    if (openBtn) openBtn.addEventListener('click', showEntryForm);
    if (closeBtn) closeBtn.addEventListener('click', hideEntryForm);

    entryModal.addEventListener('click', (e) => {
      if (e.target === entryModal) hideEntryForm();
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !entryModal.classList.contains('hidden')) {
        hideEntryForm();
      }
    });

    if (!entryForm) return;

    entryForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      clearMessage();

      if (!supabaseClient) {
        setMessage('Submission system is not configured yet.', true);
        return;
      }

      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Submitting...';
      }

      const formData = new FormData(entryForm);

      const honeypot = formData.get('company')?.toString().trim();
      if (honeypot) {
        console.warn('Bot submission blocked by honeypot.');
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = 'Submit Entry Application';
        }
        return;
      }

      const ENTRY_COOLDOWN_MS = 60 * 1000;
      const lastSubmissionTime = localStorage.getItem('vmss_last_submission_time');
      const now = Date.now();

      if (lastSubmissionTime && now - Number(lastSubmissionTime) < ENTRY_COOLDOWN_MS) {
        const secondsLeft = Math.ceil(
          (ENTRY_COOLDOWN_MS - (now - Number(lastSubmissionTime))) / 1000
        );
        setMessage(`Please wait ${secondsLeft} seconds before submitting again.`, true);

        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = 'Submit Entry Application';
        }
        return;
      }

      const payload = {
        full_name: formData.get('full_name')?.toString().trim() || '',
        age: Number(formData.get('age')),
        city: formData.get('city')?.toString().trim() || '',
        state: formData.get('state')?.toString().trim() || '',
        country: formData.get('country')?.toString().trim() || '',
        phone: formData.get('phone')?.toString().trim() || '',
        motivation: formData.get('motivation')?.toString().trim() || '',
        consent_implants: formData.get('consent_implants') === 'on',
        consent_reassignment: formData.get('consent_reassignment') === 'on',
        consent_continuity: formData.get('consent_continuity') === 'on',
        consent_charter: formData.get('consent_charter') === 'on'
      };

      try {
        const { error } = await supabaseClient.from('applications').insert([payload]);
        if (error) throw error;

        localStorage.setItem('vmss_last_submission_time', String(Date.now()));

        if (document.getElementById('applicant-count')) loadApplicantCount();
        if (document.getElementById('recent-applicants')) loadRecentApplicants();

        entryForm.reset();
        hideEntryForm();

        setTimeout(() => {
          alert(`✅ Application Received.

Welcome, citizen.

Your application to The Five Rings has been recorded for review.

The choice — and the consequences — are now yours.`);
        }, 200);
      } catch (err) {
        console.error('Submission error:', err);
        setMessage('Submission failed. Please try again in a moment.', true);
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = 'Submit Entry Application';
        }
      }
    });
  }

  /**
   * initBackArrows — hides the floating back-arrow button when the user
   * scrolls past 150px. Uses requestAnimationFrame to throttle scroll
   * events and avoid layout thrash.
   */
  function initBackArrows() {
    const backArrows = document.querySelectorAll('.back-arrow');
    if (!backArrows.length) return;

    let scrollRaf = null;
    const handleScroll = () => {
      if (scrollRaf) return;
      scrollRaf = requestAnimationFrame(() => {
        const hidden = window.scrollY > 150;
        backArrows.forEach((arrow) => arrow.classList.toggle('scrolled-hidden', hidden));
        scrollRaf = null;
      });
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
  }

  /**
   * enhancePageLayout — applies VMSS design system classes to generic
   * page sections that don't have them hardcoded in their HTML.
   *
   * This keeps individual HTML pages leaner by centralising class
   * application here rather than repeating vmss-main-section,
   * vmss-title, vmss-page-intro etc. on every page individually.
   *
   * Note: the vmss-enhanced-panel-candidate / [data-vmss-panel] selector
   * requires pages to explicitly opt in via a data attribute — the old
   * class*= approach was fragile and matched unintended elements.
   */
  function enhancePageLayout() {
    document.body.classList.add('vmss-page-shell');

    document.querySelectorAll('body > section, main > section').forEach((section) => {
      section.classList.add('vmss-main-section');

      const firstContainer = section.querySelector(':scope > div');
      if (firstContainer) firstContainer.classList.add('vmss-content-frame');

      const firstH1 = section.querySelector('h1');
      if (firstH1) firstH1.classList.add('vmss-title');

      const firstDiv = section.querySelector(':scope > div');
      if (firstDiv) {
        const directChildren = Array.from(firstDiv.children);
        const h1 = directChildren.find((el) => el.tagName === 'H1');
        const introP = h1 ? directChildren.find((el) => el.tagName === 'P') : null;

        if (h1 && introP && !firstDiv.querySelector(':scope > .vmss-page-intro')) {
          const introWrap = document.createElement('div');
          introWrap.className = 'vmss-page-intro reveal-item';
          firstDiv.insertBefore(introWrap, h1);
          introWrap.appendChild(h1);
          introWrap.appendChild(introP);
        }
      }
    });

    document.querySelectorAll('.prose').forEach((el) => {
      el.classList.add('vmss-prose', 'vmss-panel');
      el.classList.remove('prose-invert');
    });

    document.querySelectorAll('.layer-card, .sad-card').forEach((el) => {
      el.classList.add('vmss-enhanced-card', 'reveal-item');
    });

    document
      .querySelectorAll('section .vmss-enhanced-panel-candidate, section [data-vmss-panel]')
      .forEach((el) => {
        el.classList.add('vmss-enhanced-panel', 'reveal-item');
      });
  }

  /**
   * initReveal — scroll-triggered fade-in for elements with .reveal-item.
   *
   * Uses IntersectionObserver (threshold 0.01, -5% bottom rootMargin) so
   * elements animate in slightly before they fully enter the viewport.
   * Falls back to immediate visibility if IntersectionObserver isn't available.
   *
   * Safety timeout at 1400ms reveals anything still hidden after the
   * navbar/footer fetch settles, preventing content from getting stuck
   * invisible if the fetch is slow.
   */
  function initReveal() {
    const items = document.querySelectorAll('.reveal-item');
    if (!items.length) return;

    if (!('IntersectionObserver' in window)) {
      items.forEach((item) => item.classList.add('is-visible'));
      return;
    }

    const seen = new WeakSet();
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if ((entry.isIntersecting || entry.intersectionRatio > 0) && !seen.has(entry.target)) {
            seen.add(entry.target);
            entry.target.classList.add('is-visible');
            observer.unobserve(entry.target);
          }
        });
      },
      {
        threshold: 0.01,
        rootMargin: '0px 0px -5% 0px'
      }
    );

    items.forEach((item) => observer.observe(item));

    /* Safety fallback — reveal anything still hidden after nav/footer load settles */
    setTimeout(() => {
      items.forEach((item) => {
        if (!seen.has(item)) item.classList.add('is-visible');
      });
    }, 1400);
  }

  /**
   * Fetch navbar.html and footer.html in parallel, inject them into their
   * placeholder divs, then initialise all features that depend on the navbar
   * being in the DOM (theme toggle, mobile menu, active nav, HUD, etc.).
   *
   * All nav-dependent inits are wrapped in requestAnimationFrame so the
   * browser has completed layout before we query injected elements.
   */
  Promise.all([
    fetch('navbar.html').then((r) => r.text()).catch(() => '<!-- Navbar fetch failed -->'),
    fetch('footer.html').then((r) => r.text()).catch(() => '<!-- Footer fetch failed -->')
  ])
    .then(([navbarHtml, footerHtml]) => {
      const navPlaceholder = document.getElementById('navbar-placeholder');
      const footerPlaceholder = document.getElementById('footer-placeholder');

      if (navPlaceholder) navPlaceholder.innerHTML = navbarHtml;
      if (footerPlaceholder) footerPlaceholder.innerHTML = footerHtml;

      requestAnimationFrame(() => {
        initThemeToggle();
        initMobileMenu();
        initActiveNav();
        initVmssHud();
        initVmssLayerEcho();
        initVmssLayerLinks();
        initJoinModal();

        if (document.getElementById('applicant-count')) {
          loadApplicantCount();
        }

        if (document.getElementById('recent-applicants')) {
          loadRecentApplicants();
        }
      });
    })
    .catch((err) => console.error('Failed to load layout components:', err));

  enhancePageLayout();
  initBackArrows();
  initReveal();
});
