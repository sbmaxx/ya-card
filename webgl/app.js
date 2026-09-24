import { CardRenderer } from './renderer.js';

(async () => {
    'use strict';
    const root = document.documentElement;
    const scene = document.querySelector('.scene');
    const canvas = document.querySelector('#card-canvas');
    const ambient = document.querySelector('.ambient');
    const shadow = document.querySelector('.card-shadow polygon');
    const shadowDensity = document.querySelector('#shadow-density');
    const shadowFilter = document.querySelector('#shadow-soften');
    let renderer = null;
    let contextLost = false;
    let previousTime = performance.now();
    let lastDraw = 0;
    const faces = [...document.querySelectorAll('.face')];
    const languageLinks = [...document.querySelectorAll('[data-lang]')];
    const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
    const finePointer = matchMedia('(hover: hover) and (pointer: fine)');
    const pointers = new Map();
    let lang = 'ru';
    let zoom = 1;
    let rx = 0;
    let ry = 0;
    let rz = 0;
    let frame = 0;
    let gesture = null;
    let suppressClick = false;
    let pendingClick = null;
    let bounds = null;
    let lastPointerMove = 0;
    let baseRx = 0, baseRy = 0, baseRz = 0;
    let hoverRx = 0, hoverRy = 0, hoverRz = 0;
    let hoverAnchor = null;
    let focusedAnchor = null;
    let pointerOverLink = false;
    let focusRect = null;
    let userControlled = false;
    let flipLocked = false;
    let motionSettling = false;
    const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
    const sceneLabels = {
        ru: 'Визитная карточка. Enter — переворот, стрелки — наклон, плюс и минус — масштаб, Escape — сброс.',
        en: 'Business card. Enter to flip, arrows to tilt, plus and minus to zoom, Escape to reset.'
    };

    function setLanguage(next, announce = true) {
        const nextLang = next === 'en' ? 'en' : 'ru';
        if (nextLang !== lang && renderer && !reducedMotion.matches) flipLocked = true;
        if (nextLang !== lang) lastPointerMove = performance.now();
        lang = nextLang;
        const active = faces.find(face => face.lang === lang);
        // Do not leave keyboard focus on the now-hidden side.
        if (faces.some(face => face !== active && face.contains(document.activeElement))) scene.focus({ preventScroll: true });
        faces.forEach(face => {
            const inactive = face !== active;
            face.querySelectorAll('a').forEach(link => {
                if (inactive) link.tabIndex = -1;
                else link.removeAttribute('tabindex');
            });
            face.setAttribute('aria-hidden', String(inactive));
            face.toggleAttribute('inert', inactive);
        });
        if (focusedAnchor && !active.contains(focusedAnchor)) {
            focusedAnchor = null;
            focusRect = null;
        }
        if (root.classList.contains('webgl-fallback')) {
            active.hidden = false;
            faces.filter(face => face !== active).forEach(face => { face.hidden = true; });
        } else faces.forEach(face => { face.hidden = false; });
        schedule();
        languageLinks.forEach(link => {
            if (link.dataset.lang === lang) link.setAttribute('aria-current', 'true');
            else link.removeAttribute('aria-current');
        });
        root.lang = lang;
        const favicon = document.getElementById('favicon');
        favicon.href = favicon.dataset[lang];
        document.title = active.querySelector('h1').textContent;
        scene.setAttribute('aria-label', sceneLabels[lang]);
        if (announce) document.querySelector('#announcement').textContent = lang === 'ru' ? 'Русская сторона' : 'English side';
        schedule();
    }

    function navigate(next) {
        if (next === lang) return;
        history.pushState(null, '', `#${next}`);
        setLanguage(next);
    }
    const flip = () => navigate(lang === 'ru' ? 'en' : 'ru');
    languageLinks.forEach(link => link.addEventListener('click', event => {
        event.preventDefault();
        navigate(link.dataset.lang);
    }));
    window.addEventListener('hashchange', () => setLanguage(location.hash === '#en' ? 'en' : 'ru'));
    window.addEventListener('popstate', () => setLanguage(location.hash === '#en' ? 'en' : 'ru'));

    // Native WebGL: 3 draw calls, capped to 30 fps at rest, 60 fps during interaction.
    // Reduced-motion scenes stop requesting frames once the flip settles.
    function render(now = performance.now()) {
        frame = 0;
        if (!renderer || contextLost || document.hidden) return;
        const animate = !reducedMotion.matches;
        const interacting = gesture || renderer.flipProgress < 1 || motionSettling || renderer.wantsHighFrameRate || now - lastPointerMove < 500;
        const interval = interacting ? 1000 / 60 : 1000 / 30;
        if (now - lastDraw < interval - 1) { schedule(); return; }
        const delta = Math.max(.001, (now - previousTime) / 1000);
        previousTime = now;
        lastDraw = now;
        // Hold a hovered link long enough to click, then let a parked mouse
        // return to idle motion. Keyboard focus keeps a stable target.
        const poseHeld = Boolean(focusedAnchor || (pointerOverLink && now - lastPointerMove < 1800));
        const idle = !gesture && !flipLocked && !poseHeld && (!userControlled || now - lastPointerMove > 1400);
        const settling = renderer.draw({ rx, ry, rz, zoom, dragging: Boolean(gesture), flipped: lang === 'en', animate, idle, freezeTilt: flipLocked || poseHeld, freezeHover: flipLocked, focusLink: focusRect, reduced: reducedMotion.matches, delta });
        motionSettling = settling && userControlled && !idle;
        const overCard = renderer.hoverPointer && renderer.surfacePoint(renderer.hoverPointer.x, renderer.hoverPointer.y);
        canvas.style.cursor = gesture ? 'grabbing' : renderer.hoveredLink ? 'pointer' : overCard ? 'grab' : 'default';
        syncAmbient();
        if (flipLocked && renderer.flipProgress === 1) {
            flipLocked = false;
            applyHover();
        }
        if (animate || settling) schedule();
    }
    function syncAmbient() {
        ambient.style.setProperty('--ambient-opacity', renderer.ambientOpacity.toFixed(4));
        if (renderer.ambientShift) {
            ambient.style.setProperty('--ambient-x', `${renderer.ambientShift[0].toFixed(3)}vw`);
            ambient.style.setProperty('--ambient-y', `${renderer.ambientShift[1].toFixed(3)}vh`);
        }
        if (renderer.shadowPoints) shadow.setAttribute('points', renderer.shadowPoints);
        if (renderer.shadowGradient) {
            ['x1', 'y1', 'x2', 'y2'].forEach((name, i) => shadowDensity.setAttribute(name, renderer.shadowGradient[i].toFixed(2)));
            shadowDensity.children[0].setAttribute('stop-opacity', renderer.shadowGradient[4].toFixed(4));
            shadowDensity.children[1].setAttribute('stop-opacity', renderer.shadowGradient[5].toFixed(4));
            ['x', 'y', 'width', 'height'].forEach((name, i) => shadowFilter.setAttribute(name, renderer.shadowBounds[i].toFixed(1)));
        }
    }
    function schedule() {
        if (!frame && renderer && !contextLost && !document.hidden) frame = requestAnimationFrame(render);
    }
    function setZoom(value) { lastPointerMove = performance.now(); zoom = clamp(value, 0.5, 2.5); schedule(); }
    function reset() {
        lastPointerMove = performance.now();
        baseRx = baseRy = baseRz = hoverRx = hoverRy = hoverRz = rx = ry = rz = 0;
        hoverAnchor = null;
        userControlled = true;
        zoom = 1;
        schedule();
    }
    scene.addEventListener('wheel', event => {
        // Preserve the browser's own accessibility zoom (Ctrl/Cmd + wheel).
        if (event.ctrlKey || event.metaKey) return;
        if (!renderer || contextLost || !root.classList.contains('webgl-ready')) return;
        event.preventDefault();
        const delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? innerHeight : 1);
        setZoom(zoom - delta * 0.001);
    }, { passive: false });

    const distance = () => {
        const [a, b] = [...pointers.values()];
        return Math.hypot(a.x - b.x, a.y - b.y);
    };
    function hoverTilt(event) {
        bounds ||= scene.getBoundingClientRect();
        const centerX = bounds.left + bounds.width / 2;
        const centerY = bounds.top + bounds.height / 2;
        const x = clamp((event.clientX - centerX) / (bounds.width * .3), -1, 1);
        const y = clamp((event.clientY - centerY) / (bounds.height * .3), -1, 1);
        // A rigid plate: only its orientation changes. The near edge lifts
        // towards the viewer, without translating or deforming its surface.
        hoverRx = -y * 7;
        hoverRy = -x * 9;
        hoverRz = -x * y * .7;
        userControlled = true;
        applyHover();
        lastPointerMove = performance.now();
        schedule();
    }
    function applyHover() {
        if (flipLocked || gesture) return;
        rx = clamp(baseRx + hoverRx, -45, 45);
        ry = clamp(baseRy + hoverRy, -45, 45);
        rz = clamp(baseRz + hoverRz, -3, 3);
    }
    function clearPointerHover() {
        pointerOverLink = false;
        if (renderer) renderer.hoverPointer = null;
        if (!gesture) {
            hoverRx = hoverRy = hoverRz = 0;
            applyHover();
        }
        schedule();
    }
    scene.addEventListener('pointerdown', event => {
        if (event.button !== 0 || event.target.closest('a, button')) return;
        // Capture a gesture on the canvas, leaving HTML links to the browser.
        pendingClick = null;
        if (!renderer || contextLost || !root.classList.contains('webgl-ready') || flipLocked) { suppressClick = true; return; }
        lastPointerMove = performance.now();
        suppressClick = false;
        bounds = scene.getBoundingClientRect();
        pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
        scene.setPointerCapture(event.pointerId);
        if (pointers.size === 1) gesture = {
            x: event.clientX, y: event.clientY,
            rx: (renderer.rotationX - renderer.restPose[0]) * 180 / Math.PI,
            ry: (renderer.rotationY - renderer.restPose[1]) * 180 / Math.PI,
            onCard: Boolean(renderer.surfacePoint(event.clientX, event.clientY)),
            url: renderer.hitTest(event.clientX, event.clientY),
            moved: false, pinch: false
        };
        if (pointers.size === 2) {
            gesture.pinch = true;
            gesture.moved = true;
            gesture.distance = gesture.onCard && renderer.surfacePoint(event.clientX, event.clientY) ? distance() : 0;
            gesture.zoom = zoom;
        }
    });
    scene.addEventListener('pointermove', event => {
        if (!renderer || contextLost || !root.classList.contains('webgl-ready')) return;
        if (pointers.has(event.pointerId)) {
            pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
            if (pointers.size === 2 && gesture.distance > 0) {
                setZoom(gesture.zoom * distance() / gesture.distance);
            } else if (pointers.size === 1 && !gesture.pinch) {
                const dx = event.clientX - gesture.x;
                const dy = event.clientY - gesture.y;
                if (Math.hypot(dx, dy) > 5) gesture.moved = true;
                if (gesture.moved && gesture.onCard) {
                    root.classList.add('is-dragging');
                    userControlled = true;
                    rx = clamp(gesture.rx + dy * 0.22, -40, 40);
                    ry = clamp(gesture.ry + dx * 0.22, -40, 40);
                    schedule();
                }
            }
        }
        canvas.style.cursor = renderer?.hitTest(event.clientX, event.clientY) ? 'pointer'
            : renderer?.surfacePoint(event.clientX, event.clientY) ? 'grab' : 'default';
    });
    // Keep tracking over RU/EN too, so entering an overlay does not reset tilt.
    window.addEventListener('pointermove', event => {
        if (renderer && !contextLost && root.classList.contains('webgl-ready') && event.pointerType === 'mouse') {
            lastPointerMove = performance.now();
            renderer.hoverPointer = scene.contains(event.target) ? { x: event.clientX, y: event.clientY } : null;
            const overLink = finePointer.matches && !reducedMotion.matches
                && Boolean(renderer.linkAt(event.clientX, event.clientY));
            if (overLink !== pointerOverLink) {
                pointerOverLink = overLink;
                // freezeTilt holds the rendered pose; do not bake the current
                // idle angle into the user's base rotation on every hover.
                if (!overLink) { hoverRx = hoverRy = hoverRz = 0; applyHover(); }
            }
            schedule();
        }
        if (renderer && !contextLost && root.classList.contains('webgl-ready') && !gesture && !pointerOverLink && !focusedAnchor
            && event.pointerType === 'mouse' && finePointer.matches && !reducedMotion.matches) hoverTilt(event);
    });
    function updateFocusedAnchor(target) {
        focusedAnchor = target?.closest('.face a') || null;
        focusRect = null;
        if (focusedAnchor && renderer) {
            const face = focusedAnchor.closest('.face');
            const side = faces.indexOf(face);
            const index = [...face.querySelectorAll('a')].filter(link => link.getClientRects().length > 0).indexOf(focusedAnchor);
            const link = renderer.surfaces[side]?.links[index];
            if (link) focusRect = { ...link, side };
        }
        schedule();
    }
    function refreshFocusedAnchor() {
        if (document.activeElement.matches('.face a')) updateFocusedAnchor(document.activeElement);
        else if (focusedAnchor) updateFocusedAnchor(null);
    }
    scene.addEventListener('focusin', event => updateFocusedAnchor(event.target));
    scene.addEventListener('focusout', event => {
        if (event.target === focusedAnchor) {
            focusedAnchor = null;
            focusRect = null;
            schedule();
        }
    });
    function release(event) {
        if (!pointers.has(event.pointerId)) return;
        lastPointerMove = performance.now();
        suppressClick = Boolean(gesture?.moved || event.type !== 'pointerup');
        pointers.delete(event.pointerId);
        if (!pointers.size) {
            const moved = gesture?.moved && gesture.onCard;
            if (!suppressClick) pendingClick = {
                onCard: gesture.onCard, url: gesture.url, time: performance.now()
            };
            gesture = null;
            root.classList.remove('is-dragging');
            if (moved) {
                // Keep the orientation the user chose; subsequent hover is a small offset.
                baseRx = rx; baseRy = ry; baseRz = rz;
                hoverRx = hoverRy = hoverRz = 0;
                hoverAnchor = { x: event.clientX, y: event.clientY };
            }
            schedule();
        }
    }
    scene.addEventListener('pointerup', release);
    scene.addEventListener('pointercancel', release);
    scene.addEventListener('lostpointercapture', release);
    scene.addEventListener('pointerleave', () => {
        bounds = null;
        clearPointerHover();
    });
    document.documentElement.addEventListener('pointerleave', () => {
        clearPointerHover();
    });
    scene.addEventListener('click', event => {
        if (event.target.closest('a, button')) return;
        if (!renderer || contextLost || !root.classList.contains('webgl-ready')) return;
        if (!flipLocked && !suppressClick && !getSelection()?.toString() && renderer?.flipProgress === 1) {
            // Touch click may arrive after the plate has moved. Use the surface
            // picked at pointerdown, rather than re-picking a different pose.
            const tap = pendingClick && event.detail !== 0 && performance.now() - pendingClick.time < 1000 ? pendingClick : null;
            const url = tap ? tap.url : renderer.hitTest(event.clientX, event.clientY);
            const onCard = tap ? tap.onCard : Boolean(renderer.surfacePoint(event.clientX, event.clientY));
            if (url) window.location.href = url;
            else if (onCard) flip();
            else reset();
        }
        pendingClick = null;
        suppressClick = false;
    });
    scene.addEventListener('keydown', event => {
        if (event.target !== scene) return;
        const actions = {
            Enter: flip, ' ': flip, Escape: reset,
            '+': () => setZoom(zoom + 0.1), '=': () => setZoom(zoom + 0.1), '-': () => setZoom(zoom - 0.1),
            ArrowLeft: () => { baseRy = clamp(baseRy - 5, -40, 40); }, ArrowRight: () => { baseRy = clamp(baseRy + 5, -40, 40); },
            ArrowUp: () => { baseRx = clamp(baseRx - 5, -40, 40); }, ArrowDown: () => { baseRx = clamp(baseRx + 5, -40, 40); }
        };
        if (actions[event.key]) { event.preventDefault(); lastPointerMove = performance.now(); userControlled = true; actions[event.key](); applyHover(); schedule(); }
    });
    window.addEventListener('resize', () => {
        bounds = null;
        if (renderer && !contextLost) {
            renderer.resize();
            refreshFocusedAnchor();
            schedule();
        }
    });
    window.addEventListener('blur', () => {
        pendingClick = null;
        pointers.clear(); gesture = null; suppressClick = true;
        root.classList.remove('is-dragging');
        baseRx = rx; baseRy = ry; baseRz = rz; hoverRx = hoverRy = hoverRz = 0;
        pointerOverLink = false;
        if (renderer) renderer.hoverPointer = null;
        schedule();
    });
    document.addEventListener('visibilitychange', () => {
        root.classList.toggle('page-hidden', document.hidden);
        if (document.hidden) { cancelAnimationFrame(frame); frame = 0; }
        else schedule();
        schedule();
    });
    reducedMotion.addEventListener('change', () => { schedule(); });
    scene.tabIndex = 0;
    scene.setAttribute('role', 'group');

    setLanguage(location.hash === '#en' ? 'en' : 'ru', false);
    async function initialize() {
        try {
            renderer = await CardRenderer.create(canvas);
            root.classList.remove('webgl-fallback');
            root.classList.add('webgl-loading');
            canvas.hidden = false;
            renderer.resize();
            refreshFocusedAnchor();
            // Prepare the correct side before exposing the canvas to the first paint.
            renderer.draw({ rx, ry, rz, zoom, flipped: lang === 'en', animate: false, reduced: true, focusLink: focusRect, delta: 1 });
            syncAmbient();
            root.classList.add('webgl-ready');
            root.classList.remove('webgl-loading');
            clearTimeout(window.cardBootTimeout);

            contextLost = false;
            previousTime = performance.now();
            schedule();
        } catch (error) {
            console.warn('WebGL card unavailable; showing HTML contacts.', error);
            showFallback();
        }
    }
    function showFallback() {
        root.classList.remove('webgl-ready', 'webgl-loading');
        root.classList.add('webgl-fallback');
        clearTimeout(window.cardBootTimeout);
        pendingClick = null;
        suppressClick = true;
        gesture = null;
        pointerOverLink = false;
        const capturedPointers = [...pointers.keys()];
        pointers.clear();
        capturedPointers.forEach(pointerId => {
            if (scene.hasPointerCapture(pointerId)) scene.releasePointerCapture(pointerId);
        });
        root.classList.remove('is-dragging');
        faces.forEach(face => { face.hidden = face.lang !== lang; });
        setLanguage(lang, false);
        scene.removeAttribute('tabindex');
    }
    canvas.addEventListener('webglcontextlost', event => {
        event.preventDefault();
        contextLost = true;
        cancelAnimationFrame(frame); frame = 0;
        showFallback();
    });
    canvas.addEventListener('webglcontextrestored', async () => {
        renderer = null;
        await initialize();
        scene.tabIndex = 0;
        setLanguage(lang, false);
        if (document.activeElement.matches('.face a')) updateFocusedAnchor(document.activeElement);
    });
    window.addEventListener('pagehide', event => {
        cancelAnimationFrame(frame); frame = 0;
        if (!event.persisted) renderer?.destroy();
    });
    window.addEventListener('pageshow', event => { if (event.persisted) schedule(); });
    await initialize();
})();
