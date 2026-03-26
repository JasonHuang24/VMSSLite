/**
 * diagrams.js — Interactive Five Rings layer map
 *
 * Manages the SVG ring diagram on layers.html.
 * Clicking a ring updates the detail panel, highlights the
 * corresponding layer card below, and syncs the global VMSS state
 * so the HUD and other pages reflect the selection.
 *
 * Keyboard: Tab to focus rings, Enter/Space to select.
 * Mouse: click to select; hover gives a visual preview without committing.
 */

(function () {

  // =========================
  // LAYER DATA
  // =========================

  /**
   * Static metadata for each of the five rings.
   * ariaDesc is used for the aria-label on the SVG node — kept
   * separate from label/summary so the screen reader gets a concise
   * description rather than the full panel summary.
   */
  const LAYER_DATA = {
    '+1': {
      label:    '+1 Sanctuary',
      range:    'STI 85\u2013100',
      summary:  'The highest-trust ring. Pre-intervention safety, elite access, and the most selective civic privileges exist here.',
      rights:   'Maximum autonomy, highest safety, premium domains',
      doctrine: 'Trust is preserved before harm completes.',
      risk:     'Loss of access is immediate once severe trust is broken.',
      ariaDesc: 'Highest-trust ring. Pre-intervention safety and maximum civic privileges.',
      href:     'layer-+1.html'
    },
    '0': {
      label:    'Main Layer (0)',
      range:    'STI 70\u201384',
      summary:  'Baseline civilization. Full life remains available, but intervention happens after harm rather than before it.',
      rights:   'Work, family, trade, ordinary civic life',
      doctrine: 'The proving ground where moral causality remains visible.',
      risk:     'Repeated trust failures push citizens downward.',
      ariaDesc: 'The proving ground. Full life and agency, with post-intervention enforcement.',
      href:     'layer-0.html'
    },
    '-1': {
      label:    '-1 Noncompliance',
      range:    'STI 50\u201369',
      summary:  'A lower-trust stratum for non-trivial but non-predatory violations. Material life remains stable, but status and access contract. A growing private sector and mixed population give the layer its own commercial culture.',
      rights:   'Restricted status, reduced access, active private economy',
      doctrine: 'Consequences remain permanent without collapsing civilization into chaos.',
      risk:     'Continued disregard for norms escalates toward containment.',
      ariaDesc: 'Reduced privilege after lower-harm breach. Active private economy and mixed community.',
      href:     'layer--1.html'
    },
    '-2': {
      label:    '-2 Violent Offense',
      range:    'STI 30\u201349',
      summary:  'The severe-harm tier. Institutional mediation is largely absent, replaced by private security, voluntary-resident districts, and a self-organising economy.',
      rights:   'Reduced institutional presence, predominantly private economy',
      doctrine: 'Society protects the innocent first by separating high-risk actors.',
      risk:     'Violence and coercion move citizens out of ordinary civic space.',
      ariaDesc: 'Severe harm tier with reduced institutional presence and predominantly private economy.',
      href:     'layer--2.html'
    },
    '-3': {
      label:    '-3 Terminal',
      range:    'STI 0\u201329',
      summary:  'The terminal layer. Minimal institutional presence, no revival, and maximum personal autonomy. A meaningful voluntary population chose -3 for its libertarian character.',
      rights:   'Minimal institutional presence; voluntary community and frontier economy',
      doctrine: 'Terminal harm yields terminal placement.',
      risk:     'No upward restoration into high-trust life.',
      ariaDesc: 'Terminal layer. Minimal institutional presence, voluntary community, and frontier economy.',
      href:     'layer--3.html'
    }
  };

  // =========================
  // INIT
  // =========================

  function initDiagram() {
    const root = document.querySelector('[data-vmss-diagram]');
    if (!root) return; // diagram not present on this page

    // SVG ring nodes (the clickable <g> elements)
    const nodes = Array.from(root.querySelectorAll('.vmss-ring-node'));

    // Layer cards below the diagram — synced to highlight the active ring
    const cards = Array.from(document.querySelectorAll('.layer-card[data-layer]'));

    // Detail panel elements — updated on ring selection
    const title    = document.getElementById('vmss-layer-title');
    const range    = document.getElementById('vmss-layer-range');
    const summary  = document.getElementById('vmss-layer-summary');
    const rights   = document.getElementById('vmss-layer-rights');
    const doctrine = document.getElementById('vmss-layer-doctrine');
    const risk     = document.getElementById('vmss-layer-risk');
    const openLink = document.getElementById('vmss-layer-link');

    // Start from whatever layer is already in global state (persists across pages)
    let activeLayer = (window.VMSS && window.VMSS.getState().selectedLayer) || '+1';

    /**
     * sync(layer) — the central update function.
     * Updates the SVG ring states, detail panel text, layer card highlights,
     * and global VMSS state all in one call.
     */
    const sync = (layer) => {
      activeLayer = layer;
      const info = LAYER_DATA[layer];
      if (!info) return;

      // Update each ring node's visual state and accessibility attributes
      nodes.forEach((node) => {
        const isActive = node.dataset.layer === layer;
        const nodeInfo = LAYER_DATA[node.dataset.layer];

        node.classList.toggle('is-active', isActive);
        node.classList.toggle('is-dimmed', !isActive);
        node.setAttribute('aria-pressed', isActive ? 'true' : 'false');

        // aria-label is derived from LAYER_DATA.ariaDesc — single source of truth
        if (nodeInfo) {
          const base = `${nodeInfo.label}: ${nodeInfo.ariaDesc}`;
          node.setAttribute('aria-label', isActive ? `Selected: ${base}` : base);
        }
      });

      // Flash the matching layer card to signal the sync
      cards.forEach((card) => {
        const active = card.dataset.layer === layer;
        card.classList.toggle('is-linked-active', active);
        if (active) {
          card.classList.remove('vmss-flash');
          void card.offsetWidth; // force reflow to restart animation
          card.classList.add('vmss-flash');
          setTimeout(() => card.classList.remove('vmss-flash'), 520);
        }
      });

      // Populate the detail panel
      if (title)    title.textContent              = info.label;
      if (range)    range.textContent              = info.range;
      if (summary)  summary.textContent            = info.summary;
      if (rights)   rights.textContent             = info.rights;
      if (doctrine) doctrine.textContent           = info.doctrine;
      if (risk)     risk.textContent               = info.risk;
      if (openLink) openLink.setAttribute('href', info.href);

      // Push to global state so HUD and other components stay in sync
      if (window.VMSS) {
        window.VMSS.setState(
          { selectedLayer: layer, lastEvent: `Focused ${info.label}` },
          { source: 'diagram' } // source tag prevents feedback loop from state-change listener
        );
      }
    };

    // =========================
    // EVENT LISTENERS
    // =========================

    nodes.forEach((node) => {
      // Click: select ring, then blur to prevent the browser's default
      // rectangular focus outline from appearing on SVG <g> elements
      node.addEventListener('click', (e) => { sync(node.dataset.layer); e.currentTarget.blur(); });

      // Focus (keyboard Tab): select the focused ring
      node.addEventListener('focus', () => sync(node.dataset.layer));

      // Keyboard activation: Enter and Space trigger selection
      node.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); sync(node.dataset.layer); }
      });
    });

    // Layer cards below the diagram can also drive selection on click/focus
    cards.forEach((card) =>
      ['click', 'focus'].forEach((evt) => card.addEventListener(evt, () => sync(card.dataset.layer)))
    );

    // Listen for external state changes (e.g. STI console changing the selected layer)
    // Ignore events that originated from this module to avoid feedback loops
    document.addEventListener('vmss:state-change', (event) => {
      const state  = event.detail?.state;
      const source = event.detail?.meta?.source;
      if (!state || source === 'diagram') return;
      if (state.selectedLayer && state.selectedLayer !== activeLayer) {
        sync(state.selectedLayer);
      }
    });

    // Initial render
    sync(activeLayer);
  }

  document.addEventListener('DOMContentLoaded', initDiagram);

})();
