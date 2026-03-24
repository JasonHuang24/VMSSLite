/**
 * sti-sim.js — STI Simulation Console
 *
 * Powers the interactive Social Trust Index console on simulations.html.
 * Users can adjust seven civic factor sliders, trigger discrete events,
 * load preset profiles, or randomize to explore how scores and layer
 * placements change under the VMSS scoring model.
 *
 * Architecture:
 *   - Pure helper functions (layerForScore, scoreModel, etc.) at the top
 *   - buildRandomProfile() is isolated for clarity — it has non-trivial math
 *   - initSimulator() handles all DOM binding and the render cycle
 *   - All state changes are pushed to window.VMSS so the HUD and ring map stay in sync
 *
 * Score model: civic + contribution + conduct + competence + endorsement + recovery - violations
 * Max possible score: 100 (all positive factors maxed, violations = 0)
 */

(function () {

  // =========================
  // CONSTANTS
  // =========================

  /** Preset citizen profiles used by the sample profile buttons. */
  const PROFILES = {
    contributor: { civic:18, contribution:19, conduct:18, competence:17, endorsement:9, violations:2, recovery:8 },
    stable:      { civic:14, contribution:13, conduct:12, competence:10, endorsement:7, violations:5, recovery:4 },
    risk:        { civic:8,  contribution:6,  conduct:5,  competence:7,  endorsement:3, violations:15, recovery:1 },
    recovery:    { civic:10, contribution:9,  conduct:9,  competence:8,  endorsement:5, violations:10, recovery:9 }
  };

  /**
   * Factor metadata: [display label, max value].
   * Key order mirrors scoreModel addition/subtraction: positives first, violations last.
   * CATEGORY_META is the single source of truth for factor maxes —
   * the randomizer derives its constraints from here rather than hardcoding them.
   */
  const CATEGORY_META = {
    civic:        ['Civic compliance',    20],
    contribution: ['Contribution',        20],
    conduct:      ['Public conduct',      20],
    competence:   ['Verified competence', 20],
    endorsement:  ['Peer trust',          10],
    recovery:     ['Recovery modifier',   10],
    violations:   ['Violation load',      20],
  };

  /** Discrete civic events that apply deltas to the current factor values. */
  const EVENT_DELTAS = {
    violation:   { label: 'Compliance violation logged',     values: { violations: +5, conduct: -2, civic: -3 } },
    service:     { label: 'Civic service completed',         values: { contribution: +4, civic: +2, endorsement: +1 } },
    endorsement: { label: 'Peer endorsement registered',     values: { endorsement: +3, conduct: +1 } },
    audit:       { label: 'Compliance audit failed',         values: { civic: -4, competence: -1, violations: +3 } },
    rehab:       { label: 'Rehabilitation period completed', values: { recovery: +4, violations: -2, conduct: +2 } }
  };

  /**
   * Thresholds for the "coherence" readout.
   * Positive pressure = civic + contribution + conduct (the three behavioural pillars).
   * Named constants avoid magic numbers scattered through the render function.
   */
  const COHERENCE_HIGH = 40;
  const COHERENCE_MID  = 28;

  /**
   * Positive factor keys and maxes derived from CATEGORY_META.
   * Used by buildRandomProfile — if maxes change in CATEGORY_META,
   * the randomizer automatically picks up the new values.
   */
  const POS_FACTORS = Object.entries(CATEGORY_META)
    .filter(([key]) => key !== 'violations')
    .map(([key, [, max]]) => [key, max]);

  /**
   * Event sources that originate from within this module.
   * The global state-change listener ignores these to prevent re-entry
   * loops where a render triggers a state change that triggers another render.
   */
  const INTERNAL_SOURCES = new Set(['sti-sim', 'sti-event', 'profile', 'manual', 'reset', 'randomize']);

  // =========================
  // PURE HELPERS
  // =========================

  /**
   * Maps a numeric STI score to its layer descriptor.
   * Returns key, label, tone, and range string.
   * Note: this duplicates the threshold logic in vmssLayerForScore (script.js)
   * but returns a richer object with .tone — used only by this module.
   */
  function layerForScore(score) {
    if (score >= 85) return { key: '+1', label: '+1 Sanctuary',      tone: 'High-trust access unlocked',     range: '85\u2013100' };
    if (score >= 70) return { key: '0',  label: 'Main Layer (0)',    tone: 'Stable civic baseline',          range: '70\u201384'  };
    if (score >= 50) return { key: '-1', label: '-1 Noncompliance',  tone: 'Monitored trust deficit',        range: '50\u201369'  };
    if (score >= 30) return { key: '-2', label: '-2 Violent Offense',tone: 'Containment threshold engaged',  range: '30\u201349'  };
    return             { key: '-3', label: '-3 Terminal',             tone: 'Terminal trust collapse',        range: '0\u201329'   };
  }

  /** Computes the STI score from a values object. Clamped to [0, 100]. */
  function scoreModel(v) {
    return Math.max(0, Math.min(100,
      v.civic + v.contribution + v.conduct + v.competence + v.endorsement + v.recovery - v.violations
    ));
  }

  /** Clamps all factor values to their valid ranges as defined in CATEGORY_META. */
  function clampValues(v) {
    const next = { ...v };
    Object.entries(CATEGORY_META).forEach(([key, [, max]]) => {
      next[key] = Math.max(0, Math.min(max, Number(next[key]) || 0));
    });
    return next;
  }

  /**
   * Generates up to 3 human-readable signal lines for the System Interpretation panel.
   * Prioritises the most recent event label, then checks for notable factor patterns.
   */
  function buildExplanation(score, values, eventLabel) {
    const notes = [];
    if (eventLabel) notes.push(eventLabel + '.');
    if (values.violations >= 14)                              notes.push('Heavy violation load is overpowering positive inputs.');
    if (values.civic >= 15 && values.conduct >= 12)           notes.push('Compliance and public conduct are stabilizing the score.');
    if (values.recovery >= 7 && values.violations >= 8)       notes.push('Recovery signals soften the descent but do not erase prior harm.');
    if (values.contribution >= 16 && values.competence >= 12) notes.push('Productive contribution is boosting access and system confidence.');
    if (score < 50)                                           notes.push('This subject is operating below ordinary civic trust and faces containment pressure.');
    if (!notes.length)                                        notes.push('This profile sits near the middle because strengths and liabilities are balancing out.');
    return notes.slice(0, 3);
  }

  /** Builds the event feed message describing the most recent score change. */
  function buildDeltaMessage(previousScore, nextScore, layer, eventLabel) {
    const delta     = nextScore - previousScore;
    const direction = delta > 0 ? 'rose' : delta < 0 ? 'fell' : 'held steady';
    const amount    = delta === 0 ? '' : ` by ${Math.abs(delta)} points`;
    const cause     = eventLabel ? ` after ${eventLabel.toLowerCase()}` : '';
    return `STI ${direction}${amount}${cause}. Current placement: ${layer.label}.`;
  }

  /** Briefly flashes an element using the vmss-flash CSS animation. */
  function pulseElement(element) {
    if (!element) return;
    element.classList.remove('vmss-flash');
    void element.offsetWidth; // force reflow to restart the animation
    element.classList.add('vmss-flash');
    setTimeout(() => element.classList.remove('vmss-flash'), 520);
  }

  // =========================
  // RANDOMIZER
  // =========================

  /**
   * Generates a random factor profile with a layer distribution proportional
   * to each band's STI width:
   *   ~30% in -3 Terminal     (0–29,  30-point band)
   *   ~20% in -2 Violent      (30–49, 20-point band)
   *   ~20% in -1 Noncompliance(50–69, 20-point band)
   *   ~15% in Main Layer (0)  (70–84, 15-point band)
   *   ~15% in +1 Sanctuary    (85–100,16-point band)
   *
   * Algorithm (score-first):
   *   1. Pick a target score uniformly from 0–100.
   *   2. Pick violations randomly within the range that allows hitting that score.
   *   3. Fill positive factors to sum to (target + violations), respecting each max.
   *
   * This guarantees the target score is always achievable given the generated
   * violations value, unlike naive uniform random which clusters around score ~40
   * and makes Sanctuary nearly unreachable.
   */
  function buildRandomProfile() {
    const target  = Math.floor(Math.random() * 101);
    const violMax = Math.min(20, 100 - target); // violations can't push score below 0
    const viol    = Math.floor(Math.random() * (violMax + 1));

    // Distribute (target + violations) across positive factors
    const next = {};
    let remaining = Math.min(target + viol, 100);

    POS_FACTORS.forEach(([key, max], i) => {
      // futureMax: maximum the remaining factors could absorb
      const futureMax = POS_FACTORS.slice(i + 1).reduce((s, [, m]) => s + m, 0);
      // lo: minimum this factor must take so remaining factors can cover the rest
      const lo  = Math.max(0, remaining - futureMax);
      const hi  = Math.min(max, remaining);
      const val = lo >= hi ? lo : lo + Math.floor(Math.random() * (hi - lo + 1));
      next[key] = val;
      remaining -= val;
    });

    next.violations = viol;
    return next;
  }

  // =========================
  // SIMULATOR INIT
  // =========================

  function initSimulator() {
    const root = document.getElementById('sti-console');
    if (!root) return; // console not present on this page

    // --- DOM refs --------------------------------------------------------
    const inputs       = Array.from(root.querySelectorAll('input[type="range"]'));
    const scoreEl      = root.querySelector('[data-sti-score]');
    const layerEl      = root.querySelector('[data-sti-layer]');
    const toneEl       = root.querySelector('[data-sti-tone]');
    const reasoningEl  = root.querySelector('[data-sti-reasoning]');
    const liveRegion   = root.querySelector('[data-sti-live]');    // aria-live region for screen readers
    const gauge        = root.querySelector('[data-gauge-progress]');
    const layerSteps   = Array.from(root.querySelectorAll('.vmss-ladder-step'));
    const bars         = Array.from(root.querySelectorAll('.vmss-breakdown-bar'));
    const buttons      = Array.from(root.querySelectorAll('[data-profile]'));
    const resetBtn     = root.querySelector('[data-reset-sim]');
    const profileName  = root.querySelector('[data-profile-name]');
    const overallShift = root.querySelector('[data-overall-shift]');
    const stability    = root.querySelector('[data-stability-band]');
    const eventButtons = Array.from(root.querySelectorAll('[data-sti-event]'));
    const eventFeed    = root.querySelector('[data-event-feed]');
    const randomizeBtn = root.querySelector('[data-randomize-sim]');

    // SVG gauge setup
    const circumference = 2 * Math.PI * 47; // r=47 as defined in the SVG
    let lastLayerKey      = null; // tracks previous layer to detect transitions
    let currentEventLabel = '';   // label of the most recent event (used in explanations)

    if (gauge) {
      gauge.style.strokeDasharray  = `${circumference}`;
      gauge.style.strokeDashoffset = `${circumference}`; // starts at 0 (full circle hidden)
    }

    // --- Input helpers ---------------------------------------------------

    /** Read all slider values into a plain object keyed by input name. */
    const getValues = () =>
      inputs.reduce((acc, input) => (acc[input.name] = Number(input.value), acc), {});

    /** Write a values object back to the sliders. */
    const setValues = (values) =>
      inputs.forEach((input) => {
        if (values[input.name] !== undefined) input.value = String(values[input.name]);
      });

    /** Update the numeric readout labels next to each slider. */
    const setInputVisuals = () =>
      inputs.forEach((input) => {
        const el = root.querySelector(`[data-value-for="${input.name}"]`);
        if (el) el.textContent = input.value;
        // Keep aria-valuetext in sync so screen readers announce the human-readable value
        const suffix = input.name === 'violations' ? ' out of 20 deducted'
                     : ` out of ${input.max}`;
        input.setAttribute('aria-valuetext', `${input.value}${suffix}`);
      });

    // --- Render cycle ----------------------------------------------------

    /**
     * render(sourceLabel, options) — the main update function.
     * Reads current slider values, computes the score, and updates every
     * visual element in the console: gauge, score number, layer label, tone,
     * factor bars, readout tiles, ladder steps, reasoning panel, event feed,
     * and the aria-live region for screen readers.
     *
     * @param {string} sourceLabel - Profile name shown in the readout tile
     * @param {object} options     - { source } passed through to VMSS.setState
     */
    const render = (sourceLabel, options = {}) => {
      const values        = clampValues(getValues());
      setValues(values);
      setInputVisuals();

      const score         = scoreModel(values);
      const layer         = layerForScore(score);
      const dashoffset    = circumference - (score / 100) * circumference;
      const posPressure   = values.civic + values.contribution + values.conduct;

      // Read previous score from the element's data attribute (set by vmssAnimateNumber)
      // so delta calculations survive across multiple renders
      const previousScore = Number(scoreEl?.dataset.currentValue) || score;

      // Score number — animated if vmssAnimateNumber is available
      if (scoreEl) window.vmssAnimateNumber
        ? window.vmssAnimateNumber(scoreEl, score, { duration: 460 })
        : (scoreEl.textContent = score);

      if (layerEl)      layerEl.textContent     = layer.label;
      if (toneEl)       toneEl.textContent       = `${layer.tone} \u2022 STI band ${layer.range}`;
      if (profileName)  profileName.textContent  = sourceLabel || 'Custom profile';
      if (overallShift) overallShift.textContent = score >= 70 ? 'Upward pressure' : score >= 50 ? 'Friction zone' : 'Downward pressure';
      if (stability)    stability.textContent    = posPressure >= COHERENCE_HIGH ? 'High coherence' : posPressure >= COHERENCE_MID ? 'Mixed coherence' : 'Low coherence';

      // SVG gauge arc
      if (gauge) {
        gauge.style.strokeDashoffset = `${dashoffset}`;
        gauge.classList.toggle('is-strong', score >= 70); // stronger glow above Main Layer
      }

      // Highlight the current layer in the ladder
      layerSteps.forEach((step) =>
        step.classList.toggle('is-current', step.dataset.layer === layer.key)
      );

      // Factor breakdown bars
      if (reasoningEl) {
        reasoningEl.innerHTML = buildExplanation(score, values, currentEventLabel)
          .map((line) => `<div class="vmss-insight-item"><strong>Signal:</strong> ${line}</div>`)
          .join('');
      }

      bars.forEach((bar) => {
        const key   = bar.dataset.metric;
        const max   = CATEGORY_META[key][1];
        const value = values[key];
        const fill  = bar.querySelector('.bar-fill');
        const num   = bar.querySelector('.bar-number');
        if (fill) fill.style.width = `${(value / max) * 100}%`;
        // violations displayed as negative contribution
        if (num)  num.textContent  = key === 'violations' ? `-${value}` : `+${value}`;
      });

      // Event feed and aria-live announcement
      const layerChanged = lastLayerKey && lastLayerKey !== layer.key;
      const feedMsg = layerChanged
        ? `Layer transition: ${layer.label}`
        : buildDeltaMessage(previousScore, score, layer, currentEventLabel);

      if (eventFeed)  eventFeed.textContent  = feedMsg;
      if (liveRegion) liveRegion.textContent = layerChanged
        ? `Layer transition: now in ${layer.label}. STI ${score}.`
        : `STI ${score}. ${layer.label}.`;

      // Flash score card on layer transition
      if (layerChanged) pulseElement(root.querySelector('.vmss-score-card'));
      lastLayerKey = layer.key;

      // Push to global VMSS state so HUD and ring map stay in sync
      if (window.VMSS) {
        window.VMSS.setState({
          stiScore:      score,
          selectedLayer: layer.key,
          profile:       sourceLabel || 'Custom profile',
          tone:          layer.tone,
          lastEvent:     currentEventLabel || 'Manual slider adjustment',
          values
        }, { source: options.source || 'sti-sim' });
      }
    };

    // --- Event actions ---------------------------------------------------

    /** Applies a discrete EVENT_DELTAS entry to the current values and re-renders. */
    const applyEvent = (eventKey) => {
      const event = EVENT_DELTAS[eventKey];
      if (!event) return;
      const values = getValues();
      const next   = clampValues(
        Object.fromEntries(Object.keys(values).map((key) => [key, values[key] + (event.values[key] || 0)]))
      );
      setValues(next);
      currentEventLabel = event.label;
      buttons.forEach((btn) => btn.classList.remove('is-active'));
      render('Event-driven profile', { source: 'sti-event' });
    };

    /**
     * Generates a random profile via buildRandomProfile() and renders it.
     * The aria-live announcement uses the pre-computed score rather than
     * reading scoreEl.textContent, which still shows the previous value
     * while the number animation is in flight.
     */
    const randomize = () => {
      const next = buildRandomProfile();
      setValues(next);
      buttons.forEach((btn) => btn.classList.remove('is-active'));
      currentEventLabel = 'Random profile generated';
      const computedScore = scoreModel(next);
      const computedLayer = layerForScore(computedScore);
      render('Random profile', { source: 'randomize' });
      if (liveRegion) liveRegion.textContent =
        `Random profile generated. STI score ${computedScore}, placing in ${computedLayer.label}.`;
    };

    /** Resets all sliders to the balanced baseline defaults. */
    const resetToDefaults = () => {
      const defaults = { civic:11, contribution:11, conduct:8, competence:8, endorsement:6, recovery:5, violations:6 };
      setValues(defaults);
      buttons.forEach((btn) => btn.classList.remove('is-active'));
      currentEventLabel = 'Baseline loaded';
      render('Balanced baseline', { source: 'reset' });
    };

    // --- Bind listeners --------------------------------------------------

    if (randomizeBtn) randomizeBtn.addEventListener('click', randomize);
    if (resetBtn)     resetBtn.addEventListener('click', resetToDefaults);

    // Sample profile buttons
    buttons.forEach((button) => button.addEventListener('click', () => {
      const profile = PROFILES[button.dataset.profile];
      if (!profile) return;
      buttons.forEach((btn) => btn.classList.remove('is-active'));
      button.classList.add('is-active');
      currentEventLabel = 'Profile selected';
      setValues(profile);
      render(button.textContent.trim(), { source: 'profile' });
    }));

    // Discrete event buttons
    eventButtons.forEach((button) =>
      button.addEventListener('click', () => applyEvent(button.dataset.stiEvent))
    );

    // Manual slider adjustments
    inputs.forEach((input) => input.addEventListener('input', () => {
      buttons.forEach((btn) => btn.classList.remove('is-active'));
      currentEventLabel = 'Manual factor adjustment';
      render('Custom profile', { source: 'manual' });
    }));

    // Respond to external state changes (e.g. ring map changing the selected layer)
    // Ignore events originating from within this module to prevent feedback loops
    document.addEventListener('vmss:state-change', (event) => {
      const source = event.detail?.meta?.source;
      const state  = event.detail?.state;
      if (!state || INTERNAL_SOURCES.has(source)) return;
      if (state.values) setValues(state.values);
      currentEventLabel = state.lastEvent || currentEventLabel;
      render(state.profile || 'Synced profile', { source: 'external-sync' });
    });

    // --- Initial render --------------------------------------------------

    // Restore from global state if it exists (e.g. user visited simulation before)
    const initial = window.VMSS?.getState?.();
    if (initial?.values) setValues(initial.values);
    currentEventLabel = initial?.lastEvent || 'Baseline loaded';
    render(initial?.profile || 'Balanced baseline', { source: 'initial' });
  }

  document.addEventListener('DOMContentLoaded', initSimulator);

})();
